import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from accounts.models import PhoneVerification
from core.sms import get_sms_backend

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5
CODE_LENGTH = 4


class SMSUnavailable(APIException):
    status_code = 503
    default_detail = "SMS-ja nuk u dërgua. Provoni përsëri pas pak."


def _hash(phone, code):
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_code(phone, purpose):
    """Sends a fresh code. Returns it only when the SMS backend is the dev console."""
    now = timezone.now()
    latest = PhoneVerification.objects.filter(phone=phone, purpose=purpose).first()
    if latest and latest.consumed_at is None and now - latest.created_at < RESEND_COOLDOWN:
        wait = int((RESEND_COOLDOWN - (now - latest.created_at)).total_seconds()) + 1
        raise serializers.ValidationError(
            {"phone": f"Prisni {wait} sekonda para se të kërkoni kod të ri."}
        )

    code = str(secrets.randbelow(10**CODE_LENGTH)).zfill(CODE_LENGTH)
    with transaction.atomic():
        PhoneVerification.objects.filter(
            phone=phone, purpose=purpose, consumed_at__isnull=True
        ).update(consumed_at=now)
        verification = PhoneVerification.objects.create(
            phone=phone,
            purpose=purpose,
            code_hash=_hash(phone, code),
            expires_at=now + CODE_TTL,
        )

    backend = get_sms_backend()
    try:
        backend.send(phone, f"PsyCare: kodi juaj i verifikimit është {code}. Skadon pas 10 minutash.")
    except Exception as exc:
        logger.exception("Dërgimi i SMS-së dështoi për %s", phone)
        verification.delete()
        raise SMSUnavailable() from exc
    return code if settings.DEBUG and getattr(backend, "exposes_code", False) else None


def consume_code(phone, purpose, code):
    """Marks the pending code as used. Wrong guesses are counted even though we raise."""
    with transaction.atomic():
        verification = (
            PhoneVerification.objects.select_for_update()
            .filter(phone=phone, purpose=purpose, consumed_at__isnull=True)
            .first()
        )
        if verification is None or verification.expires_at < timezone.now():
            outcome = "invalid"
        elif verification.attempts >= MAX_ATTEMPTS:
            outcome = "locked"
        elif hmac.compare_digest(verification.code_hash, _hash(phone, str(code).strip())):
            verification.consumed_at = timezone.now()
            verification.save(update_fields=["consumed_at"])
            outcome = "ok"
        else:
            verification.attempts += 1
            verification.save(update_fields=["attempts"])
            outcome = "invalid"

    if outcome == "locked":
        raise serializers.ValidationError({"code": "Shumë tentativa. Kërkoni kod të ri."})
    if outcome == "invalid":
        raise serializers.ValidationError({"code": "Kodi është i pasaktë ose ka skaduar."})
