import json
import os
import subprocess
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

COUNT_CALLS = (
    "import wsgi\n"
    "from app.models import Call\n"
    "with wsgi.app.app_context():\n"
    "    print(Call.query.count())\n"
)
READ_ONLY_MODE = (
    "import wsgi\n"
    "print(wsgi.app.test_client().get('/api/v1/mode').get_json()['read_only'])\n"
)


def expected_calls():
    total = 0
    for name in ("real_excerpts.json", "synthetic.json"):
        with open(os.path.join(BACKEND_DIR, "data", name), encoding="utf-8-sig") as fh:
            total += len(json.load(fh))
    return total


def run_wsgi(code, db_path, read_only="0"):
    """Import wsgi in a fresh process that uses a temporary database file."""
    env = dict(os.environ)
    env["DATABASE_URL"] = "sqlite:///" + db_path.as_posix()
    env["READ_ONLY"] = read_only
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1]


def test_first_start_seeds_an_empty_database(tmp_path):
    assert expected_calls() > 0
    count = run_wsgi(COUNT_CALLS, tmp_path / "first.db")
    assert int(count) == expected_calls()


def test_second_start_does_not_duplicate_calls(tmp_path):
    db_path = tmp_path / "again.db"
    assert int(run_wsgi(COUNT_CALLS, db_path)) == expected_calls()
    assert int(run_wsgi(COUNT_CALLS, db_path)) == expected_calls()


def test_read_only_setting_reaches_the_mode_endpoint(tmp_path):
    assert run_wsgi(READ_ONLY_MODE, tmp_path / "ro.db", read_only="1") == "True"
    assert run_wsgi(READ_ONLY_MODE, tmp_path / "rw.db", read_only="0") == "False"
