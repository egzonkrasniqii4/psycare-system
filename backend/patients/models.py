from django.conf import settings
from django.db import models
from django.db.models import Q

from core.fields import EncryptedTextField


class PatientProfileQuerySet(models.QuerySet):
    def for_user(self, user):
        if user.role == "admin":
            return self
        if user.role == "therapist":
            return self.filter(
                Q(assigned_therapist=user) | Q(appointments__therapist=user)
            ).distinct()
        return self.filter(user=user)


class PatientProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="patient_profile",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=120, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
    medical_history = EncryptedTextField(
        blank=True,
        default="",
        help_text="Historiku klinik. Ruhet i enkriptuar në databazë.",
    )
    assigned_therapist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_patients",
        limit_choices_to={"role": "therapist"},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PatientProfileQuerySet.as_manager()

    class Meta:
        ordering = ["user__last_name", "user__first_name"]
        verbose_name = "profil pacienti"
        verbose_name_plural = "profilet e pacientëve"

    def __str__(self):
        full_name = self.user.get_full_name().strip()
        return full_name or self.user.email
