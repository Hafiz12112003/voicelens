import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def read(*parts):
    # Strict utf-8 on purpose: a byte order mark would show up as a stray first character.
    with open(os.path.join(ROOT, *parts), encoding="utf-8", newline="") as fh:
        return fh.read().replace("\r\n", "\n")


def test_vercel_json_rewrites_every_path_to_the_app():
    config = json.loads(read("frontend", "vercel.json"))
    assert config["rewrites"] == [{"source": "/(.*)", "destination": "/index.html"}]


def test_render_starts_one_gunicorn_worker_from_the_backend_folder():
    text = read("render.yaml")
    assert not text.startswith("\ufeff")
    assert "rootDir: backend\n" in text
    assert "startCommand: gunicorn wsgi:app --workers 1" in text
    assert "--bind 0.0.0.0:$PORT" in text
    assert "healthCheckPath: /api/v1/health\n" in text


def test_render_env_keeps_the_demo_read_only_and_leaves_cors_to_the_dashboard():
    text = read("render.yaml")
    assert '- key: READ_ONLY\n        value: "1"\n' in text
    assert "- key: PYTHON_VERSION\n        value: 3.12.9\n" in text
    assert "- key: CORS_ORIGINS\n        sync: false" in text
