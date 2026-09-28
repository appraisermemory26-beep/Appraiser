"""Periodic Celery tasks for the task engine.

- send_deadline_reminders: 24 hours before a task deadline.
- send_stale_task_alerts: tasks not updated in 48 hours.
- close_overdue_milestones: re-evaluates milestone health.
"""
from celery import shared_task
from django.utils import timezone


@shared_task(name="tasks.send_deadline_reminders")
def send_deadline_reminders():
    """Notify assignee + supervisor for tasks whose deadline is within the
    next 24 hours and not yet closed."""
    from apps.notifications.models import Notification
    from apps.tasks.models import Task

    now = timezone.now()
    soon = now + timezone.timedelta(hours=24)
    qs = (
        Task.objects.filter(
            deadline__gte=now,
            deadline__lte=soon,
            status__in=["CREATED", "ASSIGNED", "IN_PROGRESS"],
        )
        .exclude(assigned_to__isnull=True)
        .select_related("assigned_to", "organisation", "created_by")
    )
    sent = 0
    for t in qs:
        already = Notification.objects.filter(
            user=t.assigned_to,
            notification_type="task_deadline_reminder",
            entity_type="task",
            entity_id=t.id,
            created_at__gte=now - timezone.timedelta(hours=24),
        ).exists()
        if already:
            continue
        Notification.objects.create(
            user=t.assigned_to,
            organisation=t.organisation,
            notification_type="task_deadline_reminder",
            title="Task deadline in <24h",
            message=f"Task {t.task_id} '{t.title}' is due {t.deadline:%Y-%m-%d %H:%M}.",
            entity_type="task",
            entity_id=t.id,
        )
        if t.created_by_id and t.created_by_id != t.assigned_to_id:
            Notification.objects.create(
                user=t.created_by,
                organisation=t.organisation,
                notification_type="task_deadline_reminder",
                title="Team task deadline in <24h",
                message=f"Task {t.task_id} '{t.title}' assigned to {t.assigned_to} is due soon.",
                entity_type="task",
                entity_id=t.id,
            )
        sent += 1
    return {"sent": sent}


@shared_task(name="tasks.send_stale_task_alerts")
def send_stale_task_alerts():
    """Notify the manager when a task hasn't been updated in 48 hours."""
    from apps.notifications.models import Notification
    from apps.tasks.models import Task

    now = timezone.now()
    cutoff = now - timezone.timedelta(hours=48)
    qs = (
        Task.objects.filter(
            updated_at__lte=cutoff,
            status__in=["ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
        )
        .exclude(created_by__isnull=True)
        .select_related("created_by", "organisation")
    )
    sent = 0
    for t in qs:
        recipient = t.created_by
        already = Notification.objects.filter(
            user=recipient,
            notification_type="task_stale_alert",
            entity_type="task",
            entity_id=t.id,
            created_at__gte=now - timezone.timedelta(hours=24),
        ).exists()
        if already:
            continue
        Notification.objects.create(
            user=recipient,
            organisation=t.organisation,
            notification_type="task_stale_alert",
            title="Task not updated in 48h",
            message=f"Task {t.task_id} '{t.title}' has had no activity in 48 hours.",
            entity_type="task",
            entity_id=t.id,
        )
        sent += 1
    return {"sent": sent}
