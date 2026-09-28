from .models import AuditLog


def create_audit_log(
    *,
    event_type: str,
    event_category: str,
    description: str,
    user=None,
    organisation=None,
    **kwargs,
):
    """Create an audit log when an organisation context is available."""
    org = organisation
    if org is None and user is not None and user.organisation_id:
        org = user.organisation
    if org is None:
        return None
    return AuditLog.objects.create(
        event_type=event_type,
        event_category=event_category,
        user=user,
        organisation=org,
        description=description,
        **kwargs,
    )
