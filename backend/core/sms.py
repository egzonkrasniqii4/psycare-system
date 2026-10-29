import base64
import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class ConsoleSMSBackend:
    """Development only: prints the SMS to the Django terminal instead of sending it."""

    exposes_code = True

    def send(self, phone, message):
        print(f"\n[SMS -> {phone}] {message}\n", flush=True)


class LocMemSMSBackend:
    exposes_code = False
    outbox = []

    def send(self, phone, message):
        self.outbox.append((phone, message))


class TwilioSMSBackend:
    exposes_code = False

    def __init__(self):
        self.sid = settings.TWILIO_ACCOUNT_SID
        self.token = settings.TWILIO_AUTH_TOKEN
        self.sender = settings.TWILIO_FROM_NUMBER
        if not (self.sid and self.token and self.sender):
            raise ImproperlyConfigured(
                "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN dhe TWILIO_FROM_NUMBER duhen për SMS."
            )

    def send(self, phone, message):
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Messages.json"
        body = urllib.parse.urlencode({"To": phone, "From": self.sender, "Body": message}).encode()
        auth = base64.b64encode(f"{self.sid}:{self.token}".encode()).decode()
        request = urllib.request.Request(url, data=body, method="POST")
        request.add_header("Authorization", f"Basic {auth}")
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read() or b"{}")
        if payload.get("error_code"):
            logger.error("Twilio refuzoi SMS-në për %s: %s", phone, payload)
            raise RuntimeError("SMS-ja nuk u dërgua.")


def get_sms_backend():
    return import_string(settings.SMS_BACKEND)()
