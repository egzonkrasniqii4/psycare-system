from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.deletion import delete_protected
from core.permissions import IsAdmin, IsAdminOrTherapist
from core.phone import normalize_phone
from patients.models import PatientProfile
from patients.serializers import PatientSerializer, PatientWriteSerializer


class PatientViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = PatientProfile.objects.select_related("user", "assigned_therapist").for_user(
            self.request.user
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            phone = normalize_phone(search)
            match = (
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
            )
            if phone:
                match |= Q(user__phone__icontains=phone)
            qs = qs.filter(match)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PatientWriteSerializer
        return PatientSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAdminOrTherapist()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        delete_protected(instance)
