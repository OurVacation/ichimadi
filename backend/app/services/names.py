import re

from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.normalize import normalize_ja_name
from app.llm.base import Candidate, NameGenerator, NameGeneratorError
from app.models import NameSuggestion


def suggest(db: Session, generator: NameGenerator, raw_ja_name: str) -> list[Candidate]:
    input_key = normalize_ja_name(raw_ja_name)
    if not 1 <= len(input_key) <= 30:
        raise AppError("invalid_ja_name", "名前を確認してください", 422)
    cached = db.get(NameSuggestion, input_key)
    if cached is not None:
        return [Candidate.model_validate(item) for item in cached.candidates]
    try:
        generated = generator.generate(input_key)
        candidates = []
        for item in generated:
            candidate = Candidate.model_validate(item)
            candidates.append(Candidate(name=candidate.name.strip(), note=candidate.note.strip()))
        if (
            len(candidates) != 3
            or len({c.name for c in candidates}) != 3
            or any(
                not re.fullmatch(r"[가-힣]{1,10}", c.name) or not 1 <= len(c.note) <= 40
                for c in candidates
            )
        ):
            raise NameGeneratorError()
    except (NameGeneratorError, ValidationError, TypeError, AttributeError) as exc:
        raise AppError("name_suggest_unavailable", "いまは候補を作れません", 503) from exc
    db.execute(
        insert(NameSuggestion)
        .values(
            input_key=input_key,
            candidates=[c.model_dump() for c in candidates],
            model=generator.model,
        )
        .on_conflict_do_nothing(index_elements=[NameSuggestion.input_key])
    )
    db.commit()
    # A concurrent request may have populated the cache first; everyone gets that result.
    db.expire_all()
    cached = db.get(NameSuggestion, input_key)
    return [Candidate.model_validate(item) for item in cached.candidates]
