from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember

from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer

LATE_CUTOFF_HOUR = 9
CORRECTION_ALLOWED_ROLES = {"MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"}


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    ordering = ["-date"]

    def get_queryset(self):
        user = self.request.user
        qs = AttendanceRecord.objects.filter(organisation=user.organisation)
        if user.role == "STAFF":
            return qs.filter(user_id=user.id)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id])
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id])
        return qs

    def update(self, request, *args, **kwargs):
        return Response({"error": "Attendance records cannot be edited directly. Use clock-out, or ask a manager for a correction."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Attendance records cannot be edited directly. Use clock-out, or ask a manager for a correction."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Attendance records cannot be deleted."}, status=403)

    @action(detail=False, methods=["post"], url_path="clock-in")
    def clock_in(self, request):
        user = request.user
        today = timezone.localdate()
        if AttendanceRecord.objects.filter(organisation=user.organisation, user=user, date=today).exists():
            return Response({"error": "You have already clocked in today."}, status=400)

        now = timezone.now()
        local_hour = timezone.localtime(now).hour
        status_value = AttendanceRecord.Status.LATE if local_hour >= LATE_CUTOFF_HOUR else AttendanceRecord.Status.PRESENT

        record = AttendanceRecord.objects.create(
            user=user,
            organisation=user.organisation,
            date=today,
            clock_in=now,
            status=status_value,
        )
        return Response(AttendanceRecordSerializer(record).data, status=201)

    @action(detail=False, methods=["post"], url_path="clock-out")
    def clock_out(self, request):
        user = request.user
        today = timezone.localdate()
        record = AttendanceRecord.objects.filter(organisation=user.organisation, user=user, date=today).first()
        if not record:
            return Response({"error": "You have not clocked in today."}, status=400)
        if record.clock_out:
            return Response({"error": "You have already clocked out today."}, status=400)

        record.clock_out = timezone.now()
        record.save(update_fields=["clock_out"])
        return Response(AttendanceRecordSerializer(record).data)

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        user = request.user
        today = timezone.localdate()
        record = AttendanceRecord.objects.filter(organisation=user.organisation, user=user, date=today).first()
        if not record:
            return Response(None)
        return Response(AttendanceRecordSerializer(record).data)

    @action(detail=True, methods=["post"], url_path="correct")
    def correct(self, request, pk=None):
        actor = request.user
        if actor.role not in CORRECTION_ALLOWED_ROLES:
            return Response({"error": "Only a Manager, Department Head, Executive, Board Member, or Admin may correct an attendance record."}, status=403)

        record = self.get_object()
        reason = (request.data.get("note") or "").strip()
        if not reason:
            return Response({"error": "A reason is required to correct an attendance record."}, status=400)

        update_fields = {"note": reason, "recorded_by": actor}

        new_clock_out = request.data.get("clock_out")
        if new_clock_out:
            update_fields["clock_out"] = new_clock_out

        new_status = request.data.get("status")
        if new_status:
            if new_status not in AttendanceRecord.Status.values:
                return Response({"error": f"Invalid status. Choose one of: {AttendanceRecord.Status.values}"}, status=400)
            update_fields["status"] = new_status

        AttendanceRecord.objects.filter(pk=record.pk).update(**update_fields)
        record.refresh_from_db()
        return Response(AttendanceRecordSerializer(record).data)
