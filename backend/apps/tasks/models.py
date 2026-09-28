from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from apps.core.models import TimeStampedModel


VALID_TRANSITIONS = {
    "CREATED": ["ASSIGNED"],
    "ASSIGNED": ["IN_PROGRESS", "CREATED"],  # supervisor can revert to CREATED
    "IN_PROGRESS": ["SUBMITTED"],
    "SUBMITTED": ["REVIEWED", "IN_PROGRESS"],  # RETURNED sends back to IN_PROGRESS
    "REVIEWED": ["CLOSED", "IN_PROGRESS"],  # REJECTED sends back to IN_PROGRESS
    "CLOSED": [],  # terminal state - only supervisor can reopen
}


class Task(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "CREATED", "Created"
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        SUBMITTED = "SUBMITTED", "Submitted"
        REVIEWED = "REVIEWED", "Reviewed"
        CLOSED = "CLOSED", "Closed"

    class DeadlineType(models.TextChoices):
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    task_id = models.CharField(max_length=20, unique=True, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    objectives = models.TextField(blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    deadline_type = models.CharField(
        max_length=10, choices=DeadlineType.choices, default=DeadlineType.WEEKLY
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name="assigned_tasks", null=True, blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_tasks",
        null=True,
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="tasks"
    )
    department = models.ForeignKey(
        "organisations.Department", on_delete=models.SET_NULL,
        related_name="tasks", null=True, blank=True,
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.SET_NULL,
        related_name="tasks", null=True, blank=True,
    )
    parent_task = models.ForeignKey(
        "self", on_delete=models.CASCADE, related_name="subtasks",
        null=True, blank=True,
    )
    linked_jd = models.ForeignKey(
        "jd_management.JobDescription", on_delete=models.SET_NULL,
        related_name="tasks", null=True, blank=True,
    )
    progress_percentage = models.PositiveIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task_id} - {self.title}"

    def transition_status(self, new_status):
        """Validate and apply a status transition."""
        valid_next = VALID_TRANSITIONS.get(self.status, [])
        if new_status not in valid_next:
            raise ValidationError(
                f"Invalid transition from {self.status} to {new_status}"
            )
        self.status = new_status

    def save(self, *args, **kwargs):
        skip_transition_check = kwargs.pop("skip_transition_check", False)

        if not self.task_id:
            last = Task.objects.order_by("-id").first()
            next_num = (last.id + 1) if last else 1
            self.task_id = f"TK-{next_num:04d}"

        # Enforce valid status transitions on existing tasks
        if self.pk and not skip_transition_check:
            old = Task.objects.filter(pk=self.pk).values_list("status", flat=True).first()
            if old and old != self.status:
                if self.status not in VALID_TRANSITIONS.get(old, []):
                    raise ValidationError(
                        f"Invalid transition from {old} to {self.status}"
                    )

        super().save(*args, **kwargs)


class TaskOutput(TimeStampedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="outputs")
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="task_outputs",
        null=True,
    )
    file = models.FileField(upload_to="task_outputs/", blank=True)
    text_content = models.TextField(blank=True)

    def __str__(self):
        return f"Output for {self.task.task_id}"


class TaskReview(TimeStampedModel):
    class Action(models.TextChoices):
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        RETURNED = "RETURNED", "Returned"

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="task_reviews",
        null=True,
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review: {self.task.task_id} - {self.action}"


class TaskStatusChange(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="status_changes")
    from_status = models.CharField(max_length=20, choices=Task.Status.choices)
    to_status = models.CharField(max_length=20, choices=Task.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="task_status_changes",
        null=True,
    )
    comment = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.task.task_id}: {self.from_status} -> {self.to_status}"
