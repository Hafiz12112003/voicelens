import copy
import math

from app.services.rules import (
    FALSE_SUCCESS,
    HIGH_LATENCY,
    IGNORED_CONSTRAINT,
    REPEATED_TURN,
)

# One entry per rule, in display order. Nothing here has been validated on real
# calls. Threshold keys match the keyword arguments of the rule functions.
# Latency defaults are replaced by the app config in rule_catalog().
RULES = [
    {
        "id": HIGH_LATENCY,
        "name": "High latency",
        "description": (
            "Flags an agent turn that starts too long after the customer finished "
            "speaking."
        ),
        "severity": "Medium above the base threshold, high above the high threshold.",
        "applies_to": "All agents",
        "needs": ["start_ms and end_ms on both turns of a customer-to-agent pair"],
        "thresholds": [
            {
                "key": "threshold_ms",
                "label": "Flag gaps above",
                "unit": "ms",
                "type": "integer",
                "default": 1500,
                "min": 100,
                "max": 60000,
            },
            {
                "key": "high_ms",
                "label": "High severity above",
                "unit": "ms",
                "type": "integer",
                "default": 3000,
                "min": 100,
                "max": 120000,
            },
        ],
        "known_limits": [
            "Only as accurate as the timestamps you supply.",
            "Measures customer end to next agent start, only for a customer turn followed directly by an agent turn.",
            "Overlapping turns (a negative gap) are skipped, not counted as latency.",
            "The default thresholds are not checked against what callers actually notice.",
        ],
        "validated": False,
    },
    {
        "id": REPEATED_TURN,
        "name": "Repeated agent turn",
        "description": (
            "Flags an agent turn that says (almost) the same thing as the agent's "
            "previous turn."
        ),
        "severity": "Medium",
        "applies_to": "All agents",
        "needs": [],
        "thresholds": [
            {
                "key": "jaccard_threshold",
                "label": "Word overlap needed",
                "unit": "ratio",
                "type": "number",
                "default": 0.8,
                "min": 0.5,
                "max": 1.0,
            },
        ],
        "known_limits": [
            "Compares only with the previous agent turn.",
            "Compares sets of words, so word order is ignored and different sentences with the same words can match.",
            "Splits text on spaces, so languages written without spaces are not handled.",
            "A deliberate repeat, such as reading back an order number, is flagged too.",
        ],
        "validated": False,
    },
    {
        "id": IGNORED_CONSTRAINT,
        "name": "Ignored constraint",
        "description": (
            "Flags an agent confirmation that contradicts what the customer just "
            "asked for: a different quantity, a non-vegetarian item for a vegetarian "
            "request, an excluded ingredient, or a smoking room for a non-smoking request."
        ),
        "severity": "High for dietary, exclusion and smoking contradictions, medium for a quantity mismatch.",
        "applies_to": "Agents whose name starts with restaurant or hotel",
        "needs": [],
        "thresholds": [],
        "known_limits": [
            "Only runs for agent names starting with restaurant or hotel.",
            "Uses small English word lists: quantities 1 to 20, vegetarian words, a few excluded items and non-smoking.",
            "Only checks the first agent turn with a confirmation word before the next customer turn.",
            "Findings are candidates for review, not verdicts: the customer may have changed the request later.",
        ],
        "validated": False,
    },
    {
        "id": FALSE_SUCCESS,
        "name": "False success claim",
        "description": (
            "Flags an agent turn that claims success right after a tool call failed."
        ),
        "severity": "High",
        "applies_to": "All agents",
        "needs": ["tool_events in the call"],
        "thresholds": [],
        "known_limits": [
            "Needs tool_events. CSV imports and phone calls have none, so this rule cannot run on them.",
            "Only checks the first agent turn after a failed tool event.",
            "Matches a short English phrase list and skips turns containing a negation word such as sorry or not.",
            "Cannot tell whether a later tool call succeeded.",
        ],
        "validated": False,
    },
]

RULE_IDS = [rule["id"] for rule in RULES]


def rule_catalog(config):
    """A copy of RULES with the latency defaults taken from the app config."""
    catalog = copy.deepcopy(RULES)
    latency_defaults = {
        "threshold_ms": config["LATENCY_THRESHOLD_MS"],
        "high_ms": config["LATENCY_HIGH_MS"],
    }
    for rule in catalog:
        if rule["id"] != HIGH_LATENCY:
            continue
        for threshold in rule["thresholds"]:
            default = latency_defaults.get(threshold["key"])
            if default is None:
                continue
            threshold["default"] = default
            threshold["min"] = min(threshold["min"], default)
            threshold["max"] = max(threshold["max"], default)
    return catalog


def _check_value(spec, value):
    """None when the value is acceptable, otherwise the problem as text."""
    if isinstance(value, bool):
        ok = False
    elif spec["type"] == "integer":
        ok = isinstance(value, int)
    else:
        ok = isinstance(value, (int, float)) and math.isfinite(value)
    word = "a whole number" if spec["type"] == "integer" else "a number"
    problem = f"must be {word} between {spec['min']} and {spec['max']}"
    if not ok or not spec["min"] <= value <= spec["max"]:
        return problem
    return None


def resolve_settings(config, raw):
    """Merge request settings over the defaults. Returns (settings, errors).
    raw is the optional "settings" object of a request (None means defaults)."""
    specs = {
        threshold["key"]: threshold
        for rule in rule_catalog(config)
        for threshold in rule["thresholds"]
    }
    settings = {key: spec["default"] for key, spec in specs.items()}
    if raw is None:
        return settings, []
    if not isinstance(raw, dict):
        return settings, ["settings must be an object"]

    errors = []
    for key, value in raw.items():
        spec = specs.get(key)
        if spec is None:
            errors.append(
                f"settings.{key} is not a known setting (known: {', '.join(sorted(specs))})"
            )
            continue
        problem = _check_value(spec, value)
        if problem:
            errors.append(f"settings.{key} {problem}")
            continue
        settings[key] = value

    if not errors and settings["high_ms"] < settings["threshold_ms"]:
        errors.append(
            f"settings.high_ms ({settings['high_ms']}) must not be below "
            f"settings.threshold_ms ({settings['threshold_ms']})"
        )
    return settings, errors
