from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class PolicyCategory(TimeStampedModel):
    name = models.CharField(max_length=255)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE,
        related_name="policy_categories", null=True, blank=True,
    )

    class Meta:
        verbose_name_plural = "Policy categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Policy(TimeStampedModel):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        PolicyCategory, on_delete=models.SET_NULL, related_name="policies",
        null=True, blank=True,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="policies"
    )
    current_version = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name_plural = "Policies"
        ordering = ["title"]

    def __str__(self):
        return self.title


class PolicyVersion(TimeStampedModel):
    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to="policies/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="uploaded_policy_versions",
        null=True,
    )

    class Meta:
        ordering = ["-version_number"]
        unique_together = [("policy", "version_number")]

    def __str__(self):
        return f"{self.policy.title} v{self.version_number}"


class PolicyAcknowledgment(TimeStampedModel):
    policy_version = models.ForeignKey(
        PolicyVersion, on_delete=models.CASCADE, related_name="acknowledgments"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="policy_acknowledgments"
    )
    acknowledged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("policy_version", "user")]

    def __str__(self):
        return f"{self.user} acknowledged {self.policy_version}"
