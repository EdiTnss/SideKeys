<script lang="ts">
  import Game from './screens/Game.svelte';
  import Home from './screens/Home.svelte';
  import Practice from './screens/Practice.svelte';
  import Settings from './screens/Settings.svelte';
  import Theory from './screens/Theory.svelte';
  import Training from './screens/Training.svelte';
  import Welcome from './screens/Welcome.svelte';
  import Nav, { type Tab } from './lib/Nav.svelte';
  import type { Attempt, Finished, LevelPlan, Unit } from './game/level.svelte';
  import type { PracticePlan } from './game/practice.svelte';
  import { createInstrument } from './lib/instrument.svelte';
  import { isClean } from './bridge/theory';
  import {
    loadProgress, saveProgress, recordRun, recordPractice, dayStamp,
    streak, secondsOn, outcomesFor, dueReviews, nextLevel, levelAfter, levelById, reviewLevel,
    recordChallenge, challengeResult, challengeLevel, challengeNumber, challengeStates,
    shareText, loadTraining, trainingPlan, KEYS, SHAPES, shapeQualities, DEFAULT_TRAINING,
  } from './bridge/game';
  import { storageKey } from '../../src/storage.js';

  /** Fifteen minutes is the daily goal until someone asks to change it. */
  const GOAL_MINUTES = 15;

  // One instrument for the whole visit, so the keyboard is connected once and stays connected
  // from one level to the next. The screens borrow it; none of them owns it.
  const instrument = createInstrument();

  // Progress lives in this browser and nowhere else for now: no account, nothing to sign up to.
  let progress = $state(loadProgress());
  // The three doors and the settings behind the gear (docs/spec-ui.md).
  let tab = $state<Tab>('play');
  // Inside Practice: the choices for one kind of practice, or the door itself.
  let choosing = $state<'drill' | 'progression' | null>(null);
  // Which theory page is open (null is the list of them), and the door to go back to from it.
  let lesson = $state<string | null>(null);
  let beforeTheory: Tab = 'learn';
  // A page reached from the list goes back to the list; one opened from the path or a level goes
  // back there, where the question was asked.
  let fromList = false;
  let playing = $state<{ unit: Unit; plan: LevelPlan | PracticePlan; coach?: boolean } | null>(null);
  // What the stretch of training just finished came to, said once on the way back to its screen.
  let lastTraining = $state<{ minutes: number; played: number; clean: number; movement: number | null } | null>(null);
  let trainingRuns = 0;

  // The first visit is three presses to a first chord, once per browser (docs/spec-ui.md). Someone
  // with progress already never sees it. Storage can throw; then it is simply shown again.
  const WELCOMED = storageKey('welcomed');
  function readWelcomed() {
    try { return localStorage.getItem(WELCOMED) === '1'; } catch { return false; }
  }
  // svelte-ignore state_referenced_locally
  let welcomed = $state(readWelcomed() || Object.keys(progress.days ?? {}).length > 0);

  const today = $derived(dayStamp());
  const due = $derived(dueReviews(progress, today));
  const next = $derived(nextLevel(progress.stars, progress.last));
  const played = $derived(Object.keys(progress.days ?? {}).length > 0);
  const days = $derived(streak(progress, today));
  const minutes = $derived(Math.round(secondsOn(progress, today) / 60));

  // The level after the one being played, offered once this one has a star. Inside a unit that
  // is what opens the next level; across units nothing is locked, but a run that earned nothing
  // should lead with "Once more", not with the way past it. Off the path there is nothing after.
  const following = $derived.by(() => {
    if (!playing || !(progress.stars[playing.plan.id] > 0)) return null;
    const after = levelAfter(playing.plan.id) as { unit: Unit; level: LevelPlan } | null;
    return after && { unit: after.unit, plan: after.level };
  });

  // The day's challenge: its number always, its grid only once it has been played. The share
  // text is built from the stored pass, never from the run just finished, so a practice run
  // cannot change what gets pasted.
  const official = $derived(challengeResult(progress, today));
  const challenge = $derived({
    number: challengeNumber(today),
    states: official?.states ?? null,
    share: official ? shareText({ number: official.number, states: official.states }) : null,
  });

  /** A finished run, filed. For the daily challenge it also hands back the grid. */
  function finish({ stars, attempts, seconds }:
                  { stars: number; attempts: Attempt[]; seconds: number }): Finished {
    if (!playing) return { grid: null, share: null, official: true };
    const { missed, cleared } = outcomesFor(attempts);
    const isChallenge = playing.unit.id === 'challenge';
    // Only the pass played cold is the official one: a replay is practice, and must not change
    // the grid someone pastes (Edi, 2026-10-11).
    const first = isChallenge && !challengeResult(progress, today);
    // A challenge run still counts as playing: the minutes, the streak and the weak spots it
    // turned up are the same as any other run’s.
    // One key for the challenge rather than one per day: its stars come from `progress.challenge`,
    // so a key per date would grow for ever and be read by nothing. The plan keeps its dated id,
    // which is what remounts the screen for a new day.
    const levelId = isChallenge ? 'challenge' : playing.plan.id;
    let filed = recordRun(progress, { levelId, stars, today, seconds, missed, cleared });
    const grid = isChallenge ? (challengeStates(attempts) as string[]) : null;
    if (first && grid) {
      filed = recordChallenge(filed, { date: today, number: challengeNumber(today), states: grid, stars });
    }
    progress = filed;
    saveProgress(progress);
    const stored = challengeResult(progress, today);
    return {
      grid,
      share: stored ? shareText({ number: stored.number, states: stored.states }) : null,
      official: first,
    };
  }

  function startChallenge() {
    const plan = challengeLevel(today) as LevelPlan;
    // Not on the path, so it carries its own one-level "unit", like the review.
    playing = { unit: { id: 'challenge', name: '', blurb: '', levels: [plan] }, plan };
  }

  function startReview() {
    const plan = reviewLevel(due.map(entry => entry.quality)) as LevelPlan;
    // The review is not on the path, so it carries its own one-level "unit".
    playing = { unit: { id: 'review', name: '', blurb: '', levels: [plan] }, plan };
  }

  /**
   * A stretch of training, filed. It is playing, so the minutes and the weak spots count; it is
   * not the path, so no star is filed and "continue" stays where it was (Edi, 2026-10-12).
   * It does not look at `playing`: leaving clears that first, and the screen only reports the
   * stretch as it is torn down.
   */
  function finishTraining({ attempts, seconds, movement }:
                          { attempts: Attempt[]; seconds: number; movement: number | null }) {
    const { missed, cleared } = outcomesFor(attempts);
    progress = recordPractice(progress, { today, seconds, missed, cleared });
    saveProgress(progress);
    lastTraining = {
      minutes: Math.round(seconds / 60),
      played: attempts.length,
      clean: attempts.filter(attempt =>
        attempt.analysis && isClean(attempt.analysis, { texture: attempt.texture ?? null })).length,
      movement,
    };
  }

  function startTraining(plan: Omit<PracticePlan, 'id'>) {
    trainingRuns += 1;
    // A fresh id each time, so starting again remounts the screen instead of reusing the last run.
    playing = {
      unit: { id: 'training', name: '', blurb: '', levels: [] },
      plan: { ...plan, id: `training-${trainingRuns}` },
    };
  }

  /** "Pick up where you left off": the saved choices, straight into a stretch. */
  function resumeTraining() {
    const plan = trainingPlan(loadTraining()) as Omit<PracticePlan, 'id'> | null;
    if (plan) startTraining(plan);
  }

  /**
   * "Practise maj7" from a result: a drill on the weak quality, in all twelve keys, in the
   * level's shape when that shape has a voicing for it. The saved choices of Training are left
   * as they were (docs/spec-ui.md).
   */
  function practiseWeak(quality: string, texture: string | string[] | null, tempo: number) {
    const wanted = JSON.stringify(texture ?? null);
    const shape = SHAPES.find(entry => JSON.stringify(entry.texture) === wanted)?.id ?? 'any';
    const fits = (shapeQualities(shape) as string[]).includes(quality);
    const plan = trainingPlan({
      ...DEFAULT_TRAINING, mode: 'drill', qualities: [quality], keys: [...KEYS], shape: fits ? shape : 'any', tempo,
    }) as Omit<PracticePlan, 'id'> | null;
    tab = 'practice';
    choosing = null;
    if (plan) startTraining(plan);
  }

  /**
   * Opens a theory page, or the list of them. From inside a level this leaves the level: the
   * question "what is a drop 2?" is worth more than the run it interrupts, and a stretch of
   * training is filed by its screen as it goes.
   */
  function openTheory(unit: string | null) {
    if (tab !== 'learn') beforeTheory = tab;
    playing = null;
    lesson = unit;
    fromList = false;
    tab = 'learn';
  }

  /** "Play it" on a theory page, or a start picked on the first visit: that level, now. */
  function playLevel(id: string, coach = false) {
    const found = levelById(id) as { unit: Unit; level: LevelPlan } | null;
    if (found) playing = { unit: found.unit, plan: found.level, coach };
  }

  function welcome(level: string, coach: boolean) {
    try { localStorage.setItem(WELCOMED, '1'); } catch { /* shown again next time, no harm */ }
    welcomed = true;
    playLevel(level, coach);
  }

  function navigate(to: Tab) {
    playing = null;
    if (to === 'learn' && tab === 'learn') lesson = null;
    if (to === 'practice') choosing = null;
    tab = to;
  }

  // A new screen starts at its top: a result read at the bottom must not open the path halfway down.
  $effect(() => {
    tab; choosing; lesson; playing;
    window.scrollTo(0, 0);
  });

  /** Leaving a level or a stretch goes back to the door it was opened from. */
  function leaveGame() {
    playing = null;
  }
</script>

{#if !welcomed && !playing}
  <Welcome instrument={instrument} onstart={welcome} />
{:else if playing}
  <!-- A level has no navigation: the way out, the chord, the keys (docs/spec-ui.md). -->
  <main class="focus">
    {#key playing.plan.id}
      <Game unit={playing.unit} plan={playing.plan} instrument={instrument} onfinish={finish}
            best={progress.stars[playing.plan.id] ?? 0}
            coach={playing.coach ?? false}
            onpractice={finishTraining}
            ontheory={openTheory}
            onweak={practiseWeak}
            onnext={following ? () => (playing = following) : null}
            onexit={leaveGame} />
    {/key}
  </main>
{:else}
  <Nav tab={tab} instrument={instrument} streak={days} onnav={navigate} />
  <main class="door">
    {#if tab === 'practice' && choosing}
      <Training mode={choosing} last={lastTraining} onstart={startTraining} onback={() => (choosing = null)} />
    {:else if tab === 'practice'}
      <Practice last={lastTraining} onresume={resumeTraining} onchoose={mode => { lastTraining = null; choosing = mode; }} />
    {:else if tab === 'learn'}
      <Theory unit={lesson} instrument={instrument} onopen={unit => { lesson = unit; fromList = true; }} onplay={id => playLevel(id)}
              onback={() => { if (lesson !== null && fromList) lesson = null; else if (beforeTheory === 'learn') lesson = null; else { lesson = null; tab = beforeTheory; } }} />
    {:else if tab === 'settings'}
      <Settings instrument={instrument} streak={days} minutes={minutes} goal={GOAL_MINUTES} />
    {:else}
      <Home
        stars={progress.stars}
        minutes={minutes}
        goal={GOAL_MINUTES}
        played={played}
        next={next as { unit: Unit; level: LevelPlan; stars: number; played: boolean } | null}
        reviews={due}
        challenge={challenge}
        onplay={(unit, plan) => (playing = { unit, plan })}
        onreview={startReview}
        onchallenge={startChallenge}
        ontheory={openTheory} />
    {/if}
  </main>
{/if}

<style>
  /* Room for the doors: along the bottom on a narrow screen, down the left from 760 px. */
  .door { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
  @media (min-width: 760px) {
    .door { padding-bottom: 0; margin-left: 248px; }
  }
</style>
