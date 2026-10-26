import os

from app import create_app
from app.extensions import db
from app.services.importer import TranscriptError
from app.services.seeder import SeedError, seed_database

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
OUT = os.path.normpath(os.path.join(BACKEND_DIR, "..", "frontend", "src", "fixtures"))

SUMMARY_SOURCES = ("real", "synthetic", "all")


def write(path, data):
    import json

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def get(client, url):
    response = client.get(url)
    if response.status_code != 200:
        raise SystemExit(f"GET {url} failed with status {response.status_code}")
    return response.get_json()


def export_fixtures(out_dir=OUT, data_dir=DATA_DIR):
    """Seed a throwaway in-memory database from the data files and export it.

    The live database is never opened, so review clicks and UI imports can
    never leak into the snapshot.
    """
    app = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        try:
            try:
                seed_database(data_dir)
            except (SeedError, TranscriptError) as exc:
                lines = "\n".join(f" - {error}" for error in exc.errors)
                raise SystemExit(f"Seed failed:\n{lines}")

            client = app.test_client()
            for source in SUMMARY_SOURCES:
                summary = get(client, f"/api/v1/summary?source={source}")
                write(os.path.join(out_dir, f"summary-{source}.json"), summary)

            write(os.path.join(out_dir, "rules.json"), get(client, "/api/v1/rules"))

            calls = get(client, "/api/v1/calls?page_size=100&sort=started_at&order=desc")
            if calls["total_pages"] > 1:
                raise SystemExit(
                    f"{calls['total']} calls do not fit in one snapshot page; raise the limit first"
                )

            write(os.path.join(out_dir, "calls.json"), calls)
            for item in calls["items"]:
                detail = get(client, f"/api/v1/calls/{item['call_id']}")
                write(os.path.join(out_dir, "calls", f"{item['call_id']}.json"), detail)
            return {
                "summaries": len(SUMMARY_SOURCES),
                "rules": 1,
                "calls": len(calls["items"]),
            }
        finally:
            db.session.remove()
            db.drop_all()


def main():
    result = export_fixtures()
    print(
        f"Wrote {result['summaries']} summary files, rules.json, calls.json and "
        f"{result['calls']} call files to {OUT}"
    )


if __name__ == "__main__":
    main()
