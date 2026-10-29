import re
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import PhoneVerification, User
from core.sms import LocMemSMSBackend
from appointments.models import Appointment
from clinical.models import SessionNote
from patients.models import PatientProfile


class ClinicAccessTests(APITestCase):
    password = "ClinicPass123!"

    def setUp(self):
        cache.clear()
        self.therapist = User.objects.create_user(
            "arta@example.com",
            self.password,
            role=User.Role.THERAPIST,
            first_name="Arta",
            last_name="Dema",
        )
        User.objects.create_user(
            "tjetri@example.com",
            self.password,
            role=User.Role.THERAPIST,
            first_name="Besa",
            last_name="Leka",
        )
        self.patient_user = User.objects.create_user(
            "leon@example.com",
            self.password,
            role=User.Role.PATIENT,
            first_name="Leon",
            last_name="Kola",
        )
        self.profile = PatientProfile.objects.create(
            user=self.patient_user,
            assigned_therapist=self.therapist,
            medical_history="Historik sekret",
        )
        self.note = SessionNote.objects.create(
            patient=self.profile,
            therapist=self.therapist,
            content="Shënim sekret",
        )

    def auth(self, email):
        response = self.client.post(
            "/api/auth/token/",
            {"email": email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def test_login_returns_role(self):
        response = self.auth("leon@example.com")
        self.assertEqual(response.data["user"]["role"], "patient")

    def test_clinical_text_is_encrypted_at_rest(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT content FROM clinical_sessionnote WHERE id = %s", [self.note.id])
            stored_note = cursor.fetchone()[0]
            cursor.execute(
                "SELECT medical_history FROM patients_patientprofile WHERE id = %s",
                [self.profile.id],
            )
            stored_history = cursor.fetchone()[0]
        self.assertTrue(stored_note.startswith("gAAAA"))
        self.assertNotIn("Shënim sekret", stored_note)
        self.assertTrue(stored_history.startswith("gAAAA"))
        self.assertEqual(SessionNote.objects.get(pk=self.note.id).content, "Shënim sekret")
        self.assertEqual(
            PatientProfile.objects.get(pk=self.profile.id).medical_history,
            "Historik sekret",
        )

    def test_patient_cannot_read_session_notes(self):
        self.auth("leon@example.com")
        response = self.client.get("/api/session-notes/")
        self.assertEqual(response.status_code, 403)

    def test_other_therapist_cannot_open_note_or_patient(self):
        self.auth("tjetri@example.com")
        note = self.client.get(f"/api/session-notes/{self.note.id}/")
        patient = self.client.get(f"/api/patients/{self.profile.id}/")
        listing = self.client.get("/api/patients/")
        self.assertEqual(note.status_code, 404)
        self.assertEqual(patient.status_code, 404)
        self.assertEqual(listing.data["count"], 0)

    def test_assigned_therapist_reads_plaintext(self):
        self.auth("arta@example.com")
        response = self.client.get(f"/api/session-notes/{self.note.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["content"], "Shënim sekret")

    def test_patient_booking_stays_pending(self):
        self.auth("leon@example.com")
        start = timezone.now() + timedelta(days=2)
        response = self.client.post(
            "/api/appointments/",
            {"starts_at": start.isoformat(), "status": "confirmed", "reason": "Konsultë"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["therapist"], self.therapist.id)
        self.assertEqual(response.data["patient"], self.profile.id)

    def test_cannot_book_in_the_past(self):
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        self.auth("arta@example.com")
        staff = self.client.post(
            "/api/appointments/",
            {"patient": self.profile.id, "starts_at": yesterday},
            format="json",
        )
        self.auth("leon@example.com")
        patient = self.client.post("/api/appointments/", {"starts_at": yesterday}, format="json")
        self.assertEqual(staff.status_code, 400)
        self.assertIn("starts_at", staff.data)
        self.assertEqual(patient.status_code, 400)
        self.assertFalse(Appointment.objects.exists())

    def test_past_appointment_can_be_completed_but_not_moved_back(self):
        start = timezone.now() - timedelta(hours=3)
        appointment = Appointment.objects.create(
            patient=self.profile,
            therapist=self.therapist,
            starts_at=start,
            ends_at=start + timedelta(minutes=50),
            status=Appointment.Status.CONFIRMED,
        )
        self.auth("arta@example.com")
        completed = self.client.patch(
            f"/api/appointments/{appointment.id}/",
            {"status": "completed", "starts_at": start.isoformat()},
            format="json",
        )
        moved = self.client.patch(
            f"/api/appointments/{appointment.id}/",
            {"starts_at": (start - timedelta(days=1)).isoformat()},
            format="json",
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["status"], "completed")
        self.assertEqual(moved.status_code, 400)


class TherapistManagementTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            "admin@example.com", "AdminPass123!", role=User.Role.ADMIN, first_name="Admin"
        )
        User.objects.create_user(
            "arta@example.com", "ClinicPass123!", role=User.Role.THERAPIST, first_name="Arta"
        )

    def auth(self, email, password):
        response = self.client.post(
            "/api/auth/token/", {"email": email, "password": password}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def new_therapist(self):
        return self.client.post(
            "/api/therapists/",
            {
                "first_name": "Blerta",
                "last_name": "Hoxha",
                "email": "Blerta@Example.com",
                "phone": "+383 44 555 666",
                "password": "Terapist-Ri-2026!",
            },
            format="json",
        )

    def test_admin_creates_therapist_who_can_log_in(self):
        self.auth("admin@example.com", "AdminPass123!")
        response = self.new_therapist()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("password", response.data)
        self.client.credentials()
        login = self.auth("blerta@example.com", "Terapist-Ri-2026!")
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data["user"]["role"], "therapist")

    def test_therapist_cannot_create_therapists(self):
        self.auth("arta@example.com", "ClinicPass123!")
        self.assertEqual(self.new_therapist().status_code, 403)
        self.assertEqual(self.client.get("/api/therapists/").status_code, 200)

    def test_deactivated_therapist_is_hidden_and_cannot_log_in(self):
        self.auth("admin@example.com", "AdminPass123!")
        created = self.new_therapist().data
        self.assertEqual(self.client.delete(f"/api/therapists/{created['id']}/").status_code, 204)
        active_ids = [row["id"] for row in self.client.get("/api/therapists/").data]
        all_ids = [row["id"] for row in self.client.get("/api/therapists/?all=1").data]
        self.assertNotIn(created["id"], active_ids)
        self.assertIn(created["id"], all_ids)
        self.client.credentials()
        login = self.client.post(
            "/api/auth/token/",
            {"email": "blerta@example.com", "password": "Terapist-Ri-2026!"},
            format="json",
        )
        self.assertEqual(login.status_code, 401)


@override_settings(SMS_BACKEND="core.sms.LocMemSMSBackend")
class PhoneCodeTests(APITestCase):
    def setUp(self):
        cache.clear()
        LocMemSMSBackend.outbox.clear()
        self.therapist = User.objects.create_user(
            "arta@example.com",
            "ClinicPass123!",
            role=User.Role.THERAPIST,
            first_name="Arta",
            last_name="Dema",
        )

    def staff_creates(self, **extra):
        token = self.client.post(
            "/api/auth/token/",
            {"email": "arta@example.com", "password": "ClinicPass123!"},
            format="json",
        ).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        payload = {"first_name": "Ana", "last_name": "Krasniqi", "phone": "+383 44 123 456", **extra}
        response = self.client.post("/api/patients/", payload, format="json")
        self.client.credentials()
        return response

    def ask(self, purpose="register", **extra):
        payload = {"purpose": purpose, "phone": "+38344123456", **extra}
        if purpose == "register":
            payload = {"first_name": "Ana", "last_name": "Krasniqi", **payload}
        return self.client.post("/api/auth/phone/request/", payload, format="json")

    def verify(self, code=None, purpose="register", **extra):
        if code is None:
            code = re.search(r"\b(\d{4})\b", LocMemSMSBackend.outbox[-1][1]).group(1)
        payload = {"purpose": purpose, "phone": "+38344123456", "code": code, **extra}
        if purpose == "register":
            payload = {"first_name": "Ana", "last_name": "Krasniqi", **payload}
        return self.client.post("/api/auth/phone/verify/", payload, format="json")

    def test_staff_adds_patient_with_name_and_phone_only(self):
        response = self.staff_creates()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["email"])
        self.assertFalse(response.data["has_account"])
        self.assertEqual(response.data["phone"], "+38344123456")
        self.assertEqual(response.data["assigned_therapist"], self.therapist.id)

    def test_duplicate_phone_is_rejected_for_staff(self):
        self.staff_creates()
        response = self.staff_creates(first_name="Tjetër")
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)

    def test_code_is_sent_and_not_stored_in_plain_text(self):
        response = self.ask()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("debug_code", response.data)
        phone, message = LocMemSMSBackend.outbox[-1]
        self.assertEqual(phone, "+38344123456")
        code = re.search(r"\b\d{4}\b", message).group(0)
        self.assertNotIn(code, PhoneVerification.objects.get().code_hash)
        self.assertFalse(User.objects.filter(phone="+38344123456").exists())

    def test_registration_claims_clinic_record_without_password(self):
        profile_id = self.staff_creates().data["id"]
        self.assertEqual(self.ask(first_name=" ana ", last_name="KRASNIQI").status_code, 200)
        response = self.verify(email="ana@example.com")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["claimed"])
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["patient_profile_id"], profile_id)
        user = PatientProfile.objects.get(pk=profile_id).user
        self.assertIsNotNone(user.phone_verified_at)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.email, "ana@example.com")
        self.assertEqual(PatientProfile.objects.count(), 1)

    def test_email_is_optional(self):
        self.ask(phone="+383 49 999 888")
        response = self.verify(phone="+38349999888")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["claimed"])
        user = User.objects.get(phone="+38349999888")
        self.assertIsNone(user.email)
        self.assertIsNone(user.patient_profile.assigned_therapist_id)

    def test_wrong_name_gets_no_code(self):
        self.staff_creates()
        response = self.ask(first_name="Dikush", last_name="Tjetër")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(LocMemSMSBackend.outbox, [])

    def test_wrong_codes_are_counted_and_then_locked(self):
        self.ask()
        right = re.search(r"\b\d{4}\b", LocMemSMSBackend.outbox[-1][1]).group(0)
        wrong = "0000" if right != "0000" else "1111"
        for _ in range(5):
            self.assertEqual(self.verify(code=wrong).status_code, 400)
        self.assertEqual(PhoneVerification.objects.get().attempts, 5)
        response = self.verify(code=right)
        self.assertEqual(response.status_code, 400)
        self.assertIn("tentativa", str(response.data["code"]))

    def test_code_cannot_be_reused_and_resend_waits(self):
        self.ask()
        self.assertEqual(self.ask().status_code, 400)
        self.assertEqual(self.verify().status_code, 201)
        self.assertEqual(self.verify().status_code, 400)

    def test_expired_code_is_rejected(self):
        self.ask()
        PhoneVerification.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify().status_code, 400)

    def test_registered_patient_logs_in_with_code(self):
        self.ask()
        self.verify()
        self.assertEqual(self.ask().status_code, 400)
        PhoneVerification.objects.all().delete()
        self.assertEqual(self.ask(purpose="login").status_code, 200)
        response = self.verify(purpose="login")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["user"]["role"], "patient")

    def test_clinic_record_without_account_cannot_log_in(self):
        self.staff_creates()
        response = self.ask(purpose="login")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(LocMemSMSBackend.outbox, [])

    def test_staff_phone_change_requires_new_verification(self):
        profile_id = self.staff_creates().data["id"]
        self.ask()
        self.verify()
        token = self.client.post(
            "/api/auth/token/",
            {"email": "arta@example.com", "password": "ClinicPass123!"},
            format="json",
        ).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.patch(
            f"/api/patients/{profile_id}/", {"phone": "+383 45 000 111"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(User.objects.get(phone="+38345000111").phone_verified_at)


