from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.audit.models import AuditLog

from .models import PolicyVersion


DEFAULT_CATEGORIES = [
    "Strategic Plan",
    "HR Policies",
    "Finance & Procurement",
    "Operations",
    "Compliance",
    "Custom",
]


@receiver(post_save, sender=PolicyVersion)
def on_new_policy_version(sender, instance, created, **kwargs):
    """Bump the parent policy's current_version pointer and notify users who
    previously acknowledged the policy that a re-acknowledgment is required."""
    if not created:
        return

    policy = instance.policy
    policy.current_version = instance.version_number
    policy.save(update_fields=["current_version", "updated_at"])

    if instance.version_number == 1:
        from apps.notifications.services import notify_policy_version_uploaded
        notify_policy_version_uploaded(
            policy=policy,
            version=instance,
            uploaded_by=instance.uploaded_by,
        )
        AuditLog.objects.create(
            event_type="policy_version_uploaded",
            event_category="POLICY",
            user=instance.uploaded_by,
            organisation=policy.organisation,
            description=f"Policy '{policy.title}' published as v{instance.version_number}",
            entity_type="policy_version",
            entity_id=instance.id,
            metadata={"policy_id": policy.id, "version_number": instance.version_number},
        )
        return

    from apps.notifications.services import notify_policy_version_uploaded
    notify_policy_version_uploaded(
        policy=policy,
        version=instance,
        uploaded_by=instance.uploaded_by,
    )

    AuditLog.objects.create(
        event_type="policy_version_uploaded",
        event_category="POLICY",
        user=instance.uploaded_by,
        organisation=policy.organisation,
        description=f"Policy '{policy.title}' updated to v{instance.version_number}",
        entity_type="policy_version",
        entity_id=instance.id,
        metadata={"policy_id": policy.id, "version_number": instance.version_number},
    )
