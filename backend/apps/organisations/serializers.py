from rest_framework import serializers

from .models import Organisation, Department, Unit, Division, ReportingLine


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = [
            "id", "name", "slug", "logo", "address", "phone", "email",
            "website", "is_setup_complete", "organogram_file",
            "organogram_parse_status", "organogram_structure", "organogram_parsed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id",
            "organogram_parse_status",
            "organogram_structure",
            "organogram_parsed_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        # If trying to mark setup as complete, organogram must exist
        is_setup = attrs.get('is_setup_complete', None)
        if is_setup is True:
            organogram = attrs.get('organogram_file', None)
            instance = getattr(self, 'instance', None)
            has_organogram = organogram or (instance and instance.organogram_file)
            if not has_organogram:
                raise serializers.ValidationError({
                    "organogram_file": "Organisation setup cannot be marked complete without uploading an organogram."
                })
        return attrs


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "organisation", "parent", "head", "created_at", "updated_at"]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "department", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = ["id", "name", "unit", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ReportingLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportingLine
        fields = ["id", "subordinate", "supervisor", "organisation", "created_at", "updated_at"]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]
