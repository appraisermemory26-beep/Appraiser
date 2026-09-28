from datetime import timedelta

from django.db.models import F, Sum, ExpressionWrapper, DurationField
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember, IsManagerOrAbove

from .models import TimeLog, ActivityLog, BreakLog
from .serializers import TimeLogSerializer, ActivityLogSerializer, BreakLogSerializer


class TimeLogViewSet(viewsets.ModelViewSet):
    serializer_class = TimeLogSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user', 'task']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = TimeLog.objects.filter(organisation=user.organisation)
        predecessor_ids = user.predecessor_user_ids()
        if user.role == "STAFF":
            return qs.filter(user_id__in=[user.id] + predecessor_ids)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id] + predecessor_ids)
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id] + predecessor_ids)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            organisation=self.request.user.organisation,
            started_at=serializer.validated_data.get("started_at", timezone.now()),
        )

    def update(self, request, *args, **kwargs):
        return Response({"error": "Time logs are immutable."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Time logs are immutable."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Time logs are immutable."}, status=403)


class ActivityLogViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user', 'activity_type']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = ActivityLog.objects.filter(organisation=user.organisation)
        predecessor_ids = user.predecessor_user_ids()
        if user.role == "STAFF":
            return qs.filter(user_id__in=[user.id] + predecessor_ids)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id] + predecessor_ids)
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id] + predecessor_ids)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            organisation=self.request.user.organisation,
            started_at=serializer.validated_data.get("started_at", timezone.now()),
        )

    def update(self, request, *args, **kwargs):
        return Response({"error": "Activity logs are immutable."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Activity logs are immutable."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Activity logs are immutable."}, status=403)

    @action(detail=True, methods=["post"], url_path="stop")
    def stop_activity(self, request, pk=None):
        log = self.get_object()
        if log.user_id != request.user.id and request.user.role == "STAFF":
            return Response({"error": "Cannot stop another user's activity log."}, status=403)
        if log.ended_at:
            return Response({"status": "already_stopped"})
        log.ended_at = timezone.now()
        log.save(update_fields=["ended_at"])
        return Response({"status": "stopped", "id": log.id})


class BreakLogViewSet(viewsets.ModelViewSet):
    serializer_class = BreakLogSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user', 'break_type']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = BreakLog.objects.filter(organisation=user.organisation)
        predecessor_ids = user.predecessor_user_ids()
        if user.role == "STAFF":
            return qs.filter(user_id__in=[user.id] + predecessor_ids)
        if user.role == "MANAGER":
            direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
            return qs.filter(user_id__in=direct_report_ids + [user.id] + predecessor_ids)
        if user.role == "DEPT_HEAD" and user.department_id:
            dept_user_ids = list(user.department.members.values_list("id", flat=True))
            return qs.filter(user_id__in=dept_user_ids + [user.id] + predecessor_ids)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            organisation=self.request.user.organisation,
            started_at=serializer.validated_data.get("started_at", timezone.now()),
        )

    def update(self, request, *args, **kwargs):
        return Response({"error": "Break logs are immutable."}, status=403)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Break logs are immutable."}, status=403)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Break logs are immutable."}, status=403)

    @action(detail=True, methods=["post"], url_path="stop")
    def stop_break(self, request, pk=None):
        log = self.get_object()
        if log.user_id != request.user.id and request.user.role == "STAFF":
            return Response({"error": "Cannot stop another user's break log."}, status=403)
        if log.ended_at:
            return Response({"status": "already_stopped"})
        log.ended_at = timezone.now()
        log.save(update_fields=["ended_at"])
        return Response({"status": "stopped", "id": log.id})


def _aggregate_time_seconds(qs, now):
    """Sum total seconds across closed and currently-running TimeLog rows."""
    closed = qs.filter(ended_at__isnull=False).annotate(
        dur=ExpressionWrapper(F("ended_at") - F("started_at"), output_field=DurationField())
    ).aggregate(total=Sum("dur"))["total"] or timedelta(0)
    open_total = timedelta(0)
    for log in qs.filter(ended_at__isnull=True):
        open_total += now - log.started_at
    return int((closed + open_total).total_seconds())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attention_summary(request):
    """Return current user's daily/weekly attention summary."""
    user = request.user
    org = user.organisation
    now = timezone.now()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timezone.timedelta(days=day_start.weekday())

    def safe_duration(qs):
        seconds = 0
        for row in qs.only("started_at", "ended_at"):
            if row.ended_at and row.started_at:
                seconds += int((row.ended_at - row.started_at).total_seconds())
        return seconds

    day_time_qs = TimeLog.objects.filter(user=user, organisation=org, started_at__gte=day_start, ended_at__isnull=False)
    day_activity_qs = ActivityLog.objects.filter(user=user, organisation=org, started_at__gte=day_start, ended_at__isnull=False)
    day_break_qs = BreakLog.objects.filter(user=user, organisation=org, started_at__gte=day_start, ended_at__isnull=False)
    week_time_qs = TimeLog.objects.filter(user=user, organisation=org, started_at__gte=week_start, ended_at__isnull=False)

    return Response(
        {
            "today_task_seconds": safe_duration(day_time_qs),
            "today_activity_seconds": safe_duration(day_activity_qs),
            "today_break_seconds": safe_duration(day_break_qs),
            "week_task_seconds": safe_duration(week_time_qs),
            "active_time_log_count": TimeLog.objects.filter(user=user, organisation=org, ended_at__isnull=True).count(),
            "active_activity_count": ActivityLog.objects.filter(user=user, organisation=org, ended_at__isnull=True).count(),
            "active_break_count": BreakLog.objects.filter(user=user, organisation=org, ended_at__isnull=True).count(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_time_summary(request):
    """Return today and this-week aggregated time-on-task for the current user."""
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    user_qs = TimeLog.objects.filter(
        organisation=request.user.organisation, user=request.user
    )
    return Response({
        "today_seconds": _aggregate_time_seconds(user_qs.filter(started_at__gte=today_start), now),
        "week_seconds": _aggregate_time_seconds(user_qs.filter(started_at__gte=week_start), now),
        "active_timer": user_qs.filter(ended_at__isnull=True).exists(),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsOrganisationMember, IsManagerOrAbove])
def team_time_summary(request):
    """Manager view: today's and week's seconds-on-task per direct report."""
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())

    direct_reports = list(request.user.direct_reports.all())
    rows = []
    for member in direct_reports:
        m_qs = TimeLog.objects.filter(
            organisation=request.user.organisation, user=member
        )
        rows.append({
            "user_id": member.id,
            "name": f"{member.first_name} {member.last_name}".strip(),
            "today_seconds": _aggregate_time_seconds(m_qs.filter(started_at__gte=today_start), now),
            "week_seconds": _aggregate_time_seconds(m_qs.filter(started_at__gte=week_start), now),
        })
    return Response({"members": rows})
