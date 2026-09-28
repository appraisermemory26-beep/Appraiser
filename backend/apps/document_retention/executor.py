"""Resolves and physically removes the underlying document for an approved
DeletionRequest. Document type is referenced as a string (matches the
SOW Section 3.9 governance flow): policy_version, jd_version, project_document.
"""
from typing import Optional


def _resolve_document(document_type: str, document_id: int):
    if document_type == "policy_version":
        from apps.policies.models import PolicyVersion

        return PolicyVersion.objects.filter(id=document_id).first()
    if document_type == "jd_version":
        from apps.jd_management.models import JDVersion

        return JDVersion.objects.filter(id=document_id).first()
    if document_type == "project_document":
        from apps.projects.models import ProjectDocument

        return ProjectDocument.objects.filter(id=document_id).first()
    return None


def execute_deletion(deletion_request) -> Optional[str]:
    """Physically delete the document referenced by the request. Returns a
    human-readable description of what was removed, or None if not found."""
    doc = _resolve_document(deletion_request.document_type, deletion_request.document_id)
    if doc is None:
        return None

    description_parts = []
    file_field = getattr(doc, "file", None)
    if file_field and getattr(file_field, "name", ""):
        description_parts.append(file_field.name)
        try:
            file_field.delete(save=False)
        except Exception:
            pass

    description_parts.append(str(doc))
    doc.delete()
    return " - ".join(description_parts) or "document removed"
