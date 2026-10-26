from app.services.lexicons import (
    DEFAULT_LANGUAGE,
    LANGUAGE_NAMES,
    LEXICONS,
    available_languages,
)
from app.services.rules import check_false_success_claim, check_ignored_constraint

EN = LEXICONS[DEFAULT_LANGUAGE]
FAILED_BOOKING = [{"after_turn": 0, "name": "create_booking", "status": "failed"}]


def t(i, speaker, text):
    return {"i": i, "speaker": speaker, "text": text, "start_ms": None, "end_ms": None}


def test_every_lexicon_has_the_same_keys_and_no_empty_lists():
    assert set(LANGUAGE_NAMES) == set(LEXICONS)
    for code, lexicon in LEXICONS.items():
        assert set(lexicon) == set(EN), code
        assert all(lexicon.values()), code


def test_english_is_the_default_language():
    assert DEFAULT_LANGUAGE == "en"
    assert available_languages() == [{"id": "en", "name": "English"}]


def test_false_success_uses_the_given_lexicon():
    custom = {**EN, "success_phrases": ["listo"], "negation_words": frozenset({"siento"})}
    spanish = [t(0, "customer", "Reserva por favor"), t(1, "agent", "Listo, todo reservado.")]
    english = [t(0, "customer", "Book it"), t(1, "agent", "Your table is booked!")]

    found = check_false_success_claim(spanish, FAILED_BOOKING, custom)
    assert [(f["turn_index"], f["rule"]) for f in found] == [(1, "false_success_claim")]
    assert '(matched "listo")' in found[0]["evidence"]
    assert check_false_success_claim(spanish, FAILED_BOOKING) == []

    assert check_false_success_claim(english, FAILED_BOOKING, custom) == []
    assert len(check_false_success_claim(english, FAILED_BOOKING)) == 1


def test_ignored_constraint_uses_the_given_lexicon():
    custom = {
        **EN,
        "veg_words": frozenset({"vegano"}),
        "non_veg_items": frozenset({"pollo"}),
        "confirmation_cues": frozenset({"confirmado"}),
    }
    turns = [t(0, "customer", "Quiero vegano"), t(1, "agent", "Confirmado pollo")]

    found = check_ignored_constraint(turns, "restaurant-demo", custom)
    assert [(f["turn_index"], f["severity"]) for f in found] == [(1, "high")]
    assert '"pollo"' in found[0]["evidence"]
    assert check_ignored_constraint(turns, "restaurant-demo") == []


def test_rules_endpoint_lists_the_languages(client):
    body = client.get("/api/v1/rules").get_json()
    assert body["languages"] == [{"id": "en", "name": "English"}]
