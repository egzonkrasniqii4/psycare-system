import re

PHONE_PATTERN = re.compile(r"\+?\d{6,15}")


def normalize_phone(value):
    """Strip spacing and punctuation so '+355 69 000 0001' and '+355690000001' match."""
    cleaned = re.sub(r"[\s\-().]", "", value or "")
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    return cleaned


def is_valid_phone(value):
    return bool(PHONE_PATTERN.fullmatch(value))
