from rest_framework.permissions import BasePermission


class IsOrganisationMember(BasePermission):
    """Base permission that ensures users can only access their own organisation's data."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "organisation"):
            return obj.organisation == request.user.organisation
        if hasattr(obj, "organisation_id"):
            return obj.organisation_id == request.user.organisation_id
        return True


class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "STAFF"


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "MANAGER"


class IsDeptHead(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "DEPT_HEAD"


class IsExecutive(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "EXECUTIVE"


class IsBoardMember(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "BOARD_MEMBER"


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "ADMIN"


class IsManagerOrAbove(BasePermission):
    ALLOWED_ROLES = {"MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"}

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED_ROLES


class IsSelfOrManagerOrAbove(BasePermission):
    """Allow Manager+ to edit any user; everyone else can only edit their own record.

    Used for the `users/{id}/` update endpoints so staff/executives can update
    their own profile (avatar, name, phone, etc.) without granting cross-user edit
    rights. The view layer is responsible for stripping privileged fields
    (role, department, employment_status, reports_to) when the requester is editing
    themselves but is not Manager+.
    """

    ALLOWED_ROLES = {"MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"}

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role in self.ALLOWED_ROLES:
            return True
        return obj.pk == request.user.pk


class IsDeptHeadOrAbove(BasePermission):
    ALLOWED_ROLES = {"DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"}

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED_ROLES


class IsExecutiveOrAbove(BasePermission):
    ALLOWED_ROLES = {"EXECUTIVE", "BOARD_MEMBER", "ADMIN"}

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED_ROLES


class IsManagerOrAboveExcludingBoard(BasePermission):
    """Manager+ but NOT Board Members — board members are read-only for operational data."""
    ALLOWED_ROLES = {"MANAGER", "DEPT_HEAD", "EXECUTIVE", "ADMIN"}

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED_ROLES
