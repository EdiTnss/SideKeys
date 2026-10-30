<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { fitWindow } from '../../../src/ui/keyboard.js';
  import Keyboard from '../lib/Keyboard.svelte';
  import Glossed from '../lib/Glossed.svelte';
  import Result from './Result.svelte';
  import type { Instrument } from '../lib/instrument.svelte';
  import { createLevel, type Attempt, type Finished, type LevelPlan, type Run } from '../game/level.svelte';
  import { createPractice, type PracticePlan } from '../game/practice.svelte';
  import { lessonFor, lessonForTexture } from '../bridge/game';
  import {
    analyzeVoicing, inversionOf, parseChord, chordToneNames, isRight, isClean, playedInstead,
    roleClasses, missingClasses, armedClasses, midiToName,
  } from '../bridge/theory';
  import { sayLevel, sayMessage, sayVoicing, sayInversion, sayUnit, sayDecimal, t } from '../lib/locale.svelte';

  let { unit, plan, instrument, best = 0, coach = false, onfinish, onpractice = () => {}, ontheory = () => {},
        onweak = () => {}, onnext = null, onexit }: {
    unit: { id: string; name: string };
    /** A level, or a stretch of training: the same screen plays both. */
    plan: LevelPlan | PracticePlan;
    /** The app's one instrument: it outlives this screen, so the keyboard stays connected. */
    instrument: Instrument;
    /** The stars this level already has: the timed run only leads once it is the way to the third. */
    best?: number;
    /** A first chord for someone just starting: the notes are written under it from the start. */
    coach?: boolean;
    onfinish: (run: { stars: number; attempts: Attempt[]; seconds: number }) => Finished;
    /** A stretch of training is over: what was played, and for how long. No stars come back. */
    onpractice?: (run: { attempts: Attempt[]; seconds: number; movement: number | null }) => void;
    /** Opens the page that explains a shape. It leaves this screen: the run in hand is given up. */
    ontheory?: (unit: string) => void;
    /** "Practise maj7" from the result: the weak quality, the level's shape, its tempo. */
    onweak?: (quality: string, texture: string | string[] | null, tempo: number) => void;
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
  // What a miss was instead, when it is another chord on the same root: "You played C6/9".
  let instead = $state<string | null>(null);
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

  // A press on Play that played nothing, said where the verdict goes: a button with no answer
  // reads as one that does not work. Gone with the next verdict or the next key armed.
  let nudge = $state<'empty' | 'one' | null>(null);
  function playArmed() {
    const armedNow = instrument.armed.length;
    nudge = instrument.play() ? null : armedNow === 1 ? 'one' : 'empty';
  }
  $effect(() => {
    instrument.armed;
    nudge = null;
  });

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
    if (practice.attempts.length) {
      onpractice({ attempts: practice.attempts, seconds: practice.seconds, movement: practice.averageMovement });
    }
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
    nudge = null;
    analysis = answered.analysis;
    judged = answered.symbol;
    instead = playedInstead(notes, answered.symbol);
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

  /** "Try it" on the result: the same level again, on the clock, for the third star. */
  function againTimed() {
    again();
    startTimed();
  }

  // The notes of the chord asked for, "C = C · E · G", on request — or from the start for someone
  // just starting. Written, not coloured on the keys: a coloured key would say that one voicing is
  // the answer (docs/spec-ui.md). Hidden again when the next chord comes, unless coaching.
  let reveal = $state(false);
  $effect(() => {
    level.ask?.symbol;
    reveal = false;
  });
  const notesOf = (symbol: string | undefined) =>
    symbol ? `${symbol} = ${chordToneNames(parseChord(symbol)).join(' · ')}` : '';

  function clearVerdict() {
    instrument.cancelCapture();
    analysis = null;
    judged = null;
    instead = null;
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

  // On a phone the full C2–C6 keyboard leaves a key 11 px wide, so a narrow screen shows two
  // octaves at a time, moved with the arrows (Edi, 2026-10-28). The window follows the notes
  // the verdict colours when they fall outside it, so the answer is never off screen.
  const FULL = { from: 36, to: 84 };
  const SPAN = 24;
  let narrow = $state(false);
  let touch = $state(false);
  let low = $state(48);
  $effect(() => {
    const width = matchMedia('(max-width: 640px)');
    const finger = matchMedia('(pointer: coarse)');
    const read = () => { narrow = width.matches; touch = finger.matches; };
    read();
    width.addEventListener('change', read);
    finger.addEventListener('change', read);
    return () => { width.removeEventListener('change', read); finger.removeEventListener('change', read); };
  });
  const shown = $derived({ ...classes, ...armedClasses(instrument.armed) });
  $effect(() => {
    const notes = Object.keys(shown).map(Number);
    // Untracked: an arrow press moves the window on purpose, and must not be undone here.
    if (narrow) low = fitWindow(untrack(() => low), notes, { span: SPAN, ...{ min: FULL.from, max: FULL.to } });
  });
  const shift = (by: number) => { low = Math.min(FULL.to - SPAN, Math.max(FULL.from, low + by)); };

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
    if (event.code === 'Enter') playArmed();
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
  // A wrong or missing note ends on the answer, "Bb = Bb · D · F": the verdict says what is
  // wrong, and someone who does not know the chord yet still has nothing to play.
  const spelled = $derived(
    judged && !star && warnings.some((m: { code: string }) => m.code === 'missing' || m.code === 'wrong')
      ? `${judged} = ${chordToneNames(parseChord(judged)).join(' · ')}`
      : null);
  // The bars a change is rated against, in the rating's own words: smooth up to this
  // progression's third-star threshold, then compareVoicings' 1.5 and 3 (src/theory/stars.js
  // `rateStep`). "Close" only exists where the threshold is under 1.5, as on the ii–V–I.
  const scale = $derived.by(() => {
    if (!practice) return '';
    const bars = [`${t('rating.smooth')} ≤ ${sayDecimal(practice.smoothAt, 2)}`];
    if (practice.smoothAt < 1.5) bars.push(`${t('rating.close')} ≤ ${sayDecimal(1.5, 2)}`);
    bars.push(`${t('rating.ok')} ≤ 3`, `${t('rating.jumpy')} > 3`);
    return bars.join(' · ');
  });
  // The rest of the warnings, under the headline: when the headline is the first warning itself,
  // listing it again only says it twice ("Missing C (5)" over "Missing C (5)").
  const listed = $derived(star || shapeMiss ? warnings : warnings.slice(1));
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
  // With no shape demanded, the page about the chord itself: the unit's own on the path, and
  // for training, the challenge and the review, the page for the kind of chord on screen.
  const chordPage = $derived.by(() => {
    const own = (lessonFor(unit.id) as { unit: string } | null)?.unit;
    if (own) return own;
    const symbol = level.ask?.symbol;
    if (!symbol) return null;
    if (symbol.includes('/')) return 'inversions';
    return parseChord(symbol).chordTones.length === 3 ? 'triads' : 'sevenths';
  });
  const missPage = $derived(pageFor(judgedTexture));
  // The shape a level demands throughout, if any. Training carries its own and has no result.
  const planTexture = $derived('endless' in plan ? null : ((plan as LevelPlan).texture ?? null));
  // Where the result's "How is it built?" goes: the page for the level's shape, or for its unit.
  const resultPage = $derived(pageFor(planTexture) ?? (lessonFor(unit.id) as { unit: string } | null)?.unit ?? null);
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
  {@const weak = level.weakness}
  <Result name={title} score={level.score} weakness={weak}
          timed={level.timed} threshold={level.threshold} tempo={level.plan.tempo} grid={grid} share={share}
          official={official} onagain={again}
          ontimed={!grid && !level.timed && !level.plan.free && level.score.stars === 2 ? againTimed : null}
          onpractise={weak ? () => onweak(weak.key, planTexture, level.plan.tempo) : null}
          onhow={resultPage ? () => ontheory(resultPage) : null}
          onnext={onnext} onexit={onexit} />
{:else}
  <section class="game">
    <!-- No navigation inside a level (docs/spec-ui.md): the way out, where you are, how far. -->
    <div class="progress">
      <button type="button" class="exit" onclick={leave} aria-label={t('game.close')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
      <span class="level">
        <Glossed text={title} />
        {#if level.timed}<span class="timed">· {practice ? '' : t('game.timed')}{level.plan.tempo} bpm</span>{/if}
      </span>
      {#if practice}
        <!-- Nothing to count towards, so the tally stands where the progress bar would. -->
        <span class="spacer"></span>
        <span class="count">{t('game.tally', { played: practice.played, clean: practice.clean })}</span>
      {:else}
        <span class="track"><span class="fill" style="width: {(100 * level.answered) / level.total}%"></span></span>
        <span class="count">{level.index + 1} / {level.total}</span>
      {/if}
      {#if instrument.hardware.length}
        <span class="device"><span class="dot" aria-hidden="true"></span>{instrument.hardware.join(', ')}</span>
      {/if}
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
        {#if chordPage}<button type="button" class="what" onclick={() => ontheory(chordPage)}>{t('game.howBuilt')}</button>{/if}
      {/if}
    </p>
    {#if level.ask && (coach || reveal) && !spelled}
      <p class="spelled notes">{notesOf(level.ask.symbol)}</p>
    {/if}

    <div class="verdict" aria-live="polite">
      {#if nudge}
        <p class="nudge">{t(nudge === 'one' ? 'game.oneNote' : touch ? 'game.armFirstTouch' : 'game.armFirst')}</p>
      {:else if !analysis}
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

      {#if star && instead && !nudge}
        <!-- Right, with more on top: the star stands, and this says what was played (Edi, 2026-10-29). -->
        <p class="spelled">{t('game.youPlayed', { chord: instead })}</p>
      {/if}
      {#if spelled && !nudge}
        <p class="spelled">{#if instead}{t('game.youPlayed', { chord: instead })}{' · '}{/if}{spelled}</p>
      {/if}

      {#if analysis && !level.timed && !star}
        <p class="move">{t(practice ? 'game.tryAgainPractice' : 'game.tryAgain')}</p>
      {:else if analysis && !counted && level.timed}
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
        <!-- The yardstick under the number: 1.60 means nothing until it is set against the bars. -->
        <p class="scale">{scale}</p>
      {/if}

      {#if analysis && listed.length}
        <ul class="messages">
          <!-- Keyed by what the message says, not how: the text changes with the language. -->
          {#each listed as message (`${message.code}:${JSON.stringify(message.params)}`)}
            <li><Glossed text={sayMessage(message)} /></li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if narrow}
      <!-- The arrows sit above the keys, not beside them: on 375 px every pixel of width is key. -->
      <div class="window">
        <button type="button" class="arrow" onclick={() => shift(-12)} disabled={low <= FULL.from} aria-label={t('game.octaveDown')}>‹</button>
        <span class="range">{midiToName(low)}–{midiToName(low + SPAN)}</span>
        <button type="button" class="arrow" onclick={() => shift(12)} disabled={low >= FULL.to - SPAN} aria-label={t('game.octaveUp')}>›</button>
      </div>
      <Keyboard classes={shown} onkey={instrument.toggle} from={low} to={low + SPAN} />
    {:else}
      <Keyboard classes={shown} onkey={instrument.toggle} from={FULL.from} to={FULL.to} />
    {/if}

    <div class="controls" class:touch>
      {#if instrument.hardware.length}
        <!-- With a keyboard plugged in, the keyboard is the control: no button to press (docs/spec-ui.md). -->
        <span class="on-keyboard"><span class="dot" aria-hidden="true"></span>{t('game.onKeyboard', { device: instrument.hardware.join(', ') })}</span>
      {:else}
        <button type="button" class="play" onclick={playArmed}>{t('game.playArmed')} <kbd>Enter</kbd></button>
        <button type="button" onclick={() => instrument.clear()}>{t('game.clear')} <kbd>Esc</kbd></button>
      {/if}
      {#if practice && level.timed}
        <!-- Stops the clock, not the practice: it goes on without it, from the chord it was on. -->
        <button type="button" onclick={() => level.stop()}>{t('game.stopMetronome')}</button>
      {:else if practice}
        <button type="button" onclick={startTimed}>{t('game.startMetronome', { tempo: level.plan.tempo })}</button>
      {:else if level.timed}
        <button type="button" class="stop" onclick={() => level.stop()}>{t('game.stopRun')}</button>
      {:else if !level.plan.free && best >= 2}
        <!-- Free play is where a level starts. The clock is offered here only once the level has
             two stars, when it is the only way to the third; before that, the result offers it. -->
        <button type="button" class="start" onclick={startTimed}>{t('game.startTimed')}</button>
      {/if}
      {#if practice}
        <button type="button" onclick={leave}>{t('game.done')}</button>
      {/if}
    </div>
    <div class="links" class:touch>
      {#if level.ask && !coach}
        <button type="button" class="link" aria-pressed={reveal} onclick={() => (reveal = !reveal)}>{t('game.showNotes')}</button>
      {/if}
      {#if !instrument.hardware.length && !touch}
        <span class="octave">{t('game.octave', { note: midiToName(instrument.octave) })} <kbd>Z</kbd><kbd>X</kbd></span>
      {/if}
      <span class="spacer"></span>
      {#if !level.timed}
        <button type="button" class="link" onclick={skip}>{t('game.skip')} <kbd>Space</kbd></button>
      {/if}
    </div>

    <p class="status {instrument.status.level}">
      {t(touch && instrument.status.key === 'status.idle' ? 'status.idleTouch' : instrument.status.key, instrument.status.params)}
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
  .level { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .exit {
    flex: none; width: 40px; height: 40px; margin-left: -10px; padding: 0; justify-content: center;
    border: none; background: none; color: var(--ink);
  }
  .exit:hover { background: var(--surface); }
  .device { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink); white-space: nowrap; }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--chord-tone); }
  .on-keyboard { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 14px; color: var(--ink-muted); }
  .notes { margin: -16px 0 20px; }
  .links { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 14px; }
  .links.touch kbd { display: none; }
  button.link {
    padding: 6px 0; border: none; background: none; color: var(--ink-muted); font-size: 14px;
  }
  button.link:hover, button.link[aria-pressed='true'] { color: var(--ink); }
  button.play { min-width: 140px; justify-content: center; background: var(--ink); color: #14171a; border-color: var(--ink); font-weight: 600; }
  @media (max-width: 640px) {
    .device { display: none; }
    .controls button.play { flex: 1; }
  }
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
  .nudge { margin: 0; font-size: 18px; color: var(--ink); }
  .scale { margin: -4px 0 8px; font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-muted); }
  .spelled { margin: 0 0 8px; font-family: ui-monospace, monospace; font-size: 15px; color: var(--ink); }
  .messages { margin: 0; padding-left: 20px; color: var(--ink-muted); font-size: 14px; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }
  /* A finger has no Enter key: the shortcuts are noise on a phone. */
  .controls.touch kbd { display: none; }
  .window { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px; }
  .range { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); min-width: 64px; text-align: center; }
  .arrow { width: 44px; height: 36px; padding: 0; border-radius: 10px; font-size: 22px; display: grid; place-items: center; line-height: 1; }
  .arrow:disabled { opacity: 0.3; }
  @media (max-width: 640px) {
    .game { padding: 16px 16px 40px; }
  }
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
