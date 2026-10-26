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
        REVISE_REQUESTED = "REVISE_REQUESTED", "Revision Requested"
        REJECTED = "REJECTED", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timesheets"
    )
    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="timesheets"
    )
    institution = models.ForeignKey(
        "organisations.Institution", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="timesheets",
        help_text="Which institution/client this timesheet's hours were worked for.",
    )
    period_start = models.DateField()
    period_end = models.DateField()

    total_days_worked = models.PositiveIntegerField(default=0)
    total_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    annual_leave_days = models.PositiveIntegerField(default=0)
    upa_leave_days = models.PositiveIntegerField(default=0)
    sick_leave_days = models.PositiveIntegerField(default=0)
    holiday_days = models.PositiveIntegerField(default=0)
    other_leave_days = models.PositiveIntegerField(default=0)

    source = models.CharField(max_length=10, choices=Source.choices, default=Source.AUTO)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    current_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheets_pending_my_approval",
        help_text="Who must act next in the Send -> Supervisor -> ... -> HR approval chain. "
                  "Set when submitted, advanced one level at a time as each person approves, "
                  "and cleared once HR (an Admin) gives the final approval.",
    )

    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheets_accepted",
        help_text="Employee who reviewed and accepted this manually-entered draft before submitting it.",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)

    requires_acceptance = models.BooleanField(
        default=False,
        help_text="True only for a draft generated through the AI chat assistant - it must be "
                  "explicitly accepted before it can be submitted. A draft filled in directly by "
                  "typing into the grid does not require this extra step.",
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheets_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comment = models.TextField(
        blank=True,
        default="",
        help_text="Supervisor's remark when approving this timesheet, e.g. "
                  "'Regular at work and dedicated' or 'Irregular at work and not focused'.",
    )

    last_action_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheets_last_actioned",
        help_text="Who most recently requested revision or rejected this timesheet.",
    )
    last_action_at = models.DateTimeField(null=True, blank=True)
    last_action_comment = models.TextField(
        blank=True,
        default="",
        help_text="Reason given for the most recent Revise or Reject decision.",
    )

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


class TimesheetApproval(TimeStampedModel):
    """One step in a Timesheet's Send -> Supervisor -> ... -> HR approval
    chain - a permanent record of who acted on it and when, at each level,
    even after the chain has moved on or the timesheet is fully approved."""

    class Action(models.TextChoices):
        APPROVE = "APPROVE", "Approve"
        REVISE = "REVISE", "Revise"
        REJECT = "REJECT", "Reject"

    timesheet = models.ForeignKey(
        Timesheet, on_delete=models.CASCADE, related_name="approval_steps"
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timesheet_approval_steps"
    )
    action = models.CharField(max_length=10, choices=Action.choices, default=Action.APPROVE)
    comment = models.TextField(blank=True, default="")
    is_final = models.BooleanField(
        default=False,
        help_text="True if this step was the final HR (Admin) approval that closed the timesheet.",
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.approver} {self.action.lower()}d {self.timesheet}"


class TimesheetDay(TimeStampedModel):
    """One calendar day's entry within a Timesheet's period. Powers the
    day-by-day calendar grid - auto-filled from Attendance, but editable
    by the employee or their manager (to mark a Holiday, a specific type
    of Leave, etc.) until the parent Timesheet is approved."""

    class DayType(models.TextChoices):
        WORK = "WORK", "Work"
        WEEKEND = "WEEKEND", "Weekend"
        HOLIDAY = "HOLIDAY", "Holiday"
        LEAVE_ANNUAL = "LEAVE_ANNUAL", "Leave (Annual)"
        LEAVE_UPA = "LEAVE_UPA", "Leave (UPA)"
        SICK_LEAVE = "SICK_LEAVE", "Sick Leave"
        LEAVE_OTHER = "LEAVE_OTHER", "Other Leave"
        ABSENT = "ABSENT", "Absent"

    timesheet = models.ForeignKey(
        Timesheet, on_delete=models.CASCADE, related_name="days"
    )
    date = models.DateField()
    day_type = models.CharField(max_length=20, choices=DayType.choices, default=DayType.WORK)
    hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    source = models.CharField(
        max_length=10,
        choices=Timesheet.Source.choices,
        default=Timesheet.Source.AUTO,
        help_text="AUTO = filled from Attendance; MANUAL = overridden by employee/manager.",
    )

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["timesheet", "date"], name="one_day_entry_per_timesheet_per_date"),
        ]

    def __str__(self):
        return f"{self.timesheet} - {self.date} ({self.day_type})"