from rest_framework import serializers

from .models import TimeLog, ActivityLog, BreakLog


class TimeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeLog
        fields = ["id", "user", "task", "started_at", "ended_at", "organisation", "created_at", "updated_at"]
        read_only_fields = ["id", "user", "organisation", "created_at", "updated_at"]
        extra_kwargs = {
            "started_at": {"required": False},
        }


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ["id", "user", "activity_type", "started_at", "ended_at", "organisation", "created_at", "updated_at"]
        read_only_fields = ["id", "user", "organisation", "created_at", "updated_at"]
        extra_kwargs = {
            "started_at": {"required": False},
        }


class BreakLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreakLog
        fields = ["id", "user", "break_type", "started_at", "ended_at", "organisation", "created_at", "updated_at"]
        read_only_fields = ["id", "user", "organisation", "created_at", "updated_at"]
        extra_kwargs = {
            "started_at": {"required": False},
        }
