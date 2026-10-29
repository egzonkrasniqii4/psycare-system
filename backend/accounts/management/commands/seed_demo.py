from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from appointments.models import Appointment
from billing.models import Billing
from clinical.models import SessionNote
from patients.models import PatientProfile


class Command(BaseCommand):
    help = "Krijon përdorues demo dhe disa termine, shënime dhe fatura."

    @transaction.atomic
    def handle(self, *args, **options):
        self._user(
            "admin@psycare.local",
            "Admin12345!",
            User.Role.ADMIN,
            "Admin",
            "Klinike",
            staff=True,
            superuser=True,
        )
        therapist = self._user(
            "arta.dema@psycare.local",
            "Therapist12345!",
            User.Role.THERAPIST,
            "Arta",
            "Dema",
        )
        leon_user = self._user(
            "leon.kola@psycare.local",
            "Patient12345!",
            User.Role.PATIENT,
            "Leon",
            "Kola",
            phone="+355 69 000 0001",
        )
        mia_user = self._user(
            "mia.berisha@psycare.local",
            "Patient12345!",
            User.Role.PATIENT,
            "Mia",
            "Berisha",
            phone="+355 69 000 0002",
        )
        leon, _ = PatientProfile.objects.get_or_create(
            user=leon_user,
            defaults={
                "date_of_birth": date(1994, 4, 12),
                "address": "Rruga e Elbasanit, Tiranë",
                "emergency_contact_name": "Drita Kola",
                "emergency_contact_phone": "+355 69 000 0009",
                "medical_history": (
                    "Ankth social i raportuar që në universitet. "
                    "Nuk merr medikamente. Nuk ka hospitalizime."
                ),
                "assigned_therapist": therapist,
            },
        )
        mia, _ = PatientProfile.objects.get_or_create(
            user=mia_user,
            defaults={
                "date_of_birth": date(1998, 9, 3),
                "address": "Rruga e Dibrës, Tiranë",
                "emergency_contact_name": "Arben Berisha",
                "emergency_contact_phone": "+355 69 000 0008",
                "medical_history": "Vlerësim i parë. Ankesa: pagjumësi prej tre javësh.",
                "assigned_therapist": therapist,
            },
        )
        if not leon.appointments.exists():
            self._samples(therapist, leon, mia)

        self.stdout.write(self.style.SUCCESS("Të dhënat demo janë gati."))
        self.stdout.write("admin@psycare.local / Admin12345!")
        self.stdout.write("arta.dema@psycare.local / Therapist12345!")
        self.stdout.write("Pacient: +355690000001 (kodi SMS shfaqet në terminalin e serverit)")

    def _user(self, email, password, role, first_name, last_name, phone="", staff=False, superuser=False):
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "role": role,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "is_staff": staff,
                "is_superuser": superuser,
            },
        )
        user.role = role
        user.first_name = first_name
        user.last_name = last_name
        user.phone = phone
        user.is_staff = staff
        user.is_superuser = superuser
        user.is_active = True
        if role == User.Role.PATIENT:
            user.set_unusable_password()
            user.phone_verified_at = user.phone_verified_at or timezone.now()
        else:
            user.set_password(password)
        user.save()
        return user

    def _samples(self, therapist, leon, mia):
        base = timezone.localtime().replace(second=0, microsecond=0)

        def at(day_offset, hour, minute=0):
            return (base + timedelta(days=day_offset)).replace(hour=hour, minute=minute)

        past_start = at(-1, 11)
        past = Appointment.objects.create(
            patient=leon,
            therapist=therapist,
            starts_at=past_start,
            ends_at=past_start + timedelta(minutes=50),
            status=Appointment.Status.COMPLETED,
            reason="Seancë javore",
        )
        today = at(0, 10)
        Appointment.objects.create(
            patient=leon,
            therapist=therapist,
            starts_at=today,
            ends_at=today + timedelta(minutes=50),
            status=Appointment.Status.CONFIRMED,
            reason="Seancë javore",
        )
        mia_start = at(0, 13)
        mia_appt = Appointment.objects.create(
            patient=mia,
            therapist=therapist,
            starts_at=mia_start,
            ends_at=mia_start + timedelta(minutes=50),
            status=Appointment.Status.PENDING,
            reason="Vlerësim fillestar",
        )
        tomorrow = at(1, 9)
        Appointment.objects.create(
            patient=leon,
            therapist=therapist,
            starts_at=tomorrow,
            ends_at=tomorrow + timedelta(minutes=50),
            status=Appointment.Status.CONFIRMED,
            reason="Ndjekje",
        )
        SessionNote.objects.create(
            patient=leon,
            therapist=therapist,
            appointment=past,
            content=(
                "Pacienti raportoi ankth të lehtë para prezantimeve. "
                "U praktikua frymëmarrje e ngadaltë dhe u caktua një detyrë e shkurtër për javën tjetër."
            ),
        )
        paid = Billing.objects.create(
            patient=leon,
            appointment=past,
            therapist=therapist,
            description="Seancë individuale",
            amount=Decimal("40.00"),
            status=Billing.Status.PAID,
            paid_on=past_start.date(),
        )
        paid.issued_on = past_start.date()
        paid.save(update_fields=["issued_on"])
        Billing.objects.create(
            patient=mia,
            appointment=mia_appt,
            therapist=therapist,
            description="Vlerësim fillestar",
            amount=Decimal("45.00"),
            status=Billing.Status.UNPAID,
        )
