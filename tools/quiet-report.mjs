#!/usr/bin/env node
// Runs the tests and sums up the result: one line when green, the details when red.
//
// Why: the default `node --test` report writes one line per test. The ~200 green lines
// land in the Claude Code session's context on every run and say nothing useful: about
// 25 KB, against 100 characters here. `npm test` stays as it is, for CI and for when the
// full report is wanted.
//
// The file name deliberately avoids the patterns `node --test` takes for test files
// (`test-*`, `*-test`, `*_test`, `*.test`). Any file added to tools/ must avoid them
// too, or the runner will try to execute it.
//
// No dependencies. Arguments are passed through:
//   node tools/quiet-report.mjs test/chords.test.js

import { spawnSync } from 'node:child_process'

// The TAP reporter, asked for explicitly: the summary (`# pass N`) and the `not ok` blocks
// read below are its format. Since Node 23 the default reporter is `spec` even when the
// output is not a terminal, so without this argument the summary was not found on Node 24.
const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...process.argv.slice(2)], {
  encoding: 'utf8',
  timeout: 300_000,
})

if (run.error) {
  console.error(`The tests could not run: ${run.error.message}`)
  process.exit(1)
}

const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
const lines = out.split(/\r?\n/)
const count = label => Number(out.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1] ?? NaN)

const passed = count('pass')
const skipped = count('skipped')

// Every `not ok` is followed by a YAML block with the details, up to the `...` line.
const failures = []
for (let i = 0; i < lines.length; i++) {
  const header = lines[i].match(/^\s*not ok \d+ - (.+?)\s*$/)
  if (!header) continue
  const detail = []
  let inError = false
  for (let j = i + 1; j < lines.length && !/^\s*\.\.\.\s*$/.test(lines[j]); j++) {
    if (/^\s*error: \|-?\s*$/.test(lines[j])) { inError = true; continue }
    if (/^\s*error: /.test(lines[j])) { detail.push(lines[j].replace(/^\s*error: /, '').trim()); continue }
    if (inError) {
      if (/^\s*[a-zA-Z_]+:/.test(lines[j])) { inError = false; continue }
      detail.push(lines[j].trim())
    }
  }
  failures.push({ name: header[1], detail: detail.filter(Boolean) })
}

// A file fails because a test in it failed; it is left out, so nothing is listed twice.
const leaves = failures.filter(f => !f.detail.some(d => d === 'test failed'))
const shown = leaves.length > 0 ? leaves : failures

if (Number.isNaN(passed)) {
  console.error('Could not read the test results. Run `npm test` for the full report.')
  console.error(out.slice(-2000))
  process.exit(1)
}

if (shown.length > 0) {
  console.error(`\n${shown.length} failed, ${passed} passed:\n`)
  for (const f of shown) {
    console.error(`  ✖ ${f.name}`)
    for (const d of f.detail.slice(0, 12)) console.error(`      ${d}`)
    console.error('')
  }
  console.error('Full report: `npm test`.\n')
  process.exit(1)
}

console.log(`${passed} tests passed${skipped ? `, ${skipped} skipped` : ''}.`)
