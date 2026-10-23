import argparse
import os
import sys

from app import create_app
from app.extensions import db
from app.services.importer import TranscriptError
from app.services.seeder import SeedError, seed_database

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def main():
    parser = argparse.ArgumentParser(
        description="Load the VoiceLens data files into the database."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete ALL data first, including confirm/dismiss reviews",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.reset:
            db.drop_all()
            db.create_all()
        try:
            result = seed_database(DATA_DIR)
        except (SeedError, TranscriptError) as exc:
            print("Seed failed:")
            for error in exc.errors:
                print(" -", error)
            return 1

    print(
        f"Imported {len(result['imported'])} calls, skipped {len(result['skipped'])} "
        f"already present, {result['findings']} findings, {result['labels']} labels."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
