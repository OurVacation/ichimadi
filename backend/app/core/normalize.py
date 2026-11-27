import unicodedata


def normalize_login_id(s: str) -> str:
    return unicodedata.normalize("NFKC", s).strip().lower()


def normalize_password(s: str) -> str:
    return unicodedata.normalize("NFKC", s).strip()


def normalize_ja_name(s: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", s).split())
