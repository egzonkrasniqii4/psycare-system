from datetime import timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import display_name
from appointments.models import Appointment
from core.access import therapist_can_book


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    therapist_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "therapist",
            "therapist_name",
            "starts_at",
            "ends_at",
            "status",
            "reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "patient_name", "therapist_name", "created_at", "updated_at"]
        extra_kwargs = {
            "patient": {"required": False},
            "therapist": {"required": False},
            "ends_at": {"required": False},
            "status": {"required": False},
            "reason": {"required": False, "allow_blank": True},
        }

    def get_patient_name(self, obj):
        return display_name(obj.patient.user)

    def get_therapist_name(self, obj):
        return display_name(obj.therapist)

    def validate(self, attrs):
        user = self.context["request"].user
        self._reject_past_start(attrs.get("starts_at"))
        if user.role == User.Role.PATIENT:
            return self._validate_patient_actor(user, attrs)
        return self._validate_staff(user, attrs)

    def _reject_past_start(self, start):
        if start is None:
            return
        if self.instance is not None and self.instance.starts_at == start:
            return
        if start < timezone.now():
            raise serializers.ValidationError(
                {"starts_at": "Termini nuk mund të caktohet në të kaluarën."}
            )

    def _validate_patient_actor(self, user, attrs):
        try:
            profile = user.patient_profile
        except ObjectDoesNotExist as exc:
            raise serializers.ValidationError("Profili i pacientit mungon.") from exc

        if self.instance is None:
            if profile.assigned_therapist_id is None:
                raise serializers.ValidationError("Nuk keni psikolog të caktuar. Kontaktoni klinikën.")
            start = attrs.get("starts_at")
            if start is None:
                raise serializers.ValidationError({"starts_at": "Zgjidhni datën dhe orën."})
            end = attrs.get("ends_at") or (start + timedelta(minutes=50))
            if end <= start:
                raise serializers.ValidationError({"ends_at": "Mbarimi duhet të jetë pas fillimit."})
            return {
                "patient": profile,
                "therapist": profile.assigned_therapist,
                "starts_at": start,
                "ends_at": end,
                "status": Appointment.Status.PENDING,
                "reason": attrs.get("reason", ""),
            }

        if self.instance.patient_id != profile.id:
            raise serializers.ValidationError("Ky termi nuk është i juaji.")
        if attrs.get("status") != Appointment.Status.CANCELLED:
            raise serializers.ValidationError({"status": "Mund vetëm ta anuloni terminin."})
        if self.instance.status in {Appointment.Status.COMPLETED, Appointment.Status.CANCELLED}:
            raise serializers.ValidationError("Ky termi nuk anulohet.")
        return {"status": Appointment.Status.CANCELLED}

    def _validate_staff(self, user, attrs):
        if self.instance is not None and user.role != User.Role.ADMIN:
            attrs.pop("patient", None)
            attrs.pop("therapist", None)

        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        therapist = attrs.get("therapist", getattr(self.instance, "therapist", None))

        if self.instance is None and patient is None:
            raise serializers.ValidationError({"patient": "Zgjidhni pacientin."})

        if user.role == User.Role.THERAPIST:
            therapist = user
            attrs["therapist"] = user
            if patient is not None and not therapist_can_book(user, patient):
                raise serializers.ValidationError({"patient": "Ky pacient nuk është i juaji."})
        elif user.role == User.Role.ADMIN and self.instance is None and therapist is None:
            raise serializers.ValidationError({"therapist": "Zgjidhni psikologun."})

        if therapist is not None and therapist.role != User.Role.THERAPIST:
            raise serializers.ValidationError({"therapist": "Termini duhet të caktohet te një psikolog."})

        if self.instance is None and "status" not in attrs:
            attrs["status"] = Appointment.Status.CONFIRMED

        start = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        end = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if start and end is None:
            end = start + timedelta(minutes=50)
            attrs["ends_at"] = end
        if start and end and end <= start:
            raise serializers.ValidationError({"ends_at": "Mbarimi duhet të jetë pas fillimit."})
        return attrs
