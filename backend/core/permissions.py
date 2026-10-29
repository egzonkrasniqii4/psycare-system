from rest_framework.permissions import BasePermission

from accounts.models import User


class IsAdmin(BasePermission):
    message = "Vetëm administratori ka qasje."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.ADMIN)


class IsAdminOrTherapist(BasePermission):
    message = "Vetëm administratori ose psikologu kanë qasje."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in {User.Role.ADMIN, User.Role.THERAPIST}
        )
