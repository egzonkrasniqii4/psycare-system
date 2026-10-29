from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.models import User
from appointments.models import Appointment
from appointments.serializers import AppointmentSerializer
from core.permissions import IsAdminOrTherapist
from core.query import parse_bound, parse_positive_int


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        qs = Appointment.objects.for_user(self.request.user).select_related(
            "patient__user",
            "therapist",
        )
        start = parse_bound(self.request.query_params.get("from"), "from")
        end = parse_bound(self.request.query_params.get("to"), "to")
        if start:
            qs = qs.filter(starts_at__gte=start)
        if end:
            qs = qs.filter(starts_at__lt=end)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        patient_id = parse_positive_int(self.request.query_params.get("patient"), "patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        therapist_id = parse_positive_int(self.request.query_params.get("therapist"), "therapist")
        if therapist_id and self.request.user.role == User.Role.ADMIN:
            qs = qs.filter(therapist_id=therapist_id)
        return qs

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminOrTherapist()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        patient = serializer.validated_data.get("patient")
        user = self.request.user
        if (
            user.role == User.Role.THERAPIST
            and patient is not None
            and patient.assigned_therapist_id is None
        ):
            patient.assigned_therapist = user
            patient.save(update_fields=["assigned_therapist", "updated_at"])
        serializer.save()
