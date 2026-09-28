from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember
from apps.audit.models import AuditLog

from .executor import execute_deletion
from .models import DeletionRequest
from .permissions import IsBoardMemberForDeletion, IsDifferentBoardMemberApprover
from .serializers import DeletionRequestSerializer


class DeletionRequestViewSet(viewsets.ModelViewSet):
    serializer_class = DeletionRequestSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsBoardMemberForDeletion]

    def get_queryset(self):
        return DeletionRequest.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(
            requested_by=self.request.user,
            organisation=self.request.user.organisation,
        )
        instance = serializer.instance
        AuditLog.objects.create(
            event_type="deletion_request_created",
            event_category="DOCUMENT",
            user=self.request.user,
            organisation=self.request.user.organisation,
            description=(
                f"Deletion request created for {instance.document_type}#{instance.document_id}"
                f" — reason: {instance.reason[:200]}"
            ),
            entity_type="deletion_request",
            entity_id=instance.id,
            metadata={
                "document_type": instance.document_type,
                "document_id": instance.document_id,
                "reason": instance.reason,
            },
        )

    @action(detail=True, methods=["post"], permission_classes=[
        IsAuthenticated, IsOrganisationMember, IsBoardMemberForDeletion, IsDifferentBoardMemberApprover
    ])
    def approve(self, request, pk=None):
        deletion_request = self.get_object()
        if deletion_request.status != DeletionRequest.Status.PENDING:
            return Response(
                {"error": "Only pending requests can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deletion_request.status = DeletionRequest.Status.APPROVED
        deletion_request.approved_by = request.user
        deletion_request.resolved_at = timezone.now()
        deletion_request.save()

        AuditLog.objects.create(
            event_type="deletion_request_approved",
            event_category="DOCUMENT",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Deletion request #{deletion_request.id} approved by {request.user.email}",
            entity_type="deletion_request",
            entity_id=deletion_request.id,
            metadata={"approved_by": request.user.email},
        )

        # Execute the actual deletion now that two board members concur.
        executed_desc = execute_deletion(deletion_request)
        deletion_request.status = DeletionRequest.Status.EXECUTED
        deletion_request.save(update_fields=["status", "updated_at"])
        AuditLog.objects.create(
            event_type="document_deleted",
            event_category="DOCUMENT",
            user=request.user,
            organisation=request.user.organisation,
            description=(
                f"Document deleted via approved request #{deletion_request.id}: "
                f"{executed_desc or f'{deletion_request.document_type}#{deletion_request.document_id} (not found)'}"
            ),
            entity_type=deletion_request.document_type,
            entity_id=deletion_request.document_id,
            metadata={
                "deletion_request_id": deletion_request.id,
                "approved_by": request.user.email,
                "requested_by": deletion_request.requested_by.email if deletion_request.requested_by else None,
                "reason": deletion_request.reason,
            },
        )

        return Response(DeletionRequestSerializer(deletion_request).data)

    @action(detail=True, methods=["post"], permission_classes=[
        IsAuthenticated, IsOrganisationMember, IsBoardMemberForDeletion, IsDifferentBoardMemberApprover
    ])
    def reject(self, request, pk=None):
        deletion_request = self.get_object()
        if deletion_request.status != DeletionRequest.Status.PENDING:
            return Response(
                {"error": "Only pending requests can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deletion_request.status = DeletionRequest.Status.REJECTED
        deletion_request.approved_by = request.user
        deletion_request.resolved_at = timezone.now()
        deletion_request.save()

        AuditLog.objects.create(
            event_type="deletion_request_rejected",
            event_category="DOCUMENT",
            user=request.user,
            organisation=request.user.organisation,
            description=f"Deletion request #{deletion_request.id} rejected by {request.user.email}",
            entity_type="deletion_request",
            entity_id=deletion_request.id,
            metadata={"rejected_by": request.user.email},
        )

        return Response(DeletionRequestSerializer(deletion_request).data)
