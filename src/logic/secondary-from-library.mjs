const MUSCLE_BY_LIBRARY_ID = {
  chest: 'Klatka',
  lats: 'Plecy (szerokość)',
  upper_back: 'Plecy (grubość)',
  delts_front: 'Barki – przód',
  delts_side: 'Barki – bok',
  delts_rear: 'Barki – tył',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Czworogłowe',
  hamstrings: 'Dwugłowe',
  glutes: 'Pośladki',
  calves: 'Łydki',
  abs: 'Brzuch'
};

function mapLibraryMuscle(id) {
  if (typeof id !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(MUSCLE_BY_LIBRARY_ID, id)) return null;
  return MUSCLE_BY_LIBRARY_ID[id];
}

function isBlankSecondary(value) {
  if (value == null) return true;
  const text = String(value).trim();
  return text === '' || text === 'Brak';
}

function isBlankAgonists(value) {
  if (value == null) return true;
  if (Array.isArray(value)) {
    return value.every((part) => String(part || '').trim() === '');
  }
  return String(value).trim() === '';
}

function displaySecondary(value) {
  return isBlankSecondary(value) ? 'Brak' : String(value).trim();
}

function displayAgonists(value) {
  if (isBlankAgonists(value)) return 'puste';
  if (Array.isArray(value)) return value.map((part) => String(part).trim()).filter(Boolean).join(', ');
  return String(value).trim();
}

function catalogEntries(catalog) {
  if (Array.isArray(catalog)) return { entries: catalog };
  if (catalog && Array.isArray(catalog.exercises)) return { entries: catalog.exercises };
  return { error: 'Biblioteka startowa ma nieznany układ.' };
}

function indexCatalog(entries) {
  const byName = new Map();
  const duplicates = new Set();
  entries.forEach((entry) => {
    const name = entry && typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) return;
    if (byName.has(name)) duplicates.add(name);
    else byName.set(name, entry);
  });
  return { byName, duplicates };
}

function slotsOf(exercise) {
  if (exercise && Array.isArray(exercise.blocks) && exercise.blocks.length) {
    return exercise.blocks.map((block, blockIndex) => ({
      name: (block && block.name) || exercise.name || '',
      secondary: block ? block.secondary : undefined,
      agonists: block ? block.agonists : undefined,
      blockIndex
    }));
  }
  return [{
    name: (exercise && exercise.name) || '',
    secondary: exercise ? exercise.secondary : undefined,
    agonists: exercise ? exercise.agonists : undefined,
    blockIndex: null
  }];
}

function readSynergists(entry) {
  const raw = entry && Array.isArray(entry.synergists) ? entry.synergists : [];
  const names = [];
  const unknown = [];
  raw.forEach((id) => {
    const mapped = mapLibraryMuscle(id);
    if (!mapped) unknown.push(typeof id === 'string' ? id : String(id));
    else names.push(mapped);
  });
  return {
    names,
    unknown,
    firstMapped: raw.length ? mapLibraryMuscle(raw[0]) : null
  };
}

function proposeForName(entry, duplicates, name) {
  const key = String(name || '').trim();
  if (!key || !entry) return { status: 'unmatched', name: key || '(bez nazwy)' };
  if (duplicates.has(key)) return { status: 'unmatched', name: key, reason: 'Kilka wpisów o tej samej nazwie w bibliotece startowej' };
  return { status: 'match', name: key, synergists: readSynergists(entry) };
}

function proposeSecondaryFills({ library, plans, catalog }) {
  const parsed = catalogEntries(catalog);
  if (parsed.error) {
    return { error: parsed.error, changes: [], unmatched: [], blocked: [] };
  }
  const { byName, duplicates } = indexCatalog(parsed.entries);
  const changes = [];
  const unmatched = [];
  const blocked = [];

  function consider(name, place, fields, target) {
    const key = String(name || '').trim();
    const entry = byName.get(key);
    const found = proposeForName(entry, duplicates, key);
    if (found.status === 'unmatched') {
      unmatched.push({ name: found.name, place, reason: found.reason || 'Brak dokładnej nazwy w bibliotece startowej' });
      return;
    }
    const { names, unknown, firstMapped } = found.synergists;
    const wantsSecondary = fields.secondary && isBlankSecondary(fields.secondaryValue);
    const wantsAgonists = fields.agonists && isBlankAgonists(fields.agonistsValue);

    if (wantsSecondary) {
      if (!names.length && !unknown.length) {
        blocked.push({ name: key, place, field: 'Pomocnicza (0.5)', reason: 'Biblioteka startowa nie podaje agonistów' });
      } else if (!firstMapped) {
        blocked.push({ name: key, place, field: 'Pomocnicza (0.5)', reason: 'Nieznana partia: ' + (unknown[0] || 'brak') });
      } else {
        changes.push({
          ...target,
          place,
          exerciseName: key,
          field: 'secondary',
          fieldLabel: 'Pomocnicza (0.5)',
          oldValue: displaySecondary(fields.secondaryValue),
          newValue: firstMapped,
          newLabel: firstMapped
        });
      }
    }

    if (wantsAgonists) {
      if (!names.length && !unknown.length) {
        blocked.push({ name: key, place, field: 'Agoniści (opis)', reason: 'Biblioteka startowa nie podaje agonistów' });
      } else if (unknown.length) {
        blocked.push({ name: key, place, field: 'Agoniści (opis)', reason: 'Nieznana partia: ' + unknown.join(', ') });
      } else {
        changes.push({
          ...target,
          place,
          exerciseName: key,
          field: 'agonists',
          fieldLabel: 'Agoniści (opis)',
          oldValue: displayAgonists(fields.agonistsValue),
          newValue: names.slice(),
          newLabel: names.join(', ')
        });
      }
    }
  }

  (library || []).forEach((item) => {
    consider(item && item.name, 'Biblioteka', {
      secondary: true,
      secondaryValue: item && item.secondary,
      agonists: false
    }, {
      scope: 'library',
      libraryId: item && item.id
    });
  });

  (plans || []).forEach((plan) => {
    const planName = (plan && plan.name) || 'Plan';
    (plan && plan.customDays || []).forEach((day) => {
      (day.exercises || []).forEach((exercise) => {
        slotsOf(exercise).forEach((slot) => {
          consider(slot.name, planName, {
            secondary: true,
            secondaryValue: slot.secondary,
            agonists: true,
            agonistsValue: slot.agonists
          }, {
            scope: 'plan',
            planId: plan.id,
            dayId: day.id,
            exerciseId: exercise.id,
            blockIndex: slot.blockIndex
          });
        });
      });
    });
  });

  return { error: null, changes, unmatched, blocked };
}

function applySecondaryFills(library, plans, changes) {
  const nextLibrary = (library || []).map((item) => ({ ...item }));
  const nextPlans = JSON.parse(JSON.stringify(plans || []));
  const applied = [];
  const skipped = [];

  (changes || []).forEach((change) => {
    if (change.scope === 'library' && change.field === 'secondary') {
      const item = nextLibrary.find((entry) => entry.id === change.libraryId);
      if (!item || !isBlankSecondary(item.secondary)) {
        skipped.push(change);
        return;
      }
      item.secondary = change.newValue;
      applied.push(change);
      return;
    }

    if (change.scope !== 'plan') {
      skipped.push(change);
      return;
    }

    const plan = nextPlans.find((entry) => entry.id === change.planId);
    const day = plan && (plan.customDays || []).find((entry) => entry.id === change.dayId);
    const exercise = day && (day.exercises || []).find((entry) => entry.id === change.exerciseId);
    const bucket = exercise && (change.blockIndex == null ? exercise : (exercise.blocks || [])[change.blockIndex]);
    if (!bucket) {
      skipped.push(change);
      return;
    }

    if (change.field === 'secondary') {
      if (!isBlankSecondary(bucket.secondary)) {
        skipped.push(change);
        return;
      }
      bucket.secondary = change.newValue;
      applied.push(change);
      return;
    }

    if (change.field === 'agonists') {
      if (!isBlankAgonists(bucket.agonists)) {
        skipped.push(change);
        return;
      }
      bucket.agonists = Array.isArray(change.newValue) ? change.newValue.slice() : [];
      applied.push(change);
      return;
    }

    skipped.push(change);
  });

  return { library: nextLibrary, plans: nextPlans, applied, skipped };
}

export {
  MUSCLE_BY_LIBRARY_ID,
  mapLibraryMuscle,
  proposeSecondaryFills,
  applySecondaryFills,
  isBlankSecondary,
  isBlankAgonists
};
