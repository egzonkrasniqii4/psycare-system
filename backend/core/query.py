from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ParseError


def parse_bound(value, name):
    if value in (None, ""):
        return None
    parsed = parse_datetime(value)
    if parsed is None:
        raise ParseError(f"Parametri '{name}' duhet të jetë datë-orë ISO.")
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def parse_positive_int(value, name):
    if value in (None, ""):
        return None
    if str(value).isdigit():
        return int(value)
    raise ParseError(f"Parametri '{name}' duhet të jetë numër.")
