from rest_framework.permissions import BasePermission

from apps.accounts.permissions import IsOrganisationMember  # noqa: F401


class IsBoardMemberForDeletion(BasePermission):
    """Only Board Members can request document deletion."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "BOARD_MEMBER"


class IsDifferentBoardMemberApprover(BasePermission):
    """Approver must be a different Board Member than the requester."""

    def has_object_permission(self, request, view, obj):
        if view.action in ["approve", "reject"]:
            return (
                request.user.role == "BOARD_MEMBER"
                and request.user != obj.requested_by
            )
        return True
