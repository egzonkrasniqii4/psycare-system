from django.contrib import admin

from billing.models import Billing


@admin.register(Billing)
class BillingAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "amount", "currency", "status", "issued_on", "paid_on")
    list_filter = ("status", "currency")
    search_fields = ("patient__user__email", "patient__user__last_name", "description")
    autocomplete_fields = ("patient", "appointment", "therapist")
