#!/usr/bin/env python3
"""Offline SQLite migration and isolation smoke tests; never accesses Cloudflare."""
from pathlib import Path
import sqlite3

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
root = Path(__file__).resolve().parents[1]
for name in ("0001_initial.sql", "0002_review_security.sql", "0003_catalog_staging.sql", "0004_source_evidence.sql"):
    db.executescript((root / "migrations" / name).read_text(encoding="utf-8"))

db.execute("INSERT INTO users(id,email,display_name,role) VALUES ('m','mother@example.invalid','Testperson','member')")
db.execute("INSERT INTO users(id,email,display_name,role,email_verified) VALUES ('a','admin@example.invalid','Admin','admin',1)")
db.execute("""INSERT INTO games(id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,status)
 VALUES ('game','Testfirma','Advent-Test','Buch','https://example.org/a','https://example.org/r','https://example.org/p',
 '2026-12-01T00:00:00Z','2026-12-25T00:00:00Z',1,'review')""")
db.execute("INSERT INTO favorites(user_id,game_id) VALUES ('m','game')")
db.execute("INSERT INTO participations(user_id,game_id,day) VALUES ('m','game','2026-12-01')")
assert db.execute("SELECT count(*) FROM participations WHERE user_id='a'").fetchone()[0] == 0
db.execute("INSERT INTO contest_evidence(game_id,reviewer_id,checked_at,note) VALUES ('game','a','2026-11-21T00:00:00Z','Sicherheitsprüfung')")
db.execute("INSERT INTO admin_audit(actor_id,game_id,action,note) VALUES ('a','game','review','Review request')")
db.execute("INSERT INTO login_limits(key_hash,bucket,count) VALUES ('hash','2026-11-21T09',1)")
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
assert db.execute("SELECT count(*) FROM research_candidates").fetchone()[0] == 0
db.execute("DELETE FROM users WHERE id='m'")
assert db.execute("SELECT count(*) FROM participations").fetchone()[0] == 0
assert db.execute("SELECT count(*) FROM favorites").fetchone()[0] == 0
print("Migration 0001+0002, user isolation and delete cascades: OK")
