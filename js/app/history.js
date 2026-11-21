// Forge Pro – Historia treningów, modal potwierdzenia

function historyMatchesQuery(rec, query){
  if(!query) return true;
  const plan = String(rec.planName || '').toLowerCase();
  if(plan.includes(query)) return true;
  return (rec.exercises || []).some(ex => String(ex.name || '').toLowerCase().includes(query));
}

function renderHistory(){
  const container = document.getElementById('historyContent');
  if(!container) return;
  const searchInput = document.getElementById('historySearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const records = (state.history || []).filter(rec => historyMatchesQuery(rec, query));

  if(!state.history || state.history.length === 0){
    container.innerHTML = `<div class="hist-empty"><div class="big">⚒️</div>Brak ukończonych treningów w kuźni<br>jeszcze nic tu nie ma</div>`;
    return;
  }

  if(records.length === 0){
    container.innerHTML = `<div class="hist-empty"><div class="big">🔍</div>Brak treningów dla „${escapeHtml(searchInput.value.trim())}”</div>`;
    return;
  }

  const clearAllBtn = `<button class="clear-history-btn" onclick="confirmClearHistory()">Wyczyść całą historię</button>`;

  container.innerHTML = clearAllBtn + records.map(rec => {
    const d = new Date(rec.date);
    const dateStr = d.toLocaleDateString('pl-PL', { day:'numeric', month:'short', year:'numeric' });
    const timeStr = d.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' });
    const tonnageStr = rec.tonnage ? `<div class="hist-tonnage-tag">Tonaż: ${escapeHtml(rec.tonnage)} kg ⚒️</div>` : '';
    const planBadgeStr = rec.planName ? `<span class="hist-plan-badge">${escapeHtml(rec.planName)}</span>` : '';
    const notePreview = rec.note ? `<div class="hist-note-preview">${escapeHtml(rec.note)}</div>` : '';

    return `<div class="hist-item" data-hist-id="${escapeHtml(rec.id)}">
      <div class="hist-item-top" onclick="toggleHistDetail(this.parentElement.dataset.histId)" style="cursor:pointer;">
        <div>
          <div class="hist-item-title">
            <span>${escapeHtml(rec.dayName)} · Tyg ${escapeHtml(rec.week)}</span>
            ${planBadgeStr}
          </div>
          <div class="hist-item-date mono">${dateStr} · ${timeStr}</div>
          ${tonnageStr}
          ${notePreview}
        </div>
        <button class="hist-delete-btn" onclick="event.stopPropagation(); deleteHistoryItem(this.closest('.hist-item').dataset.histId)" aria-label="Usuń wpis">✕</button>
      </div>
      <div class="hist-detail" id="hist-detail-${escapeHtml(rec.id)}">
        <div class="hist-note-block">
          <label class="hist-note-label" for="hist-note-${escapeHtml(rec.id)}">Notatka</label>
          <textarea id="hist-note-${escapeHtml(rec.id)}" class="hist-note-input" maxlength="2000" placeholder="Dopisz uwagę do tego treningu...">${escapeHtml(rec.note || '')}</textarea>
          <button type="button" class="hist-note-save" data-hist-id="${escapeHtml(rec.id)}" onclick="saveHistoryNote(this.dataset.histId)">Zapisz notatkę</button>
        </div>
        ${(rec.exercises || []).map(ex => {
          const numSets = Math.max(ex.weights ? ex.weights.length : 0, ex.reps ? ex.reps.length : 0);
          
          let setsHtml = '';
          for(let s = 0; s < numSets; s++){
            const w = ex.weights && ex.weights[s] !== undefined && ex.weights[s] !== '' ? `${escapeHtml(ex.weights[s])} kg` : '– kg';
            const r = ex.reps && ex.reps[s] !== undefined && ex.reps[s] !== '' ? `${escapeHtml(ex.reps[s])} powt.` : '– powt.';
            setsHtml += `
              <div class="hist-set-row">
                <span class="hist-set-label">Seria ${s + 1}</span>
                <span class="hist-set-val"><b>${w}</b> × <b>${r}</b></span>
              </div>
            `;
          }

          if(numSets === 0){
            setsHtml = `<div style="font-size:12px; color:var(--text-faint); padding:4px 0;">Brak zapisanych serii</div>`;
          }

          return `
            <div class="hist-ex-block">
              <div class="hist-ex-head">
                <span>${escapeHtml(ex.name)}</span>
                <span class="hist-ex-count">${numSets}${numSets === 1 ? 'seria' : (numSets < 5 ? 'serie' : 'serii')}</span>
              </div>
              <div class="hist-sets-list">
                ${setsHtml}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function saveHistoryNote(id){
  const input = document.getElementById(`hist-note-${id}`);
  const rec = (state.history || []).find(r => String(r.id) === String(id));
  if(!rec || !input) return;
  const next = input.value.trim();
  if((rec.note || '') === next){
    showToast('Notatka bez zmian');
    return;
  }
  rec.note = next;
  saveState(true, true);
  renderHistory();
  const detail = document.getElementById(`hist-detail-${id}`);
  if(detail) detail.classList.add('open');
  showToast('Notatka zapisana');
}

function toggleHistDetail(id){
  const el = document.getElementById(`hist-detail-${id}`);
  if(el) el.classList.toggle('open');
}

function deleteHistoryItem(id){
  showConfirmModal('Usunąć ten wpis z historii? Tej operacji nie można cofnąć.', () => {
    state.history = state.history.filter(r => String(r.id) !== String(id));
    saveState();
    renderHistory();
    showToast('Wpis usunięty');
  });
}

function confirmClearHistory(){
  showConfirmModal('Wyczyścić całą historię treningów? Tej operacji nie można cofnąć.', () => {
    state.history = [];
    saveState();
    renderHistory();
    showToast('Historia wyczyszczona');
  });
}

let pendingConfirmAction = null;
function showConfirmModal(message, onConfirm, confirmLabel, variant){
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModalText').textContent = message;
  const btn = document.getElementById('confirmModalActionBtn');
  btn.textContent = confirmLabel || 'Usuń';
  btn.classList.toggle('danger', variant !== 'primary');
  btn.classList.toggle('primary-confirm', variant === 'primary');
  document.getElementById('confirmModalOverlay').classList.add('open');
}

function hideConfirmModal(){
  document.getElementById('confirmModalOverlay').classList.remove('open');
  pendingConfirmAction = null;
}

function runConfirmedAction(){
  const action = pendingConfirmAction;
  hideConfirmModal();
  if(action) action();
}
