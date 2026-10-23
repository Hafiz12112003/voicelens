import json
import os

from app.extensions import db
from app.models import Call, Label
from app.services.importer import VALID_SOURCES, import_calls, validate_call
from app.services.metrics import RULE_ORDER

DATA_FILES = [("real_excerpts.json", "real"), ("synthetic.json", "synthetic")]
LABELS_FILE = "labels.json"


class SeedError(Exception):
    """Raised when a data file is invalid. Carries every error found."""

    def __init__(self, errors):
        super().__init__("; ".join(errors))
        self.errors = errors


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _read_json_list(path, filename):
    with open(path, encoding="utf-8-sig") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise SeedError(
                [f"{filename}: not valid JSON: {exc.msg} (line {exc.lineno})"]
            )
    if not isinstance(data, list):
        raise SeedError([f"{filename}: must contain a JSON list"])
    return data


def _validate_labels(labels, calls_by_id):
    errors, seen, clean = [], set(), []
    for pos, item in enumerate(labels):
        p = f"{LABELS_FILE}[{pos}]"
        if not isinstance(item, dict):
            errors.append(f"{p}: must be an object")
            continue

        ok = True
        cid = item.get("call_id")
        call = calls_by_id.get(cid) if isinstance(cid, str) else None
        if call is None:
            errors.append(f"{p}: call '{cid}' not found in the database")
            ok = False
        elif call.source != "real":
            errors.append(
                f"{p}: call '{cid}' is {call.source}; labels are for real calls only"
            )
            ok = False

        turn = item.get("turn_index")
        if not _is_int(turn) or turn < 0 or (call is not None and turn >= len(call.turns)):
            errors.append(f"{p}: turn_index must be a turn number of the call")
            ok = False

        rule = item.get("rule")
        if rule not in RULE_ORDER:
            errors.append(f"{p}: rule must be one of: {', '.join(RULE_ORDER)}")
            ok = False

        flag = item.get("is_real_issue")
        if not isinstance(flag, bool):
            errors.append(f"{p}: is_real_issue must be true or false")
            ok = False

        if not ok:
            continue
        key = (cid, turn, rule)
        if key in seen:
            errors.append(f"{p}: duplicate label for {cid} turn {turn} rule {rule}")
            continue
        seen.add(key)
        clean.append((call, turn, rule, flag))
    return errors, clean


def seed_database(data_dir):
    data_dir = str(data_dir)
    errors, batches, seen_ids = [], [], {}

    for filename, expected in DATA_FILES:
        path = os.path.join(data_dir, filename)
        if not os.path.exists(path):
            continue
        calls = _read_json_list(path, filename)
        for pos, obj in enumerate(calls):
            errors.extend(f"{filename}: {e}" for e in validate_call(obj, pos))
            if not isinstance(obj, dict):
                continue
            cid = obj.get("call_id")
            cid = cid.strip() if isinstance(cid, str) else None
            source = obj.get("source")
            if source in VALID_SOURCES and source != expected:
                errors.append(
                    f"{filename}: {cid or f'call[{pos}]'}: source is '{source}', "
                    f"expected '{expected}' in this file"
                )
            if cid:
                if cid in seen_ids:
                    errors.append(
                        f"{filename}: duplicate call_id '{cid}' (already in {seen_ids[cid]})"
                    )
                else:
                    seen_ids[cid] = filename
        batches.append(calls)

    if errors:
        raise SeedError(errors)

    result = {"imported": [], "skipped": [], "findings": 0, "labels": 0}
    for calls in batches:
        if not calls:
            continue
        part = import_calls(calls)
        result["imported"] += part["imported"]
        result["skipped"] += part["skipped"]
        result["findings"] += part["findings"]

    labels_path = os.path.join(data_dir, LABELS_FILE)
    if os.path.exists(labels_path):
        labels = _read_json_list(labels_path, LABELS_FILE)
        calls_by_id = {c.external_id: c for c in Call.query.all()}
        label_errors, clean = _validate_labels(labels, calls_by_id)
        if label_errors:
            raise SeedError(label_errors)
        try:
            Label.query.delete()
            for call, turn, rule, flag in clean:
                db.session.add(
                    Label(call_id=call.id, turn_idx=turn, rule=rule, is_real_issue=flag)
                )
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        result["labels"] = len(clean)

    return result
