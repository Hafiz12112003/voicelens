import os
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "voicelens.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    LATENCY_THRESHOLD_MS = int(os.getenv("LATENCY_THRESHOLD_MS", "1500"))
    LATENCY_HIGH_MS = int(os.getenv("LATENCY_HIGH_MS", "3000"))
