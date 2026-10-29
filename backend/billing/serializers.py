from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import display_name
from billing.models import Billing
from core.access import user_can_access_patient


class BillingSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Billing
        fields = [
            "id",
            "patient",
            "patient_name",
            "appointment",
            "therapist",
            "description",
            "amount",
            "currency",
            "status",
            "issued_on",
            "paid_on",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "therapist", "patient_name", "issued_on", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return display_name(obj.patient.user)

    def validate_patient(self, patient):
        if not user_can_access_patient(self.context["request"].user, patient):
            raise serializers.ValidationError("Nuk keni qasje te ky pacient.")
        return patient

    def validate_currency(self, value):
        value = value.upper()
        if len(value) != 3:
            raise serializers.ValidationError("Monedha duhet të jetë kod 3-shifror.")
        return value

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        appointment = attrs.get("appointment", getattr(self.instance, "appointment", None))
        if appointment and patient and appointment.patient_id != patient.id:
            raise serializers.ValidationError({"appointment": "Termini nuk i përket këtij pacienti."})
        status = attrs.get("status", getattr(self.instance, "status", Billing.Status.UNPAID))
        if status == Billing.Status.PAID:
            current_paid = getattr(self.instance, "paid_on", None)
            if not attrs.get("paid_on") and not current_paid:
                attrs["paid_on"] = timezone.localdate()
        if status == Billing.Status.UNPAID:
            attrs["paid_on"] = None
        user = self.context["request"].user
        if user.role == User.Role.PATIENT:
            raise serializers.ValidationError("Pacienti nuk i ndryshon faturat.")
        return attrs
