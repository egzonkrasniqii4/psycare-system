from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class BillingQuerySet(models.QuerySet):
    def for_user(self, user):
        if user.role == "admin":
            return self
        if user.role == "therapist":
            return self.filter(
                Q(therapist=user) | Q(patient__assigned_therapist=user)
            ).distinct()
        return self.filter(patient__user=user)


class Billing(models.Model):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "E papaguar"
        PAID = "paid", "E paguar"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        on_delete=models.PROTECT,
        related_name="billings",
    )
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="billings",
    )
    therapist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="issued_billings",
    )
    description = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, default="EUR")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNPAID)
    issued_on = models.DateField(auto_now_add=True)
    paid_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BillingQuerySet.as_manager()

    class Meta:
        ordering = ["-issued_on", "-id"]
        verbose_name = "faturë"
        verbose_name_plural = "faturat"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status", "issued_on"]),
        ]

    def __str__(self):
        return f"{self.amount} {self.currency} · {self.get_status_display()}"
