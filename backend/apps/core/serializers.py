from rest_framework import serializers

from .models import KPITarget, InstitutionalPerformanceObjective


class KPITargetSerializer(serializers.ModelSerializer):
    set_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = KPITarget
        fields = [
            "id", "metric", "target_value", "period", "department",
            "department_name", "set_by", "set_by_name", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "set_by", "set_by_name", "department_name",
            "created_at", "updated_at",
        ]

    def get_set_by_name(self, obj):
        return f"{obj.set_by.first_name} {obj.set_by.last_name}".strip() if obj.set_by else ""

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else ""


class InstitutionalPerformanceObjectiveSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InstitutionalPerformanceObjective
        fields = [
            "id", "title", "description", "file", "period",
            "uploaded_by", "uploaded_by_name", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "uploaded_by", "uploaded_by_name", "created_at", "updated_at",
        ]

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return ""
        return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()

    def validate_file(self, value):
        import os

        if value:
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv"]:
                raise serializers.ValidationError(
                    "Supported formats: PDF, DOCX, DOC, XLSX, XLS, CSV."
                )
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("File must be under 10MB.")
        return value
