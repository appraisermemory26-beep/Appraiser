from rest_framework import serializers

from .models import AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "user", "organisation", "date",
            "clock_in", "clock_out", "status", "note",
            "recorded_by", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "user", "organisation", "date",
            "clock_in", "clock_out", "status",
            "recorded_by", "created_at", "updated_at",
        ]
