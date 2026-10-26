from app.services.rules import (
    check_agent_talking_over_customer,
    check_customer_repeated_themselves,
)


def t(i, speaker, text="x", start=None, end=None):
    return {"i": i, "speaker": speaker, "text": text, "start_ms": start, "end_ms": end}


def pair(agent_start, customer_end=3000):
    """A customer turn ending at customer_end, then an agent turn starting at agent_start."""
    return [
        t(0, "customer", start=0, end=customer_end),
        t(1, "agent", start=agent_start, end=4000),
    ]


# ---------- Rule 5: agent talking over the customer ----------

def test_talking_over_flagged_when_overlap_exceeds_threshold():
    f = check_agent_talking_over_customer(pair(2000))
    assert len(f) == 1
    assert f[0]["rule"] == "agent_talking_over_customer"
    assert f[0]["severity"] == "medium"
    assert f[0]["turn_index"] == 1
    assert "agent started at 2000 ms" in f[0]["evidence"]
    assert "1000 ms before the customer finished at 3000 ms" in f[0]["evidence"]


def test_talking_over_boundary_is_not_flagged_but_one_more_ms_is():
    assert check_agent_talking_over_customer(pair(2500)) == []  # overlap 500
    assert len(check_agent_talking_over_customer(pair(2499))) == 1  # overlap 501


def test_talking_over_custom_threshold():
    assert check_agent_talking_over_customer(pair(2800)) == []  # overlap 200
    assert len(check_agent_talking_over_customer(pair(2800), overlap_ms=100)) == 1
    assert check_agent_talking_over_customer(pair(3000), overlap_ms=0) == []
    assert len(check_agent_talking_over_customer(pair(2999), overlap_ms=0)) == 1


def test_talking_over_ignores_gaps_missing_times_and_other_pairs():
    assert check_agent_talking_over_customer(pair(3500)) == []
    assert check_agent_talking_over_customer([]) == []
    no_end = [t(0, "customer", start=0, end=None), t(1, "agent", start=100, end=200)]
    assert check_agent_talking_over_customer(no_end) == []
    no_start = [t(0, "customer", start=0, end=3000), t(1, "agent")]
    assert check_agent_talking_over_customer(no_start) == []
    customer_interrupts = [
        t(0, "agent", start=0, end=3000),
        t(1, "customer", start=1000, end=4000),
    ]
    assert check_agent_talking_over_customer(customer_interrupts) == []
    for speaker in ("customer", "agent"):
        same = [t(0, speaker, start=0, end=3000), t(1, speaker, start=1000, end=4000)]
        assert check_agent_talking_over_customer(same) == []


# ---------- Rule 6: customer repeating themselves ----------

def test_customer_repeat_exact_match_flagged_low():
    turns = [
        t(0, "customer", "I said next Friday evening"),
        t(1, "agent", "Okay"),
        t(2, "customer", "I said next Friday evening"),
    ]
    f = check_customer_repeated_themselves(turns)
    assert len(f) == 1
    assert f[0]["rule"] == "customer_repeated_themselves"
    assert f[0]["severity"] == "low"
    assert f[0]["turn_index"] == 2
    assert "repeats customer turn 0" in f[0]["evidence"]
    assert "similarity 1.00" in f[0]["evidence"]


def test_customer_repeat_needs_three_words():
    three = [t(0, "customer", "next friday evening"), t(1, "customer", "next friday evening")]
    assert len(check_customer_repeated_themselves(three)) == 1
    two = [t(0, "customer", "yes please"), t(1, "customer", "yes please")]
    assert check_customer_repeated_themselves(two) == []
    short_first = [t(0, "customer", "please wait"), t(1, "customer", "please wait now")]
    assert check_customer_repeated_themselves(short_first, customer_jaccard_threshold=0.5) == []


def test_customer_repeat_threshold_boundary_and_custom():
    base = [t(0, "customer", "please confirm your order"), t(1, "agent", "ok")]
    at_threshold = base + [t(2, "customer", "please confirm your order today")]
    f = check_customer_repeated_themselves(at_threshold)  # 4/5 = 0.8
    assert len(f) == 1
    assert "similarity 0.80" in f[0]["evidence"]
    below = base + [t(2, "customer", "please confirm your order for today evening")]
    assert check_customer_repeated_themselves(below) == []  # 4/7
    assert len(check_customer_repeated_themselves(below, customer_jaccard_threshold=0.5)) == 1


def test_customer_repeat_compares_only_with_previous_customer_turn():
    turns = [
        t(0, "customer", "book a table today"),
        t(1, "customer", "cancel my other order"),
        t(2, "customer", "book a table today"),
    ]
    assert check_customer_repeated_themselves(turns) == []


def test_customer_repeat_ignores_case_punctuation_and_agent_turns():
    turns = [t(0, "customer", "Next Friday, evening!"), t(1, "customer", "next friday evening")]
    f = check_customer_repeated_themselves(turns)
    assert len(f) == 1
    assert "similarity 1.00" in f[0]["evidence"]
    agents = [t(0, "agent", "please confirm your order"), t(1, "agent", "please confirm your order")]
    assert check_customer_repeated_themselves(agents) == []
    assert check_customer_repeated_themselves([]) == []
