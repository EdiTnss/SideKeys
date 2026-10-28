<script lang="ts">
  import Keyboard from '../lib/Keyboard.svelte';
  import type { Instrument } from '../lib/instrument.svelte';
  import { LESSONS, lessonIn, exampleNotes, GLOSSARY, GLOSSARY_GROUPS } from '../bridge/game';
  import {
    parseChord, analyzeVoicing, inversionOf, compareVoicings, roleClasses, spellPlain,
  } from '../bridge/theory';
  import { locale, sayDecimal, sayInversion, sayVoicing, t } from '../lib/locale.svelte';

  type Example = { symbol: string; notes: string; type?: string; inversion?: string; caption: string };
  type Term = { id: string; group: string; name: string; short: string; long?: string; examples?: Example[] };

  /** The id the glossary is opened under, beside the units' own. */
  const GLOSSARY_PAGE = 'glossary';
  type Lesson = {
    unit: string;
    title: string;
    lead: string;
    sections: Array<{ heading: string; text: string[] }>;
    examples: Array<Example & { type: string }>;
    chain?: Array<Example & { type: string }>;
    listens: string[];
    level: string;
  };

  let { unit = null, instrument, onopen, onplay, onback }: {
    /** Which lesson is open; null is the list of them. */
    unit?: string | null;
    /** The app's instrument, borrowed to sound an example. Nothing here is judged. */
    instrument: Instrument;
    onopen: (unit: string | null) => void;
    onplay: (level: string) => void;
    onback: () => void;
  } = $props();

  // The pages in the language in use: its words, the English page's examples.
  const lessons = $derived((LESSONS as Lesson[]).map(entry => lessonIn(locale(), entry) as Lesson));
  const at = $derived(unit ? lessons.findIndex(entry => entry.unit === unit) : -1);
  const lesson = $derived(at === -1 ? null : lessons[at]);
  // The glossary is Romanian, so it is there only in Romanian (Edi, 2026-10-27): in English
  // nothing new appears.
  const hasGlossary = $derived(locale() === 'ro');
  const glossaryOpen = $derived(unit === GLOSSARY_PAGE && hasGlossary);

  /**
   * An example as the page shows it. Nothing here is written by hand: the keys are coloured by
   * the analyzer's own reading of the notes, the name under them is the one a verdict would
   * give, and the degrees are spelled from the chord. So a page cannot draw one thing and the
   * game hear another — and test/lessons.test.js checks that the reading is the one intended.
   */
  function shown(example: Example) {
    const notes = exampleNotes(example) as number[];
    const chord = parseChord(example.symbol);
    const analysis = analyzeVoicing(notes, chord);
    const named = example.inversion ? sayInversion(inversionOf(analysis)) : sayVoicing(analysis.voicing);
    const degrees = (analysis.roles as Array<{ degree: string | null }>)
      .map(role => (role.degree ? { name: spellPlain(chord.root, role.degree) as string, degree: role.degree } : null))
      .filter((entry): entry is { name: string; degree: string } => entry !== null);
    return { ...example, midi: notes, classes: roleClasses(analysis) as Record<number, string>, named, degrees };
  }

  const examples = $derived(lesson ? lesson.examples.map(shown) : []);
  // The glossary by group, each term with its examples drawn the way a lesson draws its own.
  const glossary = $derived(glossaryOpen
    ? GLOSSARY_GROUPS.map(group => ({
        ...group,
        terms: (GLOSSARY as Term[]).filter(term => term.group === group.id)
          .map(term => ({ ...term, shown: (term.examples ?? []).map(shown) })),
      }))
    : []);
  const chain = $derived(lesson?.chain ? lesson.chain.map(shown) : []);
  // How far the voices travel from each chord of the chain to the next: the figure the page quotes.
  const moves = $derived(chain.slice(1).map((step, i) =>
    (compareVoicings(chain[i].midi, step.midi) as { averageMove: number }).averageMove));

  // One keyboard range for the whole page, so the examples can be compared by eye: from the C
  // under the lowest note to the C above the highest.
  const range = $derived.by(() => {
    const all = [...examples, ...chain, ...glossary.flatMap(group => group.terms.flatMap(term => term.shown))]
      .flatMap(example => example.midi);
    if (!all.length) return { from: 48, to: 84 };
    const from = Math.floor(Math.min(...all) / 12) * 12;
    const to = Math.ceil((Math.max(...all) + 1) / 12) * 12;
    // Never less than two octaves: a single one shows the chord and not where on the piano it is.
    return { from: to - from < 24 ? from - 12 : from, to };
  });

  let sequence: ReturnType<typeof setTimeout>[] = [];
  function quiet() {
    sequence.forEach(clearTimeout);
    sequence = [];
    instrument.hush();
  }

  function hear(notes: number[]) {
    quiet();
    instrument.audition(notes);
  }

  /** The chain, one chord after another, at about the pace of a slow ballad. */
  function hearChain() {
    quiet();
    sequence = chain.map((step, i) => setTimeout(() => instrument.audition(step.midi, 1300), i * 1400));
  }

  // An example still ringing when the page is left would ring into whatever comes next.
  $effect(() => {
    void unit;
    return quiet;
  });
</script>

{#snippet card(example: ReturnType<typeof shown>)}
  <button type="button" class="example" onclick={() => hear(example.midi)}
          aria-label={t('theory.hear', { symbol: example.symbol, caption: example.caption })}>
    <span class="symbol">{example.symbol}</span>
    <span class="keys"><Keyboard classes={example.classes} from={range.from} to={range.to} /></span>
    <span class="degrees">
      {#each example.degrees as entry, i (i)}
        <!-- "F (b3)", as the verdicts write it. Side by side without the brackets, F and b3 read
             as F flat. -->
        <span>{entry.name} <small>({entry.degree})</small></span>
      {/each}
    </span>
    <span class="caption">{example.caption}</span>
    {#if example.named}<span class="named">{example.named}</span>{/if}
  </button>
{/snippet}

<section class="theory">
  {#if lesson}
    <p class="kicker">
      <button type="button" class="link" onclick={() => onopen(null)}>{t('theory.title')}</button>
      {t('theory.of', { at: at + 1, total: lessons.length })}
    </p>
    <h1>{lesson.title}</h1>
    <p class="lead">{lesson.lead}</p>

    {#each lesson.sections as section (section.heading)}
      <h2>{section.heading}</h2>
      {#each section.text as paragraph (paragraph)}
        <p class="text">{paragraph}</p>
      {/each}
    {/each}

    <h2>{t('theory.see')}</h2>
    <p class="hint">{t('theory.hint')}</p>
    <!-- Keyed on the lesson: a keyboard is drawn once, for the range of the page it is on, and
         two pages can share an example. -->
    {#key lesson.unit}
      <div class="examples">
        {#each examples as example (example.symbol + example.notes)}
          {@render card(example)}
        {/each}
      </div>

      {#if chain.length}
        <h2>{t('theory.chain')}</h2>
        <div class="chain">
          {#each chain as example, i (example.symbol + example.notes)}
            {#if i > 0}
              <span class="move"><b>{sayDecimal(moves[i - 1], 2)}</b> {t('theory.perVoice')}</span>
            {/if}
            {@render card(example)}
          {/each}
        </div>
        <button type="button" onclick={hearChain}>{t('theory.hearChain')}</button>
      {/if}
    {/key}

    <h2>{t('theory.listens')}</h2>
    <ul class="listens">
      {#each lesson.listens as line (line)}
        <li>{line}</li>
      {/each}
    </ul>

    <div class="actions">
      <button type="button" class="go" onclick={() => onplay(lesson.level)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"></path></svg>
        {t('theory.play')}
      </button>
      {#if at > 0}
        <button type="button" onclick={() => onopen(lessons[at - 1].unit)}>← {lessons[at - 1].title}</button>
      {/if}
      {#if at < lessons.length - 1}
        <button type="button" onclick={() => onopen(lessons[at + 1].unit)}>{lessons[at + 1].title} →</button>
      {/if}
      <button type="button" onclick={onback}>{t('common.backPlain')}</button>
    </div>
  {:else if glossaryOpen}
    <p class="kicker">
      <button type="button" class="link" onclick={() => onopen(null)}>{t('theory.title')}</button>
    </p>
    <h1>{t('theory.glossary')}</h1>
    <p class="lead">{t('theory.glossaryLead')}</p>

    {#each glossary as group (group.id)}
      <h2>{group.name}</h2>
      {#each group.terms as term (term.id)}
        <section class="term" id="term-{term.id}">
          <h3>{term.name}</h3>
          <p class="short">{term.short}</p>
          {#if term.long}<p class="text">{term.long}</p>{/if}
          {#if term.shown.length}
            <div class="examples">
              {#each term.shown as example (example.symbol + example.notes)}
                {@render card(example)}
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {/each}

    <div class="actions">
      <button type="button" onclick={() => onopen(null)}>{t('common.back')}</button>
    </div>
  {:else}
    <header class="head">
      <div>
        <h1>{t('theory.title')}</h1>
        <p class="lead">{t('theory.lead')}</p>
      </div>
      <button type="button" onclick={onback}>{t('common.back')}</button>
    </header>

    <ol class="lessons">
      {#each lessons as entry, i (entry.unit)}
        <li>
          <button type="button" class="lesson" onclick={() => onopen(entry.unit)}>
            <span class="number">{i + 1}</span>
            <span class="about">
              <span class="name">{entry.title}</span>
              <span class="blurb">{entry.lead}</span>
            </span>
          </button>
        </li>
      {/each}
      {#if hasGlossary}
        <li>
          <button type="button" class="lesson" onclick={() => onopen(GLOSSARY_PAGE)}>
            <span class="number">A–Z</span>
            <span class="about">
              <span class="name">{t('theory.glossary')}</span>
              <span class="blurb">{t('theory.glossaryLead')}</span>
            </span>
          </button>
        </li>
      {/if}
    </ol>

    <!-- The piano's licence (CC BY 3.0) asks for its author where it is heard. Here, small, rather
         than under the day's three things (Edi, 2026-10-27). -->
    <p class="credit">
      {t('theory.creditPiano')}
      <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noreferrer">Salamander Grand Piano</a>
      {t('theory.creditBy')}
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>
    </p>
  {/if}
</section>

<style>
  .credit { margin: 40px 0 0; font-size: 10px; color: #4a5157; }
  .credit a { color: inherit; }
  .credit a:hover { color: var(--ink-muted); }
  .theory { max-width: 860px; margin: 0 auto; padding: 32px 32px 56px; }
  .head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
  .head div { flex: 999 1 320px; }
  .kicker { margin: 0 0 6px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  h1 { margin: 0 0 10px; font-size: 34px; font-weight: 600; letter-spacing: -0.03em; }
  .lead { margin: 0 0 8px; max-width: 62ch; font-size: 17px; line-height: 1.55; color: var(--ink); }
  h2 { margin: 30px 0 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .text { margin: 0 0 10px; max-width: 66ch; font-size: 15px; line-height: 1.65; color: #d6d3cd; }
  .hint { margin: 0 0 14px; font-size: 13px; color: var(--ink-muted); }
  .examples { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin-bottom: 14px; }
  .chain { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; }
  .chain .example { flex: 1 1 200px; }
  /* Between two chords of the chain: how far the voices went to get there. */
  .move { flex: 0 0 76px; font-size: 11px; line-height: 1.35; text-align: center; color: var(--ink-muted); }
  .move b { display: block; font-family: ui-monospace, monospace; font-size: 15px; font-weight: 600; color: var(--ink); }
  button {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 11px 20px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .example {
    display: flex; flex-direction: column; align-items: stretch; gap: 8px;
    padding: 14px; border-radius: 14px; background: var(--surface); text-align: left;
  }
  .symbol { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 600; }
  .keys { display: block; pointer-events: none; }
  .degrees { display: flex; flex-wrap: wrap; gap: 4px 12px; font-family: ui-monospace, monospace; font-size: 13px; }
  .degrees small { font-size: 11px; color: var(--ink-muted); }
  .caption { font-size: 13px; line-height: 1.45; color: #d6d3cd; }
  .named { font-size: 12px; color: var(--ink-muted); }
  .listens { margin: 0; padding-left: 20px; max-width: 66ch; font-size: 15px; line-height: 1.65; color: #d6d3cd; }
  .listens li { margin-bottom: 6px; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
  button.go { background: var(--ink); color: #14171a; border-color: var(--ink); font-size: 16px; font-weight: 600; padding: 14px 26px; }
  .link { padding: 0; border: none; background: none; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; text-decoration: underline; }
  .link:hover { color: var(--ink); }
  .lessons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .lesson { width: 100%; align-items: flex-start; gap: 16px; padding: 16px 20px; border-radius: 14px; background: var(--surface); text-align: left; }
  .number {
    flex: none; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border);
    display: inline-flex; align-items: center; justify-content: center;
    font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted);
  }
  .about { display: flex; flex-direction: column; gap: 4px; }
  .name { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; }
  .blurb { font-size: 14px; line-height: 1.5; color: var(--ink-muted); }
  .term { margin: 0 0 26px; }
  h3 { margin: 0 0 4px; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
  .short { margin: 0 0 6px; max-width: 66ch; font-size: 15px; font-weight: 500; line-height: 1.55; }
</style>
