from django.conf import settings
from django.db import models
from django.db.models import Q

from core.fields import EncryptedTextField


class SessionNoteQuerySet(models.QuerySet):
    def for_user(self, user):
        if user.role == "admin":
            return self
        if user.role == "therapist":
            return self.filter(
                Q(therapist=user) | Q(patient__assigned_therapist=user)
            ).distinct()
        return self.none()


class SessionNote(models.Model):
    patient = models.ForeignKey(
        "patients.PatientProfile",
        on_delete=models.PROTECT,
        related_name="session_notes",
    )
    therapist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="session_notes",
    )
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="session_notes",
    )
    content = EncryptedTextField(
        help_text="Shënimi klinik. Ruhet si ciphertext Fernet dhe deshifrohet vetëm në aplikacion.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SessionNoteQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "shënim seance"
        verbose_name_plural = "shënimet e seancave"
        indexes = [
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["therapist", "created_at"]),
        ]

    def __str__(self):
        return f"Shënim · {self.patient} · {self.created_at:%d.%m.%Y}"
