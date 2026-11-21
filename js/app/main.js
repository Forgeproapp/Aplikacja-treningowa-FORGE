// Forge Pro – start aplikacji (musi być ładowany jako ostatni z js/app/*)

loadState();
checkForImportedPlanInUrl();

window.state = state;
window.saveStateLocalOnly = saveStateLocalOnly;
window.render = render;
window.handlePwaInstallClick = handlePwaInstallClick;
window.handleCreatePlanSubmit = handleCreatePlanSubmit;
window.handleSelectPlanChange = handleSelectPlanChange;
window.toggleEditPlanName = toggleEditPlanName;
window.renameCurrentPlan = renameCurrentPlan;
window.duplicateCurrentPlan = duplicateCurrentPlan;
window.confirmDeleteCurrentPlan = confirmDeleteCurrentPlan;
window.deleteCurrentPlan = deleteCurrentPlan;
window.openCopyWeekModal = openCopyWeekModal;
window.closeCopyWeekModal = closeCopyWeekModal;
window.applyCopyWeekSubmit = applyCopyWeekSubmit;
window.copyWeek1ToAll = copyWeek1ToAll;
window.confirmClearCurrentPlan = confirmClearCurrentPlan;

renderSheetPanel();

window.onload = function(){
  if(isAppStandalone()){
    const btn = document.getElementById('pwaInstallBtn');
    if(btn) btn.style.display = 'none';
  }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker PWA aktywny:', reg.scope))
      .catch(err => console.log('Brak sw.js w repozytorium lub tryb lokalny:', err));
  });
}
