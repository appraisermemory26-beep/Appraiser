from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsOrganisationMember
from apps.audit.models import AuditLog

from .models import Project, ProjectDocument, ProjectMilestone, ProjectReport
from .serializers import (
    ProjectSerializer, ProjectDocumentSerializer,
    ProjectMilestoneSerializer, ProjectReportSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return Project.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user,
            organisation=self.request.user.organisation,
        )
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="project_created",
            event_category="PROJECT",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Project '{instance.name}' created",
            entity_type="project",
            entity_id=instance.id,
        )

    def perform_update(self, serializer):
        old_project = self.get_object()
        old_status = old_project.status
        instance = serializer.save()
        if old_status != instance.status:
            AuditLog.objects.create(
                event_type="project_status_changed",
                event_category="PROJECT",
                user=self.request.user,
                organisation=self.request.user.organisation,
                description=f"Project '{instance.name}' status changed from {old_status} to {instance.status}",
                entity_type="project",
                entity_id=instance.id,
                metadata={"old_status": old_status, "new_status": instance.status},
            )


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectDocumentSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return ProjectDocument.objects.filter(project__organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
        instance = serializer.instance
        file_name = instance.file.name.rsplit("/", 1)[-1] if instance.file else instance.category
        AuditLog.objects.create(
            event_type="project_document_uploaded",
            event_category="DOCUMENT",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=(
                f"Document '{file_name}' ({instance.get_category_display()}) "
                f"uploaded to project '{instance.project.name}'"
            ),
            entity_type="project_document",
            entity_id=instance.id,
            metadata={"project_id": instance.project_id, "category": instance.category},
        )


class ProjectMilestoneViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectMilestoneSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return ProjectMilestone.objects.filter(project__organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save()
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="milestone_created",
            event_category="PROJECT",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Milestone '{instance.title}' created for project '{instance.project.name}'",
            entity_type="milestone",
            entity_id=instance.id,
            metadata={"project_id": instance.project_id},
        )

    def perform_update(self, serializer):
        old_milestone = self.get_object()
        old_completed = old_milestone.is_completed
        instance = serializer.save()
        if not old_completed and instance.is_completed:
            AuditLog.objects.create(
                event_type="milestone_completed",
                event_category="PROJECT",
                user=self.request.user,
                organisation=self.request.user.organisation,
                description=f"Milestone '{instance.title}' marked as completed in project '{instance.project.name}'",
                entity_type="milestone",
                entity_id=instance.id,
                metadata={"project_id": instance.project_id},
            )


class ProjectReportViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectReportSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return ProjectReport.objects.filter(project__organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
