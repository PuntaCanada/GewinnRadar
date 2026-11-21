#!/usr/bin/env python3
"""Strict offline D1 schema preparation checks. Never uses Cloudflare credentials."""
from pathlib import Path
import sqlite3

ROOT=Path(__file__).resolve().parents[1]
MIGRATIONS=[ROOT/'migrations'/f'000{i}_{name}.sql' for i,name in [
 (1,'initial'),(2,'review_security'),(3,'catalog_staging'),
 (4,'source_evidence'),(5,'form_and_reminders')]]
EXPECTED={
 'users','login_tokens','sessions','games','favorites','participations',
 'link_checks','email_log','login_attempts','contest_evidence','admin_audit',
 'login_limits','research_candidates','research_import_log','source_evidence_history',
 'form_verifications','reminder_windows'
}

def apply(db):
 for script in MIGRATIONS:
  assert script.exists(), f'Missing migration {script}'
  db.executescript(script.read_text(encoding='utf-8'))

def check(db):
 present={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
 assert present==EXPECTED, f'Schema mismatch: missing={EXPECTED-present}, unexpected={present-EXPECTED}'
 assert db.execute('PRAGMA foreign_key_check').fetchall()==[], 'Foreign-key validation failed'
 assert db.execute("SELECT count(*) FROM sqlite_master WHERE type='trigger' AND name='prevent_source_evidence_update'").fetchone()[0]==1
 for table in EXPECTED:
  assert db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]==0, f'Unexpected seed data in {table}'


def main():
 db=sqlite3.connect(':memory:')
 db.execute('PRAGMA foreign_keys=ON')
 apply(db)
 check(db)
 apply(db)  # CREATE IF NOT EXISTS; harmless when the schema already matches
 check(db)
 print('SAFE: all 5 migrations applied twice to isolated empty SQLite; 17 expected tables, zero real users/game data, valid FKs.')
 print('REMOTE D1 database was NOT contacted or modified.')
 db.close()

if __name__=='__main__':main()
