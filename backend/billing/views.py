from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.models import User
from billing.models import Billing
from billing.serializers import BillingSerializer
from core.deletion import delete_protected
from core.permissions import IsAdmin, IsAdminOrTherapist
from core.query import parse_positive_int


class BillingViewSet(viewsets.ModelViewSet):
    serializer_class = BillingSerializer

    def get_queryset(self):
        qs = Billing.objects.for_user(self.request.user).select_related(
            "patient__user",
            "therapist",
            "appointment",
        )
        patient_id = parse_positive_int(self.request.query_params.get("patient"), "patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update"):
            return [IsAdminOrTherapist()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        therapist = user
        if user.role == User.Role.ADMIN:
            patient = serializer.validated_data["patient"]
            therapist = patient.assigned_therapist or user
        serializer.save(therapist=therapist)

    def perform_destroy(self, instance):
        delete_protected(instance)
