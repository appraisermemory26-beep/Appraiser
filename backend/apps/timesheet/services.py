from calendar import monthrange
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.attendance.models import AttendanceRecord
from apps.notifications.services import (
    notify_timesheet_approved,
    notify_timesheet_forwarded,
    notify_timesheet_rejected,
    notify_timesheet_revise_requested,
    notify_timesheet_submitted,
)
from apps.organisations.models import Institution
from apps.tasks.models import Task, TaskStatusChange

from .models import Timesheet, TimesheetDay, TimesheetApproval


class TimesheetGenerationError(Exception):
    """Raised when a timesheet cannot be generated, submitted, or approved
    in its current state. Views catch this and turn it into a 400 response."""


STANDARD_WORKDAY_HOURS = 8


def get_period_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _iter_days(period_start, period_end):
    current = period_start
    while current <= period_end:
        yield current
        current += timedelta(days=1)


def _get_institution(organisation, institution_id):
    try:
        return Institution.objects.get(pk=institution_id, organisation=organisation)
    except Institution.DoesNotExist:
        raise TimesheetGenerationError("Institution not found.")


from .holidays import get_liberia_holiday_dates


def _build_day_rows(timesheet, period_start, period_end, from_attendance: bool, absent_dates=None, holiday_dates=None, leave_dates=None, fill_default=False):
    """Returns a list of unsaved TimesheetDay instances for every calendar
    day in the period. When from_attendance is True, pulls real clock-in/
    clock-out data; otherwise builds sensible manual-entry defaults
    (weekdays as Work/8h, weekends as Weekend/0h) for the employee to edit."""
    absent_dates = absent_dates or set()
    holiday_dates = (holiday_dates or set()) | get_liberia_holiday_dates(period_start.year)
    leave_dates = leave_dates or set()
    records_by_date = {}
    if from_attendance:
        records = AttendanceRecord.objects.filter(
            organisation=timesheet.organisation,
            user=timesheet.user,
            date__gte=period_start,
            date__lte=period_end,
        )
        records_by_date = {r.date: r for r in records}

    rows = []
    for day in _iter_days(period_start, period_end):
        is_weekend = day.weekday() >= 5  # Saturday=5, Sunday=6
        record = records_by_date.get(day)

        if record is not None:
            if record.status == AttendanceRecord.Status.HOLIDAY:
                day_type, hours = TimesheetDay.DayType.HOLIDAY, STANDARD_WORKDAY_HOURS
            elif record.status == AttendanceRecord.Status.ON_LEAVE:
                day_type, hours = TimesheetDay.DayType.LEAVE_OTHER, STANDARD_WORKDAY_HOURS
            elif record.status == AttendanceRecord.Status.ABSENT:
                day_type, hours = TimesheetDay.DayType.ABSENT, 0
            elif record.status in (AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.LATE):
                worked_hours = 0
                if record.clock_in and record.clock_out:
                    worked_seconds = (record.clock_out - record.clock_in).total_seconds()
                    worked_hours = round(worked_seconds / 3600, 2)
                day_type, hours = TimesheetDay.DayType.WORK, worked_hours
            else:
                day_type = TimesheetDay.DayType.WEEKEND if is_weekend else TimesheetDay.DayType.ABSENT
                hours = 0
        elif is_weekend:
            day_type, hours = TimesheetDay.DayType.WEEKEND, 0
        elif day in holiday_dates:
            day_type, hours = TimesheetDay.DayType.HOLIDAY, STANDARD_WORKDAY_HOURS
        elif day in leave_dates:
            day_type, hours = TimesheetDay.DayType.LEAVE_OTHER, STANDARD_WORKDAY_HOURS
        elif from_attendance:
            day_type, hours = TimesheetDay.DayType.ABSENT, 0
        elif day in absent_dates:
            day_type, hours = TimesheetDay.DayType.ABSENT, 0
        else:
            day_type, hours = TimesheetDay.DayType.WORK, (STANDARD_WORKDAY_HOURS if fill_default else 0)

        rows.append(TimesheetDay(
            timesheet=timesheet,
            date=day,
            day_type=day_type,
            hours=hours,
            source=Timesheet.Source.AUTO if from_attendance else Timesheet.Source.MANUAL,
        ))
    return rows


def recalculate_timesheet_totals(timesheet: Timesheet) -> Timesheet:
    """Recomputes the Timesheet's aggregate fields from its TimesheetDay
    rows. Called after generation and after any manual day-level edit."""
    days = list(timesheet.days.all())

    timesheet.total_hours = sum((d.hours for d in days), start=0)
    timesheet.total_days_worked = sum(1 for d in days if d.day_type == TimesheetDay.DayType.WORK and d.hours > 0)
    timesheet.annual_leave_days = sum(1 for d in days if d.day_type == TimesheetDay.DayType.LEAVE_ANNUAL)
    timesheet.upa_leave_days = sum(1 for d in days if d.day_type == TimesheetDay.DayType.LEAVE_UPA)
    timesheet.sick_leave_days = sum(1 for d in days if d.day_type == TimesheetDay.DayType.SICK_LEAVE)
    timesheet.holiday_days = sum(1 for d in days if d.day_type == TimesheetDay.DayType.HOLIDAY)
    timesheet.other_leave_days = sum(1 for d in days if d.day_type == TimesheetDay.DayType.LEAVE_OTHER)

    timesheet.save(update_fields=[
        "total_hours", "total_days_worked", "annual_leave_days", "upa_leave_days",
        "sick_leave_days", "holiday_days", "other_leave_days", "updated_at",
    ])
    return timesheet


@transaction.atomic
def generate_timesheet_from_attendance(user, organisation, institution_id, year: int, month: int) -> Timesheet:
    """
    Builds (or rebuilds) a DRAFT Timesheet for `user` for the given month,
    calculated from that month's AttendanceRecord rows.

    Call this only when organisation.attendance_enforced is True.
    """
    period_start, period_end = get_period_bounds(year, month)
    institution = _get_institution(organisation, institution_id)

    existing = Timesheet.objects.filter(
        organisation=organisation, user=user, period_start=period_start
    ).first()
    if existing and existing.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError(
            "This timesheet has already been submitted or approved and cannot be regenerated."
        )

    timesheet, _ = Timesheet.objects.update_or_create(
        organisation=organisation,
        user=user,
        period_start=period_start,
        defaults=dict(
            period_end=period_end,
            institution=institution,
            source=Timesheet.Source.AUTO,
            status=Timesheet.Status.DRAFT,
        ),
    )

    timesheet.days.all().delete()
    TimesheetDay.objects.bulk_create(_build_day_rows(timesheet, period_start, period_end, from_attendance=True))
    recalculate_timesheet_totals(timesheet)
    return timesheet


@transaction.atomic
def generate_manual_timesheet(user, organisation, institution_id, year: int, month: int) -> Timesheet:
    """Manual-entry path. Builds the same DRAFT Timesheet + day-by-day
    calendar skeleton, but with sensible defaults (not from Attendance)
    for the employee to review and correct before submitting. Used only
    when Attendance is disabled for the organisation."""
    period_start, period_end = get_period_bounds(year, month)
    institution = _get_institution(organisation, institution_id)

    existing = Timesheet.objects.filter(
        organisation=organisation, user=user, period_start=period_start
    ).first()
    if existing and existing.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError("This timesheet has already been submitted or approved.")

    timesheet, _ = Timesheet.objects.update_or_create(
        organisation=organisation,
        user=user,
        period_start=period_start,
        defaults=dict(
            period_end=period_end,
            institution=institution,
            source=Timesheet.Source.MANUAL,
            status=Timesheet.Status.DRAFT,
        ),
    )

    timesheet.days.all().delete()
    TimesheetDay.objects.bulk_create(_build_day_rows(timesheet, period_start, period_end, from_attendance=False))
    recalculate_timesheet_totals(timesheet)
    return timesheet


@transaction.atomic
def generate_manual_timesheet_ai(user, organisation, institution_id, year: int, month: int, absent_dates=None, holiday_dates=None, leave_dates=None) -> Timesheet:
    """AI chat path (Flexible Mode Method 2). Same as generate_manual_timesheet,
    but applies the absent/holiday/leave days collected from the AI chat
    conversation, and flags the resulting draft as requiring an explicit
    Accept step before the employee can submit it."""
    period_start, period_end = get_period_bounds(year, month)
    institution = _get_institution(organisation, institution_id)

    existing = Timesheet.objects.filter(
        organisation=organisation, user=user, period_start=period_start
    ).first()
    if existing and existing.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError("This timesheet has already been submitted or approved.")

    timesheet, _ = Timesheet.objects.update_or_create(
        organisation=organisation,
        user=user,
        period_start=period_start,
        defaults=dict(
            period_end=period_end,
            institution=institution,
            source=Timesheet.Source.MANUAL,
            status=Timesheet.Status.DRAFT,
            requires_acceptance=True,
            accepted_by=None,
            accepted_at=None,
        ),
    )

    timesheet.days.all().delete()
    TimesheetDay.objects.bulk_create(_build_day_rows(
        timesheet, period_start, period_end, from_attendance=False,
        absent_dates=absent_dates, holiday_dates=holiday_dates, leave_dates=leave_dates,
        fill_default=True,
    ))
    recalculate_timesheet_totals(timesheet)
    return timesheet


@transaction.atomic
def update_timesheet_day(timesheet: Timesheet, day_id: int, day_type: str, hours) -> Timesheet:
    if timesheet.status == Timesheet.Status.APPROVED:
        raise TimesheetGenerationError("Approved timesheets cannot be modified.")
    try:
        day = timesheet.days.get(pk=day_id)
    except TimesheetDay.DoesNotExist:
        raise TimesheetGenerationError("Day not found on this timesheet.")
    day.day_type = day_type
    day.hours = hours
    day.source = Timesheet.Source.MANUAL
    day.save(update_fields=["day_type", "hours", "source", "updated_at"])
    recalculate_timesheet_totals(timesheet)
    return timesheet


@transaction.atomic
def accept_timesheet(timesheet: Timesheet, user) -> Timesheet:
    """Employee reviews and accepts a manually-entered DRAFT before
    submitting it for approval. Only meaningful for MANUAL (Flexible
    Mode) timesheets - Strict Mode timesheets are filled automatically
    and do not need this extra confirmation step."""
    if timesheet.status != Timesheet.Status.DRAFT:
        raise TimesheetGenerationError("Only a draft timesheet can be accepted.")
    timesheet.accepted_by = user
    timesheet.accepted_at = timezone.now()
    timesheet.save(update_fields=["accepted_by", "accepted_at", "updated_at"])
    return timesheet


def _first_admin(organisation):
    """The organisation's HR contact for the approval chain - any user
    with the Admin role, used both as the fallback once the chain runs
    out of supervisors to climb to, and as the final HR approval step."""
    return User.objects.filter(
        organisation=organisation, role=User.Role.ADMIN, is_active=True
    ).order_by("id").first()


def _next_approver_after(current_user, organisation):
    """Who should act next in the Send -> Supervisor -> ... -> HR chain,
    given the person who just acted (or the employee, for the first step).
    Climbs reports_to one level at a time; falls back to HR (an Admin)
    once the chain runs out of supervisors to climb to."""
    return current_user.reports_to or _first_admin(organisation)


def _create_approval_task(timesheet, approver):
    """Auto-create the 'Approve timesheet' to-do for whoever must act next,
    so it shows up in their Task list (not just the notification bell) -
    clicking it takes them straight to this timesheet."""
    if not approver:
        return
    employee_name = f"{timesheet.user.first_name} {timesheet.user.last_name}".strip() or str(timesheet.user)
    period_label = timesheet.period_start.strftime("%B %Y")
    task = Task.objects.create(
        title=f"Approve timesheet: {employee_name} - {period_label}",
        description=f"{employee_name}'s timesheet for {period_label} is awaiting your approval.",
        status=Task.Status.ASSIGNED,
        priority=Task.Priority.MEDIUM,
        assigned_to=approver,
        created_by=timesheet.user,
        organisation=timesheet.organisation,
        linked_timesheet=timesheet,
    )
    TaskStatusChange.objects.create(
        task=task, from_status=Task.Status.CREATED, to_status=Task.Status.ASSIGNED,
        changed_by=timesheet.user, comment="Auto-created for timesheet approval.",
    )


def _close_approval_tasks(timesheet, closed_by, note=""):
    """Close out any still-open 'Approve timesheet' to-dos for this timesheet,
    e.g. once the current approver has acted and it's moved on, or the chain
    has ended (approved / sent back for revision / rejected)."""
    open_tasks = timesheet.tasks.exclude(status=Task.Status.CLOSED)
    for task in open_tasks:
        old_status = task.status
        task.status = Task.Status.CLOSED
        task.save(update_fields=["status", "updated_at"], skip_transition_check=True)
        TaskStatusChange.objects.create(
            task=task, from_status=old_status, to_status=Task.Status.CLOSED,
            changed_by=closed_by, comment=note or "Closed automatically.",
        )


@transaction.atomic
def submit_timesheet(timesheet: Timesheet) -> Timesheet:
    if timesheet.status not in (Timesheet.Status.DRAFT, Timesheet.Status.REVISE_REQUESTED):
        raise TimesheetGenerationError("Only a draft timesheet can be submitted.")
    if timesheet.requires_acceptance and not timesheet.accepted_at:
        raise TimesheetGenerationError("You must accept this draft before submitting it.")
    timesheet.status = Timesheet.Status.SUBMITTED
    timesheet.current_approver = _next_approver_after(timesheet.user, timesheet.organisation)
    timesheet.save(update_fields=["status", "current_approver", "updated_at"])
    notify_timesheet_submitted(timesheet=timesheet)
    _create_approval_task(timesheet, timesheet.current_approver)
    return timesheet


@transaction.atomic
def approve_timesheet(timesheet: Timesheet, approver, comment: str = "", action: str = "APPROVE") -> Timesheet:
    if timesheet.status != Timesheet.Status.SUBMITTED:
        raise TimesheetGenerationError("Only a submitted timesheet can be approved.")

    if action in ("REVISE", "REJECT") and not comment.strip():
        raise TimesheetGenerationError("Please provide a reason/comment.")

    is_hr_step = approver.role == User.Role.ADMIN

    if action == "REVISE":
        TimesheetApproval.objects.create(
            timesheet=timesheet, approver=approver, action=TimesheetApproval.Action.REVISE,
            comment=comment, is_final=False,
        )
        timesheet.status = Timesheet.Status.REVISE_REQUESTED
        timesheet.current_approver = None
        timesheet.last_action_by = approver
        timesheet.last_action_at = timezone.now()
        timesheet.last_action_comment = comment
        timesheet.save(update_fields=[
            "status", "current_approver", "last_action_by", "last_action_at", "last_action_comment", "updated_at",
        ])
        _close_approval_tasks(timesheet, closed_by=approver, note=f"Revision requested: {comment}")
        notify_timesheet_revise_requested(timesheet=timesheet, requested_by=approver, comment=comment)
        return timesheet

    if action == "REJECT":
        TimesheetApproval.objects.create(
            timesheet=timesheet, approver=approver, action=TimesheetApproval.Action.REJECT,
            comment=comment, is_final=False,
        )
        timesheet.status = Timesheet.Status.REJECTED
        timesheet.current_approver = None
        timesheet.last_action_by = approver
        timesheet.last_action_at = timezone.now()
        timesheet.last_action_comment = comment
        timesheet.save(update_fields=[
            "status", "current_approver", "last_action_by", "last_action_at", "last_action_comment", "updated_at",
        ])
        _close_approval_tasks(timesheet, closed_by=approver, note=f"Rejected: {comment}")
        notify_timesheet_rejected(timesheet=timesheet, rejected_by=approver, comment=comment)
        return timesheet

    TimesheetApproval.objects.create(
        timesheet=timesheet, approver=approver, action=TimesheetApproval.Action.APPROVE,
        comment=comment, is_final=is_hr_step,
    )

    if is_hr_step:
        timesheet.status = Timesheet.Status.APPROVED
        timesheet.approved_by = approver
        timesheet.approved_at = timezone.now()
        timesheet.approval_comment = comment
        timesheet.current_approver = None
        timesheet.save(update_fields=[
            "status", "approved_by", "approved_at", "approval_comment", "current_approver", "updated_at",
        ])
        _close_approval_tasks(timesheet, closed_by=approver, note="Approved (final).")
        notify_timesheet_approved(timesheet=timesheet, approved_by=approver)
    else:
        _close_approval_tasks(timesheet, closed_by=approver, note="Approved - forwarded to next approver.")
        timesheet.current_approver = _next_approver_after(approver, timesheet.organisation)
        timesheet.save(update_fields=["current_approver", "updated_at"])
        _create_approval_task(timesheet, timesheet.current_approver)
        notify_timesheet_forwarded(timesheet=timesheet, approver=approver)
    return timesheet