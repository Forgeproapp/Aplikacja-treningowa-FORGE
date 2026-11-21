// Forge Pro – Edytor planu, przeciąganie, biblioteka ćwiczeń i treningów

function changeWeekCount(delta){
  const next = state.totalWeeks + delta;
  if(next < 1 || next > 16) return;
  const isAdding = next > state.totalWeeks;
  state.totalWeeks = next;

  if(!state.weekMeta) state.weekMeta = {};
  for(let w=1; w<=state.totalWeeks; w++){
    if(!state.weekMeta[w]){
      state.weekMeta[w] = {
        rir: 2,
        rest: 120,
        restText: '2 min',
        label: `Tydzień ${w}`
      };
    }
  }

  if(isAdding){
    const newWeek = next;
    state.customDays.forEach(day => {
      (day.exercises || []).forEach(ex => {
        if(!ex.setsByWeek) ex.setsByWeek = {};
        if(!ex.weightsByWeek) ex.weightsByWeek = {};
        if(!ex.repsByWeek) ex.repsByWeek = {};
        ex.setsByWeek[newWeek] = '';
        ex.weightsByWeek[newWeek] = '';
        ex.repsByWeek[newWeek] = '';
      });
    });
    state.editorWeek = newWeek;
  }

  ensureAllExercisesWeeks();
  if(state.currentWeek > state.totalWeeks) state.currentWeek = state.totalWeeks;
  if(state.editorWeek > state.totalWeeks) state.editorWeek = state.totalWeeks;
  const countEl = document.getElementById('editorWeeksCount');
  if(countEl) countEl.textContent = state.totalWeeks;
  saveState();
  renderEditor();
  renderHome();
  showToast(isAdding ? `Dodano Tydzień ${next} (pusty) ✓` : `Ustawiono ${state.totalWeeks} tyg. w planie`);
}

let expandedEditorDays = new Set();
function toggleEditorDay(dayId){
  const collapsing = expandedEditorDays.has(dayId);
  if(collapsing) expandedEditorDays.delete(dayId);
  else expandedEditorDays.add(dayId);
  renderEditor();
  if(!collapsing) return;
  const block = document.querySelector('#editorDaysList .edit-day-block[data-day-id="' + dayId + '"]');
  if(!block) return;
  const header = document.querySelector('header.top');
  const top = block.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

function bindDragReorderHandle(handleEl, targetEl, type, dayIdx, exIdx, getLabel, holdMs){
  if(!handleEl) return;

  handleEl.addEventListener('mousedown', (e) => {
    if(e.target.closest('button, input, select')) return;
    targetEl.setAttribute('draggable', 'true');
  });

  let holdTimer = null;
  let startX = 0, startY = 0;

  function cleanup(){
    if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    handleEl.removeEventListener('touchmove', onMove);
    handleEl.removeEventListener('touchend', onEnd);
    handleEl.removeEventListener('touchcancel', onEnd);
  }
  function onMove(ev){
    const t = ev.touches[0];
    if(!t) return;
    if(Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10){
      cleanup();
    }
  }
  function onEnd(){
    cleanup();
  }

  handleEl.addEventListener('touchstart', (e) => {
    if(e.target.closest('button, input, select')) return;
    if(e.touches.length !== 1) return;
    const touch = e.touches[0];
    startX = touch.clientX; startY = touch.clientY;
    handleEl.addEventListener('touchmove', onMove, { passive: true });
    handleEl.addEventListener('touchend', onEnd, { passive: true });
    handleEl.addEventListener('touchcancel', onEnd, { passive: true });
    holdTimer = setTimeout(() => {
      cleanup();
      initTouchDrag(e, type, dayIdx, exIdx, targetEl, getLabel());
    }, holdMs || 380);
  }, { passive: true });
}

function initTouchDrag(e, type, dayIdx, exIdx, element, label) {
  if (touchDragState) return;
  const touch = e.touches[0];
  
  if (navigator.vibrate) {
    try { navigator.vibrate(35); } catch(err){}
  }

  const badge = document.createElement('div');
  badge.className = 'touch-drag-badge';
  badge.innerHTML = `<span style="color:var(--gold);">⚒️</span> <span>${escapeHtml(label)}</span>`;
  document.body.appendChild(badge);
  badge.style.left = touch.clientX + 'px';
  badge.style.top = (touch.clientY - 25) + 'px';

  element.classList.add('dragging');

  touchDragState = {
    type: type,
    dayIdx: dayIdx,
    exIdx: exIdx,
    primaryId: touch.identifier,
    secondaryId: null,
    lastSecondaryY: null,
    lastPrimX: touch.clientX,
    lastPrimY: touch.clientY,
    targetDayIdx: dayIdx,
    targetExIdx: exIdx,
    element: element,
    badge: badge,
    autoScrollTimer: null,
    autoScrollSpeed: 0
  };

  // Jeśli drugi palec już dotykał ekranu zanim rozpoczęło się przeciąganie
  // (np. przewijał stronę w trakcie przytrzymywania), zarejestruj go od razu,
  // żeby przewijanie drugim palcem nie zacinało się po starcie przeciągania.
  for (const [id, pos] of activeTouchRegistry.entries()) {
    if (id !== touch.identifier) {
      touchDragState.secondaryId = id;
      touchDragState.lastSecondaryY = pos.y;
      break;
    }
  }
}

function handlePrimaryTouchMove(clientX, clientY) {
  if (!touchDragState) return;
  touchDragState.lastPrimX = clientX;
  touchDragState.lastPrimY = clientY;

  if (touchDragState.badge) {
    touchDragState.badge.style.left = clientX + 'px';
    touchDragState.badge.style.top = (clientY - 25) + 'px';
  }

  const edgeZone = 80;
  const viewportH = window.innerHeight;
  if (clientY < edgeZone) {
    const intensity = (edgeZone - clientY) / edgeZone;
    touchDragState.autoScrollSpeed = -Math.round(intensity * 14) - 3;
    startAutoScroll();
  } else if (clientY > viewportH - edgeZone) {
    const intensity = (clientY - (viewportH - edgeZone)) / edgeZone;
    touchDragState.autoScrollSpeed = Math.round(intensity * 14) + 3;
    startAutoScroll();
  } else {
    stopAutoScroll();
  }

  updateDropTarget(clientX, clientY);
}

function updateDropTarget(clientX, clientY) {
  if (!touchDragState) return;
  
  if (touchDragState.type === 'day') {
    document.querySelectorAll('.edit-day-block').forEach(b => b.classList.remove('drag-over'));
    const elem = document.elementFromPoint(clientX, clientY);
    const targetBlock = elem ? elem.closest('.edit-day-block') : null;
    if (targetBlock) {
      targetBlock.classList.add('drag-over');
      touchDragState.targetDayIdx = parseInt(targetBlock.dataset.dayIndex, 10);
    }
  } else if (touchDragState.type === 'ex') {
    document.querySelectorAll('.edit-ex-item').forEach(i => i.classList.remove('drag-over'));
    const elem = document.elementFromPoint(clientX, clientY);
    const targetEx = elem ? elem.closest('.edit-ex-item') : null;
    if (targetEx && targetEx.dataset.dayIndex == touchDragState.dayIdx) {
      targetEx.classList.add('drag-over');
      touchDragState.targetExIdx = parseInt(targetEx.dataset.exIndex, 10);
    }
  }
}

function startAutoScroll() {
  if (!touchDragState || touchDragState.autoScrollTimer) return;
  touchDragState.autoScrollTimer = setInterval(() => {
    if (!touchDragState || !touchDragState.autoScrollSpeed) {
      stopAutoScroll();
      return;
    }
    window.scrollBy({ top: touchDragState.autoScrollSpeed, behavior: 'instant' });
    if (touchDragState.lastPrimX !== undefined && touchDragState.lastPrimY !== undefined) {
      updateDropTarget(touchDragState.lastPrimX, touchDragState.lastPrimY);
    }
  }, 22);
}

function stopAutoScroll() {
  if (touchDragState && touchDragState.autoScrollTimer) {
    clearInterval(touchDragState.autoScrollTimer);
    touchDragState.autoScrollTimer = null;
  }
}

function finishTouchDrag() {
  if (!touchDragState) return;
  stopAutoScroll();

  if (touchDragState.badge && touchDragState.badge.parentNode) {
    touchDragState.badge.parentNode.removeChild(touchDragState.badge);
  }
  if (touchDragState.element) {
    touchDragState.element.classList.remove('dragging');
  }

  document.querySelectorAll('.edit-day-block').forEach(b => b.classList.remove('drag-over'));
  document.querySelectorAll('.edit-ex-item').forEach(i => i.classList.remove('drag-over'));

  const { type, dayIdx, exIdx, targetDayIdx, targetExIdx } = touchDragState;
  touchDragState = null;

  if (type === 'day' && targetDayIdx !== null && targetDayIdx !== undefined && targetDayIdx !== dayIdx) {
    const [movedDay] = state.customDays.splice(dayIdx, 1);
    state.customDays.splice(targetDayIdx, 0, movedDay);
    saveState();
    renderEditor();
    renderHome();
    showToast('Zmieniono kolejność treningów ✓');
  } else if (type === 'ex' && targetExIdx !== null && targetExIdx !== undefined && targetExIdx !== exIdx) {
    const list = state.customDays[dayIdx].exercises;
    const [movedEx] = list.splice(exIdx, 1);
    list.splice(targetExIdx, 0, movedEx);
    saveState();
    renderEditor();
    renderHome();
    showToast('Zmieniono kolejność ćwiczeń ✓');
  }
}

function renderEditorPlannedVolume(){
  const container = document.getElementById('editorVolumeBars');
  if(!container) return;

  const volumeMap = {};
  MUSCLE_TARGETS.forEach(m => volumeMap[m] = 0);
  volumeMap['Inne'] = 0;

  const w = state.editorWeek || 1;
  state.customDays.forEach(d => {
    (d.exercises || []).forEach(ex => {
      const view = ForgePlan.resolveExerciseForWeek(ex, w);
      const sets = Number(view.sets) || 0;
      const target = view.target || 'Inne';
      volumeMap[target] = (volumeMap[target] || 0) + sets;

      const secondary = view.secondary || 'Brak';
      if(secondary && secondary !== 'Brak'){
        volumeMap[secondary] = (volumeMap[secondary] || 0) + (sets * 0.5);
      }
    });
  });

  const maxSets = Math.max(1, ...Object.values(volumeMap));
  const volumeNames = MUSCLE_TARGETS.filter(name => volumeMap[name]).concat(
    Object.keys(volumeMap).filter(name => volumeMap[name] && !MUSCLE_TARGETS.includes(name))
  );

  container.innerHTML = volumeNames.map(m => {
    const sets = volumeMap[m];
    const pct = Math.round((sets / maxSets) * 100);
    const displaySets = Number.isInteger(sets) ? sets : sets.toFixed(1);
    const info = getLandmarkInfo(sets);
    return `
      <div class="vol-row" style="margin-bottom:8px;">
        <div class="vol-name" title="${m}">${m}</div>
        <div class="vol-bar-bg" style="height:14px;"><div class="vol-bar-fill" style="width:${pct}%; background:${info.barGradient};"></div></div>
        <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; min-width:92px;">
          ${info.badge}
          <div class="vol-count mono" style="width:auto; color:${info.color};">${displaySets} s</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderEditorWeekSelector(){
  const container = document.getElementById('editorWeekSelector');
  const badge = document.getElementById('editorHeaderWeekLabel');
  const summary = document.getElementById('editorWeekMetaSummary');
  if(!container) return;

  if(!state.editorWeek) state.editorWeek = 1;
  if(state.editorWeek > state.totalWeeks) state.editorWeek = state.totalWeeks;

  container.innerHTML = '';
  for(let w = 1; w <= state.totalWeeks; w++){
    const pill = document.createElement('button');
    pill.className = 'week-pill' + (w === state.editorWeek ? ' active' : '');
    pill.textContent = 'TYG ' + w;
    pill.onclick = () => {
      state.editorWeek = w;
      saveStateLocalOnly();
      renderEditor();
    };
    container.appendChild(pill);
  }

  const w = state.editorWeek;
  const meta = getWeekMeta(w);
  if(badge) badge.textContent = meta.label || `Tydzień ${w}`;

  const restOptions = [
    { s: 60, l: '1 min' },
    { s: 90, l: '1,5 min' },
    { s: 120, l: '2 min' },
    { s: 150, l: '2,5 min' },
    { s: 180, l: '3 min' },
    { s: 210, l: '3,5 min' },
    { s: 240, l: '4 min' },
    { s: 300, l: '5 min' }
  ];

  if(summary){
    summary.innerHTML = `
      <div class="week-meta-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; background:var(--bg-elev); padding:12px; border-radius:12px; border:1px solid var(--line);">
        <div class="week-meta-field">
          <label style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-faint); margin-bottom:4px;">RIR (Tydzień ${w})</label>
          <select onchange="updateWeekMeta(${w}, 'rir', this.value)">
            ${[0,1,2,3,4,5].map(r => `<option value="${r}" ${meta.rir === r ? 'selected' : ''}>RIR ${r}</option>`).join('')}
          </select>
        </div>
        <div class="week-meta-field">
          <label style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-faint); margin-bottom:4px;">Przerwa domyślna</label>
          <select onchange="updateWeekMeta(${w}, 'rest', this.value)">
            ${restOptions.map(opt => `<option value="${opt.s}" ${meta.rest === opt.s ? 'selected' : ''}>${opt.l}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }
}

function renderEditorPlansManager(){
  ensurePlansInitialized();
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  const select = document.getElementById('editorPlansSelect');
  const badge = document.getElementById('editorPlansCountBadge');
  const input = document.getElementById('editorCurrentPlanNameInput');
  const btn = document.getElementById('btnToggleEditPlanName');

  if(badge) badge.textContent = `${state.savedPlans.length} ${state.savedPlans.length === 1 ? 'plan' : 'plany'}`;

  const currentPlan = state.savedPlans.find(p => p.id === state.currentPlanId) || state.savedPlans[0];
  if(input && select && currentPlan){
    input.value = currentPlan.name;
    if(isEditingPlanName){
      select.style.display = 'none';
      input.style.display = 'block';
      if(btn){
        btn.innerHTML = '✓';
        btn.classList.add('primary');
        btn.title = 'Zapisz nazwę';
      }
    } else {
      select.style.display = 'block';
      input.style.display = 'none';
      if(btn){
        btn.innerHTML = '✏️';
        btn.classList.remove('primary');
        btn.title = 'Zmień nazwę planu';
      }
    }
  }

  if(select){
    select.innerHTML = state.savedPlans.map(p => `
      <option value="${escapeHtml(p.id)}" ${p.id === state.currentPlanId ? 'selected' : ''}>${escapeHtml(p.name)}</option>
    `).join('');
  }

  const delBtn = document.getElementById('btnDeleteCurrentPlan');
  if(delBtn){
    if(state.savedPlans.length <= 1){
      delBtn.style.opacity = '0.45';
      delBtn.style.cursor = 'not-allowed';
      delBtn.title = 'Nie można usunąć jedynego planu';
    } else {
      delBtn.style.opacity = '1';
      delBtn.style.cursor = 'pointer';
      delBtn.title = 'Usuń obecny plan';
    }
  }
}

function openExerciseLibraryModal(){
  const modal = document.getElementById('libraryManagerModalOverlay');
  const search = document.getElementById('editorExLibSearchInput');
  if(search) search.value = '';
  renderExerciseLibraryManager();
  if(modal) modal.classList.add('open');
}

function closeExerciseLibraryModal(){
  const modal = document.getElementById('libraryManagerModalOverlay');
  if(modal) modal.classList.remove('open');
}

function renderExerciseLibraryManager(){
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  const list = document.getElementById('editorExerciseLibraryList');
  const btnBadge = document.getElementById('editorExLibCountBadge');
  const modalBadge = document.getElementById('libManagerCountBadge');
  const countLabel = `${state.exerciseLibrary.length} ${state.exerciseLibrary.length === 1 ? 'ćwiczenie' : 'ćwiczeń'}`;
  if(btnBadge) btnBadge.textContent = countLabel;
  if(modalBadge) modalBadge.textContent = countLabel;
  if(!list) return;

  const searchInput = document.getElementById('editorExLibSearchInput');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if(state.exerciseLibrary.length === 0){
    list.innerHTML = `<div class="exlib-empty">Biblioteka jest pusta. Dodaj pierwsze ćwiczenie.</div>`;
    return;
  }

  let sorted = [...state.exerciseLibrary].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if(q){
    sorted = sorted.filter(e => e.name.toLowerCase().includes(q));
  }
  if(sorted.length === 0){
    list.innerHTML = `<div class="exlib-empty">Brak wyników dla „${escapeHtml(searchInput.value.trim())}”</div>`;
    return;
  }
  list.innerHTML = sorted.map(item => `
    <div class="exlib-item">
      <div class="exlib-item-main">
        <div class="exlib-item-name">${escapeHtml(item.name)}</div>
        <div class="exlib-item-badges">
          <span class="badge target">${escapeHtml(item.target)}</span>
          ${item.secondary && item.secondary !== 'Brak' ? `<span class="badge secondary-target">${escapeHtml(item.secondary)}</span>` : ''}
        </div>
      </div>
      <div class="exlib-item-actions">
        <button class="exlib-icon-btn" onclick="openLibraryExerciseModal('${escapeJsAttr(item.id)}')" title="Edytuj">✏️</button>
        <button class="exlib-icon-btn danger" onclick="confirmDeleteLibraryExercise('${escapeJsAttr(item.id)}')" title="Usuń">🗑</button>
      </div>
    </div>
  `).join('');
}

let editingLibExerciseId = null;

function populateLibExerciseSelects(selectedTarget, selectedSecondary){
  const targetSel = document.getElementById('inputLibExTarget');
  const secSel = document.getElementById('inputLibExSecondary');
  if(targetSel){
    targetSel.innerHTML = MUSCLE_TARGETS.map(m => `<option value="${m}" ${m === selectedTarget ? 'selected' : ''}>${m}</option>`).join('');
  }
  if(secSel){
    secSel.innerHTML = `<option value="Brak" ${(!selectedSecondary || selectedSecondary === 'Brak') ? 'selected' : ''}>Brak</option>` +
      MUSCLE_TARGETS.map(m => `<option value="${m}" ${m === selectedSecondary ? 'selected' : ''}>${m}</option>`).join('');
  }
}

function openLibraryExerciseModal(libId){
  editingLibExerciseId = libId || null;
  const titleEl = document.getElementById('libExerciseModalTitle');
  const nameInput = document.getElementById('inputLibExName');
  if(editingLibExerciseId){
    const item = state.exerciseLibrary.find(e => e.id === editingLibExerciseId);
    if(item){
      if(titleEl) titleEl.textContent = 'Edytuj ćwiczenie';
      if(nameInput) nameInput.value = item.name;
      populateLibExerciseSelects(item.target, item.secondary);
    }
  } else {
    if(titleEl) titleEl.textContent = 'Dodaj ćwiczenie do biblioteki';
    if(nameInput) nameInput.value = '';
    populateLibExerciseSelects('Klatka', 'Brak');
  }
  const modal = document.getElementById('libExerciseModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeLibraryExerciseModal(){
  const modal = document.getElementById('libExerciseModalOverlay');
  if(modal) modal.classList.remove('open');
  editingLibExerciseId = null;
}

function handleSaveLibraryExerciseModal(){
  const nameInput = document.getElementById('inputLibExName');
  const targetSel = document.getElementById('inputLibExTarget');
  const secSel = document.getElementById('inputLibExSecondary');
  const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : '';
  if(!name){
    showToast('Podaj nazwę ćwiczenia');
    return;
  }
  const target = targetSel ? targetSel.value : 'Klatka';
  const secondary = secSel ? secSel.value : 'Brak';

  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();

  if(editingLibExerciseId){
    const item = state.exerciseLibrary.find(e => e.id === editingLibExerciseId);
    if(item){
      item.name = name;
      item.target = target;
      item.secondary = secondary;
    }
    showToast('Zaktualizowano ćwiczenie w bibliotece');
  } else {
    const dupIdx = state.exerciseLibrary.findIndex(e => e.name.trim().toLowerCase() === name.toLowerCase());
    if(dupIdx !== -1){
      state.exerciseLibrary[dupIdx] = { ...state.exerciseLibrary[dupIdx], name, target, secondary };
    } else {
      state.exerciseLibrary.push({
        id: 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name, target, secondary
      });
    }
    showToast('Dodano ćwiczenie do biblioteki');
  }

  saveState();
  closeLibraryExerciseModal();
  renderExerciseLibraryManager();
}

function confirmDeleteLibraryExercise(libId){
  const item = state.exerciseLibrary.find(e => e.id === libId);
  if(!item) return;
  showConfirmModal(`Czy na pewno chcesz usunąć "${item.name}" z biblioteki? Ćwiczenia już dodane do planów nie zostaną usunięte.`, () => {
    state.exerciseLibrary = state.exerciseLibrary.filter(e => e.id !== libId);
    saveState();
    renderExerciseLibraryManager();
    showToast('Usunięto z biblioteki');
  });
}

let exPickerTarget = null;

function openExercisePicker(dayIdx, exIdx){
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  exPickerTarget = { dayIdx, exIdx };
  const search = document.getElementById('exPickerSearchInput');
  if(search) search.value = '';
  renderExercisePickerList();
  const modal = document.getElementById('exPickerModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeExercisePickerModal(){
  const modal = document.getElementById('exPickerModalOverlay');
  if(modal) modal.classList.remove('open');
  exPickerTarget = null;
}

function renderExercisePickerList(){
  const list = document.getElementById('exPickerList');
  if(!list) return;
  const search = document.getElementById('exPickerSearchInput');
  const q = search ? search.value.trim().toLowerCase() : '';
  let items = [...state.exerciseLibrary].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if(q){
    items = items.filter(e => e.name.toLowerCase().includes(q));
  }
  if(items.length === 0){
    list.innerHTML = `<div class="exlib-empty">Brak wyników. Dodaj ćwiczenia w Bibliotece Ćwiczeń.</div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <button class="exlib-picker-item" onclick="applyLibraryExerciseToSlot('${escapeJsAttr(item.id)}')">
      <div class="exlib-item-main">
        <div class="exlib-item-name">${escapeHtml(item.name)}</div>
        <div class="exlib-item-badges">
          <span class="badge target">${escapeHtml(item.target)}</span>
          ${item.secondary && item.secondary !== 'Brak' ? `<span class="badge secondary-target">${escapeHtml(item.secondary)}</span>` : ''}
        </div>
      </div>
    </button>
  `).join('');
}

function applyLibraryExerciseToSlot(libId){
  if(!exPickerTarget) return;
  const item = state.exerciseLibrary.find(e => e.id === libId);
  if(!item) return;
  const { dayIdx, exIdx } = exPickerTarget;
  const ex = state.customDays[dayIdx].exercises[exIdx];
  const week = state.editorWeek || 1;
  writeExerciseWeekField(ex, week, 'name', item.name);
  writeExerciseWeekField(ex, week, 'target', item.target);
  writeExerciseWeekField(ex, week, 'secondary', item.secondary || 'Brak');
  saveState(true);
  closeExercisePickerModal();
  renderEditor();
  renderHome();
  showToast(`Wybrano: ${item.name}`);
}

function saveExerciseToLibrary(dayIdx, exIdx){
  const ex = state.customDays[dayIdx].exercises[exIdx];
  const view = ex ? ForgePlan.resolveExerciseForWeek(ex, state.editorWeek || 1) : null;
  if(!view || !view.name || !view.name.trim()){
    showToast('Wpisz najpierw nazwę ćwiczenia');
    return;
  }
  ensureExerciseLibraryInitialized();
  ensureWorkoutLibraryInitialized();
  const dupIdx = state.exerciseLibrary.findIndex(e => e.name.trim().toLowerCase() === view.name.trim().toLowerCase());
  if(dupIdx !== -1){
    state.exerciseLibrary[dupIdx] = { ...state.exerciseLibrary[dupIdx], name: view.name, target: view.target, secondary: view.secondary || 'Brak' };
    showToast('Zaktualizowano ćwiczenie w bibliotece');
  } else {
    state.exerciseLibrary.push({
      id: 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: view.name, target: view.target, secondary: view.secondary || 'Brak'
    });
    showToast('Zapisano ćwiczenie w bibliotece');
  }
  saveState();
  renderExerciseLibraryManager();
}

function openWorkoutPreview(libId){
  const item = state.workoutLibrary.find(t => t.id === libId);
  if(!item) return;

  const titleEl = document.getElementById('workoutPreviewTitle');
  const subEl = document.getElementById('workoutPreviewSub');
  const listEl = document.getElementById('workoutPreviewExList');

  if(titleEl) titleEl.textContent = item.name;
  const count = (item.exercises || []).length;
  if(subEl) subEl.textContent = `${count} ${count === 1 ? 'ćwiczenie' : 'ćwiczeń'} w tym treningu`;

  if(listEl){
    if(count === 0){
      listEl.innerHTML = `<div class="exlib-empty">Ten szablon nie ma jeszcze żadnych ćwiczeń.</div>`;
    } else {
      listEl.innerHTML = item.exercises.map(ex => {
        const view = ForgePlan.resolveExerciseForWeek(ex, 1);
        const sets = view.sets || '';
        const reps = view.reps || '';
        const weight = (view.weight !== undefined && view.weight !== null && view.weight !== '') ? `${view.weight} kg` : '';
        const specsParts = [];
        if(sets) specsParts.push(`${sets} ${sets == 1 ? 'seria' : 'serie'}`);
        if(reps) specsParts.push(`${reps} powt.`);
        if(weight) specsParts.push(weight);
        const specs = specsParts.join(' · ');
        return `
          <div class="wprev-ex-row">
            <div class="wprev-ex-name">${escapeHtml(view.name || 'Bez nazwy')}</div>
            <div class="wprev-ex-badges">
              <span class="badge target">${escapeHtml(view.target || 'Inne')}</span>
              ${view.secondary && view.secondary !== 'Brak' ? `<span class="badge secondary-target">${escapeHtml(view.secondary)}</span>` : ''}
            </div>
            ${specs ? `<div class="wprev-ex-specs">${escapeHtml(specs)}</div>` : ''}
            ${view.note ? `<div class="wprev-ex-note">${escapeHtml(view.note)}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  }

  const modal = document.getElementById('workoutPreviewModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeWorkoutPreviewModal(){
  const modal = document.getElementById('workoutPreviewModalOverlay');
  if(modal) modal.classList.remove('open');
}

function openWorkoutLibraryModal(){
  const modal = document.getElementById('workoutLibraryManagerModalOverlay');
  const search = document.getElementById('workoutLibSearchInput');
  if(search) search.value = '';
  renderWorkoutLibraryManager();
  if(modal) modal.classList.add('open');
}

function closeWorkoutLibraryModal(){
  const modal = document.getElementById('workoutLibraryManagerModalOverlay');
  if(modal) modal.classList.remove('open');
}

function workoutMuscleBadgesHtml(template){
  const seen = new Set();
  const order = [];
  (template.exercises || []).forEach(ex => {
    const target = ForgePlan.resolveExerciseForWeek(ex, 1).target;
    if(target && !seen.has(target)){ seen.add(target); order.push(target); }
  });
  return order.slice(0, 4).map(m => `<span class="badge target">${escapeHtml(m)}</span>`).join('');
}

function renderWorkoutLibraryManager(){
  ensureWorkoutLibraryInitialized();
  const list = document.getElementById('workoutLibraryList');
  const btnBadge = document.getElementById('editorWorkoutLibCountBadge');
  const modalBadge = document.getElementById('workoutLibManagerCountBadge');
  const countLabel = `${state.workoutLibrary.length} ${state.workoutLibrary.length === 1 ? 'trening' : 'treningów'}`;
  if(btnBadge) btnBadge.textContent = countLabel;
  if(modalBadge) modalBadge.textContent = countLabel;
  if(!list) return;

  const searchInput = document.getElementById('workoutLibSearchInput');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if(state.workoutLibrary.length === 0){
    list.innerHTML = `<div class="exlib-empty">Biblioteka jest pusta. Dodaj pierwszy trening.</div>`;
    return;
  }

  let sorted = [...state.workoutLibrary].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if(q){
    sorted = sorted.filter(t => t.name.toLowerCase().includes(q));
  }
  if(sorted.length === 0){
    list.innerHTML = `<div class="exlib-empty">Brak wyników dla „${escapeHtml(searchInput.value.trim())}”</div>`;
    return;
  }
  list.innerHTML = sorted.map(t => `
    <div class="exlib-item exlib-item-clickable" onclick="openWorkoutPreview('${escapeJsAttr(t.id)}')">
      <div class="exlib-item-main">
        <div class="exlib-item-name">${escapeHtml(t.name)}</div>
        <div class="exlib-item-badges">
          <span class="badge rest">${(t.exercises || []).length} ${(t.exercises || []).length === 1 ? 'ćwiczenie' : 'ćwiczeń'}</span>
          ${workoutMuscleBadgesHtml(t)}
        </div>
      </div>
      <div class="exlib-item-actions">
        <button class="exlib-icon-btn" onclick="event.stopPropagation(); openWorkoutNameModal('${escapeJsAttr(t.id)}')" title="Zmień nazwę">✏️</button>
        <button class="exlib-icon-btn danger" onclick="event.stopPropagation(); confirmDeleteWorkoutLibrary('${escapeJsAttr(t.id)}')" title="Usuń">🗑</button>
      </div>
    </div>
  `).join('');
}

let editingWorkoutLibId = null;

function openWorkoutNameModal(libId){
  editingWorkoutLibId = libId || null;
  const titleEl = document.getElementById('workoutNameModalTitle');
  const hintEl = document.getElementById('workoutNameModalHint');
  const nameInput = document.getElementById('inputWorkoutLibName');
  if(editingWorkoutLibId){
    const item = state.workoutLibrary.find(t => t.id === editingWorkoutLibId);
    if(item){
      if(titleEl) titleEl.textContent = 'Zmień nazwę treningu';
      if(hintEl) hintEl.style.display = 'none';
      if(nameInput) nameInput.value = item.name;
    }
  } else {
    if(titleEl) titleEl.textContent = 'Dodaj trening do biblioteki';
    if(hintEl) hintEl.style.display = 'block';
    if(nameInput) nameInput.value = '';
  }
  const modal = document.getElementById('workoutNameModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeWorkoutNameModal(){
  const modal = document.getElementById('workoutNameModalOverlay');
  if(modal) modal.classList.remove('open');
  editingWorkoutLibId = null;
}

function handleSaveWorkoutNameModal(){
  const nameInput = document.getElementById('inputWorkoutLibName');
  const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : '';
  if(!name){
    showToast('Podaj nazwę treningu');
    return;
  }
  ensureWorkoutLibraryInitialized();

  if(editingWorkoutLibId){
    const item = state.workoutLibrary.find(t => t.id === editingWorkoutLibId);
    if(item) item.name = name;
    showToast('Zaktualizowano nazwę w bibliotece');
  } else {
    state.workoutLibrary.push({
      id: 'wlib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name, exercises: []
    });
    showToast('Dodano pusty trening do biblioteki');
  }

  saveState();
  closeWorkoutNameModal();
  renderWorkoutLibraryManager();
}

function confirmDeleteWorkoutLibrary(libId){
  const item = state.workoutLibrary.find(t => t.id === libId);
  if(!item) return;
  showConfirmModal(`Czy na pewno chcesz usunąć trening "${item.name}" z biblioteki? Treningi już dodane do planów nie zostaną usunięte.`, () => {
    state.workoutLibrary = state.workoutLibrary.filter(t => t.id !== libId);
    saveState();
    renderWorkoutLibraryManager();
    showToast('Usunięto z biblioteki');
  });
}

let workoutPickerDayIdx = null;

function openWorkoutPicker(dayIdx){
  ensureWorkoutLibraryInitialized();
  workoutPickerDayIdx = dayIdx;
  const search = document.getElementById('workoutPickerSearchInput');
  if(search) search.value = '';
  renderWorkoutPickerList();
  const modal = document.getElementById('workoutPickerModalOverlay');
  if(modal) modal.classList.add('open');
}

function closeWorkoutPickerModal(){
  const modal = document.getElementById('workoutPickerModalOverlay');
  if(modal) modal.classList.remove('open');
  workoutPickerDayIdx = null;
}

function renderWorkoutPickerList(){
  const list = document.getElementById('workoutPickerList');
  if(!list) return;
  const search = document.getElementById('workoutPickerSearchInput');
  const q = search ? search.value.trim().toLowerCase() : '';
  let items = [...state.workoutLibrary].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if(q){
    items = items.filter(t => t.name.toLowerCase().includes(q));
  }
  if(items.length === 0){
    list.innerHTML = `<div class="exlib-empty">Brak wyników. Dodaj treningi w Bibliotece Treningów.</div>`;
    return;
  }
  list.innerHTML = items.map(t => `
    <button class="exlib-picker-item" onclick="handlePickWorkoutTemplate('${escapeJsAttr(t.id)}')">
      <div class="exlib-item-main">
        <div class="exlib-item-name">${escapeHtml(t.name)}</div>
        <div class="exlib-item-badges">
          <span class="badge rest">${(t.exercises || []).length} ${(t.exercises || []).length === 1 ? 'ćwiczenie' : 'ćwiczeń'}</span>
          ${workoutMuscleBadgesHtml(t)}
        </div>
      </div>
    </button>
  `).join('');
}

function handlePickWorkoutTemplate(libId){
  const item = state.workoutLibrary.find(t => t.id === libId);
  if(!item || workoutPickerDayIdx === null) return;
  const dayIdx = workoutPickerDayIdx;
  const dayName = state.customDays[dayIdx].name;
  showConfirmModal(`Czy chcesz wkleić dane z treningu: "${item.name}"? Zastąpi to wszystkie ${(item.exercises || []).length > 0 ? (item.exercises.length + ' ') : ''}ćwiczenia w treningu "${dayName}".`, () => {
    const newExercises = JSON.parse(JSON.stringify(item.exercises || [])).map(ex => ({
      ...ex,
      id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    }));
    newExercises.forEach(ex => ensureExerciseWeeks(ex));
    state.customDays[dayIdx].exercises = newExercises;
    saveState();
    closeWorkoutPickerModal();
    renderEditor();
    renderHome();
    showToast(`Wczytano szablon: ${item.name}`);
  }, 'Zastąp');
}

function saveWorkoutToLibrary(dayIdx){
  const day = state.customDays[dayIdx];
  if(!day || !day.name || !day.name.trim()){
    showToast('Wpisz najpierw nazwę treningu');
    return;
  }
  if(!day.exercises || day.exercises.length === 0){
    showToast('Dodaj najpierw ćwiczenia do treningu');
    return;
  }
  ensureWorkoutLibraryInitialized();
  const exercisesCopy = JSON.parse(JSON.stringify(day.exercises));
  const dupIdx = state.workoutLibrary.findIndex(t => t.name.trim().toLowerCase() === day.name.trim().toLowerCase());
  if(dupIdx !== -1){
    state.workoutLibrary[dupIdx] = { ...state.workoutLibrary[dupIdx], name: day.name, exercises: exercisesCopy };
    showToast('Zaktualizowano trening w bibliotece');
  } else {
    state.workoutLibrary.push({
      id: 'wlib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: day.name,
      exercises: exercisesCopy
    });
    showToast('Zapisano trening w bibliotece');
  }
  saveState();
  renderWorkoutLibraryManager();
}

window.addEventListener('touchstart', (e) => {
  if (!touchDragState) return;
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    if (t.identifier !== touchDragState.primaryId && touchDragState.secondaryId === null) {
      touchDragState.secondaryId = t.identifier;
      touchDragState.lastSecondaryY = t.clientY;
      break;
    }
  }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!touchDragState) return;

  if (touchDragState.secondaryId !== null) {
    const secTouch = Array.from(e.touches).find(t => t.identifier === touchDragState.secondaryId);
    if (secTouch) {
      const deltaY = touchDragState.lastSecondaryY - secTouch.clientY;
      if (Math.abs(deltaY) > 0.5) {
        window.scrollBy({ top: deltaY, behavior: 'instant' });
        touchDragState.lastSecondaryY = secTouch.clientY;
        if (touchDragState.lastPrimX !== undefined && touchDragState.lastPrimY !== undefined) {
          updateDropTarget(touchDragState.lastPrimX, touchDragState.lastPrimY);
        }
      }
    }
  }

  const primTouch = Array.from(e.touches).find(t => t.identifier === touchDragState.primaryId);
  if (primTouch) {
    e.preventDefault();
    handlePrimaryTouchMove(primTouch.clientX, primTouch.clientY);
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!touchDragState) return;
  const activeIds = Array.from(e.touches).map(t => t.identifier);
  if (touchDragState.secondaryId !== null && !activeIds.includes(touchDragState.secondaryId)) {
    touchDragState.secondaryId = null;
    touchDragState.lastSecondaryY = null;
  }
  if (!activeIds.includes(touchDragState.primaryId)) {
    finishTouchDrag();
  }
}, { passive: false });

window.addEventListener('touchcancel', (e) => {
  if (!touchDragState) return;
  const activeIds = Array.from(e.touches).map(t => t.identifier);
  if (touchDragState.secondaryId !== null && !activeIds.includes(touchDragState.secondaryId)) {
    touchDragState.secondaryId = null;
    touchDragState.lastSecondaryY = null;
  }
  if (!activeIds.includes(touchDragState.primaryId)) {
    finishTouchDrag();
  }
}, { passive: false });

function renderEditor(){
  renderEditorPlansManager();
  renderExerciseLibraryManager();
  renderWorkoutLibraryManager();
  renderEditorWeekSelector();
  renderEditorPlannedVolume();
  const countEl = document.getElementById('editorWeeksCount');
  if(countEl) countEl.textContent = state.totalWeeks;
  const container = document.getElementById('editorDaysList');
  if(!container) return;
  container.innerHTML = '';

  state.customDays.forEach((d, dayIdx) => {
    const block = document.createElement('div');
    const isOpen = expandedEditorDays.has(d.id);
    block.className = 'edit-day-block' + (isOpen ? '' : ' collapsed');
    block.dataset.dayIndex = dayIdx;
    block.dataset.dayId = d.id;

    block.addEventListener('dragover', (e) => {
      if (draggedDayIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.add('drag-over');
    });

    block.addEventListener('dragleave', (e) => {
      block.classList.remove('drag-over');
    });

    block.addEventListener('drop', (e) => {
      if (draggedDayIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.remove('drag-over');
      const targetDayIndex = dayIdx;
      if (draggedDayIndex !== targetDayIndex) {
        const [movedDay] = state.customDays.splice(draggedDayIndex, 1);
        state.customDays.splice(targetDayIndex, 0, movedDay);
        saveState();
        renderEditor();
        renderHome();
        showToast('Zmieniono kolejność treningów ✓');
      }
      draggedDayIndex = null;
    });

    const canDelete = state.customDays.length > 1;
    const deleteBtnHtml = canDelete ? `
      <button class="btn-del-day" onclick="event.stopPropagation(); deleteEditorDay(${dayIdx})" title="Usuń trening">
        🗑 Usuń trening
      </button>
    ` : '';

    const w = state.editorWeek || 1;
    let exercisesHtml = (d.exercises || []).map((ex, exIdx) => {
      ensureExerciseWeeks(ex);
      const view = ForgePlan.resolveExerciseForWeek(ex, w);
      const activeBlock = ForgePlan.blockForWeek(ex, w);
      const blockHint = (ex.blocks && ex.blocks.length > 1 && activeBlock)
        ? `Blok od tygodnia ${activeBlock.fromWeek}. Zmiana nazwy dotyczy tego bloku.`
        : '';
      const targetChoices = MUSCLE_TARGETS.includes(view.target) ? MUSCLE_TARGETS : MUSCLE_TARGETS.concat([view.target]);
      const secondary = view.secondary || 'Brak';

      return `
      <div class="edit-ex-item" data-day-index="${dayIdx}" data-ex-index="${exIdx}">
        <div class="edit-ex-btn-row ex-drag-handle" title="Przytrzymaj chwilę, aby zmienić kolejność">
          <button class="btn-pick-ex" onclick="openExercisePicker(${dayIdx}, ${exIdx})" title="Wybierz z biblioteki">📚</button>
          <button class="btn-save-lib" onclick="saveExerciseToLibrary(${dayIdx}, ${exIdx})" title="Zapisz do biblioteki">💾</button>
          <button class="btn-del-ex" onclick="deleteEditorExercise(${dayIdx}, ${exIdx})" title="Usuń ćwiczenie">✕</button>
        </div>
        <input class="edit-ex-name-input" type="text" value="${escapeHtml(view.name)}" placeholder="Wpisz nazwę ćwiczenia..." 
          oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'name', this.value)"
          onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'name', this.value)">
        ${blockHint ? `<div style="font-size:11px; color:var(--text-faint); margin:-2px 0 8px;">${escapeHtml(blockHint)}</div>` : ''}
        <div class="edit-ex-bottom-row">
          <div class="edit-subfield">
            <label>Główna (1.0)</label>
            <select onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'target', this.value)">
              ${targetChoices.map(m => `<option value="${escapeHtml(m)}" ${view.target === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div class="edit-subfield">
            <label>Pomocnicza (0.5)</label>
            <select onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'secondary', this.value)">
              <option value="Brak" ${secondary === 'Brak' ? 'selected' : ''}>Brak</option>
              ${MUSCLE_TARGETS.map(m => `<option value="${escapeHtml(m)}" ${secondary === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="edit-ex-note-row">
          <label>Agoniści (opis, po przecinku)</label>
          <input type="text" value="${escapeHtml((view.agonists || []).join(', '))}"
            oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'agonists', this.value)"
            onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'agonists', this.value)">
        </div>
        <div class="edit-ex-specs-row">
          <div class="edit-subfield">
            <label>Serie</label>
            <input class="mono" type="number" min="0" max="15" value="${escapeHtml(view.sets)}"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'sets', this.value)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'sets', this.value)">
          </div>
          <div class="edit-subfield">
            <label>Ciężar (kg)</label>
            <input class="mono" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${escapeHtml(view.weight)}"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'weight', this)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'weight', this, true)">
          </div>
          <div class="edit-subfield">
            <label>Powtórzenia</label>
            <input class="mono" type="text" value="${escapeHtml(view.reps)}"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'reps', this.value)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'reps', this.value)">
          </div>
        </div>
        <div class="edit-ex-specs-row">
          <div class="edit-subfield">
            <label>Przerwa (s)</label>
            <input class="mono" type="number" min="0" max="600" value="${view.restSec || ''}"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'restSec', this.value)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'restSec', this.value)">
          </div>
          <div class="edit-subfield">
            <label>Superseria</label>
            <input type="text" value="${escapeHtml(view.superset || '')}" placeholder="np. a7"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'superset', this.value)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'superset', this.value)">
          </div>
          <div class="edit-subfield">
            <label>Slot</label>
            <input type="text" value="${escapeHtml(view.supersetSlot || '')}" placeholder="7a"
              oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'supersetSlot', this.value)"
              onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'supersetSlot', this.value)">
          </div>
        </div>
        <div class="edit-ex-note-row">
          <label>Notatka techniczna / ustawienia (opcjonalnie)</label>
          <input type="text" value="${escapeHtml(view.note || '')}" 
            oninput="updateEditorExercise(${dayIdx}, ${exIdx}, 'note', this.value)"
            onchange="updateEditorExercise(${dayIdx}, ${exIdx}, 'note', this.value)">
        </div>
      </div>
      `;
    }).join('');

    block.innerHTML = `
      <div class="edit-day-collapsible-head collapsible-head${isOpen ? '' : ' day-drag-handle'}" onclick="toggleEditorDay(${d.id})" title="${isOpen ? '' : 'Kliknij, aby rozwinąć. Przytrzymaj, aby zmienić kolejność.'}">
        <div class="edit-day-collapse-title">
          <span class="chevron">${isOpen ? '▾' : '▸'}</span>
          <span class="edit-day-collapse-name">${escapeHtml(d.name || 'Trening')}</span>
        </div>
        <span class="edit-day-collapse-sub mono">${(d.exercises || []).length} ${(d.exercises || []).length === 1 ? 'ćwiczenie' : 'ćwiczeń'}</span>
      </div>
      <div class="edit-day-body collapsible-body">
        <div class="edit-day-head">
          <div class="edit-day-btn-row">
            <button class="plan-icon-btn" onclick="openWorkoutPicker(${dayIdx})" title="Wybierz trening z biblioteki">📚</button>
            <button class="plan-icon-btn" onclick="saveWorkoutToLibrary(${dayIdx})" title="Zapisz trening do biblioteki">💾</button>
            ${deleteBtnHtml}
          </div>
          <div class="edit-input-group">
            <label>Nazwa treningu</label>
            <input type="text" value="${escapeHtml(d.name)}" 
              oninput="updateEditorDay(${dayIdx}, 'name', this.value)"
              onchange="updateEditorDay(${dayIdx}, 'name', this.value)">
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-dim); margin-bottom:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Ćwiczenia w tym treningu</div>
        <div class="edit-ex-list-wrap">${exercisesHtml}</div>
        <button class="btn-add-ex" onclick="addEditorExercise(${dayIdx})">+ Dodaj ćwiczenie</button>
        <button class="btn-collapse-day" onclick="toggleEditorDay(${d.id})">▲ Zwiń trening</button>
      </div>
    `;

    const dayHandle = block.querySelector('.day-drag-handle');
    bindDragReorderHandle(dayHandle, block, 'day', dayIdx, null, () => d.name || `Trening ${dayIdx + 1}`, 380);

    block.addEventListener('dragstart', (e) => {
      draggedDayIndex = dayIdx;
      block.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dayIdx));
    });

    block.addEventListener('dragend', () => {
      block.removeAttribute('draggable');
      block.classList.remove('dragging');
      document.querySelectorAll('.edit-day-block').forEach(b => b.classList.remove('drag-over'));
      draggedDayIndex = null;
    });

    const exItems = block.querySelectorAll('.edit-ex-item');
    exItems.forEach((exItem, exIdx) => {
      const exHandle = exItem.querySelector('.ex-drag-handle');
      bindDragReorderHandle(exHandle, exItem, 'ex', dayIdx, exIdx, () => d.exercises[exIdx]?.name || 'Ćwiczenie', 380);

      exItem.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        draggedEx = { dayIdx, exIdx };
        exItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${dayIdx}:${exIdx}`);
      });

      exItem.addEventListener('dragend', (e) => {
        e.stopPropagation();
        exItem.removeAttribute('draggable');
        exItem.classList.remove('dragging');
        document.querySelectorAll('.edit-ex-item').forEach(el => el.classList.remove('drag-over'));
        draggedEx = null;
      });

      exItem.addEventListener('dragover', (e) => {
        if (!draggedEx || draggedEx.dayIdx !== dayIdx) return;
        e.preventDefault();
        e.stopPropagation();
        exItem.classList.add('drag-over');
      });

      exItem.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        exItem.classList.remove('drag-over');
      });

      exItem.addEventListener('drop', (e) => {
        if (!draggedEx || draggedEx.dayIdx !== dayIdx) return;
        e.preventDefault();
        e.stopPropagation();
        exItem.classList.remove('drag-over');

        const targetExIdx = exIdx;
        if (draggedEx.exIdx !== targetExIdx) {
          const list = state.customDays[dayIdx].exercises;
          const [movedEx] = list.splice(draggedEx.exIdx, 1);
          list.splice(targetExIdx, 0, movedEx);
          saveState();
          renderEditor();
          renderHome();
          showToast('Zmieniono kolejność ćwiczeń ✓');
        }
        draggedEx = null;
      });
    });

    container.appendChild(block);
  });
}

function updateEditorDay(dayIdx, field, val){
  state.customDays[dayIdx][field] = val;
  saveState(true);
  renderHome();
}

function updateEditorExercise(dayIdx, exIdx, field, val, commit){
  const w = state.editorWeek || 1;
  const ex = state.customDays[dayIdx].exercises[exIdx];
  ensureExerciseWeeks(ex);

  if(field === 'sets'){
    val = val === '' ? '' : (parseInt(val, 10) || 0);
  } else if(field === 'weight'){
    val = readWeightField(val, !!commit);
  }
  writeExerciseWeekField(ex, w, field, val);

  saveState(true);
  renderHome();
  renderEditorPlannedVolume();
}

function addEditorDay(){
  const nextNum = state.customDays.length + 1;
  const newDay = {
    id: Date.now(),
    name: `Trening ${nextNum}`,
    focus: '',
    exercises: [
      {
        id: 'ex_' + Date.now() + '_1',
        name: 'Nowe ćwiczenie',
        target: 'Klatka',
        secondary: 'Brak',
        sets: 3,
        weight: '',
        reps: '10',
        note: ''
      }
    ]
  };
  state.customDays.push(newDay);
  ensureAllExercisesWeeks();
  saveState();
  renderEditor();
  renderHome();
  showToast(`Dodano Trening ${nextNum}`);
}

function deleteEditorDay(dayIdx){
  if(state.customDays.length <= 1){
    showToast('Plan musi zawierać co najmniej jeden trening');
    return;
  }
  const dayName = state.customDays[dayIdx].name;
  showConfirmModal(`Czy na pewno chcesz usunąć "${dayName}" wraz z wszystkimi ćwiczeniami?`, () => {
    state.customDays.splice(dayIdx, 1);
    saveState();
    renderEditor();
    renderHome();
    showToast(`Usunięto ${dayName}`);
  });
}

function addEditorExercise(dayIdx){
  const newId = 'ex_' + Date.now();
  const newEx = {
    id: newId,
    name: 'Nowe ćwiczenie',
    target: 'Klatka',
    secondary: 'Brak',
    sets: 3,
    weight: '',
    reps: '10',
    note: ''
  };
  ensureExerciseWeeks(newEx);
  state.customDays[dayIdx].exercises.push(newEx);
  saveState();
  renderEditor();
  renderHome();
  showToast('Dodano ćwiczenie');
}

function deleteEditorExercise(dayIdx, exIdx){
  state.customDays[dayIdx].exercises.splice(exIdx, 1);
  saveState();
  renderEditor();
  renderHome();
  showToast('Usunięto ćwiczenie');
}
