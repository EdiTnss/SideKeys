// Every saved session in harness/sessions/ replays to what it recorded. A change to the capture
// or the analyzer that alters a verdict on real playing fails here, with the harness's report.
// A change made on purpose is accepted with: node harness/replay.js --update

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { replayTape, formatReport } from '../src/ui/tape.js';

const SESSIONS = new URL('../harness/sessions/', import.meta.url);
const files = readdirSync(SESSIONS).filter(name => name.endsWith('.json')).sort();

test('there are saved sessions to replay', () => {
  assert.ok(files.length > 0);
});

for (const name of files) {
  test(`${name} replays to what it recorded`, () => {
    const result = replayTape(JSON.parse(readFileSync(new URL(name, SESSIONS), 'utf8')));
    assert.ok(result.snapshots.length > 0, `${name} has no snapshot, so it proves nothing`);
    assert.ok(result.ok, formatReport(name, result));
  });
}
