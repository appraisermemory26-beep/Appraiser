from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.accounts.permissions import IsOrganisationMember

from .models import JobDescription, JDVersion
from .serializers import JobDescriptionSerializer, JDVersionSerializer


class JobDescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = JobDescriptionSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return JobDescription.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)


class JDVersionViewSet(viewsets.ModelViewSet):
    serializer_class = JDVersionSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return JDVersion.objects.filter(job_description__organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        version = serializer.save(uploaded_by=self.request.user)
        # Bump the parent JD's current_version pointer
        jd = version.job_description
        jd.current_version = version.version_number
        jd.save(update_fields=["current_version", "updated_at"])
        # Notify the linked user that their JD has been updated
        if jd.linked_user_id and jd.linked_user_id != self.request.user.id:
            from apps.notifications.models import Notification

            Notification.objects.create(
                user=jd.linked_user,
                organisation=jd.organisation,
                notification_type="jd_updated",
                title="Your Job Description has been updated",
                message=f"A new version of your JD '{jd.title}' was uploaded.",
                entity_type="jd_version",
                entity_id=version.id,
            )
        # Audit log
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            event_type="jd_version_uploaded",
            event_category="DOCUMENT",
            user=self.request.user,
            organisation=jd.organisation,
            description=f"JD '{jd.title}' updated to version {version.version_number}",
            entity_type="jd_version",
            entity_id=version.id,
            metadata={"jd_id": jd.id, "version_number": version.version_number},
        )

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def download(self, request, pk=None):
        # Authenticate via query param token (for window.open downloads)
        token_str = request.query_params.get("token")
        if not token_str:
            return Response({"error": "Authentication token required"}, status=401)

        try:
            token = AccessToken(token_str)
            user = User.objects.get(id=token["user_id"])
        except Exception:
            return Response({"error": "Invalid or expired token"}, status=401)

        try:
            version = JDVersion.objects.get(
                pk=pk,
                job_description__organisation=user.organisation,
            )
        except JDVersion.DoesNotExist:
            return Response({"error": "No JDVersion matches the given query."}, status=404)

        if not version.file:
            return Response({"error": "No file attached to this version"}, status=404)

        response = FileResponse(version.file.open(), as_attachment=True)
        response["Content-Disposition"] = f'attachment; filename="{version.file.name.split("/")[-1]}"'
        return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_jd(request):
    """Get the JD linked to the current user."""
    jd = JobDescription.objects.filter(linked_user=request.user).first()
    if not jd:
        return Response({"detail": "No job description linked to your account."}, status=404)
    serializer = JobDescriptionSerializer(jd)
    return Response(serializer.data)
