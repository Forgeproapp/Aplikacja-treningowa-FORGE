// Forge Pro – Udostępnianie/import planów, zarządzanie planami, kopiowanie tygodni

// ===== UDOSTĘPNIANIE PLANÓW PRZEZ LINK =====

function encodePlanForShare(plan){
  const shareObj = {
    name: plan.name,
    totalWeeks: plan.totalWeeks,
    customDays: plan.customDays,
    weekMeta: plan.weekMeta,
    briefing: plan.briefing || null
  };
  const json = JSON.stringify(shareObj);
  const utf8Bytes = new TextEncoder().encode(json);
  let binary = '';
  utf8Bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePlanFromShare(b64){
  try {
    let str = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json);
    if(!obj || !obj.name || !Array.isArray(obj.customDays)) return null;
    return obj;
  } catch(err){
    return null;
  }
}

function buildPlanShareUrl(plan){
  const encoded = encodePlanForShare(plan);
  const base = location.origin + location.pathname;
  return `${base}#importPlan=${encoded}`;
}

function buildShortPlanShareUrl(code){
  return location.origin + location.pathname + '?p=' + code;
}

function planToShareObject(plan){
  return {
    name: plan.name,
    totalWeeks: plan.totalWeeks,
    customDays: plan.customDays,
    weekMeta: plan.weekMeta,
    briefing: plan.briefing || null
  };
}

let shareInFlight = false;

async function shareCurrentPlan(){
  if(shareInFlight) return;
  ensurePlansInitialized();
  syncCurrentPlanToSaved();
  const plan = state.savedPlans.find(p => p.id === state.currentPlanId);
  if(!plan){
    showToast('Nie znaleziono planu do udostępnienia');
    return;
  }
  if(!plan.customDays || plan.customDays.length === 0){
    showToast('Dodaj przynajmniej jeden trening przed udostępnieniem');
    return;
  }

  shareInFlight = true;
  let url;
  try {
    showToast('Tworzę krótki link…');
    if(typeof window.saveSharedPlan !== 'function') throw new Error('brak chmury');
    const code = await window.saveSharedPlan(planToShareObject(plan));
    url = buildShortPlanShareUrl(code);
  } catch(err){
    url = buildPlanShareUrl(plan);
  }

  try {
    if(navigator.share){
      try {
        await navigator.share({
          title: `Plan Kuźni: ${plan.name}`,
          text: `Zobacz mój plan treningowy "${plan.name}" z Forge Pro ⚒️`,
          url: url
        });
        return;
      } catch(err){
        if(err && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast(url.includes('?p=') ? 'Krótki link skopiowany! 🔗' : 'Chmura niedostępna — skopiowano dłuższy link');
    } catch(err){
      openShareLinkFallbackModal(url);
    }
  } finally {
    shareInFlight = false;
  }
}

function openShareLinkFallbackModal(url){
  const input = document.getElementById('shareLinkFallbackInput');
  if(input) input.value = url;
  const modal = document.getElementById('shareLinkFallbackModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeShareLinkFallbackModal(){
  const modal = document.getElementById('shareLinkFallbackModalOverlay');
  if(modal) modal.classList.remove('open');
}

function copyShareLinkFallback(){
  const input = document.getElementById('shareLinkFallbackInput');
  if(!input) return;
  input.select();
  input.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    showToast('Link skopiowany! 🔗');
  } catch(err){
    showToast('Zaznacz i skopiuj link ręcznie');
  }
}

let pendingImportPlan = null;

function presentImportedPlan(decoded){
  pendingImportPlan = decoded;
  const nameEl = document.getElementById('importPlanName');
  if(nameEl) nameEl.textContent = decoded.name;
  const metaEl = document.getElementById('importPlanMeta');
  if(metaEl){
    const dayCount = (decoded.customDays || []).length;
    const exCount = (decoded.customDays || []).reduce((sum, d) => sum + (d.exercises || []).length, 0);
    const weeks = decoded.totalWeeks || 6;
    const counts = `${dayCount} ${dayCount === 1 ? 'trening' : 'treningów'} · ${exCount} ${exCount === 1 ? 'ćwiczenie' : 'ćwiczeń'} · ${weeks} tyg. planu`;
    const summary = decoded.briefing && decoded.briefing.summary ? `<span style="display:block; margin-top:6px;">${escapeHtml(decoded.briefing.summary)}</span>` : '';
    metaEl.innerHTML = counts + summary;
  }
  const modal = document.getElementById('importPlanModalOverlay');
  if(modal) modal.classList.add('open');
}

function takePresetFromLocation(){
  const params = new URLSearchParams(location.search);
  let presetId = params.get('plan');
  let source = presetId ? 'query' : '';
  if(!presetId){
    const hashPlan = (location.hash || '').match(/^#plan=([^&]+)/);
    if(hashPlan){
      presetId = decodeURIComponent(hashPlan[1]);
      source = 'hash';
    }
  }
  if(!presetId || !window.ForgePlan) return false;
  const decoded = window.ForgePlan.buildPreset(presetId);
  if(source === 'query'){
    params.delete('plan');
    const search = params.toString();
    history.replaceState(null, '', location.pathname + (search ? '?' + search : '') + location.hash);
  } else {
    history.replaceState(null, '', location.pathname + location.search);
  }
  if(!decoded){
    showToast('Nie znam takiego planu w linku ⚠️');
    return true;
  }
  presentImportedPlan(decoded);
  return true;
}

function checkForImportedPlanInUrl(){
  if(takePresetFromLocation()) return;
  const hash = location.hash || '';
  const match = hash.match(/importPlan=([^&]+)/);
  if(!match) return;

  const decoded = decodePlanFromShare(match[1]);
  history.replaceState(null, '', location.pathname + location.search);

  if(!decoded){
    showToast('Nieprawidłowy lub uszkodzony link do planu ⚠️');
    return;
  }

  presentImportedPlan(decoded);
}

let sharedPlanConsumeStarted = false;

window.consumeSharedPlanFromUrl = async function(){
  if(sharedPlanConsumeStarted) return;
  const params = new URLSearchParams(location.search);
  const code = params.get('p');
  if(!code || typeof window.loadSharedPlan !== 'function') return;
  sharedPlanConsumeStarted = true;
  try {
    const decoded = await window.loadSharedPlan(code);
    const url = new URL(location.href);
    url.searchParams.delete('p');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    if(!decoded){
      showToast('Nie znaleziono planu pod tym linkiem ⚠️');
      return;
    }
    presentImportedPlan(decoded);
  } catch(err){
    sharedPlanConsumeStarted = false;
    showToast('Nie udało się pobrać planu. Sprawdź połączenie i odśwież stronę.');
  }
};

function dismissImportPlan(){
  pendingImportPlan = null;
  const modal = document.getElementById('importPlanModalOverlay');
  if(modal) modal.classList.remove('open');
}

function confirmImportPlan(){
  if(!pendingImportPlan) return;
  ensurePlansInitialized();

  const newId = 'plan_' + Date.now();
  const imported = {
    id: newId,
    name: pendingImportPlan.name,
    totalWeeks: pendingImportPlan.totalWeeks || 6,
    customDays: JSON.parse(JSON.stringify(pendingImportPlan.customDays || [])),
    weekMeta: JSON.parse(JSON.stringify(pendingImportPlan.weekMeta || DEFAULT_WEEK_META)),
    briefing: pendingImportPlan.briefing ? JSON.parse(JSON.stringify(pendingImportPlan.briefing)) : null,
    progress: {}
  };
  imported.customDays.forEach(day => {
    (day.exercises || []).forEach(ex => { ensureExerciseWeeks(ex); });
  });

  state.savedPlans.push(imported);
  switchActivePlan(newId);

  const modal = document.getElementById('importPlanModalOverlay');
  if(modal) modal.classList.remove('open');
  pendingImportPlan = null;

  showToast(`Zaimportowano plan "${imported.name}"! ⚒️`);
}

function confirmDeleteCurrentPlan(){
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  if(state.savedPlans.length <= 1){
    showToast('Nie możesz usunąć jedynego planu. Utwórz najpierw inny plan.');
    return;
  }
  const cur = state.savedPlans.find(p => p.id === state.currentPlanId);
  const planName = cur ? cur.name : 'ten plan';
  showConfirmModal(`Czy na pewno chcesz usunąć plan "${planName}"? Tej operacji nie można cofnąć. Historia ukończonych sesji oraz pomiary sylwetki NIE zostaną usunięte.`, () => {
    deleteCurrentPlan();
  }, 'Usuń plan');
}

function deleteCurrentPlan(){
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  if(state.savedPlans.length <= 1) return;
  const idx = state.savedPlans.findIndex(p => p.id === state.currentPlanId);
  if(idx === -1) return;

  const deletedName = state.savedPlans[idx].name;
  state.savedPlans.splice(idx, 1);

  const nextPlan = state.savedPlans[Math.min(idx, state.savedPlans.length - 1)];
  state.currentPlanId = nextPlan.id;
  state.totalWeeks = nextPlan.totalWeeks || 6;
  state.customDays = JSON.parse(JSON.stringify(nextPlan.customDays || []));
  state.weekMeta = JSON.parse(JSON.stringify(nextPlan.weekMeta || DEFAULT_WEEK_META));
  state.progress = JSON.parse(JSON.stringify(nextPlan.progress || {}));
  state.briefing = nextPlan.briefing || null;
  state.currentWeek = 1;
  state.editorWeek = 1;

  ensureAllExercisesWeeks();
  saveState();
  render();
  showToast(`Usunięto plan: "${deletedName}" ✓`);
}

function openNewPlanModal(){
  const modal = document.getElementById('newPlanModalOverlay');
  const input = document.getElementById('inputNewPlanName');
  if(input) input.value = `Plan Kuźni ${state.savedPlans.length + 1}`;
  if(modal) modal.classList.add('open');
}

function closeNewPlanModal(){
  const modal = document.getElementById('newPlanModalOverlay');
  if(modal) modal.classList.remove('open');
}

function handleCreatePlanSubmit(type){
  const nameInput = document.getElementById('inputNewPlanName');
  const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Plan Kuźni ${state.savedPlans.length + 1}`;
  
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  syncCurrentPlanToSaved();

  const newId = 'plan_' + Date.now();
  let days = [];

  if(type === 'blank'){
    days = [
      {
        id: Date.now(),
        name: 'Trening 1',
        focus: '',
        exercises: []
      }
    ];
  } else {
    days = JSON.parse(JSON.stringify(DEFAULT_DAYS));
  }

  const newPlan = {
    id: newId,
    name: name,
    totalWeeks: 6,
    customDays: days,
    weekMeta: JSON.parse(JSON.stringify(DEFAULT_WEEK_META)),
    progress: {}
  };

  state.savedPlans.push(newPlan);
  closeNewPlanModal();
  switchActivePlan(newId);
  showToast(`Wykuto nowy plan: "${name}" ⚒️`);
}

function handleSelectPlanChange(planId){
  if(planId && planId !== state.currentPlanId){
    switchActivePlan(planId);
  }
}

function openCopyWeekModal(){
  const modal = document.getElementById('copyWeekModalOverlay');
  const select = document.getElementById('selectCopySourceWeek');
  const targetLabel = document.getElementById('copyTargetWeekLabel');
  
  const toW = state.editorWeek || 1;
  if(targetLabel) targetLabel.textContent = `Tygodnia ${toW}`;

  if(select){
    select.innerHTML = '';
    for(let w = 1; w <= state.totalWeeks; w++){
      if(w !== toW){
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = `Tydzień ${w} (RIR ${getWeekMeta(w).rir})`;
        select.appendChild(opt);
      }
    }
  }

  if(modal) modal.classList.add('open');
}

function closeCopyWeekModal(){
  const modal = document.getElementById('copyWeekModalOverlay');
  if(modal) modal.classList.remove('open');
}

function applyCopyWeekSubmit(){
  const select = document.getElementById('selectCopySourceWeek');
  if(!select) return;
  const fromW = parseInt(select.value, 10);
  const toW = state.editorWeek || 1;
  
  copyWeekData(fromW, toW);
  closeCopyWeekModal();
}

function copyWeekData(fromW, toW){
  if(!fromW || !toW || fromW === toW) return;
  ensureAllExercisesWeeks();

  state.customDays.forEach(day => {
    (day.exercises || []).forEach(ex => {
      const view = ForgePlan.resolveExerciseForWeek(ex, fromW);
      writeExerciseWeekField(ex, toW, 'sets', view.sets);
      writeExerciseWeekField(ex, toW, 'reps', view.reps);
      writeExerciseWeekField(ex, toW, 'weight', view.weight);
    });
  });

  const metaFrom = getWeekMeta(fromW);
  if(!state.weekMeta) state.weekMeta = {};
  if(!state.weekMeta[toW]) state.weekMeta[toW] = {};
  state.weekMeta[toW].rir = metaFrom.rir;
  state.weekMeta[toW].rest = metaFrom.rest;
  state.weekMeta[toW].restText = metaFrom.restText;

  saveState();
  renderEditor();
  renderHome();
  showToast(`📋 Skopiowano Tydzień ${fromW} do Tygodnia ${toW} ✓`);
}

function copyWeek1ToAll(){
  showConfirmModal('Skopiować strukturę z Tygodnia 1 (serie, ciężary i powtórzenia) do wszystkich pozostałych tygodni cyklu?', () => {
    ensureAllExercisesWeeks();
    for(let w = 2; w <= state.totalWeeks; w++){
      state.customDays.forEach(day => {
        (day.exercises || []).forEach(ex => {
          const view = ForgePlan.resolveExerciseForWeek(ex, 1);
          writeExerciseWeekField(ex, w, 'sets', view.sets);
          writeExerciseWeekField(ex, w, 'reps', view.reps);
          writeExerciseWeekField(ex, w, 'weight', view.weight);
        });
      });
    }
    saveState();
    renderEditor();
    renderHome();
    showToast('⚡ Skopiowano Tydzień 1 do wszystkich pozostałych tygodni ✓');
  }, 'Kopiuj', 'primary');
}

function confirmClearCurrentPlan(){
  showConfirmModal('Czy na pewno chcesz wyczyścić bieżący plan (usunąć wszystkie dni i ćwiczenia)? Historia treningów i pomiary sylwetki pozostaną nienaruszone.', () => {
    state.customDays = [
      {
        id: Date.now(),
        name: 'Trening 1',
        focus: '',
        exercises: []
      }
    ];
    saveState();
    renderEditor();
    renderHome();
    showToast('Plan został wyczyszczony');
  });
}
