from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from clinical.models import SessionNote
from clinical.serializers import SessionNoteSerializer
from core.permissions import IsAdminOrTherapist
from core.query import parse_positive_int


class SessionNoteViewSet(viewsets.ModelViewSet):
    serializer_class = SessionNoteSerializer
    permission_classes = [IsAdminOrTherapist]

    def get_queryset(self):
        qs = SessionNote.objects.for_user(self.request.user).select_related(
            "patient__user",
            "therapist",
            "appointment",
        )
        patient_id = parse_positive_int(self.request.query_params.get("patient"), "patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(therapist=self.request.user)

    def perform_update(self, serializer):
        self._assert_author(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._assert_author(instance)
        instance.delete()

    def _assert_author(self, note):
        user = self.request.user
        if user.role != User.Role.ADMIN and note.therapist_id != user.id:
            raise PermissionDenied("Vetëm autori i shënimit mund ta ndryshojë.")
