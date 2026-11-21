// Forge Pro – Przełączanie zakładek, toast, render, eksport funkcji do window

function switchTab(tab){
  document.querySelectorAll('.tabbar-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('screen-home').classList.toggle('active', tab === 'home');
  document.getElementById('screen-editor').classList.toggle('active', tab === 'editor');
  document.getElementById('screen-wiki').classList.toggle('active', tab === 'wiki');
  document.getElementById('screen-stats').classList.toggle('active', tab === 'stats');
  document.getElementById('screen-history').classList.toggle('active', tab === 'history');
  document.getElementById('screen-session').classList.remove('active');
  // Reset przewijania: na iOS (PWA) pasek fixed potrafi "podskoczyć", gdy krótsza zakładka obcina scroll
  window.scrollTo(0, 0);

  if(tab === 'editor') renderEditor();
  if(tab === 'stats') switchStatsSubtab('volume');
  if(tab === 'history') renderHistory();
  if(tab === 'home') renderHome();
  if(tab === 'wiki') renderWiki();
}

function showToast(msg){
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function render(){
  if(activeSession){
    renderSession();
    return;
  }
  const activeTabBtn = document.querySelector('.tabbar-btn.active');
  const activeTab = activeTabBtn ? activeTabBtn.dataset.tab : 'home';
  if(activeTab === 'editor') renderEditor();
  else if(activeTab === 'stats') renderVolumeAndChart();
  else if(activeTab === 'history') renderHistory();
  else renderHome();
}

window.switchTab = switchTab;
window.startSession = startSession;
window.exitSession = exitSession;
window.toggleDayComplete = toggleDayComplete;
window.confirmToggleDayComplete = confirmToggleDayComplete;
window.confirmResetCycleProgress = confirmResetCycleProgress;
window.resetCycleProgress = resetCycleProgress;
window.finishSession = finishSession;
window.confirmFinishSession = confirmFinishSession;
window.confirmResetCurrentSession = confirmResetCurrentSession;
window.resetCurrentSessionData = resetCurrentSessionData;
window.toggleSet = toggleSet;
window.updateWeight = updateWeight;
window.updateReps = updateReps;
window.adjustRestTimer = adjustRestTimer;
window.stopRestTimer = stopRestTimer;
window.minimizeRestTimer = minimizeRestTimer;
window.expandRestTimer = expandRestTimer;
window.toggleTimerPause = toggleTimerPause;
window.switchStatsSubtab = switchStatsSubtab;
window.toggleWikiCard = toggleWikiCard;
window.openWikiTarget = openWikiTarget;
window.renderWiki = renderWiki;
window.renderProgressChart = renderProgressChart;
window.renderVolumeAndChart = renderVolumeAndChart;
window.renderBodyChart = renderBodyChart;
window.setChartMetric = setChartMetric;
window.renderHistory = renderHistory;
window.addBodyMeasurement = addBodyMeasurement;
window.deleteBodyLogItem = deleteBodyLogItem;
window.connectGoogleSheet = connectGoogleSheet;
window.refreshSheetAccess = refreshSheetAccess;
window.copySheetLink = copySheetLink;
window.saveHistoryNote = saveHistoryNote;
window.changeWeekCount = changeWeekCount;
window.updateWeekMeta = updateWeekMeta;
window.addEditorDay = addEditorDay;
window.deleteEditorDay = deleteEditorDay;
window.toggleEditorDay = toggleEditorDay;
window.updateEditorDay = updateEditorDay;
window.renderEditorPlannedVolume = renderEditorPlannedVolume;
window.addEditorExercise = addEditorExercise;
window.deleteEditorExercise = deleteEditorExercise;
window.updateEditorExercise = updateEditorExercise;
window.toggleHistDetail = toggleHistDetail;
window.deleteHistoryItem = deleteHistoryItem;
window.confirmClearHistory = confirmClearHistory;
window.hideConfirmModal = hideConfirmModal;
window.runConfirmedAction = runConfirmedAction;
window.showToast = showToast;
