"""Signals that invalidate the accountability dashboard cache when relevant
data changes, so executive/board views reflect within seconds (SOW 3.7)."""
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


def _invalidate(org_id):
    if org_id:
        cache.delete(f"accountability:{org_id}")


@receiver([post_save, post_delete], sender="tasks.Task")
def _on_task_change(sender, instance, **kwargs):
    _invalidate(getattr(instance, "organisation_id", None))


@receiver([post_save, post_delete], sender="projects.ProjectMilestone")
def _on_milestone_change(sender, instance, **kwargs):
    proj = getattr(instance, "project", None)
    _invalidate(getattr(proj, "organisation_id", None) if proj else None)


@receiver([post_save, post_delete], sender="projects.Project")
def _on_project_change(sender, instance, **kwargs):
    _invalidate(getattr(instance, "organisation_id", None))
