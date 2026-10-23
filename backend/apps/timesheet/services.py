from calendar import monthrange
from datetime import date

from django.db import transaction
from django.utils import timezone

from apps.attendance.models import AttendanceRecord

from .models import Timesheet


class TimesheetGenerationError(Exception):
    """Raised when a timesheet cannot be generated, submitted, or approved
    in its current state. Views catch this and turn it into a 400 response."""


def get_period_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


@transaction.atomic
def generate_timesheet_from_attendance(user, organisation, year: int, month: int) -> Timesheet:
    """
    Builds (or rebuilds) a DRAFT Timesheet for `user` for the given month,
    calculated from that month's AttendanceRecord rows.

    Call this only when organisation.attendance_enforced is True.
    """
    period_start, period_end = get_period_bounds(year, month)

    existing = Timesheet.objects.filter(
        organisation=organisation, user=user, period_start=period_start
    ).first()
    if existing and existing.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError(
            "This timesheet has already been submitted or approved and cannot be regenerated."
        )

    records = AttendanceRecord.objects.filter(
        organisation=organisation,
        user=user,
        date__gte=period_start,
        date__lte=period_end,
    )

    total_days_worked = 0
    total_hours = 0
    annual_leave_days = 0
    sick_leave_days = 0
    holiday_days = 0
    other_leave_days = 0

    for record in records:
        rec_status = record.status
        if rec_status == AttendanceRecord.Status.ON_LEAVE:
            other_leave_days += 1
        elif rec_status == AttendanceRecord.Status.HOLIDAY:
            holiday_days += 1
        elif rec_status in (AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.LATE):
            total_days_worked += 1
            if record.clock_in and record.clock_out:
                worked_seconds = (record.clock_out - record.clock_in).total_seconds()
                total_hours += round(worked_seconds / 3600, 2)
        # ABSENT adds to neither days-worked nor any leave bucket.

    defaults = dict(
        period_end=period_end,
        total_days_worked=total_days_worked,
        total_hours=total_hours,
        annual_leave_days=annual_leave_days,
        sick_leave_days=sick_leave_days,
        holiday_days=holiday_days,
        other_leave_days=other_leave_days,
        source=Timesheet.Source.AUTO,
        status=Timesheet.Status.DRAFT,
    )

    timesheet, _ = Timesheet.objects.update_or_create(
        organisation=organisation,
        user=user,
        period_start=period_start,
        defaults=defaults,
    )
    return timesheet


@transaction.atomic
def submit_manual_timesheet(user, organisation, data: dict) -> Timesheet:
    """Creates/updates a Timesheet from manually typed figures, and
    submits it in the same step. Used only when Attendance is disabled."""
    period_start = data["period_start"]

    existing = Timesheet.objects.filter(
        organisation=organisation, user=user, period_start=period_start
    ).first()
    if existing and existing.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError("This timesheet has already been submitted or approved.")

    defaults = {**data, "source": Timesheet.Source.MANUAL, "status": Timesheet.Status.SUBMITTED}
    defaults.pop("period_start", None)

    timesheet, _ = Timesheet.objects.update_or_create(
        organisation=organisation,
        user=user,
        period_start=period_start,
        defaults=defaults,
    )
    return timesheet


@transaction.atomic
def submit_timesheet(timesheet: Timesheet) -> Timesheet:
    if timesheet.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError("Only a draft timesheet can be submitted.")
    timesheet.status = Timesheet.Status.SUBMITTED
    timesheet.save(update_fields=["status", "updated_at"])
    return timesheet


@transaction.atomic
def approve_timesheet(timesheet: Timesheet, approver) -> Timesheet:
    if timesheet.status != Timesheet.Status.SUBMITTED:
        raise TimesheetGenerationError("Only a submitted timesheet can be approved.")
    timesheet.status = Timesheet.Status.APPROVED
    timesheet.approved_by = approver
    timesheet.approved_at = timezone.now()
    timesheet.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    return timesheet
