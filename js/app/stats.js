// Forge Pro – Statystyki, objętość, wykresy, motyw, pomiary ciała

function switchStatsSubtab(tab){
  document.getElementById('btnSubtabVolume').classList.toggle('active', tab === 'volume');
  document.getElementById('btnSubtabBody').classList.toggle('active', tab === 'body');
  document.getElementById('subtabContentVolume').style.display = tab === 'volume' ? 'block' : 'none';
  document.getElementById('subtabContentBody').style.display = tab === 'body' ? 'block' : 'none';
  if(tab === 'volume') renderVolumeAndChart();
  if(tab === 'body') renderBodyLog();
}

function getLandmarkInfo(sets){
  if(sets <= 0){
    return {
      type: 'none',
      badge: '',
      color: 'var(--text-faint)',
      barGradient: 'linear-gradient(90deg, var(--line), var(--line-strong))'
    };
  }
  if(sets < 8){
    return {
      type: 'mv',
      badge: `<span class="badge" style="font-size:10px; padding:2px 6px; color:var(--mv); border-color:var(--stone); background:var(--mv-bg);">MV</span>`,
      color: 'var(--mv)',
      barGradient: 'linear-gradient(90deg, var(--stone), var(--text-faint))'
    };
  }
  if(sets < 12){
    return {
      type: 'mev',
      badge: `<span class="badge" style="font-size:10px; padding:2px 6px; color:var(--accent); border-color:var(--accent-hover); background:rgba(var(--accent-rgb), 0.16);">MEV</span>`,
      color: 'var(--accent)',
      barGradient: 'linear-gradient(90deg, var(--accent-hover), var(--accent))'
    };
  }
  if(sets <= 20){
    return {
      type: 'mav',
      badge: `<span class="badge" style="font-size:10px; padding:2px 6px; color:var(--mav); border-color:var(--accent); background:var(--accent-deep);">MAV ★</span>`,
      color: 'var(--gold)',
      barGradient: 'linear-gradient(90deg, var(--accent), var(--gold-pale))'
    };
  }
  return {
    type: 'mrv',
    badge: `<span class="badge" style="font-size:10px; padding:2px 6px; color:var(--danger-text); border-color:#dc2626; background:rgba(239,68,68,0.2);">MRV ⚠</span>`,
    color: 'var(--danger-text)',
    barGradient: 'linear-gradient(90deg, #dc2626, #ef4444)'
  };
}

function renderVolumeAndChart(){
  const volumeMap = {};
  MUSCLE_TARGETS.forEach(m => volumeMap[m] = 0);
  volumeMap['Inne'] = 0;

  state.customDays.forEach(d => {
    const prog = state.progress[getProgressKey(state.currentWeek, d.id)];
    if(prog){
      d.exercises.forEach(ex => {
        const fullId = `w${state.currentWeek}_${ex.id}`;
        const doneCount = (prog.setsDone[fullId] || []).filter(Boolean).length;
        if(doneCount > 0){
          const view = ForgePlan.resolveExerciseForWeek(ex, state.currentWeek);
          const target = view.target || 'Inne';
          volumeMap[target] = (volumeMap[target] || 0) + (doneCount * 1.0);

          const secondary = view.secondary || 'Brak';
          if(secondary && secondary !== 'Brak'){
            volumeMap[secondary] = (volumeMap[secondary] || 0) + (doneCount * 0.5);
          }
        }
      });
    }
  });

  const maxSets = Math.max(1, ...Object.values(volumeMap));
  const container = document.getElementById('volumeMuscleBars');
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

  const select = document.getElementById('chartExerciseSelect');
  if(select){
    const planFilter = currentChartPlanFilter();
    const allExercises = collectChartExerciseNames(planFilter);
    const currentVal = select.value;
    select.innerHTML = allExercises.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    if(allExercises.includes(currentVal)) select.value = currentVal;
  }

  renderProgressChart();
}

function currentChartMetric(){
  const active = document.querySelector('#chartMetricTabs .stats-subtab-btn.active');
  return active ? active.dataset.metric : 'e1rm';
}

function currentChartPlanFilter(){
  const sel = document.getElementById('chartPlanFilter');
  return sel && sel.value === 'all' ? 'all' : 'current';
}

function setChartMetric(metric){
  document.querySelectorAll('#chartMetricTabs .stats-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.metric === metric);
  });
  renderProgressChart();
}

function sameExerciseName(a, b){
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function collectChartExerciseNames(planFilter){
  const names = [];
  const add = (name) => {
    const trimmed = String(name || '').trim();
    if(!trimmed) return;
    if(names.some(existing => sameExerciseName(existing, trimmed))) return;
    names.push(trimmed);
  };
  (state.customDays || []).forEach(day => {
    (day.exercises || []).forEach(ex => {
      ForgePlan.exerciseNames(ex).forEach(add);
    });
  });
  if(planFilter === 'all'){
    (state.history || []).forEach(rec => {
      (rec.exercises || []).forEach(ex => add(ex.name));
    });
  }
  return names;
}

function historyForChart(planFilter){
  const history = state.history || [];
  if(planFilter === 'all') return history;
  const planName = getCurrentPlanName();
  return history.filter(rec => (rec.planName || '') === planName);
}

function chartDateLabel(dateValue){
  const d = new Date(dateValue);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function formatChartNumber(value, range){
  const n = Number(value);
  if(!Number.isFinite(n)) return '';
  if(range !== undefined && range >= 10) return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function exerciseSets(ex){
  const weights = ex && ex.weights ? ex.weights : [];
  const reps = ex && ex.reps ? ex.reps : [];
  const count = Math.max(weights.length, reps.length);
  const sets = [];
  for(let i = 0; i < count; i++){
    sets.push({ weight: weights[i], reps: reps[i] });
  }
  return sets;
}

function bestE1rmInExercise(ex){
  let best = null;
  exerciseSets(ex).forEach(set => {
    const e1rm = estimate1RM(set.weight, set.reps);
    if(e1rm > 0 && (!best || e1rm > best.e1rm)){
      best = { e1rm, weight: set.weight, reps: set.reps };
    }
  });
  return best;
}

function heaviestSetInExercise(ex){
  let best = null;
  exerciseSets(ex).forEach(set => {
    const weight = parseFloat(set.weight);
    const reps = parseFloat(set.reps) || 0;
    if(!weight || weight <= 0) return;
    if(!best || weight > best.weight || (weight === best.weight && reps > best.reps)){
      best = { weight, reps };
    }
  });
  return best;
}

function chartPointValue(rec, match, metric){
  if(metric === 'tonnage'){
    const tonnage = parseFloat(rec.tonnage) || 0;
    return tonnage > 0 ? tonnage : 0;
  }
  if(metric === 'top'){
    const heavy = heaviestSetInExercise(match);
    return heavy ? heavy.weight : 0;
  }
  const best = bestE1rmInExercise(match);
  return best ? best.e1rm : 0;
}

const CHART_TITLES = {
  e1rm: 'Progresja siłowa (Szacowane 1RM)',
  top: 'Progresja siłowa (Najcięższa seria)',
  tonnage: 'Tonaż sesji'
};

const CHART_EMPTY = {
  e1rm: ['Wykuj przynajmniej 2 treningi z tym ćwiczeniem,', 'aby wygenerować wykres progresu 1RM w złocie.'],
  top: ['Wykuj przynajmniej 2 serie z ciężarem,', 'aby zobaczyć najcięższą serię w czasie.'],
  tonnage: ['Wykuj przynajmniej 2 treningi z tym ćwiczeniem,', 'aby zobaczyć tonaż tych sesji.']
};

function themeColor(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyTheme(theme){
  const next = theme === 'clear' ? 'clear' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('forge-theme', next); } catch(e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', next === 'light' ? '#F3EFE6' : '#1B2130');
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(apple) apple.setAttribute('content', next === 'light' ? 'default' : 'black-translucent');
  const label = document.getElementById('themeToggleLabel');
  const btn = document.getElementById('themeToggleBtn');
  if(label) label.textContent = next === 'light' ? 'Jasny' : 'Grafit';
  if(btn) btn.title = next === 'light' ? 'Przełącz na jaśniejszy ciemny motyw' : 'Przełącz na jasny motyw';
  if(window.state && document.getElementById('progressChart')) renderProgressChart();
  const bodyPanel = document.getElementById('subtabContentBody');
  if(window.state && bodyPanel && bodyPanel.style.display !== 'none') renderBodyChart();
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'light' ? 'clear' : 'light');
}

function drawTrendChart(canvas, points, options){
  if(!canvas) return;
  const unit = options.unit || 'kg';
  const emptyLines = options.emptyLines || ['Za mało danych do wykresu.', ''];
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  if(W < 10 || H < 10) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
  const labelColor = themeColor('--chart-label');
  const gridColor = themeColor('--chart-grid');
  const lineColor = themeColor('--chart-line');
  const dotColor = themeColor('--chart-dot');
  const textColor = themeColor('--text');
  const fillColor = themeColor('--chart-fill');

  if(points.length < 2){
    ctx.fillStyle = labelColor;
    ctx.font = '600 13px Space Grotesk';
    ctx.textAlign = 'center';
    ctx.fillText(emptyLines[0] || '', W / 2, H / 2 - 10);
    if(emptyLines[1]) ctx.fillText(emptyLines[1], W / 2, H / 2 + 12);
    return;
  }

  const padding = { top: 25, right: 18, bottom: 36, left: 52 };
  let minVal = Math.min(...points.map(p => p.val));
  let maxVal = Math.max(...points.map(p => p.val));
  if(minVal === maxVal){
    const pad = Math.max(Math.abs(minVal) * 0.05, 1);
    minVal -= pad;
    maxVal += pad;
  } else {
    const pad = (maxVal - minVal) * 0.12;
    minVal -= pad;
    maxVal += pad;
  }
  const range = maxVal - minVal;
  const getX = i => padding.left + (i / (points.length - 1)) * (W - padding.left - padding.right);
  const getY = v => H - padding.bottom - ((v - minVal) / range) * (H - padding.top - padding.bottom);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i = 0; i <= 3; i++){
    const yVal = minVal + (i / 3) * range;
    const y = getY(yVal);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.fillStyle = labelColor;
    ctx.font = '600 10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(formatChartNumber(yVal, range) + unit, padding.left - 6, y + 3);
  }
  ctx.stroke();

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.val);
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
  grad.addColorStop(0, fillColor);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.val);
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(getX(points.length - 1), H - padding.bottom);
  ctx.lineTo(getX(0), H - padding.bottom);
  ctx.closePath();
  ctx.fill();

  const step = points.length <= 6 ? 1 : Math.ceil(points.length / 6);
  const shown = new Set();
  for(let i = 0; i < points.length; i += step) shown.add(i);
  shown.add(points.length - 1);
  if(points.length > 6 && shown.has(points.length - 2)) shown.delete(points.length - 2);

  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.val);

    ctx.fillStyle = dotColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if(!shown.has(i)) return;
    ctx.fillStyle = textColor;
    ctx.font = '700 11px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(formatChartNumber(p.val, 0) + unit, x, y - 8);

    ctx.fillStyle = lineColor;
    ctx.font = '600 10px Space Grotesk';
    ctx.fillText(p.label, x, H - padding.bottom + 16);
  });
}

function renderChartRecords(exName, records){
  const el = document.getElementById('chartRecords');
  if(!el) return;
  let bestRm = null;
  let bestSet = null;
  if(exName){
    records.forEach(rec => {
      const match = (rec.exercises || []).find(ex => sameExerciseName(ex.name, exName));
      if(!match) return;
      const rm = bestE1rmInExercise(match);
      if(rm && (!bestRm || rm.e1rm > bestRm.e1rm)){
        bestRm = Object.assign({ date: rec.date }, rm);
      }
      const heavy = heaviestSetInExercise(match);
      if(heavy && (!bestSet || heavy.weight > bestSet.weight || (heavy.weight === bestSet.weight && heavy.reps > bestSet.reps))){
        bestSet = Object.assign({ date: rec.date }, heavy);
      }
    });
  }

  const rmHtml = bestRm
    ? `<div class="chart-record-val">${bestRm.e1rm} kg</div><div class="chart-record-sub">${formatChartNumber(bestRm.weight, 0)} kg × ${formatChartNumber(bestRm.reps, 0)} · ${escapeHtml(chartDateLabel(bestRm.date))}</div>`
    : `<div class="chart-record-val">—</div><div class="chart-record-sub">Brak serii z ciężarem</div>`;
  const setHtml = bestSet
    ? `<div class="chart-record-val">${formatChartNumber(bestSet.weight, 0)} kg × ${formatChartNumber(bestSet.reps, 0)}</div><div class="chart-record-sub">${escapeHtml(chartDateLabel(bestSet.date))}</div>`
    : `<div class="chart-record-val">—</div><div class="chart-record-sub">Brak serii z ciężarem</div>`;

  el.innerHTML = `
    <div class="chart-record">
      <div class="chart-record-label">Najlepsze e1RM</div>
      ${rmHtml}
    </div>
    <div class="chart-record">
      <div class="chart-record-label">Najlepsza seria</div>
      ${setHtml}
    </div>
  `;
}

function renderProgressChart(){
  const canvas = document.getElementById('progressChart');
  const metric = currentChartMetric();
  const title = document.getElementById('chartTitle');
  if(title) title.textContent = CHART_TITLES[metric] || CHART_TITLES.e1rm;

  const select = document.getElementById('chartExerciseSelect');
  const exName = select ? select.value : '';
  const records = historyForChart(currentChartPlanFilter());
  const points = [];
  [...records].reverse().forEach(rec => {
    const match = (rec.exercises || []).find(ex => sameExerciseName(ex.name, exName));
    if(!match) return;
    const val = chartPointValue(rec, match, metric);
    if(val > 0){
      points.push({ label: chartDateLabel(rec.date), val });
    }
  });

  drawTrendChart(canvas, points, {
    unit: 'kg',
    emptyLines: CHART_EMPTY[metric] || CHART_EMPTY.e1rm
  });
  renderChartRecords(exName, records);
}

const BODY_CHART_METRICS = {
  weight: { label: 'wagę', unit: 'kg' },
  waist: { label: 'pas', unit: 'cm' },
  chest: { label: 'klatkę', unit: 'cm' },
  bicep: { label: 'ramię', unit: 'cm' },
  thigh: { label: 'udo', unit: 'cm' },
  calf: { label: 'łydkę', unit: 'cm' }
};

function renderBodyChart(){
  const canvas = document.getElementById('bodyChart');
  if(!canvas) return;
  const select = document.getElementById('bodyChartMetricSelect');
  const key = select && BODY_CHART_METRICS[select.value] ? select.value : 'weight';
  const meta = BODY_CHART_METRICS[key];
  const points = [];
  [...(state.bodyLog || [])].reverse().forEach(item => {
    const val = parseFloat(item[key]);
    if(!val || val <= 0) return;
    points.push({ label: chartDateLabel(item.date), val });
  });
  drawTrendChart(canvas, points, {
    unit: meta.unit,
    emptyLines: [`Zapisz przynajmniej 2 pomiary (${meta.label}),`, 'aby zobaczyć wykres zmian.']
  });
}

function addBodyMeasurement(){
  const wInput = document.getElementById('inputBodyWeight');
  const waistInput = document.getElementById('inputBodyWaist');
  const chestInput = document.getElementById('inputBodyChest');
  const bicepInput = document.getElementById('inputBodyBicep');
  const thighInput = document.getElementById('inputBodyThigh');
  const calfInput = document.getElementById('inputBodyCalf');

  const weight = parseFloat(wInput.value) || null;
  const waist = parseFloat(waistInput.value) || null;
  const chest = parseFloat(chestInput.value) || null;
  const bicep = parseFloat(bicepInput.value) || null;
  const thigh = parseFloat(thighInput.value) || null;
  const calf = parseFloat(calfInput.value) || null;

  if(!weight && !waist && !chest && !bicep && !thigh && !calf){
    showToast('Wpisz przynajmniej jeden parametr pomiaru');
    return;
  }

  state.bodyLog.unshift({
    date: new Date().toISOString(),
    weight, waist, chest, bicep, thigh, calf
  });

  wInput.value = '';
  waistInput.value = '';
  chestInput.value = '';
  bicepInput.value = '';
  thighInput.value = '';
  calfInput.value = '';

  saveState();
  renderBodyLog();
  showToast('Zapisano pomiary sylwetki ✓');
}

function renderBodyLog(){
  renderBodyChart();
  const container = document.getElementById('bodyLogList');
  if(!container) return;
  if(!state.bodyLog || state.bodyLog.length === 0){
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-faint); font-size:13px;">Brak wpisów pomiarów</div>`;
    return;
  }

  container.innerHTML = state.bodyLog.map((item, idx) => {
    const d = new Date(item.date);
    const dateStr = d.toLocaleDateString('pl-PL', { day:'numeric', month:'short', year:'numeric' });
    const weightBadge = item.weight ? `<span class="body-weight-badge">${item.weight} kg</span>` : '';

    const metrics = [];
    if(item.waist) metrics.push(`Pas: <b>${item.waist} cm</b>`);
    if(item.chest) metrics.push(`Klatka: <b>${item.chest} cm</b>`);
    if(item.bicep) metrics.push(`Ramię: <b>${item.bicep} cm</b>`);
    if(item.thigh) metrics.push(`Udo: <b>${item.thigh} cm</b>`);
    if(item.calf) metrics.push(`Łydka: <b>${item.calf} cm</b>`);

    const pillsHtml = metrics.map(m => `<span class="body-pill">${m}</span>`).join('');

    return `
      <div class="body-card-item">
        <div class="body-card-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="body-card-date">${dateStr}</span>
            ${weightBadge}
          </div>
          <button onclick="deleteBodyLogItem(${idx})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:14px; font-weight:700; padding:2px 6px;" title="Usuń wpis">✕</button>
        </div>
        ${pillsHtml ? `<div class="body-pills-wrap">${pillsHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

function deleteBodyLogItem(idx){
  state.bodyLog.splice(idx, 1);
  saveState();
  renderBodyLog();
  showToast('Usunięto pomiar');
}
