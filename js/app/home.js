// Forge Pro – Ekran główny, odhaczanie dni, progresja cyklu

function renderPlanBriefing(){
  const el = document.getElementById('planBriefing');
  if(!el) return;
  const briefing = state.briefing;
  if(!briefing){
    el.innerHTML = '';
    return;
  }
  const warnings = (briefing.warnings || []).map(line => `<li>${escapeHtml(line)}</li>`).join('');
  el.innerHTML = `
    <details class="plan-briefing">
      <summary>${escapeHtml(briefing.summary || 'Szczegóły planu')}</summary>
      ${briefing.split ? `<p>${escapeHtml(briefing.split)}</p>` : ''}
      ${briefing.structure ? `<p>${escapeHtml(briefing.structure)}</p>` : ''}
      ${briefing.warmup ? `<p><b>Rozgrzewka.</b> ${escapeHtml(briefing.warmup)}</p>` : ''}
      ${briefing.rests ? `<p><b>Przerwy.</b> ${escapeHtml(briefing.rests)}</p>` : ''}
      ${warnings ? `<ul>${warnings}</ul>` : ''}
    </details>`;
}

function renderHome(){
  renderPlanBriefing();
  const weekSel = document.getElementById('weekSelector');
  weekSel.innerHTML = '';
  for(let w=1; w<=state.totalWeeks; w++){
    const pill = document.createElement('button');
    pill.className = 'week-pill' + (w === state.currentWeek ? ' active' : '');
    pill.textContent = 'TYG ' + w;
    if(getWeekMeta(w).deload) pill.title = 'Deload';
    pill.onclick = () => { 
      state.currentWeek = w; 
      saveStateLocalOnly();
      renderHome();
    };
    weekSel.appendChild(pill);
  }

  // Dyskretny, okrągły przycisk resetu postępu na samym końcu przewijanego paska tygodni
  const resetBtn = document.createElement('button');
  resetBtn.className = 'week-pill-reset-btn';
  resetBtn.title = 'Zresetuj postęp bieżącego cyklu kuźni';
  resetBtn.innerHTML = '🔄';
  resetBtn.onclick = (e) => {
    e.stopPropagation();
    confirmResetCycleProgress();
  };
  weekSel.appendChild(resetBtn);

  const plan = getPlanForWeek(state.currentWeek);
  const dayList = document.getElementById('dayList');
  dayList.innerHTML = '';

  state.customDays.forEach(day => {
    const dayPlan = plan[day.id];
    if(!dayPlan) return;
    const prog = getDayProgress(state.currentWeek, day.id);
    const complete = prog.completed;
    const doneSets = countCompletedSets(state.currentWeek, day.id);
    const totalSets = totalSetsForDay(state.currentWeek, day.id);

    const minutes = ForgePlan.minutesForWeek(day, state.currentWeek);
    const subBits = [];
    if(dayPlan.focus) subBits.push(dayPlan.focus);
    if(minutes) subBits.push('ok. ' + minutes + ' min');
    const card = document.createElement('div');
    card.className = 'day-card' + (complete ? ' complete' : '');
    card.id = `day-card-${day.id}`;
    card.innerHTML = `
      <div class="day-head">
        <div>
          <div class="day-title">${escapeHtml(dayPlan.name)}</div>
          <div class="day-sub">${escapeHtml(subBits.join(' · '))}</div>
        </div>
        <button class="day-check ${complete ? 'done' : ''}" onclick="event.stopPropagation(); confirmToggleDayComplete(${state.currentWeek}, ${day.id})" aria-label="Oznacz trening jako wykonany"></button>
      </div>
      <div class="ex-mini-list">
        ${dayPlan.exercises.map(ex => {
          const restBit = ex.restSec ? ` · ${ForgePlan.formatRestSeconds(ex.restSec)}` : '';
          const setsDesc = ex.sets > 0 ? `${escapeHtml(ex.sets)}×${escapeHtml(ex.reps || '–')}${restBit}${ex.weight ? ` · ${escapeHtml(ex.weight)}kg` : ''}` : 'Nie zaplanowano';
          const label = (ex.supersetSlot ? ex.supersetSlot + '  ' : '') + (ex.name || '');
          return `
          <div class="ex-mini">
            <span class="n">${escapeHtml(label)}</span>
            <span class="d mono">${setsDesc}</span>
          </div>
          `;
        }).join('')}
      </div>
      <button class="start-btn ${complete ? 'secondary' : ''}" onclick="startSession(${state.currentWeek}, ${day.id})">
        ${complete ? 'Trening ukończony · powtórz' : (doneSets > 0 ? 'Kontynuuj trening' : 'Rozpocznij trening')}
      </button>
    `;
    dayList.appendChild(card);
  });
}

function confirmToggleDayComplete(week, day){
  const prog = getDayProgress(week, day);
  if(prog.completed){
    toggleDayComplete(week, day);
    return;
  }
  showConfirmModal('Oznaczyć ten trening jako wykonany i zapisać w historii?', () => {
    toggleDayComplete(week, day);
  }, 'Zapisz trening', 'primary');
}

function toggleDayComplete(week, day){
  const prog = getDayProgress(week, day);
  const wasComplete = prog.completed;
  prog.completed = !wasComplete;
  let advanced = false;

  if(!wasComplete){
    prog.date = prog.date || new Date().toISOString();
    const dayPlan = getPlanForWeek(week)[day];
    const tonnage = calculateSessionTonnage(prog, dayPlan);
    const alreadyLogged = state.history.some(r => r.week === week && r.day === day && r.date === prog.date);
    if(!alreadyLogged){
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
          weights: prog.weights[ex.id] ? [...prog.weights[ex.id]] : [],
          reps: prog.reps[ex.id] ? [...prog.reps[ex.id]] : [],
        }))
      };
      state.history.unshift(record);
    }
    advanced = checkCycleProgression(week);
    if(!advanced){
      showToast('Trening oznaczony jako wykonany ✓');
    }
  } else {
    showToast('Odznaczono trening');
  }

  saveState(true, true);
  renderHome();

  if(!wasComplete){
    if(advanced){
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 120);
    } else {
      const curIdx = state.customDays.findIndex(d => d.id === day);
      const nextDay = state.customDays[curIdx + 1];
      if(nextDay){
        scrollToDayCard(nextDay.id);
      }
    }
  }
}

function checkCycleProgression(week){
  const isWeekComplete = (w) => state.customDays.every(d => isDayComplete(w, d.id));
  const allWeeksCompleted = Array.from({length: state.totalWeeks}, (_, i) => i + 1).every(w => isWeekComplete(w));

  if(allWeeksCompleted){
    Object.keys(state.progress).forEach(k => {
      if(state.progress[k]){
        state.progress[k].completed = false;
        state.progress[k].setsDone = {};
        state.progress[k].weights = {};
        state.progress[k].reps = {};
        state.progress[k].date = null;
      }
    });
    state.currentWeek = 1;
    saveState();
    showToast('Cykl kuźni ukończony! Zresetowano plan na Tydzień 1! ⚒️');
    return true;
  }

  if(isWeekComplete(week)){
    if(week < state.totalWeeks){
      state.currentWeek = week + 1;
      saveState();
      showToast(`Ukończono Tydzień ${week}! Przejście do Tygodnia ${state.currentWeek} 🔥`);
      return true;
    } else {
      const firstIncompleteWeek = Array.from({length: state.totalWeeks}, (_, i) => i + 1).find(w => !isWeekComplete(w));
      if(firstIncompleteWeek){
        state.currentWeek = firstIncompleteWeek;
        saveState();
        showToast(`Przejście do Tygodnia ${state.currentWeek}`);
        return true;
      }
    }
  }
  return false;
}

function confirmResetCycleProgress(){
  const planName = getCurrentPlanName();
  showConfirmModal(`Czy na pewno chcesz zresetować postęp w planie "${planName}" i rozpocząć cykl od nowa? Wszystkie odznaczone treningi oraz wpisane serie w tym planie zostaną wyzerowane. Twoja historia treningów i pomiary sylwetki pozostaną nienaruszone.`, () => {
    resetCycleProgress();
  }, 'Zresetuj postęp', 'danger');
}

function resetCycleProgress(){
  state.progress = {};
  state.currentWeek = 1;
  saveState(true, true);
  renderHome();
  showToast('Zresetowano postęp planu! Rozpoczęto Tydzień 1 🔄');
}

function startSession(week, day){
  activeSession = { week, day };
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-session').classList.add('active');
  renderSession();
}

function exitSession(targetDayId, advanced){
  stopRestTimer();
  activeSession = null;
  document.getElementById('screen-session').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();
  if(advanced){
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 120);
  } else if(targetDayId){
    scrollToDayCard(targetDayId);
  }
}

function scrollToDayCard(dayId){
  setTimeout(() => {
    const card = document.getElementById(`day-card-${dayId}`);
    if(card){
      const headerOffset = 75;
      const elementPosition = card.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, 100);
}
