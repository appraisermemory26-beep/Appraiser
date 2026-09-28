from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta

from apps.core.models import TimeStampedModel

MESSAGE_EDIT_WINDOW = timedelta(hours=2)


class Conversation(TimeStampedModel):
    class ConversationType(models.TextChoices):
        TASK_THREAD = "TASK_THREAD", "Task Thread"
        DIRECT = "DIRECT", "Direct"
        GROUP = "GROUP", "Group"

    conversation_type = models.CharField(max_length=20, choices=ConversationType.choices)
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="conversations",
        null=True, blank=True,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="conversations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_conversations",
        null=True,
    )

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.conversation_type} - {self.id}"


class ConversationParticipant(TimeStampedModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversation_participations"
    )

    class Meta:
        unique_together = [("conversation", "user")]

    def __str__(self):
        return f"{self.user} in {self.conversation}"


class Message(TimeStampedModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="sent_messages",
        null=True,
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="messages"
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["organisation", "conversation", "created_at"]),
            models.Index(fields=["organisation", "sender", "created_at"]),
            models.Index(fields=["conversation", "is_read"]),
        ]

    def __str__(self):
        return f"Message by {self.sender} in {self.conversation}"

    @property
    def edit_deadline(self):
        return self.created_at + MESSAGE_EDIT_WINDOW

    def is_editable_by(self, user) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if self.sender_id != user.id:
            return False
        return timezone.now() <= self.edit_deadline
