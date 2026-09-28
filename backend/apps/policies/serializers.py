import os

from rest_framework import serializers

from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgment


class PolicyCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyCategory
        fields = ["id", "name", "organisation", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PolicyVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PolicyVersion
        fields = [
            "id", "policy", "version_number", "file",
            "uploaded_by", "uploaded_by_name", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}"
        return None

    def validate_file(self, value):
        if value:
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in ['.pdf', '.docx', '.doc']:
                raise serializers.ValidationError("Only PDF and DOCX files are allowed.")
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("File must be under 10MB.")
        return value


class PolicySerializer(serializers.ModelSerializer):
    versions = PolicyVersionSerializer(many=True, read_only=True)
    acknowledgment_count = serializers.SerializerMethodField()
    total_staff = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = [
            "id", "title", "description", "category", "organisation",
            "current_version", "versions", "acknowledgment_count",
            "total_staff", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def get_acknowledgment_count(self, obj):
        """Number of users who acknowledged the current version."""
        current = obj.versions.filter(version_number=obj.current_version).first()
        if not current:
            return 0
        return current.acknowledgments.count()

    def get_total_staff(self, obj):
        """Total active staff in the organisation."""
        from apps.accounts.models import User
        return User.objects.filter(
            organisation=obj.organisation,
            employment_status="ACTIVE",
        ).count()


class PolicyAcknowledgmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyAcknowledgment
        fields = ["id", "policy_version", "user", "acknowledged_at"]
        read_only_fields = ["id", "user", "acknowledged_at"]
