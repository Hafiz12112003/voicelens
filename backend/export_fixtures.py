import json
import os

from app import create_app

OUT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "src", "fixtures")
)


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def get(client, url):
    response = client.get(url)
    if response.status_code != 200:
        raise SystemExit(f"GET {url} failed with status {response.status_code}")
    return response.get_json()


def main():
    app = create_app()
    client = app.test_client()

    summary = get(client, "/api/v1/summary?source=all")
    calls = get(client, "/api/v1/calls?page_size=100&sort=started_at&order=desc")
    if calls["total_pages"] > 1:
        raise SystemExit(
            f"{calls['total']} calls do not fit in one snapshot page; raise the limit first"
        )

    write(os.path.join(OUT, "summary.json"), summary)
    write(os.path.join(OUT, "calls.json"), calls)
    for item in calls["items"]:
        detail = get(client, f"/api/v1/calls/{item['call_id']}")
        write(os.path.join(OUT, "calls", f"{item['call_id']}.json"), detail)

    print(f"Wrote summary.json, calls.json and {len(calls['items'])} call files to {OUT}")


if __name__ == "__main__":
    main()
