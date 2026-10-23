from app.services.rules import (
    check_false_success_claim,
    check_high_latency,
    check_repeated_agent_turn,
    jaccard,
    normalize_text,
    response_gaps,
)


def t(i, speaker, text="x", start=None, end=None):
    return {"i": i, "speaker": speaker, "text": text, "start_ms": start, "end_ms": end}


def failed(after, name="create_booking"):
    return {"after_turn": after, "name": name, "status": "failed"}


# ---------- Rule 1: high latency ----------

def test_latency_exactly_at_threshold_is_not_flagged():
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=2500, end=3000)]
    assert check_high_latency(turns) == []


def test_latency_just_above_threshold_is_medium():
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=2501, end=3000)]
    f = check_high_latency(turns)
    assert len(f) == 1
    assert f[0]["severity"] == "medium"
    assert f[0]["turn_index"] == 1
    assert "1501 ms" in f[0]["evidence"]


def test_latency_exactly_at_high_boundary_is_medium():
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=4000, end=4500)]
    assert check_high_latency(turns)[0]["severity"] == "medium"


def test_latency_above_high_boundary_is_high():
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=4001, end=4500)]
    assert check_high_latency(turns)[0]["severity"] == "high"


def test_latency_missing_timestamps_ignored():
    turns = [t(0, "customer", start=0, end=None), t(1, "agent", start=9000, end=9500)]
    assert check_high_latency(turns) == []
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=None, end=None)]
    assert check_high_latency(turns) == []


def test_latency_negative_gap_ignored():
    turns = [t(0, "customer", start=0, end=5000), t(1, "agent", start=4000, end=6000)]
    assert check_high_latency(turns) == []
    assert response_gaps(turns) == []


def test_latency_only_customer_to_agent_pairs_count():
    turns = [
        t(0, "agent", start=0, end=1000),
        t(1, "agent", start=9000, end=9500),
        t(2, "customer", start=10000, end=11000),
        t(3, "customer", start=20000, end=21000),
    ]
    assert check_high_latency(turns) == []


def test_latency_custom_threshold():
    turns = [t(0, "customer", start=0, end=1000), t(1, "agent", start=1600, end=2000)]
    assert check_high_latency(turns) == []
    assert len(check_high_latency(turns, threshold_ms=500)) == 1


def test_latency_empty_turns():
    assert check_high_latency([]) == []


# ---------- Rule 2: repeated agent turn ----------

def test_repeat_exact_match():
    turns = [
        t(0, "agent", "Please confirm your order."),
        t(1, "customer", "yes"),
        t(2, "agent", "Please confirm your order."),
    ]
    f = check_repeated_agent_turn(turns)
    assert len(f) == 1
    assert f[0]["turn_index"] == 2
    assert "similarity 1.00" in f[0]["evidence"]


def test_repeat_ignores_case_and_punctuation():
    turns = [t(0, "agent", "Sure, one moment!"), t(1, "agent", "sure one moment")]
    assert len(check_repeated_agent_turn(turns)) == 1


def test_repeat_jaccard_exactly_at_threshold_is_flagged():
    turns = [
        t(0, "agent", "please confirm your order"),
        t(1, "agent", "please confirm your order today"),
    ]
    assert len(check_repeated_agent_turn(turns)) == 1  # 4/5 = 0.8


def test_repeat_below_threshold_not_flagged():
    turns = [
        t(0, "agent", "please confirm your order"),
        t(1, "agent", "please confirm your order for today evening"),
    ]
    assert check_repeated_agent_turn(turns) == []  # 4/7


def test_repeat_different_turns_not_flagged():
    turns = [t(0, "agent", "What would you like?"), t(1, "agent", "Your total is 400 rupees.")]
    assert check_repeated_agent_turn(turns) == []


def test_repeat_first_agent_turn_never_flagged():
    assert check_repeated_agent_turn([t(0, "agent", "Hello")]) == []


def test_repeat_compares_only_with_previous_agent_turn():
    turns = [
        t(0, "agent", "Hello there"),
        t(1, "agent", "Anything else?"),
        t(2, "agent", "Hello there"),
    ]
    assert check_repeated_agent_turn(turns) == []


def test_repeat_empty_text_skipped():
    turns = [t(0, "agent", "..."), t(1, "agent", "...")]
    assert check_repeated_agent_turn(turns) == []


def test_repeat_customer_turns_not_checked():
    turns = [t(0, "customer", "yes"), t(1, "customer", "yes")]
    assert check_repeated_agent_turn(turns) == []


def test_helpers():
    assert normalize_text("  Hello,   WORLD! ") == "hello world"
    assert jaccard([], []) == 0.0
    assert jaccard(["a", "b"], ["b", "c"]) == 1 / 3


# ---------- Rule 4: false success claim ----------

def test_false_success_flags_booked_after_failed_tool():
    turns = [t(0, "customer", "Book a table for two"), t(1, "agent", "Your table is booked!")]
    f = check_false_success_claim(turns, [failed(0)])
    assert len(f) == 1
    assert f[0]["rule"] == "false_success_claim"
    assert f[0]["severity"] == "high"
    assert f[0]["turn_index"] == 1
    assert "create_booking" in f[0]["evidence"]
    assert "booked" in f[0]["evidence"]


def test_false_success_ok_tool_not_flagged():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "Your table is booked!")]
    events = [{"after_turn": 0, "name": "create_booking", "status": "ok"}]
    assert check_false_success_claim(turns, events) == []


def test_false_success_no_tool_events_means_rule_does_not_run():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "Your table is booked!")]
    assert check_false_success_claim(turns, None) == []
    assert check_false_success_claim(turns, []) == []


def test_false_success_apology_not_flagged():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "Sorry, I couldn't get that booked.")]
    assert check_false_success_claim(turns, [failed(0)]) == []


def test_false_success_only_first_agent_turn_after_event_is_checked():
    turns = [
        t(0, "customer", "Book it"),
        t(1, "agent", "Let me try again."),
        t(2, "customer", "ok"),
        t(3, "agent", "Done, it is booked."),
    ]
    assert check_false_success_claim(turns, [failed(0)]) == []


def test_false_success_customer_turn_in_between_is_skipped():
    turns = [
        t(0, "agent", "Placing your order now."),
        t(1, "customer", "ok"),
        t(2, "agent", "Your order is confirmed."),
    ]
    f = check_false_success_claim(turns, [failed(0, "create_order")])
    assert len(f) == 1
    assert f[0]["turn_index"] == 2


def test_false_success_event_after_last_turn_ignored():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "Booked")]
    assert check_false_success_claim(turns, [failed(1)]) == []


def test_false_success_whole_word_match_only():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "The cart was abandoned earlier.")]
    assert check_false_success_claim(turns, [failed(0)]) == []


def test_false_success_two_failures_same_turn_give_one_finding():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "All done!")]
    events = [failed(0, "create_booking"), failed(0, "send_sms")]
    f = check_false_success_claim(turns, events)
    assert len(f) == 1
    assert "create_booking" in f[0]["evidence"]


def test_false_success_case_insensitive():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "CONFIRMED!")]
    assert len(check_false_success_claim(turns, [failed(0)])) == 1


def test_false_success_multiword_phrase():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "You're all set.")]
    assert len(check_false_success_claim(turns, [failed(0)])) == 1


def test_false_success_asking_to_confirm_is_not_a_claim():
    turns = [t(0, "customer", "Book it"), t(1, "agent", "Can you confirm the time?")]
    assert check_false_success_claim(turns, [failed(0)]) == []
