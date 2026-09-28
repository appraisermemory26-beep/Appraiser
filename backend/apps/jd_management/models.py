from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class JobDescription(TimeStampedModel):
    title = models.CharField(max_length=255)
    department = models.ForeignKey(
        "organisations.Department", on_delete=models.SET_NULL,
        related_name="job_descriptions", null=True, blank=True,
    )
    role_title = models.CharField(max_length=255)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="job_descriptions"
    )
    current_version = models.PositiveIntegerField(default=1)
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name="linked_job_descriptions", null=True, blank=True,
    )

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return f"{self.title} - {self.role_title}"


class JDVersion(TimeStampedModel):
    job_description = models.ForeignKey(
        JobDescription, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to="jd_versions/", blank=True)
    content_text = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="uploaded_jd_versions",
        null=True,
    )
    is_ai_generated = models.BooleanField(default=False)

    class Meta:
        ordering = ["-version_number"]
        unique_together = [("job_description", "version_number")]

    def __str__(self):
        return f"{self.job_description.title} v{self.version_number}"
