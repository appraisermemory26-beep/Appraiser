from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class AIOutput(TimeStampedModel):
    class OutputType(models.TextChoices):
        JD_DRAFT = "JD_DRAFT", "JD Draft"
        COACHING_TIP = "COACHING_TIP", "Coaching Tip"
        TASK_SUMMARY = "TASK_SUMMARY", "Task Summary"
        PROJECT_SUMMARY = "PROJECT_SUMMARY", "Project Summary"
        MILESTONE_EXTRACTION = "MILESTONE_EXTRACTION", "Milestone Extraction"
        REPORT_DRAFT = "REPORT_DRAFT", "Report Draft"
        NL_SEARCH = "NL_SEARCH", "Natural Language Search"
        POLICY_DESCRIPTION = "POLICY_DESCRIPTION", "Policy Description"

    output_type = models.CharField(max_length=30, choices=OutputType.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="ai_outputs",
        null=True,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="ai_outputs"
    )
    input_data = models.JSONField(default=dict)
    output_content = models.TextField()
    is_draft = models.BooleanField(default=True)
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "AI Output"
        verbose_name_plural = "AI Outputs"

    def __str__(self):
        return f"{self.output_type} by {self.user} ({self.created_at})"


class ChatThread(TimeStampedModel):
    """A persisted AI assistant conversation — one per chat session."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_threads"
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="chat_threads"
    )
    title = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return self.title or f"Chat #{self.id}"


class ChatMessage(TimeStampedModel):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    thread = models.ForeignKey(
        ChatThread, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["thread", "created_at"])]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"
