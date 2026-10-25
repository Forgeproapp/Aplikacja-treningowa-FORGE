import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySecondaryFills,
  mapLibraryMuscle,
  proposeSecondaryFills
} from './secondary-from-library.mjs';

const catalog = {
  exercises: [
    { name: 'Ćwiczenie testowe A', synergists: ['triceps', 'delts_front'] },
    { name: 'Ćwiczenie testowe B', synergists: ['glutes'] },
    { name: 'Ćwiczenie testowe C', synergists: ['forearms', 'biceps'] },
    { name: 'Ćwiczenie testowe D', synergists: ['chest', 'mystery_head'] },
    { name: 'Ćwiczenie testowe E', synergists: [] },
    { name: 'Powtórzone', synergists: ['abs'] },
    { name: 'Powtórzone', synergists: ['calves'] }
  ]
};

test('mapuje partie biblioteki na nazwy w aplikacji', () => {
  assert.equal(mapLibraryMuscle('chest'), 'Klatka');
  assert.equal(mapLibraryMuscle('lats'), 'Plecy (szerokość)');
  assert.equal(mapLibraryMuscle('upper_back'), 'Plecy (grubość)');
  assert.equal(mapLibraryMuscle('delts_front'), 'Barki – przód');
  assert.equal(mapLibraryMuscle('delts_side'), 'Barki – bok');
  assert.equal(mapLibraryMuscle('delts_rear'), 'Barki – tył');
  assert.equal(mapLibraryMuscle('biceps'), 'Biceps');
  assert.equal(mapLibraryMuscle('triceps'), 'Triceps');
  assert.equal(mapLibraryMuscle('quads'), 'Czworogłowe');
  assert.equal(mapLibraryMuscle('hamstrings'), 'Dwugłowe');
  assert.equal(mapLibraryMuscle('glutes'), 'Pośladki');
  assert.equal(mapLibraryMuscle('calves'), 'Łydki');
  assert.equal(mapLibraryMuscle('abs'), 'Brzuch');
  assert.equal(mapLibraryMuscle('forearms'), null);
});

test('uzupełnia pustą pomocniczą i pustych agonistów, bez nadpisywania', () => {
  const proposal = proposeSecondaryFills({
    library: [
      { id: 'lib-a', name: 'Ćwiczenie testowe A', secondary: 'Brak' },
      { id: 'lib-b', name: 'Ćwiczenie testowe B', secondary: 'Biceps' },
      { id: 'lib-x', name: 'Ćwiczenie bez wpisu', secondary: '' }
    ],
    plans: [
      {
        id: 'plan-1',
        name: 'Plan fikcyjny',
        customDays: [
          {
            id: 1,
            exercises: [
              {
                id: 'ex-a',
                name: 'Ćwiczenie testowe A',
                secondary: 'Brak',
                agonists: []
              },
              {
                id: 'ex-b',
                blocks: [
                  { fromWeek: 1, name: 'Ćwiczenie testowe B', secondary: 'Biceps', agonists: ['Brzuch'] },
                  { fromWeek: 7, name: 'Ćwiczenie testowe A', secondary: '', agonists: ['Łydki'] }
                ]
              }
            ]
          }
        ]
      }
    ],
    catalog
  });

  assert.equal(proposal.error, null);
  const secondaryA = proposal.changes.find((change) => change.scope === 'library' && change.libraryId === 'lib-a');
  assert.equal(secondaryA.newValue, 'Triceps');
  assert.equal(secondaryA.oldValue, 'Brak');
  assert.equal(proposal.changes.some((change) => change.libraryId === 'lib-b'), false);

  const planSecondary = proposal.changes.find((change) => change.exerciseId === 'ex-a' && change.field === 'secondary');
  const planAgonists = proposal.changes.find((change) => change.exerciseId === 'ex-a' && change.field === 'agonists');
  assert.equal(planSecondary.newValue, 'Triceps');
  assert.deepEqual(planAgonists.newValue, ['Triceps', 'Barki – przód']);
  assert.equal(planAgonists.newLabel, 'Triceps, Barki – przód');

  assert.equal(proposal.changes.some((change) => change.exerciseId === 'ex-b' && change.blockIndex === 0), false);
  const blockAgonists = proposal.changes.find((change) => change.exerciseId === 'ex-b' && change.field === 'agonists');
  assert.equal(blockAgonists, undefined);
  const blockSecondary = proposal.changes.find((change) => change.exerciseId === 'ex-b' && change.blockIndex === 1 && change.field === 'secondary');
  assert.equal(blockSecondary.newValue, 'Triceps');

  assert.equal(proposal.unmatched.some((row) => row.name === 'Ćwiczenie bez wpisu' && row.place === 'Biblioteka'), true);
  assert.equal(proposal.unmatched.some((row) => row.name === 'Ćwiczenie testowe'), false);
});

test('nie zgaduje nieznanej partii i nie bierze zdublowanej nazwy', () => {
  const proposal = proposeSecondaryFills({
    library: [
      { id: 'c', name: 'Ćwiczenie testowe C', secondary: 'Brak' },
      { id: 'd', name: 'Ćwiczenie testowe D', secondary: 'Brak' },
      { id: 'e', name: 'Ćwiczenie testowe E', secondary: 'Brak' },
      { id: 'p', name: 'Powtórzone', secondary: 'Brak' }
    ],
    plans: [
      {
        id: 'plan-2',
        name: 'Plan drugi',
        customDays: [
          {
            id: 2,
            exercises: [
              { id: 'ex-c', name: 'Ćwiczenie testowe C', secondary: 'Klatka', agonists: [] },
              { id: 'ex-d', name: 'Ćwiczenie testowe D', secondary: 'Brak', agonists: [] }
            ]
          }
        ]
      }
    ],
    catalog
  });

  assert.equal(proposal.changes.some((change) => change.exerciseName === 'Ćwiczenie testowe C'), false);
  assert.equal(proposal.blocked.some((row) => row.name === 'Ćwiczenie testowe C' && row.reason.includes('forearms')), true);

  const knownFirst = proposal.changes.find((change) => change.scope === 'library' && change.exerciseName === 'Ćwiczenie testowe D');
  assert.equal(knownFirst.newValue, 'Klatka');
  assert.equal(proposal.changes.some((change) => change.exerciseId === 'ex-d' && change.field === 'agonists'), false);
  assert.equal(proposal.blocked.some((row) => row.name === 'Ćwiczenie testowe D' && row.field === 'Agoniści (opis)' && row.reason.includes('mystery_head')), true);

  assert.equal(proposal.blocked.some((row) => row.name === 'Ćwiczenie testowe E'), true);
  assert.equal(proposal.unmatched.some((row) => row.name === 'Powtórzone'), true);
  assert.equal(proposal.changes.some((change) => change.exerciseName === 'Powtórzone'), false);
});

test('zapis nie nadpisuje wartości wpisanej między podglądem a potwierdzeniem', () => {
  const proposal = proposeSecondaryFills({
    library: [{ id: 'lib-a', name: 'Ćwiczenie testowe A', secondary: 'Brak' }],
    plans: [
      {
        id: 'plan-1',
        name: 'Plan fikcyjny',
        customDays: [
          {
            id: 1,
            exercises: [
              { id: 'ex-a', name: 'Ćwiczenie testowe A', secondary: 'Brak', agonists: [] }
            ]
          }
        ]
      }
    ],
    catalog
  });

  const libraryNow = [{ id: 'lib-a', name: 'Ćwiczenie testowe A', secondary: 'Biceps' }];
  const plansNow = [
    {
      id: 'plan-1',
      name: 'Plan fikcyjny',
      customDays: [
        {
          id: 1,
          exercises: [
            { id: 'ex-a', name: 'Ćwiczenie testowe A', secondary: 'Brak', agonists: ['Pośladki'] }
          ]
        }
      ]
    }
  ];
  const result = applySecondaryFills(libraryNow, plansNow, proposal.changes);
  assert.equal(result.library[0].secondary, 'Biceps');
  assert.equal(result.library[0].agonists, undefined);
  assert.equal(result.plans[0].customDays[0].exercises[0].secondary, 'Triceps');
  assert.deepEqual(result.plans[0].customDays[0].exercises[0].agonists, ['Pośladki']);
  assert.equal(result.applied.length, 1);
  assert.equal(result.skipped.length, 2);
});
