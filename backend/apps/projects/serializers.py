from rest_framework import serializers

from .models import Project, ProjectDocument, ProjectMilestone, ProjectReport


class ProjectSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.SerializerMethodField()
    total_milestones = serializers.SerializerMethodField()
    completed_milestones = serializers.SerializerMethodField()
    total_tasks = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = Project
        fields = [
            "id", "name", "start_year", "end_year", "department", "department_name",
            "owner", "owner_name", "status", "organisation", "created_at", "updated_at",
            "progress_percentage", "total_milestones", "completed_milestones", "total_tasks",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "organisation", "owner"]

    def get_progress_percentage(self, obj: Project) -> int:
        if obj.status == Project.Status.COMPLETED:
            return 100
        if obj.status == Project.Status.CANCELLED:
            return 0
        milestones = list(obj.milestones.all())
        if milestones:
            done = sum(1 for m in milestones if m.is_completed)
            return round(done * 100 / len(milestones))
        # Fallback: average task progress
        task_pcts = list(obj.tasks.values_list("progress_percentage", flat=True))
        if task_pcts:
            return round(sum(task_pcts) / len(task_pcts))
        return 0

    def get_total_milestones(self, obj: Project) -> int:
        return obj.milestones.count()

    def get_completed_milestones(self, obj: Project) -> int:
        return obj.milestones.filter(is_completed=True).count()

    def get_total_tasks(self, obj: Project) -> int:
        return obj.tasks.count()

    def get_owner_name(self, obj: Project) -> str | None:
        if obj.owner is None:
            return None
        full = f"{obj.owner.first_name} {obj.owner.last_name}".strip()
        return full or obj.owner.email


class ProjectDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectDocument
        fields = ["id", "project", "category", "file", "uploaded_by", "version", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProjectMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMilestone
        fields = [
            "id", "project", "title", "description", "deadline",
            "is_completed", "completed_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectReport
        fields = [
            "id", "project", "title", "content", "period_start",
            "period_end", "is_ai_generated", "is_draft", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
