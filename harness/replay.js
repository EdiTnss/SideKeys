// The verification harness: replays saved practice sessions through today's capture and
// analyzer, on a virtual clock, and reports every snapshot or verdict that is no longer what it
// was. A session comes from "Save session" (Settings) in the app; see docs/spec-capture.md.
//
//   node harness/replay.js                        every session in harness/sessions/
//   node harness/replay.js path/to/session.json   just those
//   node harness/replay.js --update               accept today's result as the new reference
//
// Exit code 1 when a session changed; test/replay.test.js makes the same check in CI. Use
// --update only for a change made on purpose (a new analyzer rule), and read the diff first.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { replayTape, updateTape, formatReport, formatSession, TAPE_FORMAT } from '../src/ui/tape.js';

const SESSIONS = new URL('./sessions/', import.meta.url);

const { values: options, positionals } = parseArgs({ allowPositionals: true, options: { update: { type: 'boolean', default: false } } });
const files = positionals.length
  ? positionals
  : readdirSync(SESSIONS).filter(name => name.endsWith('.json')).sort().map(name => fileURLToPath(new URL(name, SESSIONS)));
if (files.length === 0) {
  console.log('No saved sessions to replay.');
  process.exit(0);
}

let changed = 0;
for (const file of files) {
  const session = JSON.parse(readFileSync(file, 'utf8'));
  if (session.format !== TAPE_FORMAT) {
    console.log(`${file}: format ${session.format}, this replay reads format ${TAPE_FORMAT}; skipped.`);
    changed++;
    continue;
  }
  const result = replayTape(session);
  console.log(formatReport(file.split(/[\\/]/).at(-1), result));
  if (result.ok) continue;
  if (options.update) {
    writeFileSync(file, formatSession(updateTape(session, result)));
    console.log('  updated: the replay is the new reference.');
  } else {
    changed++;
  }
}
if (changed) console.log(`\n${changed} session(s) changed. On purpose? node harness/replay.js --update`);
process.exit(changed ? 1 : 0);
