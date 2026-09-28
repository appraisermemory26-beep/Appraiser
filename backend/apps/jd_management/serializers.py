import os

from rest_framework import serializers

from .models import JobDescription, JDVersion


class JDVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = JDVersion
        fields = [
            "id", "job_description", "version_number", "file",
            "content_text", "uploaded_by", "uploaded_by_name",
            "is_ai_generated", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return ""

    def validate_file(self, value):
        if value:
            allowed_extensions = ['.pdf', '.docx', '.doc']
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError("Only PDF and DOCX files are allowed.")
            # Max 10MB
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("File size must not exceed 10MB.")
        return value


class JobDescriptionSerializer(serializers.ModelSerializer):
    versions = JDVersionSerializer(many=True, read_only=True)
    linked_user_name = serializers.SerializerMethodField()

    class Meta:
        model = JobDescription
        fields = [
            "id", "title", "department", "role_title", "organisation",
            "current_version", "linked_user", "linked_user_name", "versions",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def get_linked_user_name(self, obj):
        if obj.linked_user:
            return f"{obj.linked_user.first_name} {obj.linked_user.last_name}".strip()
        return ""
