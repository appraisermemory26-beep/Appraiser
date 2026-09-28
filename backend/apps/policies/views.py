import os

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsOrganisationMember, IsAdmin, IsManagerOrAbove, IsDeptHeadOrAbove,
)
from apps.audit.models import AuditLog

from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgment
from .serializers import (
    PolicyCategorySerializer, PolicySerializer,
    PolicyVersionSerializer, PolicyAcknowledgmentSerializer,
)


class PolicyCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = PolicyCategorySerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        from django.db.models import Q
        return PolicyCategory.objects.filter(
            Q(organisation=self.request.user.organisation) | Q(organisation__isnull=True)
        )

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]


class PolicyViewSet(viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        return Policy.objects.filter(organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="policy_created",
            event_category="POLICY",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Policy '{instance.title}' created",
            entity_type="policy",
            entity_id=instance.id,
        )
        from apps.notifications.services import notify_policy_created
        notify_policy_created(policy=instance, created_by=self.request.user)

    @action(detail=True, methods=["get"], url_path="acknowledgment-status")
    def acknowledgment_status(self, request, pk=None):
        """Get acknowledgment status for a policy. Shows who acknowledged and who hasn't.
        Only accessible to managers and above."""
        if request.user.role not in ['MANAGER', 'DEPT_HEAD', 'EXECUTIVE', 'ADMIN']:
            return Response({"error": "Insufficient permissions"}, status=403)

        policy = self.get_object()
        current_version = PolicyVersion.objects.filter(
            policy=policy, version_number=policy.current_version
        ).first()

        if not current_version:
            return Response({"error": "No current version found"}, status=404)

        from apps.accounts.models import User
        all_staff = User.objects.filter(
            organisation=request.user.organisation,
            employment_status="ACTIVE"
        )

        acknowledged_user_ids = set(
            PolicyAcknowledgment.objects.filter(
                policy_version=current_version
            ).values_list('user_id', flat=True)
        )

        acknowledged = []
        not_acknowledged = []
        for user in all_staff:
            entry = {
                "id": user.id,
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "role": user.role,
                "department": user.department.name if user.department else "N/A",
            }
            if user.id in acknowledged_user_ids:
                ack = PolicyAcknowledgment.objects.filter(
                    policy_version=current_version, user=user
                ).first()
                entry["acknowledged_at"] = ack.acknowledged_at.isoformat() if ack else None
                acknowledged.append(entry)
            else:
                not_acknowledged.append(entry)

        return Response({
            "policy_id": policy.id,
            "policy_title": policy.title,
            "current_version": policy.current_version,
            "total_staff": all_staff.count(),
            "acknowledged_count": len(acknowledged),
            "not_acknowledged_count": len(not_acknowledged),
            "acknowledged": acknowledged,
            "not_acknowledged": not_acknowledged,
        })

    @action(detail=True, methods=["post"], url_path="upload-version")
    def upload_version(self, request, pk=None):
        """Upload a new version of a policy document."""
        policy = self.get_object()
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "file is required"}, status=400)

        # Validate file type
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ['.pdf', '.docx', '.doc']:
            return Response({"error": "Only PDF and DOCX files are allowed."}, status=400)

        latest = (
            PolicyVersion.objects.filter(policy=policy)
            .order_by("-version_number")
            .first()
        )
        new_version_num = (latest.version_number + 1) if latest else 1
        version = PolicyVersion.objects.create(
            policy=policy,
            version_number=new_version_num,
            file=file,
            uploaded_by=request.user,
        )
        # current_version updated by signal

        # Log to audit
        AuditLog.objects.create(
            event_type="policy_version_uploaded",
            event_category="POLICY",
            user=request.user,
            organisation=request.user.organisation,
            description=f"New version (v{new_version_num}) uploaded for policy '{policy.title}'",
            entity_type="policy",
            entity_id=policy.id,
        )

        return Response(PolicyVersionSerializer(version).data, status=201)


class PolicyVersionViewSet(viewsets.ModelViewSet):
    serializer_class = PolicyVersionSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return PolicyVersion.objects.filter(policy__organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class PolicyAcknowledgmentViewSet(viewsets.ModelViewSet):
    serializer_class = PolicyAcknowledgmentSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['policy_version', 'user', 'policy_version__policy']

    def get_queryset(self):
        user = self.request.user
        qs = PolicyAcknowledgment.objects.filter(
            policy_version__policy__organisation=user.organisation
        )
        # Non-managers can only see their own acknowledgments
        manager_roles = {'MANAGER', 'DEPT_HEAD', 'EXECUTIVE', 'BOARD_MEMBER', 'ADMIN'}
        if user.role not in manager_roles:
            qs = qs.filter(user=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="policy_acknowledged",
            event_category="POLICY",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"User {self.request.user.email} acknowledged policy version {instance.policy_version}",
            entity_type="policy_acknowledgment",
            entity_id=instance.id,
            metadata={"policy_version_id": instance.policy_version_id},
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Acknowledgment records are permanent and cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN
        )
