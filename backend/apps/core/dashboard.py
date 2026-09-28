"""Custom dashboard callback for Unfold admin."""

from django.db.models import Sum, F
from django.utils import timezone


def dashboard_callback(request, context):
    from apps.accounts.models import User
    from apps.ai_tools.models import AIOutput
    from apps.attention.models import ActivityLog, BreakLog, TimeLog
    from apps.audit.models import AuditLog
    from apps.jd_management.models import JDVersion, JobDescription
    from apps.messaging.models import Conversation, Message
    from apps.notifications.models import Notification
    from apps.organisations.models import Department, Organisation
    from apps.policies.models import Policy, PolicyAcknowledgment, PolicyVersion
    from apps.projects.models import Project, ProjectDocument, ProjectMilestone
    from apps.tasks.models import Task

    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)
    seven_days_ago = now - timezone.timedelta(days=7)

    # ── KPI Stats (top cards) ──
    total_users = User.objects.filter(is_active=True).count()
    total_orgs = Organisation.objects.count()
    total_projects = Project.objects.count()
    active_projects = Project.objects.filter(status="ACTIVE").count()
    total_tasks = Task.objects.count()
    open_tasks = Task.objects.filter(
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS"]
    ).count()
    total_departments = Department.objects.count()
    new_users_week = User.objects.filter(date_joined__gte=seven_days_ago).count()
    overdue_tasks = Task.objects.filter(
        deadline__lt=now,
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
    ).count()

    # ── Project breakdown ──
    proj_active = active_projects
    proj_on_hold = Project.objects.filter(status="ON_HOLD").count()
    proj_completed = Project.objects.filter(status="COMPLETED").count()
    proj_cancelled = Project.objects.filter(status="CANCELLED").count()

    # ── Policies & Compliance ──
    total_policies = Policy.objects.count()
    total_policy_versions = PolicyVersion.objects.count()
    total_acknowledgments = PolicyAcknowledgment.objects.count()
    new_policies_month = Policy.objects.filter(created_at__gte=thirty_days_ago).count()

    # ── Job Descriptions ──
    total_jds = JobDescription.objects.count()
    ai_generated_jds = JDVersion.objects.filter(is_ai_generated=True).count()

    # ── Messaging ──
    total_conversations = Conversation.objects.count()
    total_messages = Message.objects.count()
    messages_this_week = Message.objects.filter(created_at__gte=seven_days_ago).count()

    # ── Milestones ──
    total_milestones = ProjectMilestone.objects.count()
    completed_milestones = ProjectMilestone.objects.filter(is_completed=True).count()
    pending_milestones = total_milestones - completed_milestones
    upcoming_milestones = ProjectMilestone.objects.filter(
        is_completed=False,
        deadline__gte=now,
        deadline__lte=now + timezone.timedelta(days=14),
    ).order_by("deadline")[:5]

    # ── Documents ──
    total_documents = ProjectDocument.objects.count()

    # ── AI Tools ──
    total_ai_outputs = AIOutput.objects.count()
    ai_this_month = AIOutput.objects.filter(created_at__gte=thirty_days_ago).count()
    ai_type_counts = {}
    for choice in AIOutput.OutputType.choices:
        c = AIOutput.objects.filter(output_type=choice[0]).count()
        if c > 0:
            ai_type_counts[choice[1]] = c

    # ── Notifications ──
    total_notifications = Notification.objects.count()
    unread_notifications = Notification.objects.filter(is_read=False).count()

    # ── Time & Activity ──
    active_timers = TimeLog.objects.filter(ended_at__isnull=True).count()
    total_time_logs = TimeLog.objects.count()
    total_activity_logs = ActivityLog.objects.count()
    total_break_logs = BreakLog.objects.count()

    # ── User role distribution ──
    role_counts = {}
    for role_choice in User.Role.choices:
        role_counts[role_choice[1]] = User.objects.filter(
            role=role_choice[0], is_active=True
        ).count()

    # ── Recent activity ──
    recent_audit = AuditLog.objects.order_by("-timestamp")[:8]

    context.update(
        {
            "dashboard": True,
            # KPIs
            "total_users": total_users,
            "total_orgs": total_orgs,
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_tasks": total_tasks,
            "open_tasks": open_tasks,
            "total_departments": total_departments,
            "overdue_tasks": overdue_tasks,
            "new_users_week": new_users_week,
            # Projects
            "proj_active": proj_active,
            "proj_on_hold": proj_on_hold,
            "proj_completed": proj_completed,
            "proj_cancelled": proj_cancelled,
            # Policies
            "total_policies": total_policies,
            "total_policy_versions": total_policy_versions,
            "total_acknowledgments": total_acknowledgments,
            "new_policies_month": new_policies_month,
            # Job Descriptions
            "total_jds": total_jds,
            "ai_generated_jds": ai_generated_jds,
            # Messaging
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "messages_this_week": messages_this_week,
            # Milestones
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "pending_milestones": pending_milestones,
            "upcoming_milestones": upcoming_milestones,
            # Documents
            "total_documents": total_documents,
            # AI Tools
            "total_ai_outputs": total_ai_outputs,
            "ai_this_month": ai_this_month,
            "ai_type_counts": ai_type_counts,
            # Notifications
            "total_notifications": total_notifications,
            "unread_notifications": unread_notifications,
            # Time & Activity
            "active_timers": active_timers,
            "total_time_logs": total_time_logs,
            "total_activity_logs": total_activity_logs,
            "total_break_logs": total_break_logs,
            # Role distribution
            "role_counts": role_counts,
            # Recent
            "recent_audit": recent_audit,
        }
    )

    return context
