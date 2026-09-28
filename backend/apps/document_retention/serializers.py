from rest_framework import serializers

from .executor import _resolve_document
from .models import DeletionRequest

ALLOWED_DOCUMENT_TYPES = frozenset({"policy_version", "jd_version", "project_document"})


class DeletionRequestSerializer(serializers.ModelSerializer):
    document_description = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DeletionRequest
        fields = [
            "id", "document_type", "document_id", "document_description",
            "requested_by", "requested_by_name", "reason", "status",
            "approved_by", "approved_by_name", "organisation",
            "resolved_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "requested_by", "requested_by_name", "approved_by",
            "approved_by_name", "organisation", "status", "resolved_at",
            "document_description", "created_at", "updated_at",
        ]

    def validate_document_type(self, value):
        if value not in ALLOWED_DOCUMENT_TYPES:
            raise serializers.ValidationError(
                f"Invalid document_type. Must be one of: {', '.join(sorted(ALLOWED_DOCUMENT_TYPES))}"
            )
        return value

    def validate(self, attrs):
        document_type = attrs.get("document_type") or getattr(self.instance, "document_type", None)
        document_id = attrs.get("document_id") or getattr(self.instance, "document_id", None)
        if document_type and document_id is not None:
            if _resolve_document(document_type, document_id) is None:
                raise serializers.ValidationError(
                    {"document_id": f"No {document_type} found with id {document_id}."}
                )
        return attrs

    def get_document_description(self, obj):
        doc = _resolve_document(obj.document_type, obj.document_id)
        return str(doc) if doc else f"{obj.document_type}#{obj.document_id}"

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip()
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
        return ""
