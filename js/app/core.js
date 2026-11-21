// Forge Pro – Stałe, stan aplikacji, dotyk, dźwięk timera, PWA, podstawy planów

const MUSCLE_TARGETS = window.ForgePlan.MUSCLE_TARGETS;

const DEFAULT_PLAN_NAME = 'Plan początkowy';

const DEFAULT_DAYS = [
  {
    id: 1, name: 'Trening 1', focus: 'Plecy / Barki',
    exercises: [
      { id: 'ex_1_0', name:'Bench Press', target:'Klatka', secondary:'Triceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_1_1', name:'Seated Cable Row', target:'Plecy', secondary:'Biceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_1_2', name:'OHP', target:'Barki', secondary:'Triceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_1_3', name:'Chest Supported Row', target:'Plecy', secondary:'Biceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_1_4', name:'Lateral Raises', target:'Barki', secondary:'Brak', sets:3, weight:'', reps:'10', note:'' },
    ]
  },
  {
    id: 2, name: 'Trening 2', focus: 'Nogi',
    exercises: [
      { id: 'ex_2_0', name:'Squat', target:'Czworogłowe', secondary:'Pośladki', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_2_1', name:'RDL', target:'Dwugłowe', secondary:'Plecy', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_2_2', name:'Leg Extension', target:'Czworogłowe', secondary:'Brak', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_2_3', name:'Leg Curl', target:'Dwugłowe', secondary:'Brak', sets:3, weight:'', reps:'10', note:'' },
    ]
  },
  {
    id: 3, name: 'Trening 3', focus: 'Klatka / Plecy górne',
    exercises: [
      { id: 'ex_3_0', name:'Incline Bench Press', target:'Klatka', secondary:'Triceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_3_1', name:'Pullup', target:'Plecy', secondary:'Biceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_3_2', name:'Shoulder Press', target:'Barki', secondary:'Triceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_3_3', name:'Dip', target:'Klatka', secondary:'Triceps', sets:3, weight:'', reps:'10', note:'' },
      { id: 'ex_3_4', name:'Lateral Raises', target:'Barki', secondary:'Brak', sets:3, weight:'', reps:'10', note:'' },
    ]
  }
];

const DEFAULT_WEEK_META = {
  1: { rir: 3, rest: 90, restText: '1,5 min', label: 'Tydzień 1' },
  2: { rir: 2, rest: 120, restText: '2 min', label: 'Tydzień 2' },
  3: { rir: 1, rest: 150, restText: '2,5 min', label: 'Tydzień 3' },
  4: { rir: 1, rest: 150, restText: '2,5 min', label: 'Tydzień 4' },
  5: { rir: 0, rest: 180, restText: '3 min', label: 'Tydzień 5' },
  6: { rir: 4, rest: 90, restText: '1,5 min', label: 'Tydzień 6' },
};

window.state = {
  totalWeeks: 6,
  currentWeek: 1,
  editorWeek: 1,
  customDays: JSON.parse(JSON.stringify(DEFAULT_DAYS)),
  weekMeta: JSON.parse(JSON.stringify(DEFAULT_WEEK_META)),
  progress: {}, 
  history: [], 
  bodyLog: [],
  lastUpdatedAt: null,
  savedPlans: [],
  currentPlanId: null,
  exerciseLibrary: [],
  workoutLibrary: null
};

let state = window.state;
let lastHistoryFingerprint = null;
let activeSession = null;
const STORAGE_KEY = 'forge_pro_state_v4';
let saveTimer = null;

let draggedDayIndex = null;
let draggedEx = null;
let touchDragState = null;
let deferredPwaPrompt = null;
let pendingCompleteExit = null;
let activeTouchRegistry = new Map();

window.addEventListener('touchstart', (e) => {
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    activeTouchRegistry.set(t.identifier, { x: t.clientX, y: t.clientY });
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    activeTouchRegistry.set(t.identifier, { x: t.clientX, y: t.clientY });
  }
}, { passive: true });

function releaseTouchFromRegistry(e){
  const activeIds = new Set(Array.from(e.touches).map(t => t.identifier));
  Array.from(activeTouchRegistry.keys()).forEach(id => {
    if (!activeIds.has(id)) activeTouchRegistry.delete(id);
  });
}
window.addEventListener('touchend', releaseTouchFromRegistry, { passive: true });
window.addEventListener('touchcancel', releaseTouchFromRegistry, { passive: true });

let audioCtx = null;
function playTimerBeep(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(740, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([250, 100, 250]);
}

function isAppStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function handlePwaInstallClick(){
  if(deferredPwaPrompt){
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then(() => {
      deferredPwaPrompt = null;
    });
  } else {
    showToast('Wybierz "Dodaj do ekranu głównego" w menu przeglądarki');
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const btn = document.getElementById('pwaInstallBtn');
  if(btn) btn.style.display = 'none';
  showToast('Forge Pro zainstalowane pomyślnie! ⚒️');
});

function getCurrentPlanName(){
  if(state.savedPlans && state.savedPlans.length > 0){
    const cur = state.savedPlans.find(p => p.id === state.currentPlanId);
    if(cur && cur.name) return cur.name;
    if(state.savedPlans[0] && state.savedPlans[0].name) return state.savedPlans[0].name;
  }
  return DEFAULT_PLAN_NAME;
}

function ensurePlansInitialized(){
  if(!state.savedPlans || !Array.isArray(state.savedPlans) || state.savedPlans.length === 0){
    const initPlan = {
      id: 'plan_' + Date.now(),
      name: DEFAULT_PLAN_NAME,
      totalWeeks: state.totalWeeks || 6,
      customDays: JSON.parse(JSON.stringify(state.customDays || DEFAULT_DAYS)),
      weekMeta: JSON.parse(JSON.stringify(state.weekMeta || DEFAULT_WEEK_META)),
      progress: JSON.parse(JSON.stringify(state.progress || {}))
    };
    state.savedPlans = [initPlan];
    state.currentPlanId = initPlan.id;
  }
  if(!state.currentPlanId && state.savedPlans.length > 0){
    state.currentPlanId = state.savedPlans[0].id;
  }
}

function ensureExerciseLibraryInitialized(){
  if(!state.exerciseLibrary || !Array.isArray(state.exerciseLibrary)){
    state.exerciseLibrary = [];
  }
  if(state.exerciseLibrary.length === 0){
    const seen = new Set();
    const seeded = [];
    DEFAULT_DAYS.forEach(day => {
      (day.exercises || []).forEach(ex => {
        const key = ex.name.trim().toLowerCase();
        if(!seen.has(key)){
          seen.add(key);
          seeded.push({
            id: 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            name: ex.name,
            target: ex.target,
            secondary: ex.secondary || 'Brak'
          });
        }
      });
    });
    state.exerciseLibrary = seeded;
  }
}

function ensureWorkoutLibraryInitialized(){
  if(Array.isArray(state.workoutLibrary)) return;
  state.workoutLibrary = DEFAULT_DAYS.map(day => ({
    id: 'wlib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: day.name,
    exercises: JSON.parse(JSON.stringify(day.exercises || []))
  }));
}

function syncCurrentPlanToSaved(){
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  const cur = state.savedPlans.find(p => p.id === state.currentPlanId);
  if(cur){
    cur.totalWeeks = state.totalWeeks;
    cur.customDays = JSON.parse(JSON.stringify(state.customDays));
    cur.weekMeta = JSON.parse(JSON.stringify(state.weekMeta));
    cur.progress = JSON.parse(JSON.stringify(state.progress));
    cur.briefing = state.briefing || null;
  }
}

let isEditingPlanName = false;

function toggleEditPlanName(){
  const select = document.getElementById('editorPlansSelect');
  const input = document.getElementById('editorCurrentPlanNameInput');
  const btn = document.getElementById('btnToggleEditPlanName');
  if(!input || !btn || !select) return;

  if(!isEditingPlanName){
    isEditingPlanName = true;
    const cur = state.savedPlans.find(p => p.id === state.currentPlanId) || state.savedPlans[0];
    input.value = cur ? cur.name : '';
    select.style.display = 'none';
    input.style.display = 'block';
    input.focus();
    input.select();
    btn.innerHTML = '✓';
    btn.classList.add('primary');
    btn.title = 'Zapisz nazwę';
  } else {
    const newName = input.value.trim();
    if(newName){
      renameCurrentPlan(newName);
    }
    isEditingPlanName = false;
    input.style.display = 'none';
    select.style.display = 'block';
    btn.innerHTML = '✏️';
    btn.classList.remove('primary');
    btn.title = 'Zmień nazwę planu';
  }
}

function switchActivePlan(planId){
  isEditingPlanName = false;
  syncCurrentPlanToSaved();
  const target = state.savedPlans.find(p => p.id === planId);
  if(!target) return;

  state.currentPlanId = target.id;
  state.totalWeeks = target.totalWeeks || 6;
  state.customDays = JSON.parse(JSON.stringify(target.customDays || []));
  state.weekMeta = JSON.parse(JSON.stringify(target.weekMeta || DEFAULT_WEEK_META));
  state.progress = JSON.parse(JSON.stringify(target.progress || {}));
  state.briefing = target.briefing || null;
  state.currentWeek = 1;
  state.editorWeek = 1;

  ensureAllExercisesWeeks();
  saveState();
  render();
  showToast(`Aktywny plan: ${target.name} ⚒️`);
}

function renameCurrentPlan(newName){
  if(!newName || !newName.trim()) return;
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  const cur = state.savedPlans.find(p => p.id === state.currentPlanId);
  if(cur){
    cur.name = newName.trim();
    saveState();
    renderEditor();
    showToast(`Zmieniono nazwę: "${cur.name}" ✓`);
  }
}

function duplicateCurrentPlan(){
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  syncCurrentPlanToSaved();
  const cur = state.savedPlans.find(p => p.id === state.currentPlanId);
  if(!cur) return;

  const newId = 'plan_' + Date.now();
  const duplicate = {
    id: newId,
    name: cur.name + ' (Kopia)',
    totalWeeks: cur.totalWeeks,
    customDays: JSON.parse(JSON.stringify(cur.customDays)),
    weekMeta: JSON.parse(JSON.stringify(cur.weekMeta)),
    briefing: cur.briefing ? JSON.parse(JSON.stringify(cur.briefing)) : null,
    progress: {}
  };
  state.savedPlans.push(duplicate);
  switchActivePlan(newId);
  showToast(`Sklonowano plan jako "${duplicate.name}"!`);
}
