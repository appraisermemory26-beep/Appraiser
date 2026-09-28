import logging
import os
import secrets

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenBlacklistView, TokenRefreshView

from apps.audit.models import AuditLog
from apps.audit.utils import create_audit_log

from .emails import send_password_reset_email
from .models import User
from .permissions import IsOrganisationMember, IsAdmin, IsManagerOrAbove, IsSelfOrManagerOrAbove
from .serializers import UserSerializer, UserCreateSerializer


logger = logging.getLogger(__name__)


# Fields a non-Manager+ user is NOT allowed to change on their own profile.
SELF_EDIT_PROTECTED_FIELDS = {
    "role", "department", "reports_to", "organisation",
    "succeeded_by", "is_active", "employment_status",
}
MANAGER_PLUS_ROLES = {"MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"}


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation)

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticated(), IsSelfOrManagerOrAbove()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = serializer.save(
            organisation=self.request.user.organisation,
        )

        # If no password was provided, generate a temporary one
        if not self.request.data.get("password"):
            temp_password = secrets.token_urlsafe(12)
            user.set_password(temp_password)
            user.save()

        # Generate password setup token so the invited user can set their own password
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        setup_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        self._setup_url = setup_url
        self._setup_token = token
        self._setup_uid = uid

        instance = user
        AuditLog.objects.create(
            event_type="user_account_created",
            event_category="USER_MANAGEMENT",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"User account created for {instance.first_name} {instance.last_name} ({instance.email}) with role {instance.role}",
            entity_type="user",
            entity_id=instance.id,
            metadata={"email": instance.email, "role": instance.role},
        )

        from apps.notifications.services import notify_managers, notify_user
        notify_user(
            user=instance,
            organisation=self.request.user.organisation,
            notification_type="account_created",
            title="Your Appraiser account is ready",
            message="Your account has been created. Check your email or ask your admin for the password setup link.",
            entity_type="user",
            entity_id=instance.id,
        )
        notify_managers(
            organisation=self.request.user.organisation,
            notification_type="team_member_added",
            title="New team member added",
            message=f"{instance.full_name} joined as {instance.get_role_display()}.",
            entity_type="user",
            entity_id=instance.id,
            exclude_user_ids=[self.request.user.id, instance.id],
        )

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if hasattr(self, '_setup_url'):
            response.data['setup_url'] = self._setup_url
            response.data['setup_uid'] = self._setup_uid
            response.data['setup_token'] = self._setup_token
        return response

    def perform_update(self, serializer):
        old_user = self.get_object()
        old_role = old_user.role

        # When a non-Manager+ user is editing their own profile, silently drop
        # any attempt to mutate privileged fields (role, department, etc.).
        is_self_edit = old_user.pk == self.request.user.pk
        is_privileged = self.request.user.role in MANAGER_PLUS_ROLES
        if is_self_edit and not is_privileged:
            for field in SELF_EDIT_PROTECTED_FIELDS:
                serializer.validated_data.pop(field, None)

        instance = serializer.save()
        if old_role != instance.role:
            AuditLog.objects.create(
                event_type="user_role_changed",
                event_category="USER_MANAGEMENT",
                user=self.request.user,
                organisation=self.request.user.organisation,
                description=f"User {instance.email} role changed from {old_role} to {instance.role}",
                entity_type="user",
                entity_id=instance.id,
                metadata={"old_role": old_role, "new_role": instance.role},
            )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "User accounts cannot be deleted. Change the employment status instead."},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_employment_status(self, request, pk=None):
        """Change a user's employment status. Requires mandatory reason.
        Expects: { "employment_status": "RESIGNED", "reason": "Employee resigned voluntarily" }
        Only Admin and Manager roles can change status.
        """
        user_obj = self.get_object()
        new_status = request.data.get("employment_status")
        reason = request.data.get("reason", "").strip()

        valid_statuses = [
            "ACTIVE", "PROBATION", "PROMOTED", "DEMOTED", "SUSPENDED",
            "RESIGNED", "TERMINATED", "CONTRACT_ENDED",
        ]
        if new_status not in valid_statuses:
            return Response({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}, status=400)

        if not reason:
            return Response({"error": "A reason is mandatory for employment status changes."}, status=400)

        if request.user.role not in ['ADMIN', 'MANAGER', 'DEPT_HEAD']:
            return Response({"error": "Only Admin, Manager, or Department Head can change employment status."}, status=403)

        old_status = user_obj.employment_status
        if old_status == new_status:
            return Response({"error": f"User is already {new_status}"}, status=400)

        inactive_statuses = {"RESIGNED", "TERMINATED", "CONTRACT_ENDED"}
        if new_status in inactive_statuses and "succeeded_by" in request.data:
            successor_id = request.data.get("succeeded_by")
            if successor_id in (None, "", 0, "0"):
                user_obj.succeeded_by = None
            else:
                try:
                    successor = User.objects.get(
                        pk=successor_id,
                        organisation=user_obj.organisation,
                        employment_status="ACTIVE",
                    )
                except (User.DoesNotExist, ValueError, TypeError):
                    return Response(
                        {"error": "Successor must be an active member of your organisation."},
                        status=400,
                    )
                if successor.pk == user_obj.pk:
                    return Response({"error": "A user cannot be their own successor."}, status=400)
                user_obj.succeeded_by = successor

        if new_status == "ACTIVE":
            user_obj.succeeded_by = None

        user_obj.employment_status = new_status
        user_obj.save()

        # Revoke all outstanding refresh tokens only for access-revoking statuses.
        # Probation/Promoted/Demoted/Suspended keep the user logged in.
        if new_status in inactive_statuses:
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
                outstanding = OutstandingToken.objects.filter(user=user_obj)
                for tok in outstanding:
                    BlacklistedToken.objects.get_or_create(token=tok)
            except Exception:
                pass

        # Log to audit trail
        AuditLog.objects.create(
            event_type="employment_status_change",
            event_category="USER_MANAGEMENT",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Employment status of {user_obj.first_name} {user_obj.last_name} ({user_obj.email}) changed from {old_status} to {new_status}. Reason: {reason}",
            entity_type="user",
            entity_id=user_obj.id,
            metadata={
                "employee_email": user_obj.email,
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
                "changed_by": request.user.email,
                "successor_id": user_obj.succeeded_by_id,
            }
        )

        from apps.notifications.services import notify_employment_status_change
        notify_employment_status_change(
            subject=user_obj,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
            changed_by=request.user,
        )

        return Response({
            "message": f"Employment status changed to {new_status}",
            "user": UserSerializer(user_obj).data,
        })


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    """Register a new organisation with an admin user.

    Creates both the organisation and the first admin user in one step.
    Expects: { organisation_name, first_name, last_name, email, password }
    """
    first_name = request.data.get("first_name", "").strip()
    last_name = request.data.get("last_name", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")

    org_name = request.data.get("organisation_name", "").strip()

    errors = {}
    if not org_name:
        errors["organisation_name"] = "Organisation name is required."
    if not first_name:
        errors["first_name"] = "First name is required."
    if not last_name:
        errors["last_name"] = "Last name is required."
    if not email:
        errors["email"] = "Email is required."
    if not password or len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    if email and User.objects.filter(email=email).exists():
        errors["email"] = "An account with this email already exists."
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    from apps.organisations.models import Organisation
    from apps.billing.models import BillingProfile
    from django.utils.text import slugify

    # Create organisation
    slug = slugify(org_name)
    base_slug = slug
    counter = 1
    while Organisation.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organisation.objects.create(
        name=org_name,
        slug=slug,
        email=email,
    )

    # Create billing profile
    BillingProfile.objects.create(
        organisation=org,
        contact_name=f"{first_name} {last_name}",
        billing_email=email,
    )

    # Seed the 6 default policy categories per SOW 3.8
    from apps.policies.models import PolicyCategory
    from apps.policies.signals import DEFAULT_CATEGORIES

    PolicyCategory.objects.bulk_create([
        PolicyCategory(name=name, organisation=org) for name in DEFAULT_CATEGORIES
    ])

    # Create admin user
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role="ADMIN",
        organisation=org,
        is_staff=True,
        employment_status="ACTIVE",
        job_title="Organisation Administrator",
    )

    # Log account creation to audit trail
    AuditLog.objects.create(
        event_type="account_created",
        event_category="USER_MANAGEMENT",
        user=user,
        organisation=org,
        description=f"New organisation '{org.name}' and admin account created for {user.email}",
        entity_type="user",
        entity_id=user.id,
        metadata={"organisation_name": org.name, "organisation_id": org.id},
    )

    # Generate JWT tokens
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)

    return Response({
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
        },
        "organisation": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "is_setup_complete": False,
        },
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    email = request.data.get("email")
    if not email:
        return Response({"error": "Email is required"}, status=400)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal whether email exists
        return Response({"message": "If an account with that email exists, a reset link has been sent."})

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

    create_audit_log(
        event_type="password_reset_requested",
        event_category="AUTHENTICATION",
        user=user,
        description=f"Password reset requested for {user.email}",
        entity_type="user",
        entity_id=user.id,
    )

    try:
        send_password_reset_email(user=user, uid=uid, token=token)
    except Exception:
        logger.exception("Failed to send password reset email to %s", user.email)
        return Response(
            {"error": "Unable to send reset email. Please try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response_data = {
        "message": "If an account with that email exists, a reset link has been sent.",
    }
    if settings.DEBUG:
        response_data["reset_url"] = reset_url
        response_data["uid"] = uid
        response_data["token"] = token
    return Response(response_data)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    new_password = request.data.get("new_password")

    if not all([uid, token, new_password]):
        return Response({"error": "uid, token, and new_password are required"}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({"error": "Invalid reset link"}, status=400)

    if not default_token_generator.check_token(user, token):
        return Response({"error": "Invalid or expired reset link"}, status=400)

    if len(new_password) < 8:
        return Response({"error": "Password must be at least 8 characters"}, status=400)

    user.set_password(new_password)
    user.save()

    create_audit_log(
        event_type="password_reset_completed",
        event_category="AUTHENTICATION",
        user=user,
        description=f"Password reset completed for {user.email}",
        entity_type="user",
        entity_id=user.id,
    )

    return Response({"message": "Password has been reset successfully."})


class AuditedTokenObtainPairView(TokenObtainPairView):
    """Custom login view that logs successful and failed login attempts."""

    def post(self, request, *args, **kwargs):
        email = request.data.get("email", "")
        # Block non-Active users explicitly so they receive a clear error.
        try:
            existing = User.objects.get(email=email)
            if existing.employment_status != "ACTIVE":
                create_audit_log(
                    event_type="login_failed",
                    event_category="AUTHENTICATION",
                    user=existing,
                    description=f"Login blocked for inactive user {existing.email} ({existing.employment_status})",
                    entity_type="user",
                    entity_id=existing.id,
                    metadata={"email": email, "employment_status": existing.employment_status},
                )
                return Response(
                    {"detail": "This account is no longer active."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        except User.DoesNotExist:
            pass
        try:
            response = super().post(request, *args, **kwargs)
            # Successful login
            try:
                user = User.objects.get(email=email)
                create_audit_log(
                    event_type="user_login",
                    event_category="AUTHENTICATION",
                    user=user,
                    description=f"User {user.email} logged in successfully",
                    entity_type="user",
                    entity_id=user.id,
                )
            except User.DoesNotExist:
                pass
            return response
        except (InvalidToken, TokenError):
            # Failed login - try to log with user's org if user exists
            try:
                user = User.objects.get(email=email)
                create_audit_log(
                    event_type="login_failed",
                    event_category="AUTHENTICATION",
                    user=user,
                    description=f"Failed login attempt for email: {email}",
                    entity_type="user",
                    entity_id=user.id,
                    metadata={"email": email},
                )
            except User.DoesNotExist:
                pass
            raise


class ActiveTokenRefreshView(TokenRefreshView):
    """Refresh that rejects tokens belonging to non-Active users."""

    def post(self, request, *args, **kwargs):
        refresh_str = request.data.get("refresh")
        if refresh_str:
            try:
                refresh = RefreshToken(refresh_str)
                user_id = refresh.get("user_id")
                if user_id:
                    try:
                        u = User.objects.get(pk=user_id)
                        if u.employment_status != "ACTIVE":
                            return Response(
                                {"detail": "This account is no longer active."},
                                status=status.HTTP_401_UNAUTHORIZED,
                            )
                    except User.DoesNotExist:
                        pass
            except (InvalidToken, TokenError):
                pass
        return super().post(request, *args, **kwargs)


class AuditedTokenBlacklistView(TokenBlacklistView):
    """Custom logout view that logs user logout events."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            create_audit_log(
                event_type="user_logout",
                event_category="AUTHENTICATION",
                user=request.user,
                description=f"User {request.user.email} logged out",
                entity_type="user",
                entity_id=request.user.id,
            )
        return response
