"""Central helpers for creating in-app notifications."""

from __future__ import annotations

from typing import Iterable

from apps.accounts.models import User

MANAGER_ROLES = frozenset({"MANAGER", "DEPT_HEAD", "EXECUTIVE", "ADMIN"})

EMPLOYMENT_STATUS_LABELS = {
    "ACTIVE": "Active",
    "RESIGNED": "Resigned",
    "TERMINATED": "Terminated",
    "CONTRACT_ENDED": "Contract Ended",
}

LEAVE_BREAK_TYPES = frozenset({"ANNUAL_LEAVE", "SICK_LEAVE"})

LEAVE_BREAK_LABELS = {
    "ANNUAL_LEAVE": "annual leave",
    "SICK_LEAVE": "sick leave",
}


def _user_display(user) -> str:
    if user is None:
        return "Someone"
    name = getattr(user, "full_name", None) or ""
    return name.strip() or getattr(user, "email", "Someone")


def notify_user(
    *,
    user,
    organisation,
    notification_type: str,
    title: str,
    message: str,
    entity_type: str = "",
    entity_id: int | None = None,
):
    if not user or not organisation:
        return None
    from .models import Notification

    return Notification.objects.create(
        user=user,
        organisation=organisation,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def notify_users(
    *,
    user_ids: Iterable[int],
    organisation,
    notification_type: str,
    title: str,
    message: str,
    entity_type: str = "",
    entity_id: int | None = None,
    exclude_user_ids: Iterable[int] | None = None,
):
    if not organisation:
        return 0
    exclude = set(exclude_user_ids or [])
    unique_ids = [uid for uid in dict.fromkeys(user_ids) if uid and uid not in exclude]
    if not unique_ids:
        return 0

    from .models import Notification

    Notification.objects.bulk_create(
        [
            Notification(
                user_id=uid,
                organisation=organisation,
                notification_type=notification_type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=entity_id,
            )
            for uid in unique_ids
        ]
    )
    return len(unique_ids)


def active_org_user_ids(organisation, *, exclude_ids: Iterable[int] | None = None):
    if not organisation:
        return []
    qs = User.objects.filter(organisation=organisation, employment_status="ACTIVE")
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
    return list(qs.values_list("id", flat=True))


def manager_user_ids(organisation, *, exclude_ids: Iterable[int] | None = None):
    if not organisation:
        return []
    qs = User.objects.filter(
        organisation=organisation,
        employment_status="ACTIVE",
        role__in=MANAGER_ROLES,
    )
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
    return list(qs.values_list("id", flat=True))


def notify_org(
    *,
    organisation,
    notification_type: str,
    title: str,
    message: str,
    entity_type: str = "",
    entity_id: int | None = None,
    exclude_user_ids: Iterable[int] | None = None,
):
    return notify_users(
        user_ids=active_org_user_ids(organisation, exclude_ids=exclude_user_ids),
        organisation=organisation,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def notify_managers(
    *,
    organisation,
    notification_type: str,
    title: str,
    message: str,
    entity_type: str = "",
    entity_id: int | None = None,
    exclude_user_ids: Iterable[int] | None = None,
):
    return notify_users(
        user_ids=manager_user_ids(organisation, exclude_ids=exclude_user_ids),
        organisation=organisation,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def notify_employment_status_change(*, subject, old_status: str, new_status: str, reason: str, changed_by):
    organisation = subject.organisation
    if not organisation:
        return

    subject_name = _user_display(subject)
    new_label = EMPLOYMENT_STATUS_LABELS.get(new_status, new_status)
    title = f"Employment update: {subject_name}"
    message = (
        f"{subject_name}'s employment status changed from "
        f"{EMPLOYMENT_STATUS_LABELS.get(old_status, old_status)} to {new_label}. "
        f"Reason: {reason}"
    )
    if changed_by and changed_by.id != subject.id:
        message += f" (updated by {_user_display(changed_by)})"

    notify_org(
        organisation=organisation,
        notification_type="employment_status_change",
        title=title,
        message=message,
        entity_type="user",
        entity_id=subject.id,
        exclude_user_ids=[subject.id],
    )


def notify_staff_leave(*, user, break_type: str):
    organisation = user.organisation
    if not organisation or break_type not in LEAVE_BREAK_TYPES:
        return

    leave_label = LEAVE_BREAK_LABELS.get(break_type, break_type.replace("_", " ").lower())
    user_name = _user_display(user)
    notify_org(
        organisation=organisation,
        notification_type="staff_leave",
        title=f"{user_name} is on {leave_label}",
        message=f"{user_name} has started {leave_label}.",
        entity_type="user",
        entity_id=user.id,
        exclude_user_ids=[user.id],
    )


def notify_message_sent(*, message):
    from apps.messaging.models import ConversationParticipant

    sender = message.sender
    conversation = message.conversation
    if not sender or not conversation:
        return

    participant_ids = list(
        ConversationParticipant.objects.filter(conversation=conversation)
        .exclude(user_id=sender.id)
        .values_list("user_id", flat=True)
    )
    if not participant_ids:
        return

    preview = (message.content or "").strip().replace("\n", " ")
    if len(preview) > 180:
        preview = preview[:177] + "..."

    sender_name = _user_display(sender)
    if conversation.conversation_type == "TASK_THREAD" and conversation.task_id:
        context_label = f"task {conversation.task.task_id}"
    elif conversation.conversation_type == "GROUP":
        context_label = "group chat"
    else:
        context_label = "direct message"

    notify_users(
        user_ids=participant_ids,
        organisation=message.organisation,
        notification_type="message_received",
        title=f"New message from {sender_name}",
        message=f"{sender_name} ({context_label}): {preview or '[attachment]'}",
        entity_type="message",
        entity_id=message.id,
    )


def notify_task_assigned(*, task):
    if not task.assigned_to_id or not task.organisation_id:
        return
    notify_user(
        user=task.assigned_to,
        organisation=task.organisation,
        notification_type="task_assigned",
        title="Task assigned to you",
        message=f"You have been assigned task '{task.task_id}: {task.title}'.",
        entity_type="task",
        entity_id=task.id,
    )


def notify_task_submitted(*, task, submitted_by):
    organisation = task.organisation
    if not organisation:
        return

    submitter_name = _user_display(submitted_by)
    recipient_ids = set(manager_user_ids(organisation, exclude_ids=[submitted_by.id]))
    if task.created_by_id and task.created_by_id != submitted_by.id:
        recipient_ids.add(task.created_by_id)

    notify_users(
        user_ids=recipient_ids,
        organisation=organisation,
        notification_type="task_submitted",
        title="Task submitted for review",
        message=f"{submitter_name} submitted output for '{task.task_id}: {task.title}'.",
        entity_type="task",
        entity_id=task.id,
    )


def notify_task_reviewed(*, task, reviewer, action: str, comment: str = ""):
    if not task.assigned_to_id:
        return

    action_messages = {
        "APPROVED": ("Task approved", "approved"),
        "REJECTED": ("Task submission rejected", "rejected"),
        "RETURNED": ("Task returned for revision", "returned for revision"),
    }
    title, summary = action_messages.get(action, ("Task reviewed", action.lower()))
    message = f"Your submission for '{task.task_id}: {task.title}' was {summary}."
    if comment:
        message += f" Feedback: {comment}"
    reviewer_name = _user_display(reviewer)
    if reviewer:
        message += f" (Reviewed by {reviewer_name})"

    notify_user(
        user=task.assigned_to,
        organisation=task.organisation,
        notification_type="task_reviewed",
        title=title,
        message=message,
        entity_type="task",
        entity_id=task.id,
    )


def notify_policy_version_uploaded(*, policy, version, uploaded_by):
    organisation = policy.organisation
    if not organisation:
        return

    uploader = _user_display(uploaded_by)
    if version.version_number == 1:
        title = "New policy published"
        message = f"{uploader} published policy '{policy.title}' (v{version.version_number})."
        notification_type = "policy_published"
    else:
        title = "Policy updated"
        message = (
            f"{uploader} uploaded v{version.version_number} of '{policy.title}'. "
            "Please review and acknowledge if required."
        )
        notification_type = "policy_updated"

    notify_org(
        organisation=organisation,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type="policy_version",
        entity_id=version.id,
        exclude_user_ids=[uploaded_by.id] if uploaded_by else None,
    )


def notify_policy_created(*, policy, created_by):
    organisation = policy.organisation
    if not organisation:
        return
    notify_org(
        organisation=organisation,
        notification_type="policy_created",
        title="New policy added",
        message=f"{_user_display(created_by)} added policy '{policy.title}' to the vault.",
        entity_type="policy",
        entity_id=policy.id,
        exclude_user_ids=[created_by.id] if created_by else None,
    )
