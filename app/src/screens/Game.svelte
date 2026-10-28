<script lang="ts">
  import { onDestroy } from 'svelte';
  import Keyboard from '../lib/Keyboard.svelte';
  import Glossed from '../lib/Glossed.svelte';
  import Result from './Result.svelte';
  import type { Instrument } from '../lib/instrument.svelte';
  import { createLevel, type Attempt, type Finished, type LevelPlan, type Run } from '../game/level.svelte';
  import { createPractice, type PracticePlan } from '../game/practice.svelte';
  import { lessonForTexture } from '../bridge/game';
  import {
    analyzeVoicing, inversionOf, parseChord, isRight, isClean,
    roleClasses, missingClasses, armedClasses, midiToName,
  } from '../bridge/theory';
  import { sayLevel, sayMessage, sayVoicing, sayInversion, sayUnit, sayDecimal, t } from '../lib/locale.svelte';

  let { unit, plan, instrument, onfinish, onpractice = () => {}, ontheory = () => {}, onnext = null, onexit }: {
    unit: { id: string; name: string };
    /** A level, or a stretch of training: the same screen plays both. */
    plan: LevelPlan | PracticePlan;
    /** The app's one instrument: it outlives this screen, so the keyboard stays connected. */
    instrument: Instrument;
    onfinish: (run: { stars: number; attempts: Attempt[]; seconds: number }) => Finished;
    /** A stretch of training is over: what was played, and for how long. No stars come back. */
    onpractice?: (run: { attempts: Attempt[]; seconds: number }) => void;
    /** Opens the page that explains a shape. It leaves this screen: the run in hand is given up. */
    ontheory?: (unit: string) => void;
    /** Straight on to the level after this one, once this run has opened it. Null when it has not. */
    onnext?: (() => void) | null;
    onexit: () => void;
  } = $props();

  // A level is built once, from the plan this screen was mounted with. App.svelte wraps the
  // screen in {#key plan.id}, so picking another level remounts it rather than swapping the
  // plan underneath a run in progress — which is what the warning below would be about.
  // Training runs on this screen too. It is a `Run` like a level, so everything below talks to
  // `level` and only what training does differently asks for `practice`.
  // svelte-ignore state_referenced_locally
  const practice = 'endless' in plan ? createPractice(plan) : null;
  // svelte-ignore state_referenced_locally
  const level: Run = practice ?? createLevel(plan as LevelPlan);
  let recorded = $state(false);
  let grid = $state<string[] | null>(null);
  let share = $state<string | null>(null);
  let official = $state(true);

  // One run is recorded once: the effect fires again on every change while the result is up.
  $effect(() => {
    if (level.finished && level.score && !recorded) {
      recorded = true;
      const filed = onfinish({ stars: level.score.stars, attempts: level.attempts, seconds: level.seconds });
      grid = filed.grid;
      share = filed.share;
      official = filed.official;
    }
  });

  let analysis = $state<ReturnType<typeof analyzeVoicing> | null>(null);
  let judged = $state<string | null>(null);
  let anticipated = $state(false);
  // False when the voicing was judged but not filed: on the clock, its bar already had an answer.
  let counted = $state(true);
  let judgedTexture = $state<string | string[] | null>(null);
  let classes = $state<Record<number, string>>({});
  // The chord the coloured keys answer, so they can go white once another one is asked.
  let paintedSlot = $state<number | null>(null);
  // Alternates with every verdict so the keys animate again when the same chord comes back:
  // a CSS animation does not restart for a class the element already carries.
  let strike = 'strike-a';

  // This screen is the one being played to for as long as it is mounted, and no longer.
  // svelte-ignore state_referenced_locally
  onDestroy(instrument.listen({ onVoicing: judge, onNext: skip }));

  // Training has no result screen to end on: leaving is how it ends. It is filed once,
  // whichever way out is taken — the buttons here, or the logo, which this screen only hears
  // of by being torn down.
  function filePractice() {
    if (!practice || recorded) return;
    recorded = true;
    practice.end();
    if (practice.attempts.length) onpractice({ attempts: practice.attempts, seconds: practice.seconds });
  }

  function leave() {
    filePractice();
    onexit();
  }

  onDestroy(() => {
    filePractice();
    level.dispose();
  });

  function judge(notes: number[], { startedAt }: { startedAt: number | null }) {
    // Which chord this answers is the level's decision, not the screen's: timed, a voicing that
    // started in the last half beat of a bar belongs to the next one.
    const answered = level.answer(notes, startedAt);
    if (!answered) return;        // played during the count-in, or after the last bar
    analysis = answered.analysis;
    judged = answered.symbol;
    anticipated = answered.anticipated;
    counted = answered.counted;
    judgedTexture = answered.texture;
    strike = strike === 'strike-a' ? 'strike-b' : 'strike-a';
    // Only the notes that were played are struck. A missing one was never under a finger, so
    // it breathes instead — its own animation, in app.css.
    const played = Object.entries(roleClasses(answered.analysis) as Record<string, string>)
      .map(([midi, role]) => [midi, `${role} ${strike}`]);
    classes = { ...Object.fromEntries(played), ...missingClasses(answered.analysis) };
    paintedSlot = answered.slot;
  }

  function skip() {
    level.skip();
    clearVerdict();
  }

  function startTimed() {
    clearVerdict();
    level.start();
  }

  function again() {
    level.restart();
    recorded = false;
    grid = null;
    share = null;
    clearVerdict();
  }

  function clearVerdict() {
    instrument.cancelCapture();
    analysis = null;
    judged = null;
    anticipated = false;
    counted = true;
    judgedTexture = null;
    classes = {};
    paintedSlot = null;
  }

  // Once the chord asked for moves on, the keys of the last answer go back to white after 1.5
  // seconds: long enough to read them, gone before they are mistaken for the new chord (Edi,
  // 2026-10-28). Only the keys: the verdict above them stays until the next one.
  // The clock runs only while the keys show an answer to some other chord than the one asked: a
  // verdict on the new chord stops it, and so does an anticipated one once its bar arrives.
  const FADE_MS = 1500;
  $effect(() => {
    if (paintedSlot === null || paintedSlot === level.index) return;
    const timer = setTimeout(() => {
      if (instrument.held.length) return;
      classes = {};
      paintedSlot = null;
    }, FADE_MS);
    return () => clearTimeout(timer);
  });

  // Held notes show grey while the chord is being built; the verdict paints over them when the
  // capture fires, and a release leaves the verdict standing.
  $effect(() => {
    const held = instrument.held;
    if (held.length) classes = Object.fromEntries(held.map(midi => [midi, 'held']));
  });

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
    // While the letters are a piano they are not shortcuts: a note beats a shortcut on one key.
    if (instrument.typeToPlay && instrument.keyDown(event.code)) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter') instrument.play();
    else if (event.code === 'Escape') instrument.clear();
    else if (event.code === 'KeyZ') instrument.octaveDown();
    else if (event.code === 'KeyX') instrument.octaveUp();
    else if (event.code === 'Space' && !level.timed) { event.preventDefault(); skip(); }
  }

  // The path reads "Triads · Major triads"; the challenge and the review have no unit above
  // them, so they read as themselves instead of saying their own name twice.
  const title = $derived(unit.name ? `${sayUnit(unit)} · ${sayLevel(level.plan)}` : sayLevel(level.plan));
  const warnings = $derived(analysis ? analysis.messages.filter((m: { level: string }) => m.level === 'warning') : []);
  // What was demanded of the chord that was judged, not of the one on screen: timed, an
  // anticipated voicing answers the next rung, which may ask for another shape.
  const asked = $derived({ texture: judgedTexture });
  const star = $derived(!analysis ? null : isClean(analysis, asked) ? 'Clean' : isRight(analysis, asked) ? 'Right' : null);
  // Right notes in the wrong shape is the one failure with no warning behind it, so the screen
  // has to say it itself: the analyzer was asked about the chord, not about the exercise.
  const shapeMiss = $derived(
    analysis && !star && !warnings.length
      ? sayVoicing(analysis.voicing) ?? t('voicing.other')
      : null);
  // A shape demanded, by the name a verdict gives it: "Drop 2", "Rootless A or Rootless B".
  const shapeOf = (texture: string | string[] | null | undefined) =>
    texture
      ? ([] as string[]).concat(texture)
          .map(type => sayVoicing({ type, detail: null, bass: null }) ?? type)
          .join(` ${t('common.or')} `)
      : '';
  // The theory page for a shape, when there is one. A level that demands "drop-2" of someone who
  // has never met the word is a wall; the page is one press away from the word itself.
  const pageFor = (texture: string | string[] | null | undefined) =>
    (lessonForTexture(texture) as { unit: string } | null)?.unit ?? null;
  const askPage = $derived(pageFor(level.ask?.texture));
  const missPage = $derived(pageFor(judgedTexture));
  // The shape the next chord wants, said only when it is not the one already being asked for:
  // a level demands one shape throughout, and repeating it under every chord would be noise.
  // The daily challenge is a ramp, where each rung may want another.
  const nextShape = $derived(
    level.next && shapeOf(level.next.texture) !== shapeOf(level.ask?.texture) ? shapeOf(level.next.texture) : '');
  // What the voicing is called beside its star. A shape with a name of its own is named.
  // "Close" and "spread" are only what is left when it has none: on a triad played exactly as
  // asked they read as a remark, in every inversion alike (Edi, 2026-10-12). There the
  // inversion is the name worth saying — it is what the first two units teach.
  const shape = $derived.by(() => {
    if (!analysis || !judged) return null;
    const { type } = analysis.voicing;
    if (type && type !== 'close' && type !== 'spread') return sayVoicing(analysis.voicing);
    return parseChord(judged).chordTones.length === 3 ? sayInversion(inversionOf(analysis)) : null;
  });
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={event => instrument.keyUp(event.code)} />

{#if level.finished && level.score}
  <Result name={title} score={level.score} weakness={level.weakness}
          timed={level.timed} threshold={level.threshold} grid={grid} share={share}
          official={official} onagain={again} onnext={onnext} onexit={onexit} />
{:else}
  <section class="game">
    <div class="progress">
      {#if practice}
        <!-- Nothing to count towards, so the tally stands where the progress bar would. -->
        <span class="count">{t('game.tally', { played: practice.played, clean: practice.clean })}</span>
        <span class="spacer"></span>
      {:else}
        <span class="count">{level.index + 1} / {level.total}</span>
        <span class="track"><span class="fill" style="width: {(100 * level.answered) / level.total}%"></span></span>
      {/if}
      <span class="level">
        <button type="button" class="exit" onclick={leave}>{t('common.back')}</button>
        <Glossed text={sayLevel(level.plan)} />
        {#if level.timed}<span class="timed">· {practice ? '' : t('game.timed')}{level.plan.tempo} bpm</span>{/if}
      </span>
    </div>

    <!-- The chord to play and the one after it. The next one is always on screen — in free play,
         on the clock and through the count-in — because a chord first seen on beat one cannot be
         played on beat one (Edi, at the Genos, 2026-10-12). It never comes and goes, which is
         what the earlier idea, showing it only inside the anticipation window, was turned down
         for. The count-in used to stand where the first chord is, so even that one came late. -->
    <div class="asks">
      <p class="ask">{level.ask?.symbol}</p>
      {#if level.next}
        <p class="next">
          <span class="then">{t('game.then')}</span>{level.next.symbol}{#if nextShape}<span class="as"><Glossed text={t('game.as', { shape: nextShape })} /></span>{/if}
        </p>
      {/if}
    </div>
    <p class="hint">
      {#if level.countIn !== null || (level.timed && !level.at)}
        <!-- Timed with no position yet is the instant before the first click: already the count-in. -->
        <span class="beat">{level.countIn ?? ''}</span>{t('game.countIn')}
      {:else if level.timed && practice?.mode === 'drill'}
        <!-- A drawn chord has no bar number worth reading: only where the bar is. -->
        {t('game.beat', { beat: level.at?.beat ?? 1 })}
      {:else if level.timed && practice}
        {t('game.barBeat', { bar: level.at?.bar ?? 1, beat: level.at?.beat ?? 1 })}
      {:else if level.timed}
        {t('game.barBeatPlay', { bar: level.at?.bar ?? 1, beat: level.at?.beat ?? 1 })}
      {:else if level.ask?.texture}
        <Glossed text={t('game.playAs', { shape: shapeOf(level.ask.texture) })} />
        {#if askPage}<button type="button" class="what" onclick={() => ontheory(askPage)}>{t('game.whatIsThat')}</button>{/if}
      {:else}
        {t('game.playAny')}
      {/if}
    </p>

    <div class="verdict" aria-live="polite">
      {#if !analysis}
        <p class="waiting">—</p>
      {:else if star}
        <p class="star {star.toLowerCase()}">
          <span class="judged">{judged}{anticipated ? t('game.anticipated') : ''}</span>
          {star}{#if shape}{' — '}<Glossed text={shape} />{/if}
        </p>
      {:else if shapeMiss}
        <p class="star none">
          <span class="judged">{judged}</span>
          <Glossed text={t('game.wrongShape', { shape: shapeMiss })} />
          {#if missPage}<button type="button" class="what" onclick={() => ontheory(missPage)}>{t('game.whatAsked')}</button>{/if}
        </p>
      {:else}
        <p class="star none">
          <span class="judged">{judged}{anticipated ? t('game.anticipated') : ''}</span>
          <Glossed text={sayMessage(warnings[0])} />
        </p>
      {/if}

      {#if analysis && !counted}
        <!-- Said in so many words, because the verdict above is true and still changes nothing:
             the bar had its answer, and on the clock the first one stands. -->
        <p class="move">{t('game.notCounted')}</p>
      {/if}

      {#if practice?.movement && star}
        <!-- In a progression the step from the chord before is the thing being practised. The
             same number the third star is earned on, said after every change instead of once. -->
        <p class="move">
          {t('game.movement', {
            from: practice.movement.from,
            average: sayDecimal(practice.movement.average, 2),
            rating: t(`rating.${practice.movement.rating}`),
          })}
        </p>
      {/if}

      {#if analysis && warnings.length}
        <ul class="messages">
          <!-- Keyed by what the message says, not how: the text changes with the language. -->
          {#each warnings as message (`${message.code}:${JSON.stringify(message.params)}`)}
            <li><Glossed text={sayMessage(message)} /></li>
          {/each}
        </ul>
      {/if}
    </div>

    <Keyboard classes={{ ...classes, ...armedClasses(instrument.armed) }} onkey={instrument.toggle} />

    <div class="controls">
      {#if practice && level.timed}
        <!-- Stops the clock, not the practice: it goes on without it, from the chord it was on. -->
        <button type="button" onclick={() => level.stop()}>{t('game.stopMetronome')}</button>
      {:else if practice}
        <button type="button" onclick={startTimed}>{t('game.startMetronome', { tempo: level.plan.tempo })}</button>
      {:else if level.timed}
        <button type="button" class="stop" onclick={() => level.stop()}>{t('game.stopRun')}</button>
      {:else if !level.plan.free}
        <button type="button" class="start" onclick={startTimed}>{t('game.startTimed')}</button>
      {/if}
      <button type="button" onclick={() => instrument.play()}>{t('game.playArmed')} <kbd>Enter</kbd></button>
      <button type="button" onclick={() => instrument.clear()}>{t('game.clear')} <kbd>Esc</kbd></button>
      {#if !level.timed}
        <button type="button" onclick={skip}>{t('game.skip')} <kbd>Space</kbd></button>
      {/if}
      {#if practice}
        <button type="button" onclick={leave}>{t('game.done')}</button>
      {/if}
      <span class="octave">{t('game.octave', { note: midiToName(instrument.octave) })} <kbd>Z</kbd><kbd>X</kbd></span>
    </div>

    <p class="status {instrument.status.level}">
      {t(instrument.status.key, instrument.status.params)}
      <span class="sound">· {instrument.sound === 'piano' ? t('game.piano') : t('game.synth')}</span>
    </p>
  </section>
{/if}

<style>
  .game { max-width: 1100px; margin: 0 auto; padding: 24px 32px 48px; }
  .progress { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .count { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .track { flex-grow: 1; height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .spacer { flex-grow: 1; }
  .move { margin: 0 0 8px; font-size: 14px; color: var(--ink-muted); }
  .fill { display: block; height: 4px; border-radius: 999px; background: var(--ink); }
  .level { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 10px; }
  .exit { padding: 4px 10px; font-size: 12px; border-radius: 8px; }
  .timed { font-family: ui-monospace, monospace; }
  .asks { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 44px; margin: 18px 0 6px; }
  .ask { margin: 0; font-size: 96px; line-height: 1; font-weight: 600; letter-spacing: -0.05em; }
  /* Smaller and muted: read ahead of time, never mistaken for the chord being asked for. */
  .next { margin: 0; font-size: 40px; line-height: 1; font-weight: 600; letter-spacing: -0.04em; color: var(--ink-muted); }
  .then, .as { font-size: 13px; font-weight: 400; letter-spacing: 0; }
  .then { margin-right: 10px; }
  .as { margin-left: 10px; }
  .beat { margin-right: 10px; font-family: ui-monospace, monospace; font-size: 22px; font-weight: 600; color: var(--ink); }
  .hint { margin: 0 0 24px; color: var(--ink-muted); font-size: 15px; }
  .verdict { min-height: 92px; }
  .star { margin: 0 0 8px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
  .star.clean { color: var(--chord-tone); }
  .star.right { color: var(--ink); }
  .star.none { color: var(--avoid); }
  .judged { font-family: ui-monospace, monospace; font-size: 15px; color: var(--ink-muted); margin-right: 6px; }
  .waiting { margin: 0; font-size: 24px; color: var(--ink-muted); }
  .messages { margin: 0; padding-left: 20px; color: var(--ink-muted); font-size: 14px; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }
  button {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.start { background: var(--ink); color: #14171a; border-color: var(--ink); font-weight: 600; }
  /* A link inside a sentence, to the page that explains the word before it. */
  button.what {
    display: inline; margin-left: 6px; padding: 0; border: none; background: none;
    font-size: 13px; font-weight: 400; letter-spacing: 0; color: var(--ink-muted); text-decoration: underline;
  }
  button.what:hover { color: var(--ink); }
  kbd {
    font-family: ui-monospace, monospace; font-size: 11px; color: var(--ink-muted);
    border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
  }
  .octave { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 5px; }
  .status { margin: 16px 0 0; font-size: 13px; color: var(--ink-muted); }
  .status.ok { color: var(--chord-tone); }
  .status.warn { color: var(--avoid); }
  .sound { color: #5c646b; }
</style>
