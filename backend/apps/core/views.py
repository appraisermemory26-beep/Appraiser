from django.core.cache import cache
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsOrganisationMember,
    IsExecutiveOrAbove,
    IsBoardMember,
)

from .models import KPITarget, InstitutionalPerformanceObjective
from .serializers import KPITargetSerializer, InstitutionalPerformanceObjectiveSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def status(request):
    return Response({"status": "ok", "service": "appraiser"})


# ─── Dashboard helpers ───────────────────────────────────────────────────────


def _task_metrics(tasks_qs, now):
    """Standard task metrics from a queryset."""
    total = tasks_qs.count()
    open_count = tasks_qs.filter(
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS"]
    ).count()
    overdue = tasks_qs.filter(
        deadline__lt=now,
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
    ).count()
    completed = tasks_qs.filter(status="CLOSED").count()
    return {
        "total_tasks": total,
        "open_tasks": open_count,
        "overdue_tasks": overdue,
        "completed_tasks": completed,
        "task_completion_pct": round((completed / max(total, 1)) * 100),
    }


def _dept_stats(depts_qs, org_tasks_qs, now):
    """Per-department breakdown with frontend-expected keys."""
    stats = []
    for dept in depts_qs:
        dept_tasks = org_tasks_qs.filter(department=dept)
        dt = dept_tasks.count()
        dc = dept_tasks.filter(status="CLOSED").count()
        do = dept_tasks.filter(
            deadline__lt=now,
            status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
        ).count()
        stats.append(
            {
                "name": dept.name,
                "total_tasks": dt,
                "completion_pct": round((dc / max(dt, 1)) * 100),
                "overdue": do,
            }
        )
    return stats


def _project_health(projects_qs):
    """Per-project health summary for active/on-hold projects."""
    from apps.projects.models import ProjectMilestone

    health = []
    for proj in projects_qs.filter(status__in=["ACTIVE", "ON_HOLD"]):
        ms_total = ProjectMilestone.objects.filter(project=proj).count()
        ms_done = ProjectMilestone.objects.filter(
            project=proj, is_completed=True
        ).count()
        health.append(
            {
                "id": proj.id,
                "name": proj.name,
                "status": proj.status,
                "completion_pct": round((ms_done / max(ms_total, 1)) * 100),
            }
        )
    return health


# ─── Per-role builders ───────────────────────────────────────────────────────


def _staff_stats(user, org, now):
    """STAFF: personal tasks plus institutional memory from predecessors."""
    from apps.attention.models import TimeLog
    from apps.notifications.models import Notification
    from apps.tasks.models import Task

    seven_days_ago = now - timezone.timedelta(days=7)
    predecessor_ids = user.predecessor_user_ids()
    my_tasks = Task.objects.filter(organisation_id=org).filter(
        Q(assigned_to=user) | Q(assigned_to_id__in=predecessor_ids)
    )
    closed = my_tasks.filter(status="CLOSED").count()
    open_count = my_tasks.filter(
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS"]
    ).count()
    overdue = my_tasks.filter(
        deadline__lt=now,
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
    ).count()
    total = open_count + closed

    return {
        "my_tasks": my_tasks.count(),
        "my_open": open_count,
        "my_completed": closed,
        "my_overdue": overdue,
        "tasks_this_week": my_tasks.filter(created_at__gte=seven_days_ago).count(),
        "task_completion_pct": round((closed / max(total, 1)) * 100),
        "unread_notifications": Notification.objects.filter(
            user=user, is_read=False
        ).count(),
        "active_timers": TimeLog.objects.filter(
            user=user, ended_at__isnull=True
        ).count(),
    }


def _manager_stats(user, org, now):
    """MANAGER: team scope (self + direct reports + created by self + predecessors)."""
    from apps.notifications.models import Notification
    from apps.projects.models import Project
    from apps.tasks.models import Task

    seven_days_ago = now - timezone.timedelta(days=7)
    direct_report_ids = list(user.direct_reports.values_list("id", flat=True))
    team_ids = [user.id] + direct_report_ids
    predecessor_ids = user.predecessor_user_ids()

    team_tasks = Task.objects.filter(organisation_id=org).filter(
        Q(assigned_to__in=team_ids)
        | Q(assigned_to_id__in=predecessor_ids)
        | Q(created_by=user)
        | Q(created_by_id__in=predecessor_ids)
    )

    result = _task_metrics(team_tasks, now)
    result["team_members"] = len(direct_report_ids)
    result["team_tasks"] = result["total_tasks"]
    result["pending_reviews"] = team_tasks.filter(status="SUBMITTED").count()
    result["tasks_this_week"] = team_tasks.filter(
        created_at__gte=seven_days_ago
    ).count()

    # Projects scoped to team
    team_projects = Project.objects.filter(organisation_id=org, owner__in=team_ids)
    result["active_projects"] = team_projects.filter(status="ACTIVE").count()
    result["total_projects"] = team_projects.count()
    result["proj_completed"] = team_projects.filter(status="COMPLETED").count()

    result["unread_notifications"] = Notification.objects.filter(
        user=user, is_read=False
    ).count()
    return result


def _dept_head_stats(user, org, now):
    """DEPT_HEAD: department scope (departments this user heads)."""
    from apps.notifications.models import Notification
    from apps.organisations.models import Department
    from apps.tasks.models import Task

    seven_days_ago = now - timezone.timedelta(days=7)

    # Departments this user heads; fall back to user's own department
    my_depts = Department.objects.filter(organisation_id=org, head=user)
    if not my_depts.exists() and user.department_id:
        my_depts = Department.objects.filter(id=user.department_id)

    dept_ids = list(my_depts.values_list("id", flat=True))
    dept_tasks = Task.objects.filter(organisation_id=org, department__in=dept_ids)
    org_tasks = Task.objects.filter(organisation_id=org)

    result = _task_metrics(dept_tasks, now)
    result["total_departments"] = len(dept_ids)
    result["tasks_this_week"] = dept_tasks.filter(
        created_at__gte=seven_days_ago
    ).count()
    result["pending_reviews"] = dept_tasks.filter(status="SUBMITTED").count()
    result["dept_stats"] = _dept_stats(my_depts, org_tasks, now)
    result["unread_notifications"] = Notification.objects.filter(
        user=user, is_read=False
    ).count()
    return result


def _executive_stats(user, org, now):
    """EXECUTIVE: org-wide aggregates, no individual time logs."""
    from apps.notifications.models import Notification
    from apps.organisations.models import Department
    from apps.projects.models import Project
    from apps.tasks.models import Task

    tasks_qs = Task.objects.filter(organisation_id=org)
    result = _task_metrics(tasks_qs, now)

    completed = result["completed_tasks"]
    on_time = tasks_qs.filter(status="CLOSED", deadline__gte=F("updated_at")).count()
    result["execution_score"] = round((completed / max(result["total_tasks"], 1)) * 100)
    result["on_time_rate"] = round((on_time / max(completed, 1)) * 100)

    depts_qs = Department.objects.filter(organisation_id=org)
    result["total_departments"] = depts_qs.count()
    result["dept_stats"] = _dept_stats(depts_qs, tasks_qs, now)

    projects_qs = Project.objects.filter(organisation_id=org)
    result["project_health"] = _project_health(projects_qs)
    result["active_projects"] = projects_qs.filter(status="ACTIVE").count()
    result["total_projects"] = projects_qs.count()

    result["unread_notifications"] = Notification.objects.filter(
        user=user, is_read=False
    ).count()
    return result


def _board_stats(user, org, now):
    """BOARD_MEMBER: same as executive + read_only flag."""
    result = _executive_stats(user, org, now)
    result["read_only"] = True
    return result


def _admin_stats(user, org, now):
    """ADMIN: full org view with all modules."""
    from apps.accounts.models import User
    from apps.ai_tools.models import AIOutput
    from apps.attention.models import TimeLog
    from apps.jd_management.models import JobDescription
    from apps.messaging.models import Conversation, Message
    from apps.notifications.models import Notification
    from apps.organisations.models import Department
    from apps.policies.models import Policy, PolicyAcknowledgment
    from apps.projects.models import Project, ProjectDocument, ProjectMilestone
    from apps.tasks.models import Task

    thirty_days_ago = now - timezone.timedelta(days=30)
    seven_days_ago = now - timezone.timedelta(days=7)

    # Users
    users_qs = User.objects.filter(is_active=True)
    if org:
        users_qs = users_qs.filter(organisation_id=org)
    total_users = users_qs.count()

    # Tasks
    tasks_qs = Task.objects.filter(organisation_id=org) if org else Task.objects.all()
    result = _task_metrics(tasks_qs, now)
    result["tasks_this_week"] = tasks_qs.filter(created_at__gte=seven_days_ago).count()
    result["total_users"] = total_users

    # Departments
    depts_qs = (
        Department.objects.filter(organisation_id=org)
        if org
        else Department.objects.none()
    )
    result["total_departments"] = depts_qs.count()
    result["dept_stats"] = _dept_stats(depts_qs, tasks_qs, now)

    # Pending reviews
    result["pending_reviews"] = tasks_qs.filter(status="SUBMITTED").count()

    # Execution metrics
    completed = result["completed_tasks"]
    on_time = tasks_qs.filter(status="CLOSED", deadline__gte=F("updated_at")).count()
    result["execution_score"] = round((completed / max(result["total_tasks"], 1)) * 100)
    result["on_time_rate"] = round((on_time / max(completed, 1)) * 100)

    # Projects
    projects_qs = (
        Project.objects.filter(organisation_id=org)
        if org
        else Project.objects.none()
    )
    result["total_projects"] = projects_qs.count()
    result["active_projects"] = projects_qs.filter(status="ACTIVE").count()
    result["proj_completed"] = projects_qs.filter(status="COMPLETED").count()
    result["project_health"] = _project_health(projects_qs)

    # Milestones
    milestones_qs = ProjectMilestone.objects.all()
    if org:
        milestones_qs = milestones_qs.filter(project__organisation_id=org)
    result["total_milestones"] = milestones_qs.count()
    result["completed_milestones"] = milestones_qs.filter(is_completed=True).count()
    upcoming = (
        milestones_qs.filter(
            is_completed=False,
            deadline__gte=now,
            deadline__lte=now + timezone.timedelta(days=14),
        )
        .order_by("deadline")
        .values("id", "title", "deadline")[:5]
    )
    result["upcoming_milestones"] = list(upcoming)

    # Policies
    policies_qs = Policy.objects.all()
    if org:
        policies_qs = policies_qs.filter(organisation_id=org)
    result["total_policies"] = policies_qs.count()

    ack_qs = PolicyAcknowledgment.objects.all()
    if org:
        ack_qs = ack_qs.filter(policy_version__policy__organisation_id=org)
    result["total_acknowledgments"] = ack_qs.count()

    # Documents
    docs_qs = ProjectDocument.objects.all()
    if org:
        docs_qs = docs_qs.filter(project__organisation_id=org)
    result["total_documents"] = docs_qs.count()

    # Job Descriptions
    jd_qs = JobDescription.objects.all()
    if org:
        jd_qs = jd_qs.filter(organisation_id=org)
    result["total_jds"] = jd_qs.count()

    # Messaging
    msg_qs = Message.objects.all()
    if org:
        msg_qs = msg_qs.filter(organisation_id=org)
    result["total_messages"] = msg_qs.count()
    result["messages_this_week"] = msg_qs.filter(
        created_at__gte=seven_days_ago
    ).count()

    convo_qs = Conversation.objects.all()
    if org:
        convo_qs = convo_qs.filter(organisation_id=org)
    result["total_conversations"] = convo_qs.count()

    # AI
    ai_qs = AIOutput.objects.all()
    if org:
        ai_qs = ai_qs.filter(organisation_id=org)
    result["total_ai_outputs"] = ai_qs.count()
    result["ai_this_month"] = ai_qs.filter(created_at__gte=thirty_days_ago).count()

    # Notifications
    result["unread_notifications"] = Notification.objects.filter(
        user=user, is_read=False
    ).count()

    # Time logs
    time_qs = TimeLog.objects.all()
    if org:
        time_qs = time_qs.filter(organisation_id=org)
    result["active_timers"] = time_qs.filter(ended_at__isnull=True).count()

    return result


# ─── Dashboard endpoint ──────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Return role-scoped dashboard stats for the frontend."""
    user = request.user
    org = user.organisation_id
    now = timezone.now()

    builders = {
        "STAFF": _staff_stats,
        "MANAGER": _manager_stats,
        "DEPT_HEAD": _dept_head_stats,
        "EXECUTIVE": _executive_stats,
        "BOARD_MEMBER": _board_stats,
        "ADMIN": _admin_stats,
    }
    builder = builders.get(user.role, _staff_stats)
    return Response(builder(user, org, now))


# ─── Accountability dashboard (Executive/Board) ──────────────────────────────


def _classify_project(proj, now) -> str:
    """ON_TRACK / DELAYED / CRITICAL based on milestones + deadline proximity."""
    from apps.projects.models import ProjectMilestone

    overdue_ms = ProjectMilestone.objects.filter(
        project=proj, is_completed=False, deadline__lt=now.date()
    ).count()
    upcoming_ms = ProjectMilestone.objects.filter(
        project=proj, is_completed=False, deadline__lte=now.date() + timezone.timedelta(days=14),
    ).count()
    if overdue_ms >= 2:
        return "CRITICAL"
    if overdue_ms >= 1:
        return "DELAYED"
    if upcoming_ms == 0 and proj.status == "ACTIVE":
        return "ON_TRACK"
    return "ON_TRACK"


def _accountability_payload(org_id: int, now):
    from apps.organisations.models import Department
    from apps.projects.models import Project, ProjectMilestone
    from apps.tasks.models import Task

    tasks_qs = Task.objects.filter(organisation_id=org_id)
    total = tasks_qs.count()
    completed = tasks_qs.filter(status="CLOSED").count()
    on_time = tasks_qs.filter(status="CLOSED", deadline__gte=F("updated_at")).count()
    execution_score = round((completed / max(total, 1)) * 100)
    on_time_rate = round((on_time / max(completed, 1)) * 100)

    depts_qs = Department.objects.filter(organisation_id=org_id)
    dept_perf = []
    for d in depts_qs:
        d_total = tasks_qs.filter(department=d).count()
        d_done = tasks_qs.filter(department=d, status="CLOSED").count()
        dept_perf.append(
            {
                "id": d.id,
                "name": d.name,
                "completion_pct": round((d_done / max(d_total, 1)) * 100),
                "task_total": d_total,
            }
        )
    dept_perf.sort(key=lambda r: r["completion_pct"], reverse=True)

    projects = []
    for proj in Project.objects.filter(organisation_id=org_id):
        ms_total = ProjectMilestone.objects.filter(project=proj).count()
        ms_done = ProjectMilestone.objects.filter(project=proj, is_completed=True).count()
        projects.append(
            {
                "id": proj.id,
                "name": proj.name,
                "status": proj.status,
                "health": _classify_project(proj, now),
                "completion_pct": round((ms_done / max(ms_total, 1)) * 100),
                "department_id": proj.department_id,
            }
        )

    overdue_tasks = tasks_qs.filter(
        deadline__lt=now,
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
    )
    alerts = []
    for t in overdue_tasks.select_related("department")[:50]:
        alerts.append(
            {
                "type": "overdue_task",
                "task_id": t.id,
                "task_label": t.task_id,
                "title": t.title,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "department_id": t.department_id,
                "department_name": t.department.name if t.department_id else "",
            }
        )
    delayed_milestones = ProjectMilestone.objects.filter(
        project__organisation_id=org_id, is_completed=False, deadline__lt=now.date()
    ).select_related("project")[:50]
    for m in delayed_milestones:
        alerts.append(
            {
                "type": "delayed_milestone",
                "milestone_id": m.id,
                "title": m.title,
                "deadline": m.deadline.isoformat() if m.deadline else None,
                "project_id": m.project_id,
                "project_name": m.project.name,
            }
        )

    targets = []
    for t in KPITarget.objects.filter(organisation_id=org_id).select_related("department"):
        if t.metric == "TASK_COMPLETION_RATE":
            actual = execution_score
        elif t.metric == "ON_TIME_DELIVERY":
            actual = on_time_rate
        else:
            # DEPT_PRODUCTIVITY → if scoped to a department, that dept's completion %
            actual = next(
                (d["completion_pct"] for d in dept_perf if d["id"] == t.department_id), 0
            )
        target = float(t.target_value)
        diff = actual - target
        if diff >= 0:
            status_color = "green"
        elif diff >= -10:
            status_color = "amber"
        else:
            status_color = "red"
        targets.append(
            {
                "id": t.id,
                "metric": t.metric,
                "period": t.period,
                "department": t.department_id,
                "department_name": t.department.name if t.department_id else "",
                "target": target,
                "actual": actual,
                "status": status_color,
            }
        )

    return {
        "execution_score": execution_score,
        "on_time_rate": on_time_rate,
        "department_performance": dept_perf,
        "projects": projects,
        "alerts": alerts,
        "kpi_targets": targets,
        "generated_at": now.isoformat(),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsOrganisationMember, IsExecutiveOrAbove])
def accountability_dashboard(request):
    """Executive/Board accountability view. Cached for 60 seconds per
    SOW 3.7 ('Execution score recalculated within 60 seconds')."""
    org_id = request.user.organisation_id
    cache_key = f"accountability:{org_id}"
    payload = cache.get(cache_key)
    if not payload or request.query_params.get("refresh") == "1":
        payload = _accountability_payload(org_id, timezone.now())
        cache.set(cache_key, payload, 60)
    return Response(payload)


class KPITargetViewSet(viewsets.ModelViewSet):
    """Board-only mutation; Executive read-only."""

    serializer_class = KPITargetSerializer

    def get_queryset(self):
        return KPITarget.objects.filter(organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAuthenticated(), IsOrganisationMember(), IsExecutiveOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember(), IsBoardMember()]

    def perform_create(self, serializer):
        serializer.save(
            organisation=self.request.user.organisation,
            set_by=self.request.user,
        )
        # Invalidate accountability cache so the new target shows up immediately
        cache.delete(f"accountability:{self.request.user.organisation_id}")

    def perform_update(self, serializer):
        serializer.save()
        cache.delete(f"accountability:{self.request.user.organisation_id}")

    def perform_destroy(self, instance):
        instance.delete()
        cache.delete(f"accountability:{self.request.user.organisation_id}")


class InstitutionalPerformanceObjectiveViewSet(viewsets.ModelViewSet):
    """PMCS M&E uploads — Board uploads; Executive+ read."""

    serializer_class = InstitutionalPerformanceObjectiveSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return InstitutionalPerformanceObjective.objects.filter(
            organisation=self.request.user.organisation
        )

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAuthenticated(), IsOrganisationMember(), IsExecutiveOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember(), IsBoardMember()]

    def perform_create(self, serializer):
        serializer.save(
            organisation=self.request.user.organisation,
            uploaded_by=self.request.user,
        )
