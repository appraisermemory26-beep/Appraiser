"""Periodic Celery tasks for document retention.

SOW 3.9: documents must be retained for at least 10 years from upload. Older
documents become eligible for deletion review (we surface them as PENDING
deletion suggestions; only Board approval can actually remove them).
"""
from celery import shared_task
from django.utils import timezone


@shared_task(name="retention.cleanup_expired_documents")
def cleanup_expired_documents():
    """Surface 10-year-expired documents to board members as deletion suggestions."""
    from apps.notifications.models import Notification
    from apps.accounts.models import User
    from apps.policies.models import PolicyVersion
    from apps.jd_management.models import JDVersion
    from apps.projects.models import ProjectDocument

    cutoff = timezone.now() - timezone.timedelta(days=365 * 10)
    flagged = 0
    for model, label in (
        (PolicyVersion, "policy_version"),
        (JDVersion, "jd_version"),
        (ProjectDocument, "project_document"),
    ):
        for doc in model.objects.filter(created_at__lte=cutoff)[:200]:
            org_id = (
                getattr(doc, "organisation_id", None)
                or getattr(getattr(doc, "policy", None), "organisation_id", None)
                or getattr(getattr(doc, "job_description", None), "organisation_id", None)
                or getattr(getattr(doc, "project", None), "organisation_id", None)
            )
            if not org_id:
                continue
            board_members = User.objects.filter(
                organisation_id=org_id, role="BOARD_MEMBER", employment_status="ACTIVE"
            )
            for board in board_members:
                already = Notification.objects.filter(
                    user=board,
                    notification_type="retention_review_required",
                    entity_type=label,
                    entity_id=doc.id,
                ).exists()
                if already:
                    continue
                Notification.objects.create(
                    user=board,
                    organisation_id=org_id,
                    notification_type="retention_review_required",
                    title="10-year retention review",
                    message=f"{label} #{doc.id} has reached 10 years; board may decide to retain or initiate deletion.",
                    entity_type=label,
                    entity_id=doc.id,
                )
            flagged += 1
    return {"flagged": flagged}
