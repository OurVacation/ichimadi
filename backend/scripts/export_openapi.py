import json
from pathlib import Path

from app.main import app

# 컨테이너에서는 /docs/api, 로컬에서는 레포의 docs/api
OUTPUT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
