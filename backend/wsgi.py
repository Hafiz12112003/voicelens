"""Production entry point: gunicorn wsgi:app --workers 1

Render's free disk is wiped whenever the service restarts, so an empty database
is filled from backend/data on start. A database that already has calls is left
alone, so reviews survive a plain reload. Run one worker: two workers starting
at once on an empty database could both try to seed it.
"""
import os

from app import create_app
from app.models import Call
from app.services.seeder import seed_database

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

app = create_app()

with app.app_context():
    if Call.query.count() == 0:
        seed_database(DATA_DIR)
