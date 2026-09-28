import os

from rest_framework import serializers

from .models import Task, TaskOutput, TaskReview, TaskStatusChange


class TaskOutputSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskOutput
        fields = [
            "id", "task", "submitted_by", "submitted_by_name",
            "file", "text_content", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return f"{obj.submitted_by.first_name} {obj.submitted_by.last_name}".strip()
        return None

    def validate_file(self, value):
        if value:
            ext = os.path.splitext(value.name)[1].lower()
            allowed = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp']
            if ext not in allowed:
                raise serializers.ValidationError("Only PDF, DOCX, and image files are allowed.")
            if value.size > 25 * 1024 * 1024:
                raise serializers.ValidationError("File must be under 25MB.")
        return value


class TaskReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskReview
        fields = ["id", "task", "reviewer", "reviewer_name", "action", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            return f"{obj.reviewer.first_name} {obj.reviewer.last_name}".strip()
        return None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    is_inherited = serializers.SerializerMethodField()
    inherited_from_name = serializers.SerializerMethodField()
    outputs = TaskOutputSerializer(many=True, read_only=True)
    reviews = TaskReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "task_id", "title", "description", "objectives",
            "deadline", "deadline_type", "status", "assigned_to",
            "assigned_to_name", "created_by", "created_by_name",
            "organisation", "department", "department_name", "project",
            "parent_task", "linked_jd", "progress_percentage", "priority",
            "is_inherited", "inherited_from_name",
            "outputs", "reviews", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "task_id", "created_by", "organisation", "created_at", "updated_at"]

    def validate_status(self, value):
        """Validate status transitions when updating via PATCH/PUT."""
        if self.instance and self.instance.status != value:
            from .models import VALID_TRANSITIONS
            valid = VALID_TRANSITIONS.get(self.instance.status, [])
            if value not in valid:
                raise serializers.ValidationError(
                    f"Cannot transition from {self.instance.status} to {value}. "
                    f"Use the /transition/ endpoint for supervisor overrides."
                )
        return value

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None

    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        return None

    def _predecessor_names(self):
        """Per-request cache of {predecessor_id: full_name} for the viewer."""
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return {}
        cache_key = "_predecessor_name_map"
        if cache_key in self.context:
            return self.context[cache_key]
        names: dict[int, str] = {}
        viewer = request.user
        ids = viewer.predecessor_user_ids() if hasattr(viewer, "predecessor_user_ids") else []
        if ids:
            from apps.accounts.models import User
            for u in User.objects.filter(id__in=ids).only("id", "first_name", "last_name"):
                names[u.id] = f"{u.first_name} {u.last_name}".strip()
        self.context[cache_key] = names
        return names

    def get_is_inherited(self, obj):
        names = self._predecessor_names()
        return obj.assigned_to_id in names or obj.created_by_id in names

    def get_inherited_from_name(self, obj):
        names = self._predecessor_names()
        return names.get(obj.assigned_to_id) or names.get(obj.created_by_id)


class TaskStatusChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskStatusChange
        fields = ["id", "task", "from_status", "to_status", "changed_by", "comment", "timestamp"]
        read_only_fields = ["id", "timestamp"]
