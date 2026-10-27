from datetime import date

from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember

from .models import Timesheet
from .serializers import (
    TimesheetSerializer,
    TimesheetGenerateSerializer,
    TimesheetDayUpdateSerializer,
    TimesheetApproveSerializer,
)
from .services import (
    TimesheetGenerationError,
    generate_timesheet_from_attendance,
    generate_manual_timesheet,
    generate_manual_timesheet_ai,
    update_timesheet_day,
    submit_timesheet,
    accept_timesheet,
    approve_timesheet,
)


class TimesheetViewSet(viewsets.ModelViewSet):
    serializer_class = TimesheetSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Timesheet.objects.filter(organisation=user.organisation)
        pending_with_me = qs.filter(current_approver_id=user.id)
        if user.role == "STAFF":
            return (qs.filter(user_id=user.id) | pending_with_me).distinct()
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return (qs.filter(user_id__in=direct_report_ids + [user.id]) | pending_with_me).distinct()
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return (qs.filter(user_id__in=dept_user_ids + [user.id]) | pending_with_me).distinct()
        return qs

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """Attendance-enforced path. Body: {"institution": 1, "year": 2026, "month": 10}"""
        user = request.user
        organisation = user.organisation

        if not getattr(organisation, "attendance_enforced", True):
            return Response(
                {"error": "Attendance is disabled for your organisation. Use generate-manual instead."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        serializer = TimesheetGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            timesheet = generate_timesheet_from_attendance(
                user, organisation, data["institution"], data["year"], data["month"]
            )
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=False, methods=["post"], url_path="generate-manual")
    def generate_manual(self, request):
        """Manual-entry path. Used only when Attendance is disabled.
        Body: {"institution": 1, "year": 2026, "month": 10}"""
        user = request.user
        organisation = user.organisation

        if getattr(organisation, "attendance_enforced", True):
            return Response(
                {"error": "Attendance is enabled for your organisation. Use generate instead."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        serializer = TimesheetGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            timesheet = generate_manual_timesheet(
                user, organisation, data["institution"], data["year"], data["month"]
            )
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=False, methods=["post"], url_path="generate-manual-ai")
    def generate_manual_ai(self, request):
        """AI chat path (Flexible Mode Method 2). Same as generate-manual, but
        also accepts the days collected during the chat conversation.
        Body: {"institution": 1, "year": 2026, "month": 10,
               "absent_dates": ["2026-11-05"], "holiday_dates": [...], "leave_dates": [...]}
        Each *_dates entry is a plain "YYYY-MM-DD" string."""
        user = request.user
        organisation = user.organisation

        if getattr(organisation, "attendance_enforced", True):
            return Response(
                {"error": "Attendance is enabled for your organisation. Use generate instead."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        serializer = TimesheetGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        def _parse_dates(key):
            raw = request.data.get(key) or []
            parsed = set()
            for s in raw:
                try:
                    parsed.add(date.fromisoformat(s))
                except (ValueError, TypeError):
                    pass
            return parsed

        try:
            timesheet = generate_manual_timesheet_ai(
                user, organisation, data["institution"], data["year"], data["month"],
                absent_dates=_parse_dates("absent_dates"),
                holiday_dates=_parse_dates("holiday_dates"),
                leave_dates=_parse_dates("leave_dates"),
            )
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=True, methods=["patch"], url_path=r"days/(?P<day_id>\d+)")
    def update_day(self, request, pk=None, day_id=None):
        """Edit one calendar day on this timesheet - change its type
        (Work/Holiday/Leave.../Absent) and/or its hours."""
        timesheet = self.get_object()
        if timesheet.user_id != request.user.id and request.user.role == "STAFF":
            return Response({"error": "You can only edit your own timesheet."}, status=403)

        serializer = TimesheetDayUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            timesheet = update_timesheet_day(
                timesheet, day_id, serializer.validated_data["day_type"], serializer.validated_data["hours"]
            )
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, pk=None):
        """Employee reviews and accepts a manually-entered DRAFT before
        submitting it (Flexible Mode only)."""
        timesheet = self.get_object()
        if timesheet.user_id != request.user.id:
            return Response({"error": "You can only accept your own timesheet."}, status=403)
        try:
            timesheet = accept_timesheet(timesheet, request.user)
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Submits a DRAFT timesheet for approval."""
        timesheet = self.get_object()
        if timesheet.user_id != request.user.id:
            return Response({"error": "You can only submit your own timesheet."}, status=403)
        try:
            timesheet = submit_timesheet(timesheet)
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Send -> Supervisor -> ... -> HR chain: only the person the
        timesheet is currently awaiting (timesheet.current_approver), or
        any Admin acting as HR, may approve - and never your own timesheet."""
        approver = request.user
        timesheet = self.get_object()

        if timesheet.user_id == approver.id:
            return Response({"error": "You cannot approve your own timesheet."}, status=403)
        if timesheet.current_approver_id != approver.id and approver.role != "ADMIN":
            return Response(
                {"error": "This timesheet is not currently awaiting your approval."}, status=403,
            )

        serializer = TimesheetApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            timesheet = approve_timesheet(
                timesheet, approver,
                serializer.validated_data.get("comment", ""),
                serializer.validated_data.get("action", "APPROVE"),
            )
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=False, methods=["get"], url_path="pending-approvals")
    def pending_approvals(self, request):
        """Every timesheet - across every employee and period - that is
        currently waiting on this user's approval. Feeds the Team
        Approvals screen so a supervisor can act on several at once
        instead of opening one employee/period at a time."""
        user = request.user
        qs = (
            Timesheet.objects.filter(organisation=user.organisation, status="SUBMITTED")
            .exclude(user_id=user.id)
        )
        if user.role != "ADMIN":
            qs = qs.filter(current_approver_id=user.id)
        qs = qs.order_by("user__first_name", "user__last_name", "-period_start")
        return Response(TimesheetSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="mass-approve")
    def mass_approve(self, request):
        """Act on several employees' timesheets in one call - the Team
        Approvals screen's Approve Selected / Request Revision / Reject
        buttons. Staff left unchecked there (sorted out) are simply never
        included in timesheet_ids, so they are untouched."""
        approver = request.user
        ids = request.data.get("timesheet_ids") or []
        if not isinstance(ids, list) or not ids:
            return Response({"error": "No timesheets were selected."}, status=400)

        serializer = TimesheetApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_value = serializer.validated_data.get("action", "APPROVE")
        comment = serializer.validated_data.get("comment", "")

        approved_ids = []
        failed = []
        timesheets = Timesheet.objects.filter(id__in=ids, organisation=approver.organisation)
        by_id = {t.id: t for t in timesheets}

        for timesheet_id in ids:
            timesheet = by_id.get(timesheet_id)
            if timesheet is None:
                failed.append({"id": timesheet_id, "error": "Timesheet not found."})
                continue
            if timesheet.user_id == approver.id:
                failed.append({"id": timesheet_id, "error": "You cannot approve your own timesheet."})
                continue
            if timesheet.current_approver_id != approver.id and approver.role != "ADMIN":
                failed.append({"id": timesheet_id, "error": "Not currently awaiting your approval."})
                continue
            try:
                approve_timesheet(timesheet, approver, comment, action_value)
                approved_ids.append(timesheet_id)
            except TimesheetGenerationError as exc:
                failed.append({"id": timesheet_id, "error": str(exc)})

        return Response({"approved": approved_ids, "failed": failed})

    def update(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be edited directly. Use generate, submit, or approve."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be edited directly. Use generate, submit, or approve."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be deleted."}, status=403)

    def create(self, request, *args, **kwargs):
        return Response({"error": "Use /generate or /generate-manual to create a timesheet."}, status=403)