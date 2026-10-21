import SQLite from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const fixtureSql = `
CREATE TABLE worlds (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL);
CREATE TABLE maps (
  id TEXT PRIMARY KEY, world_id TEXT NOT NULL REFERENCES worlds(id),
  title TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  gm_only INTEGER NOT NULL DEFAULT 0 CHECK (gm_only IN (0,1)),
  body TEXT NOT NULL, layers TEXT NOT NULL, gm_notes TEXT
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY, world_id TEXT NOT NULL REFERENCES worlds(id), gm_user_id TEXT NOT NULL
);
CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gm','player')), active INTEGER NOT NULL CHECK (active IN (0,1)),
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL CHECK (status IN ('waiting','active','completed')),
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE map_reveals (
  project_id TEXT NOT NULL REFERENCES projects(id), map_id TEXT NOT NULL REFERENCES maps(id),
  player_user_id TEXT NOT NULL, PRIMARY KEY (project_id, map_id, player_user_id)
);
CREATE TABLE command_receipts (
  id TEXT PRIMARY KEY, map_id TEXT NOT NULL REFERENCES maps(id), actor_user_id TEXT NOT NULL,
  request_digest TEXT NOT NULL, result_title TEXT NOT NULL, result_revision INTEGER NOT NULL
);
CREATE INDEX map_world_idx ON maps(world_id);
CREATE INDEX project_world_idx ON projects(world_id);
CREATE INDEX reveal_map_idx ON map_reveals(map_id, project_id, player_user_id);
`;

export function freshFixture(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  const db = new SQLite(file);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.exec(fixtureSql);
  db.transaction(() => {
    const world = db.prepare('INSERT INTO worlds VALUES (?,?)');
    world.run('W1', 'O'); world.run('W2', 'X');
    const project = db.prepare('INSERT INTO projects VALUES (?,?,?)');
    project.run('A', 'W1', 'G'); project.run('B', 'W1', 'G'); project.run('X', 'W2', 'X');
    const member = db.prepare('INSERT INTO project_members VALUES (?,?,?,?)');
    for (const [saga, user, role, active] of [
      ['A','G','gm',1], ['A','P1','player',1], ['A','P2','player',1],
      ['A','INACTIVE','player',0], ['B','G','gm',1], ['B','P2','player',1], ['X','X','gm',1],
    ]) member.run(saga, user, role, active);
    const map = db.prepare('INSERT INTO maps VALUES (?,?,?,?,?,?,?,?)');
    map.run('public', 'W1', 'PUBLIC_TITLE', 0, 0, 'PUBLIC_BODY', 'PUBLIC_LAYER', 'GM_NOTES_PUBLIC');
    map.run('hidden', 'W1', 'UNREVEALED_TITLE', 0, 1, 'UNREVEALED_BODY', 'UNREVEALED_LAYER', 'GM_NOTES_HIDDEN');
    map.run('p1', 'W1', 'P1_REVEAL_TITLE', 0, 1, 'P1_REVEAL_BODY', 'P1_REVEAL_LAYER', 'GM_NOTES_P1');
    map.run('wrong-saga', 'W1', 'OTHER_SAGA_TITLE', 0, 1, 'OTHER_SAGA_BODY', 'OTHER_SAGA_LAYER', 'GM_NOTES_OTHER');
    map.run('foreign', 'W2', 'FOREIGN_TITLE', 0, 1, 'FOREIGN_BODY', 'FOREIGN_LAYER', 'GM_NOTES_FOREIGN');
    map.run('perf', 'W1', 'PERF', 0, 1, 'PERF_BODY', 'PERF_LAYER', null);
    const reveal = db.prepare('INSERT INTO map_reveals VALUES (?,?,?)');
    reveal.run('A', 'p1', 'P1');
    reveal.run('B', 'wrong-saga', 'P1'); // P1 is NOT a member of B.
    reveal.run('B', 'wrong-saga', 'P2');
    reveal.run('A', 'foreign', 'P1'); // Deliberately inconsistent foreign-world reveal.
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('S-A', 'A', 'waiting', 0);
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('S-X', 'X', 'waiting', 0);
  })();
  db.close();
}

export function inspectFixture(file: string) {
  const db = new SQLite(file, { readonly: true });
  try {
    return {
      maps: db.prepare('SELECT id, world_id, title, revision FROM maps ORDER BY id').all(),
      worlds: db.prepare('SELECT * FROM worlds ORDER BY id').all(),
      sessions: db.prepare('SELECT * FROM sessions ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM command_receipts ORDER BY id').all(),
      sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get(),
    };
  } finally { db.close(); }
}

export function transferFixtureWorldToX(file: string): void {
  const db = new SQLite(file);
  try { db.prepare('UPDATE worlds SET owner_user_id = ? WHERE id = ?').run('X', 'W1'); }
  finally { db.close(); }
}
