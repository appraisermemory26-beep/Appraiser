from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember, IsManagerOrAbove, IsManagerOrAboveExcludingBoard
from apps.audit.models import AuditLog

from .models import Task, TaskOutput, TaskReview, TaskStatusChange, VALID_TRANSITIONS
from .serializers import (
    TaskSerializer, TaskOutputSerializer,
    TaskReviewSerializer, TaskStatusChangeSerializer,
)


def _staff_can_act_on_task(user, task):
    """Staff may work tasks assigned to them or inherited from inactive predecessors."""
    if task.assigned_to_id == user.id:
        return True
    return task.assigned_to_id in user.predecessor_user_ids()


def _promote_to_assigned_if_needed(task, *, changed_by, comment=""):
    """Advance CREATED → ASSIGNED when the task already has an assignee."""
    if not task.assigned_to_id or task.status != Task.Status.CREATED:
        return False
    old_status = task.status
    task.status = Task.Status.ASSIGNED
    task.save(skip_transition_check=True)
    TaskStatusChange.objects.create(
        task=task,
        from_status=old_status,
        to_status=task.status,
        changed_by=changed_by,
        comment=comment or "Task assigned",
    )
    return True


def _notify_task_assigned(task, organisation):
    if not task.assigned_to_id:
        return
    from apps.notifications.services import notify_task_assigned
    notify_task_assigned(task=task)
    from apps.messaging.models import Conversation, ConversationParticipant
    conv = Conversation.objects.filter(conversation_type="TASK_THREAD", task=task).first()
    if conv:
        ConversationParticipant.objects.get_or_create(conversation=conv, user=task.assigned_to)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'department', 'deadline_type']
    search_fields = ['title', 'description', 'task_id']
    ordering_fields = ['created_at', 'deadline', 'status', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Task.objects.filter(organisation=user.organisation)
        from django.db.models import Q
        predecessor_ids = user.predecessor_user_ids()
        if user.role == 'STAFF':
            qs = qs.filter(Q(assigned_to=user) | Q(assigned_to_id__in=predecessor_ids))
        elif user.role == 'MANAGER':
            direct_report_ids = list(user.direct_reports.values_list('id', flat=True))
            qs = qs.filter(
                Q(assigned_to=user)
                | Q(assigned_to_id__in=direct_report_ids)
                | Q(assigned_to_id__in=predecessor_ids)
                | Q(created_by=user)
                | Q(created_by_id__in=predecessor_ids)
            )
        elif user.role == 'DEPT_HEAD' and user.department_id:
            qs = qs.filter(
                Q(department_id=user.department_id)
                | Q(assigned_to__department_id=user.department_id)
                | Q(created_by=user)
                | Q(assigned_to_id__in=predecessor_ids)
                | Q(created_by_id__in=predecessor_ids)
            )
        return qs.prefetch_related("outputs", "reviews", "reviews__reviewer")

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAboveExcludingBoard()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            organisation=self.request.user.organisation,
        )
        instance = serializer.instance
        promoted = _promote_to_assigned_if_needed(
            instance,
            changed_by=self.request.user,
            comment="Assignee set at creation",
        )
        AuditLog.objects.create(
            event_type="task_created",
            event_category="TASK",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=f"Task '{instance.task_id}: {instance.title}' created",
            entity_type="task",
            entity_id=instance.id,
        )
        if instance.assigned_to_id:
            _notify_task_assigned(instance, self.request.user.organisation)
            if promoted:
                AuditLog.objects.create(
                    event_type="task_status_change",
                    event_category="TASK",
                    user=self.request.user,
                    organisation=self.request.user.organisation,
                    description=f"Task {instance.task_id} status changed from CREATED to ASSIGNED. Assignee set at creation",
                    entity_type="task",
                    entity_id=instance.id,
                    metadata={"from": "CREATED", "to": "ASSIGNED", "comment": "Assignee set at creation"},
                )

    def perform_update(self, serializer):
        old_task = self.get_object()
        old_assigned = old_task.assigned_to_id
        old_deadline = old_task.deadline
        instance = serializer.save()
        user = self.request.user
        org = user.organisation
        if old_assigned != instance.assigned_to_id:
            AuditLog.objects.create(
                event_type="task_assigned",
                event_category="TASK",
                user=user,
                organisation=org,
                description=f"Task {instance.task_id} assigned to {instance.assigned_to}",
                entity_type="task",
                entity_id=instance.id,
                metadata={"old_assigned_to": old_assigned, "new_assigned_to": instance.assigned_to_id},
            )
            if instance.assigned_to:
                _notify_task_assigned(instance, org)
        if instance.assigned_to_id:
            promoted = _promote_to_assigned_if_needed(
                instance,
                changed_by=user,
                comment="Assignee updated",
            )
            if promoted:
                AuditLog.objects.create(
                    event_type="task_status_change",
                    event_category="TASK",
                    user=user,
                    organisation=org,
                    description=f"Task {instance.task_id} status changed from CREATED to ASSIGNED. Assignee updated",
                    entity_type="task",
                    entity_id=instance.id,
                    metadata={"from": "CREATED", "to": "ASSIGNED", "comment": "Assignee updated"},
                )
        if old_deadline != instance.deadline:
            AuditLog.objects.create(
                event_type="task_deadline_changed",
                event_category="TASK",
                user=user,
                organisation=org,
                description=f"Task {instance.task_id} deadline changed from {old_deadline} to {instance.deadline}",
                entity_type="task",
                entity_id=instance.id,
                metadata={"old_deadline": str(old_deadline), "new_deadline": str(instance.deadline)},
            )

    @action(detail=True, methods=["post"], url_path="transition")
    def transition_status(self, request, pk=None):
        """Transition task to a new status with audit logging.
        Expects: { "status": "IN_PROGRESS", "comment": "optional" }
        """
        task = self.get_object()
        new_status = request.data.get("status")
        comment = request.data.get("comment", "")

        if not new_status:
            return Response({"error": "status is required"}, status=400)

        old_status = task.status

        if request.user.role == "STAFF" and not _staff_can_act_on_task(request.user, task):
            return Response(
                {"error": "You can only update tasks assigned to you or inherited from a predecessor."},
                status=403,
            )

        # Validate transition
        valid_next = list(VALID_TRANSITIONS.get(old_status, []))
        # Assignee (or successor) can start work directly on legacy CREATED tasks.
        if (
            old_status == "CREATED"
            and new_status == "IN_PROGRESS"
            and request.user.role == "STAFF"
            and _staff_can_act_on_task(request.user, task)
        ):
            valid_next.append("IN_PROGRESS")
        # Supervisors (Manager+) can also force backward transitions
        if request.user.role in ['MANAGER', 'DEPT_HEAD', 'EXECUTIVE', 'ADMIN']:
            valid_next = list(set(valid_next + list(VALID_TRANSITIONS.keys())))

        if new_status not in valid_next:
            return Response(
                {"error": f"Cannot transition from {old_status} to {new_status}"},
                status=400,
            )

        task.status = new_status
        task.save(skip_transition_check=True)

        # Create TaskStatusChange record
        TaskStatusChange.objects.create(
            task=task, from_status=old_status, to_status=new_status,
            changed_by=request.user, comment=comment,
        )

        # Log to AuditLog
        AuditLog.objects.create(
            event_type="task_status_change",
            event_category="TASK",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Task {task.task_id} status changed from {old_status} to {new_status}. {comment}".strip(),
            entity_type="task",
            entity_id=task.id,
            metadata={"from": old_status, "to": new_status, "comment": comment},
        )

        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="submit-output")
    def submit_output(self, request, pk=None):
        """Submit task output (file or text) and transition to SUBMITTED."""
        task = self.get_object()

        if task.status != "IN_PROGRESS":
            return Response(
                {"error": "Task must be In Progress to submit output"}, status=400
            )

        file = request.FILES.get("file")
        text_content = request.data.get("text_content", "")

        if not file and not text_content:
            return Response(
                {"error": "Provide a file or text content"}, status=400
            )

        # Create output
        output = TaskOutput.objects.create(
            task=task, submitted_by=request.user,
            file=file, text_content=text_content,
        )

        # Transition to SUBMITTED
        old_status = task.status
        task.status = "SUBMITTED"
        task.save(skip_transition_check=True)

        TaskStatusChange.objects.create(
            task=task, from_status=old_status, to_status="SUBMITTED",
            changed_by=request.user, comment="Output submitted",
        )

        AuditLog.objects.create(
            event_type="task_submitted",
            event_category="TASK",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Task {task.task_id} output submitted by {request.user.first_name} {request.user.last_name}",
            entity_type="task",
            entity_id=task.id,
        )

        from apps.notifications.services import notify_task_submitted
        notify_task_submitted(task=task, submitted_by=request.user)

        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="review")
    def review_task(self, request, pk=None):
        """Review a submitted task. Expects: { action: APPROVED|REJECTED|RETURNED, comment: "" }
        - APPROVED: SUBMITTED -> REVIEWED
        - REJECTED/RETURNED: SUBMITTED -> IN_PROGRESS (preserves outputs)
        """
        task = self.get_object()
        action_type = request.data.get("action")
        comment = request.data.get("comment", "")

        if task.status != "SUBMITTED":
            return Response(
                {"error": "Only submitted tasks can be reviewed"}, status=400
            )

        if action_type not in ["APPROVED", "REJECTED", "RETURNED"]:
            return Response(
                {"error": "action must be APPROVED, REJECTED, or RETURNED"},
                status=400,
            )

        # Only managers+ can review
        if request.user.role not in ['MANAGER', 'DEPT_HEAD', 'EXECUTIVE', 'ADMIN']:
            return Response(
                {"error": "Only managers can review tasks"}, status=403
            )

        # Create review record
        TaskReview.objects.create(
            task=task, reviewer=request.user, action=action_type, comment=comment,
        )

        old_status = task.status
        if action_type == "APPROVED":
            task.status = "REVIEWED"
        else:
            task.status = "IN_PROGRESS"  # Returned/Rejected -> back to in progress
        task.save(skip_transition_check=True)

        TaskStatusChange.objects.create(
            task=task, from_status=old_status, to_status=task.status,
            changed_by=request.user, comment=f"{action_type}: {comment}",
        )

        AuditLog.objects.create(
            event_type=f"task_{action_type.lower()}",
            event_category="TASK",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Task {task.task_id} {action_type.lower()} by {request.user.first_name} {request.user.last_name}. {comment}".strip(),
            entity_type="task",
            entity_id=task.id,
            metadata={"action": action_type, "comment": comment},
        )

        if task.assigned_to_id:
            from apps.notifications.services import notify_task_reviewed
            notify_task_reviewed(
                task=task,
                reviewer=request.user,
                action=action_type,
                comment=comment,
            )

        return Response(TaskSerializer(task, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="start-work")
    def start_work(self, request, pk=None):
        """Start a time log when a user opens/starts working on a task."""
        task = self.get_object()
        user = request.user

        if user.role == "STAFF" and not _staff_can_act_on_task(user, task):
            return Response(
                {"error": "You can only start work on tasks assigned to you or inherited from a predecessor."},
                status=403,
            )

        from apps.attention.models import TimeLog

        active_log = TimeLog.objects.filter(
            user=user,
            organisation=user.organisation,
            task=task,
            ended_at__isnull=True,
        ).order_by("-started_at").first()
        if active_log:
            return Response({"time_log_id": active_log.id, "status": "already_running"})

        # Close any other currently running task logs for this user.
        TimeLog.objects.filter(
            user=user,
            organisation=user.organisation,
            ended_at__isnull=True,
        ).exclude(task=task).update(ended_at=timezone.now())

        time_log = TimeLog.objects.create(
            user=user,
            organisation=user.organisation,
            task=task,
            started_at=timezone.now(),
        )
        return Response({"time_log_id": time_log.id, "status": "started"}, status=201)

    @action(detail=True, methods=["post"], url_path="stop-work")
    def stop_work(self, request, pk=None):
        """Stop the currently running time log for this task/user."""
        task = self.get_object()
        user = request.user

        from apps.attention.models import TimeLog

        log = TimeLog.objects.filter(
            user=user,
            organisation=user.organisation,
            task=task,
            ended_at__isnull=True,
        ).order_by("-started_at").first()
        if not log:
            return Response({"error": "No active time log found for this task."}, status=400)

        log.ended_at = timezone.now()
        log.save(update_fields=["ended_at"])
        return Response({"time_log_id": log.id, "status": "stopped"})

    @action(detail=True, methods=["post"], url_path="update-progress")
    def update_progress(self, request, pk=None):
        """Update task progress percentage (0-100) with audit trail."""
        task = self.get_object()
        user = request.user

        if user.role == "STAFF" and not _staff_can_act_on_task(user, task):
            return Response(
                {"error": "You can only update progress for tasks assigned to you or inherited from a predecessor."},
                status=403,
            )

        try:
            progress = int(request.data.get("progress_percentage"))
        except (TypeError, ValueError):
            return Response({"error": "progress_percentage must be an integer."}, status=400)

        if progress < 0 or progress > 100:
            return Response({"error": "progress_percentage must be between 0 and 100."}, status=400)

        old_progress = task.progress_percentage
        task.progress_percentage = progress
        task.save(update_fields=["progress_percentage", "updated_at"])

        AuditLog.objects.create(
            event_type="task_progress_updated",
            event_category="TASK",
            user=user,
            organisation=user.organisation,
            description=f"Task {task.task_id} progress updated from {old_progress}% to {progress}%",
            entity_type="task",
            entity_id=task.id,
            metadata={"old_progress": old_progress, "new_progress": progress},
        )

        return Response(TaskSerializer(task).data)


class TaskOutputViewSet(viewsets.ModelViewSet):
    serializer_class = TaskOutputSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return TaskOutput.objects.filter(task__organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class TaskReviewViewSet(viewsets.ModelViewSet):
    serializer_class = TaskReviewSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return TaskReview.objects.filter(task__organisation=self.request.user.organisation)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsOrganisationMember()]

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)


class TaskStatusChangeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TaskStatusChangeSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return TaskStatusChange.objects.filter(task__organisation=self.request.user.organisation)
