from rest_framework import serializers

from .models import Timesheet


class TimesheetSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name", read_only=True, default=None
    )

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "user",
            "user_name",
            "organisation",
            "period_start",
            "period_end",
            "total_days_worked",
            "total_hours",
            "annual_leave_days",
            "sick_leave_days",
            "holiday_days",
            "other_leave_days",
            "source",
            "status",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "user", "organisation", "source", "status",
            "approved_at", "approved_by", "created_at", "updated_at",
        ]


class TimesheetManualEntrySerializer(serializers.Serializer):
    period_start = serializers.DateField()
    period_end = serializers.DateField()
    total_days_worked = serializers.IntegerField(min_value=0)
    total_hours = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)
    annual_leave_days = serializers.IntegerField(min_value=0, default=0)
    sick_leave_days = serializers.IntegerField(min_value=0, default=0)
    holiday_days = serializers.IntegerField(min_value=0, default=0)
    other_leave_days = serializers.IntegerField(min_value=0, default=0)
