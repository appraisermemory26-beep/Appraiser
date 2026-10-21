from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Timesheet(TimeStampedModel):
    class Source(models.TextChoices):
        AUTO = "AUTO", "Calculated from Attendance"
        MANUAL = "MANUAL", "Entered manually"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timesheets"
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="timesheets"
    )
    period_start = models.DateField()
    period_end = models.DateField()

    total_days_worked = models.PositiveIntegerField(default=0)
    total_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    annual_leave_days = models.PositiveIntegerField(default=0)
    sick_leave_days = models.PositiveIntegerField(default=0)
    holiday_days = models.PositiveIntegerField(default=0)
    other_leave_days = models.PositiveIntegerField(default=0)

    source = models.CharField(max_length=10, choices=Source.choices, default=Source.AUTO)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheets_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-period_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["organisation", "user", "period_start"],
                name="one_timesheet_per_user_per_period",
            ),
        ]
        indexes = [
            models.Index(fields=["organisation", "user", "-period_start"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.period_start} to {self.period_end} ({self.status})"

    def save(self, *args, **kwargs):
        # Approved timesheets are immutable, same rule as Attendance.
        if self.pk:
            existing = Timesheet.objects.filter(pk=self.pk).only("status").first()
            if existing and existing.status == Timesheet.Status.APPROVED:
                raise ValueError("Approved timesheets cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status == Timesheet.Status.APPROVED:
            raise ValueError("Approved timesheets cannot be deleted.")
        super().delete(*args, **kwargs)
