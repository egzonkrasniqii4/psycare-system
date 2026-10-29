from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    DashboardView,
    EmailTokenObtainPairView,
    MeView,
    PhoneCodeRequestView,
    PhoneCodeVerifyView,
    TherapistViewSet,
)
from appointments.views import AppointmentViewSet
from billing.views import BillingViewSet
from clinical.views import SessionNoteViewSet
from patients.views import PatientViewSet

router = DefaultRouter()
router.register("patients", PatientViewSet, basename="patient")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("session-notes", SessionNoteViewSet, basename="session-note")
router.register("billing", BillingViewSet, basename="billing")
router.register("therapists", TherapistViewSet, basename="therapist")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/phone/request/", PhoneCodeRequestView.as_view(), name="phone_code_request"),
    path("api/auth/phone/verify/", PhoneCodeVerifyView.as_view(), name="phone_code_verify"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/", include(router.urls)),
]

admin.site.site_header = "PsyCare"
admin.site.site_title = "PsyCare"
admin.site.index_title = "Administrimi i klinikës"
