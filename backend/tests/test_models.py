import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Call, Turn


def test_turn_requires_existing_call(app):
    with app.app_context():
        db.session.add(Turn(call_id=999, idx=0, speaker="agent", text="hi"))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_deleting_call_deletes_its_turns(app):
    with app.app_context():
        call = Call(external_id="c-1", agent="a", source="real")
        call.turns.append(Turn(idx=0, speaker="agent", text="hi"))
        db.session.add(call)
        db.session.commit()
        db.session.delete(call)
        db.session.commit()
        assert Turn.query.count() == 0
