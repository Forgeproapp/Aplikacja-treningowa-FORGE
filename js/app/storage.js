// Forge Pro – Wake lock, zapis/odczyt stanu, meta tygodni, postęp dni

let wakeLock = null;
async function acquireWakeLock(){
  if('wakeLock' in navigator){
    try {
      if(!wakeLock || wakeLock.released){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch(err){}
  }
}

window.addEventListener('load', acquireWakeLock);
window.addEventListener('touchstart', acquireWakeLock, { passive: true });
window.addEventListener('click', acquireWakeLock, { passive: true });

function applyNewState(newState){
  if(!newState) return;
  Object.keys(newState).forEach(key => {
    window.state[key] = newState[key];
  });

  state = window.state;
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  ensureAllExercisesWeeks();
  saveStateLocalOnly();
  render();
  noteRemoteHistory();
}
window.applyNewState = applyNewState;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const loaded = JSON.parse(raw);
      applyNewState(loaded);
    }
  }catch(e){}
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  ensureAllExercisesWeeks();
  render();
  if(lastHistoryFingerprint === null) lastHistoryFingerprint = historyFingerprint();
}

function saveState(markUpdated = true, immediate = false){
  if(markUpdated){
    window.state.editSeq = (Number(window.state.editSeq) || 0) + 1;
    window.state.lastUpdatedAt = new Date().toISOString();
    window.state.pendingCloudSync = true;
  }
  syncCurrentPlanToSaved();
  clearTimeout(saveTimer);
  if(immediate){
    doSave();
  } else {
    saveTimer = setTimeout(() => doSave(), 300);
  }
}

function flushPendingSave(){
  if(!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  doSave();
}

function saveStateLocalOnly(){
  try{
    syncCurrentPlanToSaved();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.state));
  }catch(e){}
}

function doSave(){
  try{
    saveStateLocalOnly();
    if(typeof window.syncStateToCloud === 'function'){
      window.syncStateToCloud();
    }
    noteRemoteHistory();
  }catch(e){
    console.error('Save failed:', e);
    showToast('⚠ Błąd zapisu danych');
  }
}

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden'){
    flushPendingSave();
  } else if(document.visibilityState === 'visible'){
    acquireWakeLock();
    if(timerInterval && !isTimerPaused){
      tickTimer();
    }
  }
});
window.addEventListener('pagehide', flushPendingSave);
window.addEventListener('beforeunload', flushPendingSave);

function getWeekMeta(w){
  if(state.weekMeta && state.weekMeta[w]){
    return state.weekMeta[w];
  }
  if(DEFAULT_WEEK_META[w]) return DEFAULT_WEEK_META[w];
  return { rir: Math.max(0, 4 - (w % 4)), rest: 120, restText: '2 min', label: `Tydzień ${w}` };
}

function formatRestSecondsToText(secs){
  const m = secs / 60;
  return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1).replace('.', ',')} min`;
}

function updateWeekMeta(weekNum, field, value){
  if(!state.weekMeta) state.weekMeta = {};
  if(!state.weekMeta[weekNum]){
    state.weekMeta[weekNum] = Object.assign({}, getWeekMeta(weekNum));
  }
  const meta = state.weekMeta[weekNum];

  if(field === 'rir'){
    meta.rir = parseInt(value, 10);
  } else if(field === 'rest'){
    meta.rest = parseInt(value, 10);
    meta.restText = formatRestSecondsToText(meta.rest);
  }
  meta.label = `Tydzień ${weekNum}`;

  saveState();
}

function ensureExerciseWeeks(ex){
  ForgePlan.ensureWeekSlots(ex, Math.max(state.totalWeeks || 6, 1));
}

function writeExerciseWeekField(ex, week, field, value){
  const block = ForgePlan.blockForWeek(ex, week);
  if(field === 'sets'){
    const bucket = block || ex;
    if(!bucket.setsByWeek) bucket.setsByWeek = {};
    bucket.setsByWeek[week] = value;
    if(!block && week === 1) ex.sets = value;
    return;
  }
  if(field === 'reps'){
    const bucket = block || ex;
    if(!bucket.repsByWeek) bucket.repsByWeek = {};
    bucket.repsByWeek[week] = value;
    if(!block && week === 1) ex.reps = value;
    return;
  }
  if(field === 'weight'){
    if(!ex.weightsByWeek) ex.weightsByWeek = {};
    ex.weightsByWeek[week] = value;
    if(week === 1) ex.weight = value;
    return;
  }
  const bucket = block || ex;
  if(field === 'agonists'){
    bucket.agonists = String(value || '').split(',').map(part => part.trim()).filter(Boolean);
    return;
  }
  if(field === 'restSec'){
    const parsed = parseInt(value, 10);
    bucket.restSec = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    return;
  }
  bucket[field] = value;
}

function ensureAllExercisesWeeks(){
  if(!state.customDays) return;
  state.customDays.forEach(day => {
    (day.exercises || []).forEach(ex => ensureExerciseWeeks(ex));
  });
}

function getPlanForWeek(w){
  ensureAllExercisesWeeks();
  const plan = {};
  state.customDays.forEach(day => {
    plan[day.id] = {
      name: day.name,
      focus: day.focus,
      exercises: day.exercises.map(ex => {
        const view = ForgePlan.resolveExerciseForWeek(ex, w);
        return {
          id: `w${w}_${ex.id}`,
          rawId: ex.id,
          name: view.name,
          target: view.target || 'Inne',
          secondary: view.secondary || 'Brak',
          agonists: view.agonists || [],
          sets: view.sets,
          weight: view.weight,
          reps: view.reps,
          note: view.note || '',
          restSec: view.restSec,
          superset: view.superset || '',
          supersetSlot: view.supersetSlot || ''
        };
      })
    };
  });
  return plan;
}

function getProgressKey(week, day){ return `w${week}d${day}`; }

function getDayProgress(week, day){
  const key = getProgressKey(week, day);
  if(!state.progress[key]){
    state.progress[key] = { setsDone: {}, weights: {}, reps: {}, completed: false, date: null };
  }
  return state.progress[key];
}

function isDayComplete(week, day){
  return !!state.progress[getProgressKey(week,day)]?.completed;
}

function countCompletedSets(week, day){
  const prog = state.progress[getProgressKey(week,day)];
  if(!prog) return 0;
  let total = 0;
  Object.values(prog.setsDone).forEach(arr => { total += arr.filter(Boolean).length; });
  return total;
}

function totalSetsForDay(week, day){
  const dayPlan = getPlanForWeek(week)[day];
  if(!dayPlan) return 0;
  let total = 0;
  dayPlan.exercises.forEach(ex => { total += ex.sets; });
  return total;
}

function findLastExercisePerformance(exerciseName){
  for(const record of state.history){
    const match = record.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    if(match && match.weights && match.weights.length > 0){
      const validSets = [];
      let firstWeight = null;
      let firstReps = null;
      for(let i=0; i<match.weights.length; i++){
        if(match.weights[i] && match.reps[i]){
          validSets.push(`${match.weights[i]}kg×${match.reps[i]}`);
          if(firstWeight === null){
            firstWeight = match.weights[i];
            firstReps = match.reps[i];
          }
        }
      }
      if(validSets.length > 0){
        return {
          date: record.date,
          week: record.week,
          summary: validSets.join(' | '),
          firstWeight: firstWeight,
          firstReps: firstReps
        };
      }
    }
  }
  return null;
}

function calculateSessionTonnage(prog, dayPlan){
  let tonnage = 0;
  dayPlan.exercises.forEach(ex => {
    const wArr = prog.weights[ex.id] || [];
    const rArr = prog.reps[ex.id] || [];
    const dArr = prog.setsDone[ex.id] || [];
    for(let i=0; i<ex.sets; i++){
      if(dArr[i]){
        const w = parseFloat(wArr[i]) || 0;
        const r = parseFloat(rArr[i]) || 0;
        tonnage += (w * r);
      }
    }
  });
  return Math.round(tonnage);
}

function estimate1RM(weight, reps){
  const w = parseFloat(weight) || 0;
  const r = parseFloat(reps) || 0;
  if(w <= 0 || r <= 0) return 0;
  if(r === 1) return w;
  return Math.round(w * (1 + r / 30));
}
