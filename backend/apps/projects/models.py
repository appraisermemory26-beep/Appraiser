from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Project(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ON_HOLD = "ON_HOLD", "On Hold"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    name = models.CharField(max_length=255)
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField()
    department = models.ForeignKey(
        "organisations.Department", on_delete=models.SET_NULL,
        related_name="projects", null=True, blank=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="owned_projects",
        null=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="projects"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class ProjectDocument(TimeStampedModel):
    class Category(models.TextChoices):
        PD = "PD", "Project Document"
        BUDGET = "BUDGET", "Budget"
        WORKPLAN = "WORKPLAN", "Work Plan"
        SCHEDULE = "SCHEDULE", "Schedule"
        RESULT_FRAMEWORK = "RESULT_FRAMEWORK", "Result Framework"
        SUPPORTING = "SUPPORTING", "Supporting Document"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="documents")
    category = models.CharField(max_length=20, choices=Category.choices)
    file = models.FileField(upload_to="project_documents/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="uploaded_project_documents",
        null=True,
    )
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project.name} - {self.category} v{self.version}"


class ProjectMilestone(TimeStampedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    deadline = models.DateField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["deadline"]

    def __str__(self):
        return f"{self.project.name} - {self.title}"


class ProjectReport(TimeStampedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="reports")
    title = models.CharField(max_length=255)
    content = models.TextField()
    period_start = models.DateField()
    period_end = models.DateField()
    is_ai_generated = models.BooleanField(default=False)
    is_draft = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="project_reports",
        null=True,
    )

    class Meta:
        ordering = ["-period_end"]

    def __str__(self):
        return f"{self.project.name} - {self.title}"
