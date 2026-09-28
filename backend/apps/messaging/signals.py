from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.tasks.models import Task
from .models import Conversation, ConversationParticipant


@receiver(post_save, sender=Task)
def manage_task_thread(sender, instance, created, **kwargs):
    """Auto-create a message thread when a task is created,
    and keep the assignee as a participant when (re)assigned."""
    if created:
        # Create the thread
        conv = Conversation.objects.create(
            conversation_type="TASK_THREAD",
            task=instance,
            organisation=instance.organisation,
            created_by=instance.created_by,
        )
        # Add creator
        if instance.created_by:
            ConversationParticipant.objects.get_or_create(conversation=conv, user=instance.created_by)
        # Add assignee
        if instance.assigned_to:
            ConversationParticipant.objects.get_or_create(conversation=conv, user=instance.assigned_to)
            # Notify assignee
            _notify_assignment(instance)
    else:
        # On update — ensure assignee is in the thread and notified
        if instance.assigned_to:
            conv = Conversation.objects.filter(
                conversation_type="TASK_THREAD",
                task=instance,
            ).first()
            if conv:
                added, _ = ConversationParticipant.objects.get_or_create(
                    conversation=conv, user=instance.assigned_to
                )


def _notify_assignment(task):
    """Create a notification for the assigned user."""
    from apps.notifications.services import notify_task_assigned
    if task.assigned_to and task.created_by and task.assigned_to != task.created_by:
        notify_task_assigned(task=task)
