from app.services.rules import check_ignored_constraint


def t(i, speaker, text):
    return {"i": i, "speaker": speaker, "text": text, "start_ms": None, "end_ms": None}


def run(customer, agent, agent_name="restaurant-demo"):
    turns = [t(0, "customer", customer), t(1, "agent", agent)]
    return check_ignored_constraint(turns, agent_name)


def test_non_restaurant_hotel_agent_is_skipped():
    assert run("Two thalis", "Got it, three thalis.", "flight-demo") == []


def test_missing_agent_name_is_skipped():
    assert run("Two thalis", "Got it, three thalis.", None) == []


def test_quantity_mismatch_flagged_medium():
    f = run("Two vegetarian thalis please", "Got it, three thalis for you.")
    assert len(f) == 1
    assert f[0]["rule"] == "ignored_constraint"
    assert f[0]["severity"] == "medium"
    assert f[0]["turn_index"] == 1
    assert "[2]" in f[0]["evidence"] and "[3]" in f[0]["evidence"]


def test_quantity_word_matches_digit():
    assert run("Two thalis please", "Confirmed, 2 thalis.") == []


def test_quantity_partial_overlap_not_flagged():
    assert run("Two thalis by 8", "Confirmed two thalis.") == []


def test_currency_numbers_ignored():
    assert run("Two thalis please", "Confirmed, two thalis for 5 rupees.") == []


def test_time_numbers_ignored():
    assert run("Table for two", "Confirmed for 7 pm.") == []


def test_one_moment_is_not_a_quantity():
    assert run("Two thalis please", "One moment, I will confirm your order.") == []


def test_vegetarian_with_chicken_flagged_high():
    f = run("I want a vegetarian meal", "Confirmed, one chicken biryani.")
    assert len(f) == 1
    assert f[0]["severity"] == "high"
    assert "chicken" in f[0]["evidence"]


def test_vegetarian_with_negated_chicken_not_flagged():
    assert run("I want a vegetarian meal", "Confirmed, vegetable biryani with no chicken.") == []


def test_non_veg_customer_not_treated_as_vegetarian():
    assert run("Chicken biryani non veg please", "Confirmed, chicken biryani.") == []


def test_exclusion_ignored_by_agent_flagged_high():
    f = run("Paneer wrap, no onion please", "Noted, paneer wrap with onion.")
    assert len(f) == 1
    assert f[0]["severity"] == "high"
    assert "onion" in f[0]["evidence"]


def test_exclusion_respected_not_flagged():
    assert run("Paneer wrap, no onion please", "Noted, paneer wrap without onion.") == []


def test_non_smoking_ignored_flagged_high():
    f = run("I need a non smoking room for two nights", "Booked a smoking room for two nights.", "hotel-demo")
    assert len(f) == 1
    assert f[0]["severity"] == "high"


def test_non_smoking_respected_not_flagged():
    assert run("I need a non smoking room", "Booked a non-smoking room.", "hotel-demo") == []


def test_no_confirmation_cue_not_flagged():
    assert run("Vegetarian please", "We have chicken and fish today.") == []


def test_search_stops_at_next_customer_turn():
    turns = [
        t(0, "customer", "Vegetarian please"),
        t(1, "agent", "What size would you like?"),
        t(2, "customer", "Large"),
        t(3, "agent", "Confirmed, chicken pizza."),
    ]
    assert check_ignored_constraint(turns, "restaurant-demo") == []


def test_only_first_confirmation_turn_is_checked():
    turns = [
        t(0, "customer", "Vegetarian thali please"),
        t(1, "agent", "Got it, one veg thali."),
        t(2, "agent", "Confirmed, chicken thali."),
    ]
    assert check_ignored_constraint(turns, "restaurant-demo") == []


def test_hotel_prefix_is_accepted():
    f = run("Non smoking room please", "Confirmed, smoking room.", "hotel-demo")
    assert len(f) == 1


def test_empty_turns():
    assert check_ignored_constraint([], "restaurant-demo") == []
