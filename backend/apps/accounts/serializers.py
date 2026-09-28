from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    succeeded_by_name = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "middle_name", "last_name", "full_name",
            "role", "employment_status", "organisation", "department",
            "reports_to", "phone", "avatar", "job_title",
            "succeeded_by", "succeeded_by_name",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "employment_status", "full_name", "succeeded_by_name",
            "created_at", "updated_at",
        ]

    def validate_succeeded_by(self, value):
        if value is None:
            return value
        subject = self.instance
        if subject and value.pk == subject.pk:
            raise serializers.ValidationError("A user cannot be their own successor.")
        if value.employment_status != User.EmploymentStatus.ACTIVE:
            raise serializers.ValidationError("Successor must be an active employee.")
        request = self.context.get("request")
        if request and value.organisation_id != request.user.organisation_id:
            raise serializers.ValidationError("Successor must belong to your organisation.")
        return value

    def get_succeeded_by_name(self, obj):
        if obj.succeeded_by_id:
            return obj.succeeded_by.full_name
        return ""


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "middle_name", "last_name", "password",
            "role", "organisation", "department", "reports_to",
            "phone", "job_title",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        # If no password provided, the view's perform_create handles temp password.
        user.save()
        return user


class UserMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "middle_name", "last_name", "full_name", "role", "job_title"]
