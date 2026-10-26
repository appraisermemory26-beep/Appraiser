from rest_framework import serializers

from .models import PayrollConfiguration, StatutoryScheme, TaxBracket


class PayrollConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollConfiguration
        fields = ["id", "organisation", "currency", "pay_frequency", "created_at", "updated_at"]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]


class StatutorySchemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatutoryScheme
        fields = [
            "id", "payroll_configuration", "name", "employee_rate", "employer_rate",
            "effective_date", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TaxBracketSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxBracket
        fields = [
            "id", "payroll_configuration", "lower_bound", "upper_bound", "rate",
            "effective_date", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]