from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember

from .models import Timesheet
from .serializers import TimesheetSerializer, TimesheetManualEntrySerializer
from .services import (
    TimesheetGenerationError,
    generate_timesheet_from_attendance,
    submit_manual_timesheet,
    submit_timesheet,
    approve_timesheet,
)


class TimesheetViewSet(viewsets.ModelViewSet):
    serializer_class = TimesheetSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Timesheet.objects.filter(organisation=user.organisation)
        if user.role == "STAFF":
            return qs.filter(user_id=user.id)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id])
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id])
        return qs

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """Attendance-enforced path. Body: {"year": 2026, "month": 10}"""
        user = request.user
        organisation = user.organisation

        if not getattr(organisation, "attendance_enforced", True):
            return Response(
                {"error": "Attendance is disabled for your organisation. Use submit-manual instead."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            year = int(request.data["year"])
            month = int(request.data["month"])
        except (KeyError, TypeError, ValueError):
            return Response({"error": "year and month are required integers."}, status=400)

        try:
            timesheet = generate_timesheet_from_attendance(user, organisation, year, month)
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=False, methods=["post"], url_path="submit-manual")
    def submit_manual(self, request):
        """Manual-entry path. Used only when Attendance is disabled."""
        user = request.user
        organisation = user.organisation

        if getattr(organisation, "attendance_enforced", True):
            return Response(
                {"error": "Attendance is enabled for your organisation. Use generate instead."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        serializer = TimesheetManualEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            timesheet = submit_manual_timesheet(user, organisation, serializer.validated_data)
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(TimesheetSerializer(timesheet).data)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Submits an attendance-generated DRAFT timesheet for approval."""
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
        """Only Manager/Dept Head/Executive/Admin, and only for someone
        already inside their own reporting line (get_queryset enforces
        that), and never your own timesheet."""
        approver = request.user
        if approver.role == "STAFF":
            return Response({"error": "Staff cannot approve timesheets."}, status=403)

        timesheet = self.get_object()
        if timesheet.user_id == approver.id:
            return Response({"error": "You cannot approve your own timesheet."}, status=403)

        try:
            timesheet = approve_timesheet(timesheet, approver)
        except TimesheetGenerationError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(TimesheetSerializer(timesheet).data)

    def update(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be edited directly. Use generate, submit, or approve."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be edited directly. Use generate, submit, or approve."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Timesheets cannot be deleted."}, status=403)

    def create(self, request, *args, **kwargs):
        return Response({"error": "Use /generate or /submit-manual to create a timesheet."}, status=403)
