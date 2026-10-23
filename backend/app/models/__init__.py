from app.extensions import db


class Call(db.Model):
    __tablename__ = "calls"

    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(80), unique=True, nullable=False, index=True)
    agent = db.Column(db.String(80), nullable=False, index=True)
    source = db.Column(db.String(20), nullable=False, index=True)  # "real" | "synthetic"
    started_at = db.Column(db.DateTime)
    duration_ms = db.Column(db.Integer)
    outcome = db.Column(db.String(40))

    turns = db.relationship(
        "Turn", backref="call", cascade="all, delete-orphan", order_by="Turn.idx"
    )
    tool_events = db.relationship(
        "ToolEvent", backref="call", cascade="all, delete-orphan", order_by="ToolEvent.after_turn"
    )
    findings = db.relationship(
        "Finding", backref="call", cascade="all, delete-orphan", order_by="Finding.turn_idx"
    )
    labels = db.relationship("Label", backref="call", cascade="all, delete-orphan")


class Turn(db.Model):
    __tablename__ = "turns"

    id = db.Column(db.Integer, primary_key=True)
    call_id = db.Column(db.Integer, db.ForeignKey("calls.id"), nullable=False, index=True)
    idx = db.Column(db.Integer, nullable=False)
    speaker = db.Column(db.String(20), nullable=False)  # "agent" | "customer"
    text = db.Column(db.Text, nullable=False)
    start_ms = db.Column(db.Integer)
    end_ms = db.Column(db.Integer)

    __table_args__ = (db.UniqueConstraint("call_id", "idx", name="uq_turn_call_idx"),)


class ToolEvent(db.Model):
    __tablename__ = "tool_events"

    id = db.Column(db.Integer, primary_key=True)
    call_id = db.Column(db.Integer, db.ForeignKey("calls.id"), nullable=False, index=True)
    after_turn = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # "ok" | "failed"


class Finding(db.Model):
    __tablename__ = "findings"

    id = db.Column(db.Integer, primary_key=True)
    call_id = db.Column(db.Integer, db.ForeignKey("calls.id"), nullable=False, index=True)
    turn_idx = db.Column(db.Integer, nullable=False)
    rule = db.Column(db.String(40), nullable=False, index=True)
    severity = db.Column(db.String(10), nullable=False)  # "high" | "medium" | "low"
    evidence = db.Column(db.Text, nullable=False)
    explanation = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(12), nullable=False, default="open")  # open|confirmed|dismissed
    note = db.Column(db.Text)


class Label(db.Model):
    __tablename__ = "labels"

    id = db.Column(db.Integer, primary_key=True)
    call_id = db.Column(db.Integer, db.ForeignKey("calls.id"), nullable=False, index=True)
    turn_idx = db.Column(db.Integer, nullable=False)
    rule = db.Column(db.String(40), nullable=False)
    is_real_issue = db.Column(db.Boolean, nullable=False)
