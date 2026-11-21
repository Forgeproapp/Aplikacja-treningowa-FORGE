// Forge Pro – Ekran treningu, serie/ciężary, timer przerwy, zakończenie sesji

function renderSession(){
  const scrollY = window.scrollY;
  const { week, day } = activeSession;
  const dayPlan = getPlanForWeek(week)[day];
  const prog = getDayProgress(week, day);
  const meta = getWeekMeta(week);

  const doneSets = countCompletedSets(week, day);
  const totalSets = totalSetsForDay(week, day);
  document.getElementById('progressFill').style.width = totalSets ? `${(doneSets/totalSets*100)}%` : '0%';

  const content = document.getElementById('sessionContent');
  const warmupHtml = (state.briefing && state.briefing.warmup)
    ? `<div class="ex-note-display" style="margin-bottom:14px;">🔥 <span>${escapeHtml(state.briefing.warmup)}</span></div>`
    : '';
  let html = `
    <div class="session-title-row">
      <div>
        <h2 style="font-size:22px; font-weight:800; margin:0 0 4px; color:var(--text);">${escapeHtml(dayPlan.name)}</h2>
        <div style="color:var(--gold); font-size:14px; font-weight:700;">${escapeHtml(meta.label)} · RIR ${meta.rir}</div>
      </div>
      <button class="session-reset-btn" onclick="confirmResetCurrentSession()" title="Wyczyść wpisane serie i ciężary">
        <span>🗑</span> Wyczyść trening
      </button>
    </div>
    ${warmupHtml}
  `;

  dayPlan.exercises.forEach((ex, exIdx) => {
    if(!prog.setsDone[ex.id]) prog.setsDone[ex.id] = new Array(ex.sets).fill(false);
    if(!prog.weights[ex.id]) prog.weights[ex.id] = new Array(ex.sets).fill('');
    if(!prog.reps[ex.id]) prog.reps[ex.id] = new Array(ex.sets).fill('');

    if(prog.setsDone[ex.id].length !== ex.sets){
      prog.setsDone[ex.id] = resizeArray(prog.setsDone[ex.id], ex.sets, false);
      prog.weights[ex.id] = resizeArray(prog.weights[ex.id], ex.sets, '');
      prog.reps[ex.id] = resizeArray(prog.reps[ex.id], ex.sets, '');
    }

    const allDone = prog.setsDone[ex.id].every(Boolean);
    const isCurrent = !allDone && dayPlan.exercises.slice(0, exIdx).every(e => {
      if(ex.superset && e.superset === ex.superset) return true;
      return prog.setsDone[e.id]?.every(Boolean);
    });
    const lastPerf = findLastExercisePerformance(ex.name);

    const assignedWeight = (ex.weight !== undefined && ex.weight !== null && ex.weight !== '') ? ex.weight : null;
    const noteHtml = (ex.note && ex.note.trim() !== '') ? `<div class="ex-note-display" style="margin-top:6px; margin-bottom:4px;">📝 <span>${escapeHtml(ex.note.trim())}</span></div>` : '';
    const restValue = ex.restSec ? ForgePlan.formatRestSeconds(ex.restSec) : meta.restText;
    const restCaption = ex.superset ? 'przerwa · superseria' : 'przerwa';
    const weightStatHtml = assignedWeight
      ? `<div class="ex-stat"><span class="ex-stat-val">${escapeHtml(assignedWeight)}</span><span class="ex-stat-lbl">kg</span></div>`
      : '';
    const slotHtml = ex.supersetSlot ? `<span class="badge superset-slot">${escapeHtml(ex.supersetSlot)}</span> ` : '';

    html += `<div class="exercise-card ${ex.superset ? 'superset' : ''} ${isCurrent ? 'current' : ''} ${allDone ? 'done' : ''}" id="ex-${escapeHtml(ex.id)}">
      <div class="ex-top">
        <div style="width:100%;">
          <div class="ex-name">${slotHtml}${escapeHtml(ex.name)}</div>
          ${noteHtml}
          <div class="ex-stats">
            <div class="ex-stat"><span class="ex-stat-val">${escapeHtml(ex.sets)}</span><span class="ex-stat-lbl">serie</span></div>
            <div class="ex-stat"><span class="ex-stat-val">${escapeHtml(ex.reps)}</span><span class="ex-stat-lbl">powtórzenia</span></div>
            <div class="ex-stat"><span class="ex-stat-val">${escapeHtml(meta.rir)}</span><span class="ex-stat-lbl">RIR</span></div>
            <div class="ex-stat"><span class="ex-stat-val">${escapeHtml(restValue)}</span><span class="ex-stat-lbl">${restCaption}</span></div>
            ${weightStatHtml}
          </div>
        </div>
      </div>`;

    if(lastPerf){
      html += `<div class="ghost-box">
        <span class="ghost-label">Ostatnio w kuźni (Tyg ${lastPerf.week}):</span>
        <span class="ghost-val">${escapeHtml(lastPerf.summary)}</span>
      </div>`;
    }

    if(ex.sets > 0){
      html += `
        <div class="set-header-row">
          <span></span><span class="col-label">Ciężar (kg)</span><span class="col-label">Powt.</span><span></span>
        </div>`;

      for(let s=0; s<ex.sets; s++){
        const setDone = prog.setsDone[ex.id][s];
        const setId = escapeJsAttr(ex.id);
        html += `<div class="set-row">
          <div class="set-num mono">${s+1}</div>
          <input class="set-input mono" data-ex="${escapeHtml(ex.id)}" data-set="${s}" data-type="weight" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
            value="${escapeHtml(prog.weights[ex.id][s])}"
            oninput="updateWeight('${setId}', ${s}, this)"
            onchange="updateWeight('${setId}', ${s}, this, true)"
            onblur="updateWeight('${setId}', ${s}, this, true)">
          <input class="set-input mono" data-ex="${escapeHtml(ex.id)}" data-set="${s}" data-type="reps" type="number" inputmode="numeric"
            value="${escapeHtml(prog.reps[ex.id][s])}"
            oninput="updateReps('${setId}', ${s}, this.value)"
            onchange="updateReps('${setId}', ${s}, this.value)">
          <button class="set-check ${setDone ? 'done' : ''}" data-ex="${escapeHtml(ex.id)}" data-set="${s}" onclick="toggleSet('${setId}', ${s}, ${Number(ex.sets) || 0})"></button>
        </div>`;
      }
    } else {
      html += `<div style="font-size:12px; color:var(--text-faint); padding:10px 0; text-align:center;">Brak zaplanowanych serii na ten tydzień.</div>`;
    }
    html += `</div>`;
  });

  const allExercisesDone = dayPlan.exercises.every(ex => prog.setsDone[ex.id]?.every(Boolean));
  html += `<button class="next-btn" id="sessionNextBtn" ${allExercisesDone ? '' : 'disabled'} onclick="confirmFinishSession()">
    ${allExercisesDone ? 'Zakończ trening kuźni ✓' : `Ukończ wszystkie serie (${doneSets}/${totalSets})`}
  </button>`;

  content.innerHTML = html;
  window.scrollTo(0, scrollY);
}

function resizeArray(arr, newLen, fill){
  const copy = arr.slice(0, newLen);
  while(copy.length < newLen) copy.push(fill);
  return copy;
}

// type=number drops a Polish decimal comma (22,5 becomes 225 or empty), so the
// weight never copies down and never gets stored. Keep the raw text and canonicalize.
function normalizeWeightDraft(raw){
  if(raw === null || raw === undefined) return '';
  let s = String(raw).trim().replace(/\s+/g, '').replace(/,/g, '.');
  s = s.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if(dot === -1) return s;
  return s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
}

function finalizeWeightDraft(raw, commit){
  let val = normalizeWeightDraft(raw);
  if(commit && val.endsWith('.')) val = val.slice(0, -1);
  if(commit && val.startsWith('.')) val = '0' + val;
  return val;
}

function weightCursorFromRaw(raw, cursor){
  if(cursor == null) return null;
  return normalizeWeightDraft(String(raw).slice(0, cursor)).length;
}

function writeWeightInput(el, val){
  if(!el || el.value === val) return;
  const raw = el.value;
  const start = weightCursorFromRaw(raw, el.selectionStart);
  const end = weightCursorFromRaw(raw, el.selectionEnd);
  el.value = val;
  if(document.activeElement === el && start != null && end != null){
    const nextStart = Math.max(0, Math.min(val.length, start));
    const nextEnd = Math.max(0, Math.min(val.length, end));
    try { el.setSelectionRange(nextStart, nextEnd); } catch(e){}
  }
}

function readWeightField(inputOrVal, commit){
  const el = (inputOrVal && typeof inputOrVal === 'object' && inputOrVal.nodeType === 1) ? inputOrVal : null;
  const raw = el ? el.value : inputOrVal;
  const val = finalizeWeightDraft(raw, !!commit);
  if(el) writeWeightInput(el, val);
  return val;
}

function updateWeight(exId, setIdx, inputOrVal, commit){
  const { week, day } = activeSession;
  const prog = getDayProgress(week, day);
  if(!prog.weights[exId]) prog.weights[exId] = [];
  const oldVal = prog.weights[exId][setIdx] ?? '';
  const val = readWeightField(inputOrVal, !!commit);
  const oldKey = normalizeWeightDraft(oldVal);
  prog.weights[exId][setIdx] = val;

  const dayPlan = getPlanForWeek(week)[day];
  const ex = dayPlan.exercises.find(e => e.id === exId);
  const totalSets = ex ? ex.sets : (prog.weights[exId]?.length || 0);
  let changed = normalizeWeightDraft(oldVal) !== val;

  for(let i = setIdx + 1; i < totalSets; i++){
    const curVal = prog.weights[exId][i];
    const curKey = (curVal === undefined || curVal === null) ? '' : normalizeWeightDraft(curVal);
    if(curVal === undefined || curKey === '' || curKey === oldKey){
      if(normalizeWeightDraft(curVal) !== val) changed = true;
      prog.weights[exId][i] = val;
      const inputEl = document.querySelector(`input[data-ex="${exId}"][data-set="${i}"][data-type="weight"]`);
      if(inputEl && inputEl !== document.activeElement){
        inputEl.value = val;
      }
    }
  }
  if(changed) saveState();
}

function updateReps(exId, setIdx, val){
  const { week, day } = activeSession;
  const prog = getDayProgress(week, day);
  if(!prog.reps[exId]) prog.reps[exId] = [];
  const oldVal = prog.reps[exId][setIdx] ?? '';
  prog.reps[exId][setIdx] = val;

  const dayPlan = getPlanForWeek(week)[day];
  const ex = dayPlan.exercises.find(e => e.id === exId);
  const totalSets = ex ? ex.sets : (prog.reps[exId]?.length || 0);

  for(let i = setIdx + 1; i < totalSets; i++){
    const curVal = prog.reps[exId][i];
    if(curVal === undefined || curVal === '' || curVal === oldVal){
      prog.reps[exId][i] = val;
      const inputEl = document.querySelector(`input[data-ex="${exId}"][data-set="${i}"][data-type="reps"]`);
      if(inputEl && inputEl !== document.activeElement){
        inputEl.value = val;
      }
    }
  }
  saveState();
}

function toggleSet(exId, setIdx, totalSets){
  const { week, day } = activeSession;
  const prog = getDayProgress(week, day);
  const wasDone = prog.setsDone[exId][setIdx];
  prog.setsDone[exId][setIdx] = !wasDone;
  saveState(true, true);
  updateSessionDOM();

  if(!wasDone){
    const meta = getWeekMeta(week);
    const dayPlan = getPlanForWeek(week)[day];
    const finished = dayPlan.exercises.find(item => item.id === exId);
    const decision = ForgePlan.restAfterCompletedSet(finished || {}, dayPlan.exercises, setIdx, prog.setsDone, meta.rest);
    if(decision.restSec > 0) startRestTimer(decision.restSec);
    if(decision.partnerId){
      const partnerCard = document.getElementById(`ex-${decision.partnerId}`);
      if(partnerCard) partnerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const exDone = prog.setsDone[exId].every(Boolean);
    if(exDone && !decision.partnerId){
      const curExIdx = dayPlan.exercises.findIndex(e => e.id === exId);
      const nextEx = dayPlan.exercises[curExIdx + 1];
      setTimeout(() => {
        if(nextEx){
          const nextCard = document.getElementById(`ex-${nextEx.id}`);
          if(nextCard){
            nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          const nextBtn = document.getElementById('sessionNextBtn');
          if(nextBtn){
            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 250);
    }
  }
}

function updateSessionDOM(){
  const { week, day } = activeSession;
  const dayPlan = getPlanForWeek(week)[day];
  const prog = getDayProgress(week, day);

  const doneSets = countCompletedSets(week, day);
  const totalSets = totalSetsForDay(week, day);
  const fill = document.getElementById('progressFill');
  if(fill) fill.style.width = totalSets ? `${(doneSets/totalSets*100)}%` : '0%';

  dayPlan.exercises.forEach((ex, exIdx) => {
    const setsDone = prog.setsDone[ex.id] || [];
    const allDone = setsDone.every(Boolean) && setsDone.length === ex.sets;
    const isCurrent = !allDone && dayPlan.exercises.slice(0, exIdx).every(e => {
      if(ex.superset && e.superset === ex.superset) return true;
      return prog.setsDone[e.id]?.every(Boolean);
    });

    const card = document.getElementById(`ex-${ex.id}`);
    if(card){
      card.classList.toggle('current', isCurrent);
      card.classList.toggle('done', allDone);
      setsDone.forEach((done, s) => {
        const btn = card.querySelector(`.set-check[data-ex="${ex.id}"][data-set="${s}"]`);
        if(btn) btn.classList.toggle('done', done);
      });
    }
  });

  const allExercisesDone = dayPlan.exercises.every(ex => prog.setsDone[ex.id]?.every(Boolean));
  const nextBtn = document.getElementById('sessionNextBtn');
  if(nextBtn){
    nextBtn.disabled = !allExercisesDone;
    nextBtn.textContent = allExercisesDone ? 'Zakończ trening kuźni ✓' : `Ukończ wszystkie serie (${doneSets}/${totalSets})`;
  }
}

let timerInterval = null;
let timerEndTime = 0;
let timerInitialSeconds = 0;
let timerPausedRemainingMs = 0;
let isTimerPaused = false;
let isTimerMinimized = false;

function startRestTimer(seconds){
  stopRestTimer();
  timerInitialSeconds = seconds;
  timerEndTime = Date.now() + (seconds * 1000);
  isTimerPaused = false;
  isTimerMinimized = false;

  if('Notification' in window && Notification.permission === 'default'){
    try { Notification.requestPermission().catch(() => {}); } catch(e){}
  }

  const overlay = document.getElementById('restTimerOverlay');
  const pip = document.getElementById('restTimerPipWidget');
  if(overlay) overlay.classList.add('active');
  if(pip) pip.classList.remove('active');

  updateTimerPauseUI();
  tickTimer();

  timerInterval = setInterval(tickTimer, 500);
}

function tickTimer(){
  if(isTimerPaused) return;
  const now = Date.now();
  const diffMs = timerEndTime - now;
  const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));

  updateTimerDisplay(secondsLeft);

  if(diffMs <= 0){
    stopRestTimer();
    playTimerBeep();
    showToast('⚒️ Czas na kolejną serię w kuźni!');

    if(document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted'){
      try {
        new Notification('Forge Pro', {
          body: '⚒️ Przerwa dobiegła końca! Chwytaj za sztangę.',
          icon: 'icon-192.png',
          vibrate: [250, 100, 250]
        });
      } catch(e){}
    }
  }
}

function updateTimerDisplay(secondsLeft){
  if(secondsLeft === undefined){
    const now = Date.now();
    const diffMs = isTimerPaused ? timerPausedRemainingMs : (timerEndTime - now);
    secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));
  }
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const bigClock = document.getElementById('timerBigClockDisplay');
  const pipClock = document.getElementById('timerPipClockDisplay');
  const bar = document.getElementById('timerBigProgressBar');

  if(bigClock) bigClock.textContent = timeStr;
  if(pipClock) pipClock.textContent = timeStr;

  if(bar && timerInitialSeconds > 0){
    const pct = Math.max(0, Math.min(100, (secondsLeft / timerInitialSeconds) * 100));
    bar.style.width = `${pct}%`;
  }
}

function adjustRestTimer(delta){
  if(isTimerPaused){
    timerPausedRemainingMs = Math.max(0, timerPausedRemainingMs + (delta * 1000));
    const secs = Math.ceil(timerPausedRemainingMs / 1000);
    if(secs > timerInitialSeconds) timerInitialSeconds = secs;
    updateTimerDisplay(secs);
  } else {
    timerEndTime += (delta * 1000);
    const now = Date.now();
    const diffMs = timerEndTime - now;
    const secs = Math.max(0, Math.ceil(diffMs / 1000));
    if(secs > timerInitialSeconds) timerInitialSeconds = secs;
    updateTimerDisplay(secs);
  }
}

function toggleTimerPause(){
  isTimerPaused = !isTimerPaused;
  if(isTimerPaused){
    timerPausedRemainingMs = Math.max(0, timerEndTime - Date.now());
  } else {
    timerEndTime = Date.now() + timerPausedRemainingMs;
  }
  updateTimerPauseUI();
  updateTimerDisplay();
}

function updateTimerPauseUI(){
  const btnText = document.getElementById('timerPauseText');
  const btnIcon = document.getElementById('timerPauseIcon');
  if(btnText && btnIcon){
    if(isTimerPaused){
      btnText.textContent = 'Wznów';
      btnIcon.textContent = '▶';
    } else {
      btnText.textContent = 'Zatrzymaj';
      btnIcon.textContent = '⏸';
    }
  }
}

function minimizeRestTimer(){
  isTimerMinimized = true;
  const overlay = document.getElementById('restTimerOverlay');
  const pip = document.getElementById('restTimerPipWidget');
  if(overlay) overlay.classList.remove('active');
  if(pip) pip.classList.add('active');
}

function expandRestTimer(e){
  if(e) e.stopPropagation();
  isTimerMinimized = false;
  const overlay = document.getElementById('restTimerOverlay');
  const pip = document.getElementById('restTimerPipWidget');
  if(pip) pip.classList.remove('active');
  if(overlay) overlay.classList.add('active');
}

function stopRestTimer(e){
  if(e) e.stopPropagation();
  clearInterval(timerInterval);
  timerInterval = null;
  isTimerPaused = false;
  isTimerMinimized = false;
  timerEndTime = 0;
  timerPausedRemainingMs = 0;

  const overlay = document.getElementById('restTimerOverlay');
  const pip = document.getElementById('restTimerPipWidget');
  if(overlay) overlay.classList.remove('active');
  if(pip) pip.classList.remove('active');
}

(function initPipDrag(){
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let moved = false;

  function onPointerDown(clientX, clientY, target){
    if(target && (target.closest('.pip-expand-btn') || target.closest('.pip-close-btn'))) return;
    const pip = document.getElementById('restTimerPipWidget');
    if(!pip) return;

    isDragging = true;
    moved = false;
    startX = clientX;
    startY = clientY;

    const rect = pip.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    pip.style.right = 'auto';
    pip.style.bottom = 'auto';
    pip.style.left = initialLeft + 'px';
    pip.style.top = initialTop + 'px';
    pip.classList.add('dragging');
  }

  function onPointerMove(clientX, clientY){
    if(!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if(Math.abs(dx) > 4 || Math.abs(dy) > 4){
      moved = true;
    }

    const pip = document.getElementById('restTimerPipWidget');
    if(!pip) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const pipW = pip.offsetWidth;
    const pipH = pip.offsetHeight;

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    newLeft = Math.max(10, Math.min(winW - pipW - 10, newLeft));
    newTop = Math.max(10, Math.min(winH - pipH - 10, newTop));

    pip.style.left = newLeft + 'px';
    pip.style.top = newTop + 'px';
  }

  function onPointerUp(target){
    if(!isDragging) return;
    isDragging = false;
    const pip = document.getElementById('restTimerPipWidget');
    if(pip){
      pip.classList.remove('dragging');
      if(!moved && target && !target.closest('.pip-close-btn') && !target.closest('.pip-expand-btn')){
        expandRestTimer();
      }
    }
  }

  window.addEventListener('load', () => {
    const pip = document.getElementById('restTimerPipWidget');
    if(!pip) return;

    pip.addEventListener('touchstart', (e) => {
      if(e.touches.length === 1){
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if(isDragging && e.touches.length === 1){
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if(isDragging){
        onPointerUp(e.target);
      }
    });

    pip.addEventListener('mousedown', (e) => {
      onPointerDown(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
      if(isDragging){
        onPointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if(isDragging){
        onPointerUp(e.target);
      }
    });
  });
})();

function confirmFinishSession(){
  showConfirmModal('Zakończyć trening i zakuć go w historii kuźni?', () => {
    finishSession();
  }, 'Zapisz trening', 'primary');
}

function finishSession(){
  stopRestTimer();
  const { week, day } = activeSession;
  const prog = getDayProgress(week, day);
  prog.completed = true;
  prog.date = new Date().toISOString();

  const dayPlan = getPlanForWeek(week)[day];
  const tonnage = calculateSessionTonnage(prog, dayPlan);

  const record = {
    id: Date.now(),
    week, day,
    planName: getCurrentPlanName(),
    dayName: dayPlan.name,
    focus: dayPlan.focus,
    date: prog.date,
    tonnage: tonnage,
    note: '',
    exercises: dayPlan.exercises.map(ex => ({
      name: ex.name,
      target: ex.target,
      weights: [...(prog.weights[ex.id] || [])],
      reps: [...(prog.reps[ex.id] || [])],
    }))
  };
  state.history.unshift(record);
  saveState(true, true);

  const advanced = checkCycleProgression(week);

  const curIdx = state.customDays.findIndex(d => d.id === day);
  const nextDay = state.customDays[curIdx + 1];
  const nextDayId = (!advanced && nextDay) ? nextDay.id : null;

  openWorkoutCompleteModal(tonnage, nextDayId, advanced, record.id);
}

function openWorkoutCompleteModal(tonnage, nextDayId, advanced, recordId){
  pendingCompleteExit = { nextDayId, advanced, recordId };
  const tonnageEl = document.getElementById('workoutCompleteTonnage');
  if(tonnageEl) tonnageEl.textContent = `Tonaż sesji: ${tonnage} kg`;
  const noteEl = document.getElementById('workoutCompleteNote');
  if(noteEl) noteEl.value = '';
  const modal = document.getElementById('workoutCompleteModalOverlay');
  if(modal) modal.classList.add('open');
  if(navigator.vibrate){ try{ navigator.vibrate([30, 40, 30]); }catch(err){} }
}

function closeWorkoutCompleteModal(){
  const modal = document.getElementById('workoutCompleteModalOverlay');
  if(modal) modal.classList.remove('open');
  const exit = pendingCompleteExit || {};
  pendingCompleteExit = null;
  const noteEl = document.getElementById('workoutCompleteNote');
  const note = noteEl ? noteEl.value.trim() : '';
  if(exit.recordId && note){
    const rec = state.history.find(r => String(r.id) === String(exit.recordId));
    if(rec){
      rec.note = note;
      saveState(true, true);
    }
  }
  exitSession(exit.nextDayId || null, exit.advanced || false);
}

function confirmResetCurrentSession(){
  if(!activeSession) return;
  showConfirmModal('Czy na pewno chcesz wyczyścić wszystkie wpisane serie i ciężary z tego treningu?', () => {
    resetCurrentSessionData();
  });
}

function resetCurrentSessionData(){
  if(!activeSession) return;
  const { week, day } = activeSession;
  const prog = getDayProgress(week, day);
  prog.setsDone = {};
  prog.weights = {};
  prog.reps = {};
  prog.completed = false;
  prog.date = null;
  stopRestTimer();
  saveState();
  renderSession();
  showToast('Wyczyszczono dane treningu');
}
