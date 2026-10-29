from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import PhoneVerification, User
from accounts.serializers import (
    EmailTokenObtainPairSerializer,
    PhoneCodeSerializer,
    PhoneCodeVerifySerializer,
    TherapistAdminSerializer,
    TherapistSerializer,
    UserSerializer,
)
from appointments.models import Appointment
from appointments.serializers import AppointmentSerializer
from billing.models import Billing
from core.otp import issue_code
from core.permissions import IsAdmin, IsAdminOrTherapist
from patients.models import PatientProfile


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class PublicPhoneView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_throttles(self):
        return [ScopedRateThrottle()]


class PhoneCodeRequestView(PublicPhoneView):
    throttle_scope = "otp_request"

    def post(self, request):
        serializer = PhoneCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        debug_code = issue_code(data["phone"], data["purpose"])
        body = {"detail": "Kodi u dërgua me SMS.", "phone": data["phone"], "expires_in": 600}
        if debug_code:
            body["debug_code"] = debug_code
        return Response(body)


class PhoneCodeVerifyView(PublicPhoneView):
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = PhoneCodeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = EmailTokenObtainPairSerializer.get_token(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
                "claimed": serializer.claimed,
            },
            status=(
                status.HTTP_201_CREATED
                if serializer.validated_data["purpose"] == PhoneVerification.Purpose.REGISTER
                else status.HTTP_200_OK
            ),
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.get(pk=request.user.pk)
        return Response(UserSerializer(user).data)


class TherapistViewSet(viewsets.ModelViewSet):
    """Staff read the active list for pickers; only admins manage accounts (`?all=1` adds inactive)."""

    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAdminOrTherapist()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.request.user.role == User.Role.ADMIN:
            return TherapistAdminSerializer
        return TherapistSerializer

    def get_queryset(self):
        qs = (
            User.objects.filter(role=User.Role.THERAPIST)
            .annotate(patient_count=Count("assigned_patients", distinct=True))
            .order_by("first_name", "last_name")
        )
        is_admin = self.request.user.role == User.Role.ADMIN
        if not (is_admin and self.request.query_params.get("all") == "1"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone

        user = request.user
        today = timezone.localdate()
        appointments = Appointment.objects.for_user(user)
        patients = PatientProfile.objects.for_user(user)
        billings = Billing.objects.for_user(user)
        upcoming = (
            appointments.exclude(status=Appointment.Status.CANCELLED)
            .filter(starts_at__date__gte=today)
            .select_related("patient__user", "therapist")
            .order_by("starts_at")[:8]
        )
        return Response(
            {
                "patients": patients.count(),
                "appointments_today": appointments.filter(starts_at__date=today)
                .exclude(status=Appointment.Status.CANCELLED)
                .count(),
                "pending": appointments.filter(status=Appointment.Status.PENDING).count(),
                "unpaid_invoices": billings.filter(status=Billing.Status.UNPAID).count(),
                "upcoming": AppointmentSerializer(upcoming, many=True).data,
            }
        )
