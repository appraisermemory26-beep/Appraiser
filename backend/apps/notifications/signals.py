from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.attention.models import BreakLog
from apps.messaging.models import Message

from .services import notify_message_sent, notify_staff_leave


@receiver(post_save, sender=Message)
def on_message_created(sender, instance, created, **kwargs):
    if created:
        notify_message_sent(message=instance)


@receiver(post_save, sender=BreakLog)
def on_break_log_created(sender, instance, created, **kwargs):
    if created and instance.break_type in {"ANNUAL_LEAVE", "SICK_LEAVE"}:
        notify_staff_leave(user=instance.user, break_type=instance.break_type)
