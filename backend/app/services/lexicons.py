# Phrase lists used by the rules, one entry per language.
#
# English is the only language today. Every list is small, written by hand and
# NOT validated on real calls. A new language needs every key below, filled in
# and checked by someone who speaks it, before it is added to LEXICONS.
# Words are compared after lowercasing, dropping apostrophes and stripping
# punctuation, so write them that way (couldnt, not couldn't).

DEFAULT_LANGUAGE = "en"

ENGLISH = {
    # Rule 4 (false success claim)
    "success_phrases": ["booked", "confirmed", "done", "all set", "successfully"],
    "negation_words": frozenset(
        {
            "not", "cannot", "cant", "couldnt", "wasnt", "didnt", "isnt", "hasnt",
            "unable", "failed", "unfortunately", "sorry",
        }
    ),
    # Rule 3 (ignored constraint)
    "confirmation_cues": frozenset(
        {
            "confirm", "confirmed", "booked", "booking", "order", "ordered",
            "reservation", "reserved", "noted", "added", "got",
        }
    ),
    "number_words": {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    },
    "non_quantity_followers": frozenset(
        {
            "am", "pm", "oclock", "rupees", "rupee", "rs", "dollars", "dollar", "usd",
            "inr", "minutes", "minute", "hours", "hour", "percent",
            "moment", "second", "seconds", "sec", "more",
        }
    ),
    "veg_words": frozenset({"vegetarian", "vegan", "veg"}),
    "non_veg_items": frozenset(
        {
            "chicken", "mutton", "fish", "beef", "pork", "prawn", "prawns",
            "shrimp", "lamb", "meat", "bacon",
        }
    ),
    "excludable_items": frozenset(
        {
            "onion", "onions", "garlic", "nuts", "peanut", "peanuts",
            "cheese", "egg", "eggs", "dairy", "sugar",
        }
    ),
    "item_negators": frozenset({"no", "without", "non", "not"}),
    "exclusion_words": frozenset({"no", "without"}),
    "non_word": "non",
    "smoking_word": "smoking",
}

LEXICONS = {"en": ENGLISH}
LANGUAGE_NAMES = {"en": "English"}


def available_languages():
    return [{"id": code, "name": LANGUAGE_NAMES[code]} for code in LEXICONS]
