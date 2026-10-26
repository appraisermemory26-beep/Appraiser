from rest_framework import serializers

from .models import Organisation, Department, Unit, Division, ReportingLine, Institution


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = [
            "id", "name", "slug", "logo", "address", "phone", "email", "website",
            "is_setup_complete", "attendance_enforced", "organogram_file",
            "organogram_parse_status", "organogram_structure", "organogram_parsed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organogram_parse_status", "organogram_structure", "organogram_parsed_at", "created_at", "updated_at"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "organisation", "parent", "head", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


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
        read_only_fields = ["id", "created_at", "updated_at"]


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = ["id", "name", "organisation", "country", "default_currency", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]