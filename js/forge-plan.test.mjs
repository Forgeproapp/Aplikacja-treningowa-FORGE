import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

eval(fs.readFileSync(new URL('./forge-plan.js', import.meta.url), 'utf8'));
const ForgePlan = globalThis.ForgePlan;

const VOLUME = {
  'Klatka': [10, 10, 11, 13, 14, 8, 11, 13, 13, 14, 14, 8],
  'Plecy (szerokość)': [6, 6, 6, 7, 7, 4, 6, 7, 7, 7, 7, 4],
  'Plecy (grubość)': [5, 5, 5, 7, 7, 4, 5, 7, 7, 7, 7, 4],
  'Barki – bok': [8, 8, 8, 9, 10, 6, 8, 9, 9, 10, 10, 6],
  'Barki – przód': [2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2],
  'Barki – tył': [2, 2, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2],
  'Biceps': [4, 4, 4, 5, 5, 4, 4, 5, 5, 5, 5, 4],
  'Triceps': [4, 4, 4, 5, 5, 4, 4, 5, 5, 5, 5, 4],
  'Czworogłowe': [8, 8, 8, 8, 9, 6, 8, 8, 8, 9, 9, 6],
  'Dwugłowe': [7, 8, 8, 8, 8, 6, 8, 8, 8, 8, 8, 6],
  'Pośladki': [2, 2, 2, 2, 3, 2, 2, 2, 2, 3, 3, 2],
  'Łydki': [4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 4],
  'Brzuch': [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
};

test('preset buduje 12 tygodni i 3 treningi', () => {
  const plan = ForgePlan.buildPreset(ForgePlan.PRESET_ID);
  assert.equal(plan.totalWeeks, 12);
  assert.equal(plan.customDays.length, 3);
  assert.deepEqual(plan.customDays.map((day) => day.name), [
    'Full body A (wt)',
    'Full body B (czw)',
    'Full body C (sob)'
  ]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((week) => plan.weekMeta[week].rir), [
    3, 3, 2, 2, 1, 4, 3, 3, 2, 2, 1, 4
  ]);
  assert.equal(plan.weekMeta[6].deload, true);
  assert.equal(plan.weekMeta[12].deload, true);
});

test('serie bezpośrednie zgadzają się z rozpiską w każdym tygodniu', () => {
  const plan = ForgePlan.buildAdvanced3Day12WeekPlan();
  for (let week = 1; week <= 12; week++) {
    const volume = ForgePlan.directWeeklyVolume(plan.customDays, week);
    Object.entries(VOLUME).forEach(([muscle, series]) => {
      assert.equal(volume[muscle], series[week - 1], muscle + ' tydzień ' + week);
    });
    const extra = Object.keys(volume).filter((muscle) => VOLUME[muscle] == null);
    assert.deepEqual(extra, []);
  }
});

test('blok 2 wymienia akcesoria, a boje zostają', () => {
  const plan = ForgePlan.buildAdvanced3Day12WeekPlan();
  const byId = {};
  plan.customDays.forEach((day) => {
    day.exercises.forEach((ex) => { byId[ex.id] = ex; });
  });
  const name = (id, week) => ForgePlan.resolveExerciseForWeek(byId[id], week).name;
  assert.equal(name('adv_a1', 1), 'Przysiad na suwnicy hack');
  assert.equal(name('adv_a1', 7), 'Przysiad na suwnicy hack');
  assert.equal(name('adv_a4', 1), 'Unoszenie bokiem na wyciągu');
  assert.equal(name('adv_a4', 7), 'Unoszenie hantli bokiem');
  assert.equal(name('adv_a5', 5), 'Uginanie nóg siedząc');
  assert.equal(name('adv_a5', 12), 'Uginanie nóg leżąc');
  assert.equal(name('adv_a6', 1), 'Rozpiętki na wyciągach (dolny do górnego)');
  assert.equal(name('adv_a6', 7), 'Rozpiętki na maszynie (pec deck)');
  assert.equal(name('adv_a7a', 1), 'Prostowanie ramion na wyciągu górnym');
  assert.equal(name('adv_a7a', 7), 'Wyciskanie francuskie leżąc');
  assert.equal(name('adv_b6', 1), 'Odwrotne rozpiętki na maszynie');
  assert.equal(name('adv_b6', 8), 'Face pull na wyciągu');
  assert.equal(name('adv_b9', 1), 'Unoszenie nóg w zwisie');
  assert.equal(name('adv_b9', 7), 'Spięcia brzucha na wyciągu');
  assert.equal(name('adv_c2', 1), 'Ściąganie jednorącz na wyciągu');
  assert.equal(name('adv_c2', 7), 'Ściąganie prostych ramion na wyciągu');
  assert.equal(name('adv_c8a', 1), 'Prostowanie ramion nad głową na wyciągu');
  assert.equal(name('adv_c8a', 11), 'Prostowanie ramion nad głową z hantlem');

  const straightArm = ForgePlan.resolveExerciseForWeek(byId.adv_c2, 7);
  assert.equal(straightArm.restSec, 75);
  assert.deepEqual(straightArm.agonists, ['Triceps']);
  assert.equal(straightArm.target, 'Plecy (szerokość)');

  const squat = ForgePlan.resolveExerciseForWeek(byId.adv_a1, 5);
  assert.equal(squat.sets, 4);
  assert.equal(squat.reps, '6–10');
  assert.equal(squat.restSec, 180);
  assert.equal(ForgePlan.resolveExerciseForWeek(byId.adv_a1, 6).sets, 2);
});

test('superseria odpoczywa 90 s dopiero po rundzie', () => {
  const pair = [
    { id: 'a', superset: 'a7', restSec: 90 },
    { id: 'b', superset: 'a7', restSec: 90 }
  ];
  const done = { a: [true, false], b: [false, false] };
  const first = ForgePlan.restAfterCompletedSet(pair[0], pair, 0, done, 120);
  assert.equal(first.restSec, 0);
  assert.equal(first.partnerId, 'b');
  done.b[0] = true;
  const second = ForgePlan.restAfterCompletedSet(pair[1], pair, 0, done, 120);
  assert.equal(second.restSec, 90);
  assert.equal(second.partnerId, null);

  const single = ForgePlan.restAfterCompletedSet({ id: 'x', restSec: null }, [], 0, {}, 180);
  assert.equal(single.restSec, 180);
});

test('stary ćwiczenie bez bloków dalej czyta serie tygodnia', () => {
  const ex = {
    id: 'old',
    name: 'Squat',
    target: 'Czworogłowe',
    secondary: 'Pośladki',
    sets: 3,
    reps: '10',
    setsByWeek: { 1: 3, 2: 4 },
    repsByWeek: { 1: '10', 2: '8' }
  };
  const view = ForgePlan.resolveExerciseForWeek(ex, 2);
  assert.equal(view.name, 'Squat');
  assert.equal(view.sets, 4);
  assert.equal(view.reps, '8');
  assert.equal(view.secondary, 'Pośladki');
  ForgePlan.ensureWeekSlots(ex, 4);
  assert.equal(ex.setsByWeek[4], '');
  assert.equal(ex.setsByWeek[2], 4);
});

test('każde ćwiczenie ma partię z listy i przerwę', () => {
  const plan = ForgePlan.buildAdvanced3Day12WeekPlan();
  plan.customDays.forEach((day) => {
    assert.equal(ForgePlan.minutesForWeek(day, 5) > 0, true);
    day.exercises.forEach((ex) => {
      [1, 7, 12].forEach((week) => {
        const view = ForgePlan.resolveExerciseForWeek(ex, week);
        assert.equal(ForgePlan.MUSCLE_TARGETS.includes(view.target), true, view.name);
        view.agonists.forEach((muscle) => {
          assert.equal(ForgePlan.MUSCLE_TARGETS.includes(muscle), true, muscle);
        });
        assert.equal(view.restSec > 0, true, view.name);
        assert.equal(view.reps.includes('–'), true, view.name);
      });
    });
  });
});

test('nieznany preset zwraca null', () => {
  assert.equal(ForgePlan.buildPreset('inny'), null);
});
