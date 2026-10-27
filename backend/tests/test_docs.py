import json
import pathlib

from app.services.registry import RULES

ROOT = pathlib.Path(__file__).resolve().parents[2]


def read(*parts):
    return ROOT.joinpath(*parts).read_text(encoding="utf-8-sig")


def test_accuracy_doc_covers_every_rule_and_its_limits():
    text = read("docs", "accuracy.md")
    for rule in RULES:
        assert rule["id"] in text, rule["id"]
        assert rule["name"] in text, rule["name"]
        for limit in rule["known_limits"]:
            assert limit in text, f'{rule["id"]}: {limit}'


def test_accuracy_doc_matches_the_label_file():
    labels = json.loads(read("backend", "data", "labels.json"))
    says_no_labels = "No labels yet" in read("docs", "accuracy.md")
    assert says_no_labels == (len(labels) == 0), (
        "labels.json and docs/accuracy.md disagree: update the doc when labels are added"
    )


def test_readme_states_the_honesty_rules():
    text = read("README.md")
    assert "independent prototype inspired by Zudu's public product" in text
    assert "synthetic" in text
    assert "validated on real calls" in text


def test_readme_lists_every_rule_and_links_the_accuracy_doc():
    text = read("README.md")
    for rule in RULES:
        assert rule["id"] in text, rule["id"]
    assert "docs/accuracy.md" in text
