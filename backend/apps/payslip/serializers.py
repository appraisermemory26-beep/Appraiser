from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Payslip


class PayslipSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    is_payday_soon = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = [
            "id", "user", "user_name", "organisation", "timesheet",
            "period_start", "period_end", "currency", "pay_frequency",
            "gross_pay", "total_statutory_employee", "total_statutory_employer",
            "total_tax", "total_deductions", "net_pay", "breakdown",
            "generated_at", "hidden_by_employee", "is_payday_soon",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "user", "organisation", "timesheet",
            "period_start", "period_end", "currency", "pay_frequency",
            "gross_pay", "total_statutory_employee", "total_statutory_employer",
            "total_tax", "total_deductions", "net_pay", "breakdown",
            "generated_at", "hidden_by_employee", "created_at", "updated_at",
        ]

    def get_is_payday_soon(self, obj):
        today = timezone.now().date()
        payday = obj.period_end + timedelta(days=5)
        return 0 <= (payday - today).days <= 3
