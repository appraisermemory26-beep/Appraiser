from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class AttendanceRecord(TimeStampedModel):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        LATE = "LATE", "Late"
        ABSENT = "ABSENT", "Absent"
        ON_LEAVE = "ON_LEAVE", "On Leave"
        HOLIDAY = "HOLIDAY", "Holiday"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attendance_records"
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="attendance_records"
    )
    date = models.DateField()
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PRESENT)
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records_recorded",
        help_text="Set only when a manager or HR enters or corrects this record on the employee's behalf.",
    )

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "user", "date"], name="one_attendance_record_per_user_per_day"),
        ]
        indexes = [
            models.Index(fields=["organisation", "user", "-date"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.date} ({self.status})"

    def save(self, *args, **kwargs):
        # Closed records (clock_out is set) are immutable, same rule as TimeLog.
        if self.pk:
            existing = AttendanceRecord.objects.filter(pk=self.pk).only("clock_out").first()
            if existing and existing.clock_out is not None:
                raise ValueError("Attendance records cannot be modified after clock-out is set.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.clock_out is not None:
            raise ValueError("Attendance records cannot be deleted once clock-out is set.")
        super().delete(*args, **kwargs)