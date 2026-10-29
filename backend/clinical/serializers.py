from rest_framework import serializers

from accounts.serializers import display_name
from clinical.models import SessionNote
from core.access import user_can_access_patient


class SessionNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    therapist_name = serializers.SerializerMethodField()

    class Meta:
        model = SessionNote
        fields = [
            "id",
            "patient",
            "patient_name",
            "therapist",
            "therapist_name",
            "appointment",
            "content",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "therapist",
            "patient_name",
            "therapist_name",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        return display_name(obj.patient.user)

    def get_therapist_name(self, obj):
        return display_name(obj.therapist)

    def validate_patient(self, patient):
        user = self.context["request"].user
        if not user_can_access_patient(user, patient):
            raise serializers.ValidationError("Nuk keni qasje te ky pacient.")
        return patient

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        appointment = attrs.get("appointment", getattr(self.instance, "appointment", None))
        if appointment and patient and appointment.patient_id != patient.id:
            raise serializers.ValidationError({"appointment": "Termini nuk i përket këtij pacienti."})
        user = self.context["request"].user
        if appointment and user.role == "therapist" and appointment.therapist_id != user.id:
            raise serializers.ValidationError({"appointment": "Termini nuk është i juaji."})
        return attrs
