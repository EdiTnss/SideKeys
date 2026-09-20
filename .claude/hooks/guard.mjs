#!/usr/bin/env node
// SideKeys — garda de sesiune.
// Rulează la Stop: testele plus invariantele din CLAUDE.md și docs/PRODUCT.md.
// Ieșire 2 = blocant, mesajul ajunge înapoi la Claude Code.
// Fără dependențe, rulează pe Windows și pe Linux deopotrivă.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOK_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HOOK_DIR, '..', '..')
const STATE_FILE = join(HOOK_DIR, 'state.json')

const problems = []
const notes = []

// ---------------------------------------------------------------- 1. testele

const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 100_000,
})

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
const passed = Number(output.match(/^# pass (\d+)$/m)?.[1] ?? NaN)
const failed = Number(output.match(/^# fail (\d+)$/m)?.[1] ?? NaN)

if (run.error) {
  problems.push(`Testele nu au putut rula: ${run.error.message}`)
} else if (Number.isNaN(passed)) {
  problems.push('Nu am putut citi rezultatul testelor din `node --test`. Rulează-l manual.')
} else if (failed > 0) {
  const names = [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => `    ${m[1]}`)
  problems.push(`${failed} teste pică:\n${names.slice(0, 10).join('\n')}`)
} else {
  notes.push(`${passed} teste verzi`)
}

// -------------------------------------------- 2. numărul de teste nu scade

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : { testFloor: 0 }

if (!Number.isNaN(passed) && failed === 0) {
  if (passed < state.testFloor) {
    problems.push(
      `Numărul de teste a scăzut: ${passed} acum, ${state.testFloor} înainte.\n` +
      '    Dacă ștergerea lor e intenționată, spune-i lui Edi și coboară\n' +
      `    "testFloor" din .claude/hooks/state.json la ${passed}. Nu o face singur.`
    )
  } else if (passed > state.testFloor) {
    state.testFloor = passed
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
    notes.push(`prag ridicat la ${passed}`)
  }
}

// ------------------------------------------- 3. aplicația rămâne fără npm

try {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  for (const field of ['dependencies', 'devDependencies']) {
    const names = Object.keys(pkg[field] ?? {})
    if (names.length > 0) {
      problems.push(
        `package.json de la rădăcină are ${field}: ${names.join(', ')}.\n` +
        '    Aplicația rămâne fără dependențe npm. Doar worker/ are voie.'
      )
    }
  }
} catch (err) {
  problems.push(`Nu am putut citi package.json: ${err.message}`)
}

// ------------------------------------------- 4. theory/ nu importă în sus

const jsFiles = dir =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(e => e.isFile() && e.name.endsWith('.js'))
        .map(e => join(e.parentPath ?? e.path, e.name))
    : []

const FORBIDDEN = ['midi', 'ui', 'ai', 'audio']

for (const file of jsFiles(join(ROOT, 'src', 'theory'))) {
  const source = readFileSync(file, 'utf8')
  for (const layer of FORBIDDEN) {
    const pattern = new RegExp(`from\\s+['"]\\.\\./${layer}/`, 'm')
    if (pattern.test(source)) {
      problems.push(
        `${relative(ROOT, file)} importă din ${layer}/.\n` +
        '    theory/ rămâne pur: nimic din midi/, ui/, ai/ sau audio/.'
      )
    }
  }
}

// ------------------------------------------------------- 5. niciun secret

const SEARCH = ['src', 'test', 'eval', join('worker', 'src')]
const SECRET = /sk-ant-[A-Za-z0-9_-]{8,}/

for (const folder of SEARCH) {
  for (const file of jsFiles(join(ROOT, folder))) {
    if (SECRET.test(readFileSync(file, 'utf8'))) {
      problems.push(
        `${relative(ROOT, file)} pare să conțină o cheie API.\n` +
        '    Cheia stă doar în worker/.dev.vars și în secretele Worker-ului.\n' +
        '    Istoricul devine public la Faza 4 — nu comita.'
      )
    }
  }
}

// ------------------------------------------------------------------ raport

if (problems.length > 0) {
  console.error('\nGarda SideKeys a oprit sesiunea:\n')
  for (const p of problems) console.error(`  ✗ ${p}\n`)
  console.error('Repară astea înainte să închei. Dacă vreuna e intenționată, întreabă-l pe Edi.\n')
  process.exit(2)
}

console.log(`Garda SideKeys: ${notes.join(', ')}.`)
