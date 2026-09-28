from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class TimeLog(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_logs"
    )
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="time_logs"
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="time_logs"
    )

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["organisation", "user", "-started_at"]),
            models.Index(fields=["organisation", "task", "-started_at"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.task} ({self.started_at})"

    def save(self, *args, **kwargs):
        # Closed log lines (ended_at is set) are immutable.
        if self.pk:
            existing = TimeLog.objects.filter(pk=self.pk).only("ended_at").first()
            if existing and existing.ended_at is not None:
                raise ValueError("TimeLog entries cannot be modified after they are closed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.ended_at is not None:
            raise ValueError("TimeLog entries cannot be deleted once closed.")
        super().delete(*args, **kwargs)


class ActivityLog(TimeStampedModel):
    class ActivityType(models.TextChoices):
        DESK_WORK = "DESK_WORK", "Desk Work"
        FIELD_WORK = "FIELD_WORK", "Field Work"
        MEETING = "MEETING", "Meeting"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_logs"
    )
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="activity_logs"
    )

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["organisation", "user", "-started_at"])]

    def __str__(self):
        return f"{self.user} - {self.activity_type} ({self.started_at})"

    def save(self, *args, **kwargs):
        if self.pk:
            existing = ActivityLog.objects.filter(pk=self.pk).only("ended_at").first()
            if existing and existing.ended_at is not None:
                raise ValueError("ActivityLog entries cannot be modified after they are closed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.ended_at is not None:
            raise ValueError("ActivityLog entries cannot be deleted once closed.")
        super().delete(*args, **kwargs)


class BreakLog(TimeStampedModel):
    class BreakType(models.TextChoices):
        LUNCH = "LUNCH", "Lunch"
        STEP_OUT = "STEP_OUT", "Step Out"
        ANNUAL_LEAVE = "ANNUAL_LEAVE", "Annual Leave"
        SICK_LEAVE = "SICK_LEAVE", "Sick Leave"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="break_logs"
    )
    break_type = models.CharField(max_length=20, choices=BreakType.choices)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="break_logs"
    )

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["organisation", "user", "-started_at"])]

    def __str__(self):
        return f"{self.user} - {self.break_type} ({self.started_at})"

    def save(self, *args, **kwargs):
        if self.pk:
            existing = BreakLog.objects.filter(pk=self.pk).only("ended_at").first()
            if existing and existing.ended_at is not None:
                raise ValueError("BreakLog entries cannot be modified after they are closed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.ended_at is not None:
            raise ValueError("BreakLog entries cannot be deleted once closed.")
        super().delete(*args, **kwargs)
