from rest_framework import serializers

from .models import Timesheet, TimesheetDay


class TimesheetDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimesheetDay
        fields = ["id", "date", "day_type", "hours", "source"]
        read_only_fields = ["id"]


class TimesheetSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    position = serializers.CharField(source="user.job_title", read_only=True, default="")
    department_name = serializers.CharField(source="user.department.name", read_only=True, default=None)
    institution_name = serializers.CharField(source="institution.name", read_only=True, default=None)
    currency = serializers.CharField(source="institution.default_currency", read_only=True, default=None)
    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name", read_only=True, default=None
    )
    accepted_by_name = serializers.CharField(
        source="accepted_by.get_full_name", read_only=True, default=None
    )
    current_approver_name = serializers.CharField(
        source="current_approver.get_full_name", read_only=True, default=None
    )
    last_action_by_name = serializers.CharField(
        source="last_action_by.get_full_name", read_only=True, default=None
    )
    days = TimesheetDaySerializer(many=True, read_only=True)

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "user",
            "user_name",
            "position",
            "department_name",
            "organisation",
            "institution",
            "institution_name",
            "currency",
            "period_start",
            "period_end",
            "total_days_worked",
            "total_hours",
            "annual_leave_days",
            "upa_leave_days",
            "sick_leave_days",
            "holiday_days",
            "other_leave_days",
            "source",
            "status",
            "accepted_at",
            "accepted_by",
            "accepted_by_name",
            "requires_acceptance",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "approval_comment",
            "current_approver",
            "current_approver_name",
            "last_action_by",
            "last_action_by_name",
            "last_action_at",
            "last_action_comment",
            "days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "user", "organisation", "source", "status",
            "accepted_at", "accepted_by", "requires_acceptance",
            "approved_at", "approved_by", "approval_comment",
            "current_approver", "last_action_by", "last_action_at", "last_action_comment",
            "created_at", "updated_at",
        ]


class TimesheetGenerateSerializer(serializers.Serializer):
    institution = serializers.IntegerField()
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


class TimesheetDayUpdateSerializer(serializers.Serializer):
    day_type = serializers.ChoiceField(choices=TimesheetDay.DayType.choices)
    hours = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0)


class TimesheetApproveSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REVISE", "REJECT"], required=False, default="APPROVE")
    comment = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, data):
        if data.get("action") in ("REVISE", "REJECT") and not data.get("comment", "").strip():
            raise serializers.ValidationError({"comment": "A reason is required to request revision or reject."})
        return data