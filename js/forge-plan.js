(function (root) {
  const MUSCLE_TARGETS = [
    'Klatka',
    'Plecy',
    'Plecy (szerokość)',
    'Plecy (grubość)',
    'Barki',
    'Barki – bok',
    'Barki – przód',
    'Barki – tył',
    'Biceps',
    'Triceps',
    'Czworogłowe',
    'Dwugłowe',
    'Pośladki',
    'Łydki',
    'Brzuch'
  ];

  const PRESET_ID = 'zaawansowany-3dni-12tyg';

  function own(map, week) {
    if (!map) return undefined;
    if (Object.prototype.hasOwnProperty.call(map, week)) return map[week];
    const key = String(week);
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    return undefined;
  }

  function blockForWeek(ex, week) {
    if (!ex || !Array.isArray(ex.blocks) || ex.blocks.length === 0) return null;
    const weekNum = Number(week) || 1;
    let chosen = null;
    ex.blocks.forEach((block) => {
      const from = Number(block.fromWeek) || 1;
      if (from <= weekNum && (!chosen || from >= (Number(chosen.fromWeek) || 1))) {
        chosen = block;
      }
    });
    return chosen || ex.blocks[0];
  }

  function resolveExerciseForWeek(ex, week) {
    const weekNum = Number(week) || 1;
    const block = blockForWeek(ex, weekNum);
    const setsMap = (block && block.setsByWeek) || ex.setsByWeek;
    const repsMap = (block && block.repsByWeek) || ex.repsByWeek;
    const rawSets = own(setsMap, weekNum);
    let sets;
    if (rawSets === undefined || rawSets === '') {
      sets = !block && weekNum === 1 ? (Number(ex.sets) || 0) : 0;
    } else {
      sets = Number(rawSets) || 0;
    }

    const rawReps = own(repsMap, weekNum);
    let reps = '';
    if (rawReps !== undefined && rawReps !== null && rawReps !== '') reps = String(rawReps);
    else if (block && block.reps) reps = String(block.reps);
    else if (weekNum === 1) reps = ex.reps ? String(ex.reps) : '';

    const rawWeight = own(ex.weightsByWeek, weekNum);
    let weight = '';
    if (rawWeight !== undefined && rawWeight !== null && rawWeight !== '') weight = rawWeight;
    else if (weekNum === 1 && ex.weight !== undefined && ex.weight !== null) weight = ex.weight;

    const agonists = (block && block.agonists) || ex.agonists || [];
    return {
      id: ex.id,
      name: (block && block.name) || ex.name || '',
      target: (block && block.target) || ex.target || 'Inne',
      secondary: (block && block.secondary) || ex.secondary || 'Brak',
      agonists: Array.isArray(agonists) ? agonists.filter(Boolean) : [],
      sets,
      reps,
      weight,
      note: block && block.note != null && block.note !== '' ? block.note : (ex.note || ''),
      restSec: Number((block && block.restSec) || ex.restSec) || null,
      superset: (block && block.superset) || ex.superset || '',
      supersetSlot: (block && block.supersetSlot) || ex.supersetSlot || ''
    };
  }

  function exerciseNames(ex) {
    const names = [];
    const push = (name) => {
      const trimmed = String(name || '').trim();
      if (!trimmed || names.indexOf(trimmed) !== -1) return;
      names.push(trimmed);
    };
    push(ex && ex.name);
    ((ex && ex.blocks) || []).forEach((block) => push(block.name));
    return names;
  }

  function directWeeklyVolume(days, week) {
    const map = {};
    (days || []).forEach((day) => {
      (day.exercises || []).forEach((ex) => {
        const view = resolveExerciseForWeek(ex, week);
        if (!view.sets) return;
        const target = view.target || 'Inne';
        map[target] = (map[target] || 0) + view.sets;
      });
    });
    return map;
  }

  function restAfterCompletedSet(exercise, exercises, setIndex, setsDoneById, fallbackRest) {
    const ownRest = Number(exercise && exercise.restSec) || Number(fallbackRest) || 0;
    if (!exercise || !exercise.superset) {
      return { restSec: ownRest, partnerId: null, partnerSet: null };
    }
    const partner = (exercises || []).find((item) => item.superset === exercise.superset && item.id !== exercise.id);
    if (!partner) return { restSec: ownRest, partnerId: null, partnerSet: null };
    const partnerDone = (setsDoneById && setsDoneById[partner.id]) || [];
    if (!partnerDone[setIndex]) {
      return { restSec: 0, partnerId: partner.id, partnerSet: setIndex };
    }
    return { restSec: ownRest, partnerId: null, partnerSet: null };
  }

  function formatRestSeconds(secs) {
    const n = Number(secs) || 0;
    if (n <= 0) return '';
    if (n === 75 || n === 90) return n + ' s';
    if (n % 60 === 0) return (n / 60) + ' min';
    if (n < 60) return n + ' s';
    const minutes = Math.floor(n / 60);
    const seconds = n % 60;
    return minutes + ' min ' + seconds + ' s';
  }

  function minutesForWeek(day, week) {
    if (!day || !day.minutesByWeek) return null;
    const value = own(day.minutesByWeek, week);
    if (value == null || value === '') return null;
    return Number(value);
  }

  function ensureWeekSlots(ex, totalWeeks) {
    const total = Math.max(Number(totalWeeks) || 1, 1);
    if (!ex.weightsByWeek) ex.weightsByWeek = {};
    if (Array.isArray(ex.blocks) && ex.blocks.length) {
      for (let week = 1; week <= total; week++) {
        const block = blockForWeek(ex, week);
        if (block) {
          if (!block.setsByWeek) block.setsByWeek = {};
          if (own(block.setsByWeek, week) === undefined) block.setsByWeek[week] = '';
          if (!block.repsByWeek) block.repsByWeek = {};
        }
        if (own(ex.weightsByWeek, week) === undefined) ex.weightsByWeek[week] = '';
      }
      return ex;
    }
    if (!ex.setsByWeek) ex.setsByWeek = {};
    if (!ex.repsByWeek) ex.repsByWeek = {};
    for (let week = 1; week <= total; week++) {
      if (own(ex.setsByWeek, week) === undefined) {
        ex.setsByWeek[week] = week === 1 ? (Number(ex.sets) || 3) : '';
      }
      if (own(ex.repsByWeek, week) === undefined) {
        ex.repsByWeek[week] = week === 1 ? (ex.reps || '10') : '';
      }
      if (own(ex.weightsByWeek, week) === undefined) {
        ex.weightsByWeek[week] = week === 1 ? (ex.weight != null ? ex.weight : '') : '';
      }
    }
    return ex;
  }

  function setsFrom(startWeek, list) {
    const map = {};
    list.forEach((count, index) => { map[startWeek + index] = count; });
    return map;
  }

  function block(fromWeek, name, target, agonists, sets, reps, restSec, extra) {
    const info = extra || {};
    return {
      fromWeek,
      name,
      target,
      agonists: agonists || [],
      secondary: 'Brak',
      setsByWeek: setsFrom(fromWeek, sets),
      reps,
      restSec,
      superset: info.superset || '',
      supersetSlot: info.slot || '',
      note: ''
    };
  }

  function exercise(id, first, second) {
    return { id, blocks: [first, second] };
  }

  function buildAdvanced3Day12WeekPlan() {
    const rir = [3, 3, 2, 2, 1, 4];
    const weekMeta = {};
    for (let week = 1; week <= 12; week++) {
      const step = (week - 1) % 6;
      const deload = step === 5;
      weekMeta[week] = {
        rir: rir[step],
        rest: 120,
        restText: '2 min',
        label: deload ? ('Tydzień ' + week + ' · deload') : ('Tydzień ' + week),
        deload
      };
    }

    const days = [
      {
        id: 1,
        name: 'Full body A (wt)',
        focus: 'Wtorek',
        minutesByWeek: Object.assign(setsFrom(1, [56, 58, 59, 68, 73, 45]), setsFrom(7, [59, 68, 68, 73, 73, 45])),
        exercises: [
          exercise('adv_a1',
            block(1, 'Przysiad na suwnicy hack', 'Czworogłowe', ['Pośladki'], [3, 3, 3, 3, 4, 2], '6–10', 180),
            block(7, 'Przysiad na suwnicy hack', 'Czworogłowe', ['Pośladki'], [3, 3, 3, 4, 4, 2], '6–10', 180)),
          exercise('adv_a2',
            block(1, 'Wyciskanie hantli na ławce skośnej', 'Klatka', ['Barki – przód', 'Triceps'], [3, 3, 3, 4, 4, 2], '6–10', 120),
            block(7, 'Wyciskanie hantli na ławce skośnej', 'Klatka', ['Barki – przód', 'Triceps'], [3, 4, 4, 4, 4, 2], '6–10', 120)),
          exercise('adv_a3',
            block(1, 'Ściąganie drążka wyciągu górnego do klatki', 'Plecy (szerokość)', ['Biceps', 'Plecy (grubość)'], [3, 3, 3, 4, 4, 2], '8–12', 120),
            block(7, 'Ściąganie drążka wyciągu górnego do klatki', 'Plecy (szerokość)', ['Biceps', 'Plecy (grubość)'], [3, 4, 4, 4, 4, 2], '8–12', 120)),
          exercise('adv_a4',
            block(1, 'Unoszenie bokiem na wyciągu', 'Barki – bok', [], [3, 3, 3, 3, 4, 2], '10–20', 75),
            block(7, 'Unoszenie hantli bokiem', 'Barki – bok', [], [3, 3, 3, 4, 4, 2], '10–20', 75)),
          exercise('adv_a5',
            block(1, 'Uginanie nóg siedząc', 'Dwugłowe', [], [2, 3, 3, 3, 3, 2], '8–12', 75),
            block(7, 'Uginanie nóg leżąc', 'Dwugłowe', [], [3, 3, 3, 3, 3, 2], '8–12', 75)),
          exercise('adv_a6',
            block(1, 'Rozpiętki na wyciągach (dolny do górnego)', 'Klatka', ['Barki – przód'], [2, 2, 3, 3, 3, 2], '10–15', 75),
            block(7, 'Rozpiętki na maszynie (pec deck)', 'Klatka', ['Barki – przód'], [3, 3, 3, 3, 3, 2], '10–15', 75)),
          exercise('adv_a7a',
            block(1, 'Prostowanie ramion na wyciągu górnym', 'Triceps', [], [2, 2, 2, 3, 3, 2], '10–15', 90, { superset: 'a7', slot: '7a' }),
            block(7, 'Wyciskanie francuskie leżąc', 'Triceps', [], [2, 3, 3, 3, 3, 2], '8–12', 90, { superset: 'a7', slot: '7a' })),
          exercise('adv_a7b',
            block(1, 'Uginanie hantli na ławce skośnej', 'Biceps', [], [2, 2, 2, 3, 3, 2], '8–12', 90, { superset: 'a7', slot: '7b' }),
            block(7, 'Uginanie ramion na modlitewniku', 'Biceps', [], [2, 3, 3, 3, 3, 2], '8–12', 90, { superset: 'a7', slot: '7b' }))
        ]
      },
      {
        id: 2,
        name: 'Full body B (czw)',
        focus: 'Czwartek',
        minutesByWeek: Object.assign(setsFrom(1, [61, 66, 68, 70, 73, 50]), setsFrom(7, [68, 70, 70, 73, 73, 50])),
        exercises: [
          exercise('adv_b1',
            block(1, 'Martwy ciąg rumuński', 'Dwugłowe', ['Pośladki', 'Plecy (szerokość)'], [3, 3, 3, 3, 3, 2], '6–10', 180),
            block(7, 'Martwy ciąg rumuński', 'Dwugłowe', ['Pośladki', 'Plecy (szerokość)'], [3, 3, 3, 3, 3, 2], '6–10', 180)),
          exercise('adv_b2',
            block(1, 'Wyciskanie hantli na ławce płaskiej', 'Klatka', ['Triceps', 'Barki – przód'], [3, 3, 3, 3, 4, 2], '6–10', 120),
            block(7, 'Wyciskanie hantli na ławce płaskiej', 'Klatka', ['Triceps', 'Barki – przód'], [3, 3, 3, 4, 4, 2], '6–10', 120)),
          exercise('adv_b3',
            block(1, 'Wiosłowanie siedząc na wyciągu', 'Plecy (grubość)', ['Plecy (szerokość)', 'Biceps'], [3, 3, 3, 4, 4, 2], '8–12', 120),
            block(7, 'Wiosłowanie siedząc na wyciągu', 'Plecy (grubość)', ['Plecy (szerokość)', 'Biceps'], [3, 4, 4, 4, 4, 2], '8–12', 120)),
          exercise('adv_b4',
            block(1, 'Wyciskanie hantli siedząc (barki)', 'Barki – przód', ['Barki – bok', 'Triceps'], [2, 3, 3, 3, 3, 2], '6–10', 120),
            block(7, 'Wyciskanie hantli siedząc (barki)', 'Barki – przód', ['Barki – bok', 'Triceps'], [3, 3, 3, 3, 3, 2], '6–10', 120)),
          exercise('adv_b5',
            block(1, 'Unoszenie hantli bokiem', 'Barki – bok', [], [3, 3, 3, 3, 3, 2], '10–20', 75),
            block(7, 'Unoszenie bokiem na maszynie', 'Barki – bok', [], [3, 3, 3, 3, 3, 2], '10–20', 75)),
          exercise('adv_b6',
            block(1, 'Odwrotne rozpiętki na maszynie', 'Barki – tył', ['Plecy (grubość)'], [2, 2, 3, 3, 3, 2], '12–20', 75),
            block(7, 'Face pull na wyciągu', 'Barki – tył', ['Plecy (grubość)'], [3, 3, 3, 3, 3, 2], '12–20', 75)),
          exercise('adv_b7',
            block(1, 'Prostowanie nóg na maszynie', 'Czworogłowe', [], [2, 2, 2, 2, 2, 2], '10–15', 75),
            block(7, 'Prostowanie nóg na maszynie', 'Czworogłowe', [], [2, 2, 2, 2, 2, 2], '10–15', 75)),
          exercise('adv_b8',
            block(1, 'Wspięcia na palce stojąc', 'Łydki', [], [2, 3, 3, 3, 3, 2], '8–15', 75),
            block(7, 'Wspięcia na palce siedząc', 'Łydki', [], [3, 3, 3, 3, 3, 2], '10–20', 75)),
          exercise('adv_b9',
            block(1, 'Unoszenie nóg w zwisie', 'Brzuch', [], [2, 2, 2, 2, 2, 2], '8–15', 75),
            block(7, 'Spięcia brzucha na wyciągu', 'Brzuch', [], [2, 2, 2, 2, 2, 2], '10–15', 75))
        ]
      },
      {
        id: 3,
        name: 'Full body C (sob)',
        focus: 'Sobota (zamiennie niedziela)',
        minutesByWeek: Object.assign(setsFrom(1, [63, 63, 63, 70, 73, 57]), setsFrom(7, [61, 68, 68, 71, 71, 56])),
        exercises: [
          exercise('adv_c1',
            block(1, 'Wypychanie na suwnicy', 'Czworogłowe', ['Pośladki', 'Dwugłowe'], [3, 3, 3, 3, 3, 2], '8–12', 180),
            block(7, 'Wypychanie na suwnicy', 'Czworogłowe', ['Pośladki', 'Dwugłowe'], [3, 3, 3, 3, 3, 2], '8–12', 180)),
          exercise('adv_c2',
            block(1, 'Ściąganie jednorącz na wyciągu', 'Plecy (szerokość)', ['Biceps', 'Plecy (grubość)'], [3, 3, 3, 3, 3, 2], '8–12', 120),
            block(7, 'Ściąganie prostych ramion na wyciągu', 'Plecy (szerokość)', ['Triceps'], [3, 3, 3, 3, 3, 2], '10–15', 75)),
          exercise('adv_c3',
            block(1, 'Wyciskanie na maszynie (klatka)', 'Klatka', ['Triceps', 'Barki – przód'], [2, 2, 2, 3, 3, 2], '8–12', 120),
            block(7, 'Wyciskanie na maszynie (klatka)', 'Klatka', ['Triceps', 'Barki – przód'], [2, 3, 3, 3, 3, 2], '8–12', 120)),
          exercise('adv_c4',
            block(1, 'Wiosłowanie hantlem jednorącz', 'Plecy (grubość)', ['Plecy (szerokość)', 'Biceps'], [2, 2, 2, 3, 3, 2], '8–12', 120),
            block(7, 'Wiosłowanie hantlem jednorącz', 'Plecy (grubość)', ['Plecy (szerokość)', 'Biceps'], [2, 3, 3, 3, 3, 2], '8–12', 120)),
          exercise('adv_c5',
            block(1, 'Hip thrust', 'Pośladki', ['Dwugłowe'], [2, 2, 2, 2, 3, 2], '6–12', 120),
            block(7, 'Hip thrust', 'Pośladki', ['Dwugłowe'], [2, 2, 2, 3, 3, 2], '6–12', 120)),
          exercise('adv_c6',
            block(1, 'Unoszenie bokiem na maszynie', 'Barki – bok', [], [2, 2, 2, 3, 3, 2], '10–20', 75),
            block(7, 'Unoszenie bokiem na maszynie', 'Barki – bok', [], [2, 3, 3, 3, 3, 2], '10–20', 75)),
          exercise('adv_c7',
            block(1, 'Uginanie nóg leżąc', 'Dwugłowe', [], [2, 2, 2, 2, 2, 2], '8–12', 75),
            block(7, 'Uginanie nóg siedząc', 'Dwugłowe', [], [2, 2, 2, 2, 2, 2], '8–12', 75)),
          exercise('adv_c8a',
            block(1, 'Prostowanie ramion nad głową na wyciągu', 'Triceps', [], [2, 2, 2, 2, 2, 2], '8–12', 90, { superset: 'c8', slot: '8a' }),
            block(7, 'Prostowanie ramion nad głową z hantlem', 'Triceps', [], [2, 2, 2, 2, 2, 2], '8–12', 90, { superset: 'c8', slot: '8a' })),
          exercise('adv_c8b',
            block(1, 'Uginanie ramion na modlitewniku', 'Biceps', [], [2, 2, 2, 2, 2, 2], '8–12', 90, { superset: 'c8', slot: '8b' }),
            block(7, 'Uginanie ramion na modlitewniku', 'Biceps', [], [2, 2, 2, 2, 2, 2], '8–12', 90, { superset: 'c8', slot: '8b' })),
          exercise('adv_c9',
            block(1, 'Wspięcia na palce siedząc', 'Łydki', [], [2, 2, 2, 2, 2, 2], '10–20', 75),
            block(7, 'Wspięcia na palce stojąc', 'Łydki', [], [2, 2, 2, 2, 2, 2], '8–15', 75))
        ]
      }
    ];

    return {
      presetId: PRESET_ID,
      name: 'Zaawansowany 3 dni · 12 tyg.',
      totalWeeks: 12,
      customDays: days,
      weekMeta,
      briefing: {
        summary: 'Poziom zaawansowany, cel masa, 3 dni (wtorek, czwartek, sobota; zamiennie niedziela), 75 min, pełna siłownia, bez urazów. Priorytet: klatka, plecy, barki.',
        split: 'Full body A, B i C. Każda partia trenowana 3 razy w tygodniu. Odstępy: wt–czw 48 h, czw–sob 48 h, sob–wt 72 h. Przy niedzieli zamiast soboty: czw–niedz 72 h, niedz–wt 48 h.',
        structure: 'Tygodnie 1–5 progresja, tydzień 6 deload (mniej serii, RIR 4). Blok 2 (tygodnie 7–12) ma te same ćwiczenia główne i wymienione akcesoria. Tydzień 12 to deload. RIR w tygodniach roboczych obu bloków: 3, 3, 2, 2, 1. Progresja obciążenia: podwójna progresja w zakresie powtórzeń.',
        warmup: '5 min ogólnie, a potem 2 serie rozgrzewkowe raz na wzorzec ruchu (wypychanie, ciągnięcie, przysiad, zawias biodrowy), przed pierwszym ćwiczeniem wielostawowym o tym wzorcu.',
        rests: 'Ćwiczenia ciężkie wielostawowe (przysiad, RDL, wypychanie) 3 min, pozostałe wielostawowe 2 min, izolacje 75 s, superserie 90 s między rundami.',
        warnings: [
          'Objętość jest ograniczona czasem. Pośladki i brzuch są poniżej typowego MEV.',
          'Zapas czasu to ok. 2 minuty w tygodniach szczytowych.',
          'Blok 2 startuje od wyższej objętości niż blok 1 i kończy na tym samym szczycie. Postęp w bloku 2 to głównie ciężar i RIR.'
        ]
      }
    };
  }

  function buildPreset(id) {
    if (id === PRESET_ID) return buildAdvanced3Day12WeekPlan();
    return null;
  }

  root.ForgePlan = {
    MUSCLE_TARGETS,
    PRESET_ID,
    blockForWeek,
    resolveExerciseForWeek,
    exerciseNames,
    directWeeklyVolume,
    restAfterCompletedSet,
    formatRestSeconds,
    minutesForWeek,
    ensureWeekSlots,
    buildAdvanced3Day12WeekPlan,
    buildPreset
  };
})(typeof window !== 'undefined' ? window : globalThis);
