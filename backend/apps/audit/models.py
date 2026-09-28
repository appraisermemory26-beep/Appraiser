from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class EventCategory(models.TextChoices):
        TASK = "TASK", "Task"
        PROJECT = "PROJECT", "Project"
        DOCUMENT = "DOCUMENT", "Document"
        POLICY = "POLICY", "Policy"
        USER_MANAGEMENT = "USER_MANAGEMENT", "User Management"
        AUTHENTICATION = "AUTHENTICATION", "Authentication"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Administrative"

    event_type = models.CharField(max_length=100)
    event_category = models.CharField(max_length=20, choices=EventCategory.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name="audit_logs", null=True,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="audit_logs"
    )
    description = models.TextField()
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["organisation", "-timestamp"]),
            models.Index(fields=["organisation", "event_category", "-timestamp"]),
            models.Index(fields=["organisation", "event_type", "-timestamp"]),
            models.Index(fields=["organisation", "user", "-timestamp"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"[{self.event_category}] {self.event_type} by {self.user} at {self.timestamp}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("Audit logs are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Audit logs are immutable and cannot be deleted.")
