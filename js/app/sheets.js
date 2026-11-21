// Forge Pro – Synchronizacja z Google Sheets

// Web client ID: Firebase Console → Authentication → Sign-in method → Google → Web client ID.
const GOOGLE_SHEETS_CLIENT_ID = '926503747482-fi0ffvsou34jfm3iuca570j5b3e3uj5c.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_CLIENT_HELP = 'Brak Web client ID. W Firebase Console → Authentication → Google skopiuj Web client ID i wklej go w kodzie jako GOOGLE_SHEETS_CLIENT_ID. Potem włącz Google Sheets API w projekcie forge-725df.';

let sheetsAccessToken = null;
let sheetsTokenExpiresAt = 0;
let sheetsTokenClient = null;
let sheetsTokenWait = null;
let sheetSyncTimer = null;
let sheetSyncInFlight = false;
let sheetSyncQueued = false;
let sheetRuntime = { needsReauth: false, lastError: '', syncing: false };

function historyFingerprint(){
  try {
    return JSON.stringify(window.state?.history || []);
  } catch(e){
    return '';
  }
}

function noteRemoteHistory(){
  const fp = historyFingerprint();
  if(lastHistoryFingerprint === null){
    lastHistoryFingerprint = fp;
    return;
  }
  if(fp === lastHistoryFingerprint) return;
  lastHistoryFingerprint = fp;
  scheduleSheetSync();
}

function isGoogleSignedIn(){
  const user = window.forgeAuthUser;
  return !!(user && !user.isAnonymous && user.email);
}

function sheetMeta(){
  if(!state.googleSheet || typeof state.googleSheet !== 'object'){
    state.googleSheet = { spreadsheetId: '', spreadsheetUrl: '', accountEmail: '', lastSyncAt: '' };
  }
  return state.googleSheet;
}

function formatSheetTime(iso){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pl-PL', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function sheetCell(value){
  if(value === undefined || value === null) return '';
  return String(value);
}

function buildSheetRows(){
  const history = [...(state.history || [])].reverse();
  const sessions = [['ID', 'Data', 'Godzina', 'Plan', 'Trening', 'Tydzień', 'Partie', 'Tonaż', 'Notatka']];
  const sets = [['ID treningu', 'Ćwiczenie', 'Seria', 'Kg', 'Powtórzenia']];
  history.forEach(rec => {
    const d = new Date(rec.date);
    const valid = !Number.isNaN(d.getTime());
    sessions.push([
      sheetCell(rec.id),
      valid ? d.toLocaleDateString('pl-PL') : '',
      valid ? d.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : '',
      sheetCell(rec.planName),
      sheetCell(rec.dayName),
      rec.week != null ? sheetCell(rec.week) : '',
      sheetCell(rec.focus),
      rec.tonnage != null ? sheetCell(rec.tonnage) : '',
      sheetCell(rec.note)
    ]);
    (rec.exercises || []).forEach(ex => {
      const weights = Array.isArray(ex.weights) ? ex.weights : [];
      const reps = Array.isArray(ex.reps) ? ex.reps : [];
      const numSets = Math.max(weights.length, reps.length);
      for(let s = 0; s < numSets; s++){
        const weight = weights[s];
        const rep = reps[s];
        const emptyWeight = weight === undefined || weight === null || weight === '';
        const emptyRep = rep === undefined || rep === null || rep === '';
        if(emptyWeight && emptyRep) continue;
        sets.push([
          sheetCell(rec.id),
          sheetCell(ex.name),
          String(s + 1),
          emptyWeight ? '' : sheetCell(weight),
          emptyRep ? '' : sheetCell(rep)
        ]);
      }
    });
  });
  return { sessions, sets };
}

function isSheetsAuthError(err){
  const msg = String((err && (err.message || err.type)) || '');
  const status = err && err.status;
  return status === 401 || err?.type === 'interaction_required' || /interaction_required|invalid_grant|insufficient authentication scopes|access_denied|popup_closed|popup_failed/i.test(msg);
}

function handleSheetError(err){
  const status = err && err.status;
  const msg = String((err && err.message) || err || '');
  sheetsAccessToken = status === 401 ? null : sheetsAccessToken;
  if(status === 401){
    sheetRuntime.needsReauth = true;
    sheetRuntime.lastError = 'Dostęp do Arkuszy wygasł. Odśwież go, a historia poleci dalej.';
    return;
  }
  if(status === 404){
    sheetRuntime.lastError = 'Nie ma już tego arkusza na koncie. Podłącz nowy.';
    return;
  }
  if(status === 403 && /has not been used|it is disabled|SERVICE_DISABLED/i.test(msg)){
    sheetRuntime.lastError = 'Włącz Google Sheets API w projekcie Google Cloud (forge-725df).';
    return;
  }
  if(status === 403 && /insufficient authentication scopes/i.test(msg)){
    sheetsAccessToken = null;
    sheetsTokenExpiresAt = 0;
    sheetRuntime.needsReauth = true;
    sheetRuntime.lastError = 'Google nie ma zgody na zapis do Arkuszy. Odśwież dostęp.';
    return;
  }
  sheetRuntime.lastError = msg || 'Nie udało się wysłać historii do arkusza.';
}

function waitForGis(timeoutMs){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if(window.google?.accounts?.oauth2) return resolve();
      if(Date.now() - start > timeoutMs) return reject(new Error('Biblioteka logowania Google jeszcze się nie załadowała. Spróbuj za chwilę.'));
      setTimeout(tick, 120);
    };
    tick();
  });
}

function ensureSheetsTokenClient(){
  if(sheetsTokenClient) return sheetsTokenClient;
  sheetsTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_SHEETS_CLIENT_ID,
    scope: SHEETS_SCOPE,
    callback: (resp) => {
      const wait = sheetsTokenWait;
      sheetsTokenWait = null;
      if(!wait) return;
      if(resp && resp.access_token){
        sheetsAccessToken = resp.access_token;
        const seconds = Number(resp.expires_in) || 3600;
        sheetsTokenExpiresAt = Date.now() + seconds * 1000 - 60000;
        wait.resolve(sheetsAccessToken);
        return;
      }
      const err = new Error((resp && (resp.error_description || resp.error)) || 'Brak dostępu do Arkuszy');
      err.type = resp && resp.error;
      wait.reject(err);
    },
    error_callback: (err) => {
      const wait = sheetsTokenWait;
      sheetsTokenWait = null;
      if(!wait) return;
      const wrapped = new Error((err && (err.message || err.type)) || 'Brak dostępu do Arkuszy');
      wrapped.type = err && err.type;
      wait.reject(wrapped);
    }
  });
  return sheetsTokenClient;
}

function requestSheetsToken(interactive){
  if(!GOOGLE_SHEETS_CLIENT_ID){
    const err = new Error(SHEETS_CLIENT_HELP);
    err.code = 'no-client-id';
    return Promise.reject(err);
  }
  if(sheetsAccessToken && Date.now() < sheetsTokenExpiresAt){
    return Promise.resolve(sheetsAccessToken);
  }
  return waitForGis(8000).then(() => new Promise((resolve, reject) => {
    const client = ensureSheetsTokenClient();
    sheetsTokenWait = { resolve, reject };
    try {
      client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch(e){
      sheetsTokenWait = null;
      reject(e);
    }
  }));
}

async function sheetsFetch(url, options, token){
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: options.body
  });
  if(!res.ok){
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error?.message || '';
    } catch(e){}
    const err = new Error(detail || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  if(res.status === 204) return null;
  return res.json();
}

function renderSheetPanel(){
  const root = document.getElementById('sheetPanel');
  if(!root) return;
  const signedIn = isGoogleSignedIn();
  const meta = state.googleSheet || {};
  const connected = !!meta.spreadsheetId;
  const email = window.forgeAuthUser && window.forgeAuthUser.email ? window.forgeAuthUser.email : '';
  const mismatch = signedIn && connected && meta.accountEmail && email && meta.accountEmail !== email;
  let status = '';
  let actions = '';
  let error = sheetRuntime.lastError || '';

  if(!window.forgeAuthKnown){
    status = 'Sprawdzam konto Google…';
  } else if(!signedIn){
    status = 'Zaloguj się przez Google. Historia poleci do arkusza na tym koncie, a link do niego podesłesz, kiedy chcesz oddać raport.';
    actions = '<button class="backup-btn" type="button" onclick="openCloudModal()">Zaloguj przez Google</button>';
  } else if(!GOOGLE_SHEETS_CLIENT_ID && !connected){
    status = 'Konto: ' + escapeHtml(email);
    error = error || SHEETS_CLIENT_HELP;
  } else if(!connected || mismatch){
    status = mismatch
      ? ('Arkusz jest na koncie ' + escapeHtml(meta.accountEmail) + '. Teraz jesteś na ' + escapeHtml(email) + '.')
      : ('Konto: ' + escapeHtml(email) + '. Podłącz arkusz raz — dalej historia zapisuje się sama.');
    const label = mismatch ? 'Podłącz arkusz tego konta' : 'Podłącz arkusz';
    actions = '<button class="backup-btn" type="button" onclick="connectGoogleSheet()"' + (sheetRuntime.syncing ? ' disabled' : '') + '>' + label + '</button>';
  } else {
    const when = meta.lastSyncAt ? formatSheetTime(meta.lastSyncAt) : '';
    if(!GOOGLE_SHEETS_CLIENT_ID) error = error || SHEETS_CLIENT_HELP;
    status = sheetRuntime.syncing
      ? 'Wysyłanie historii…'
      : (when ? ('Ostatnia wysyłka: ' + escapeHtml(when)) : 'Arkusz podłączony. Historia wyśle się po najbliższym treningu.');
    const link = meta.spreadsheetUrl || ('https://docs.google.com/spreadsheets/d/' + meta.spreadsheetId);
    actions = '<div class="sheet-actions-row">' +
      '<a class="backup-btn" href="' + escapeHtml(link) + '" target="_blank" rel="noopener">Otwórz arkusz</a>' +
      '<button class="backup-btn" type="button" onclick="copySheetLink()">Kopiuj link</button>' +
      '</div>';
    if(sheetRuntime.needsReauth){
      actions += '<button class="backup-btn" type="button" onclick="refreshSheetAccess()">Odśwież dostęp</button>';
    }
    if(error){
      actions += '<button class="backup-btn" type="button" onclick="refreshSheetAccess()">Wyślij historię ponownie</button>';
    }
    actions += '<input id="sheetLinkInput" class="sheet-link-input" readonly value="' + escapeHtml(link) + '">';
  }

  root.innerHTML = '<div class="sheet-status">' + status + '</div>' +
    (error ? '<div class="sheet-error">' + escapeHtml(error) + '</div>' : '') +
    (actions ? '<div class="sheet-actions">' + actions + '</div>' : '');
}
window.refreshSheetPanel = renderSheetPanel;

function scheduleSheetSync(){
  if(!state.googleSheet?.spreadsheetId) return;
  if(!window.forgeAuthKnown || !isGoogleSignedIn()) return;
  const meta = state.googleSheet;
  const email = window.forgeAuthUser && window.forgeAuthUser.email;
  if(meta.accountEmail && email && meta.accountEmail !== email) return;
  clearTimeout(sheetSyncTimer);
  sheetSyncTimer = setTimeout(() => { syncSheetNow(false); }, 800);
}

async function syncSheetNow(interactive){
  const meta = state.googleSheet;
  if(!meta?.spreadsheetId) return;
  if(!isGoogleSignedIn()) return;
  if(meta.accountEmail && window.forgeAuthUser.email && meta.accountEmail !== window.forgeAuthUser.email) return;
  if(sheetSyncInFlight){
    sheetSyncQueued = true;
    return;
  }
  sheetSyncInFlight = true;
  sheetRuntime.syncing = true;
  renderSheetPanel();
  try {
    const token = await requestSheetsToken(interactive);
    const rows = buildSheetRows();
    const id = meta.spreadsheetId;
    await sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchClear', {
      method: 'POST',
      body: JSON.stringify({ ranges: ['Treningi!A:I', 'Serie!A:E'] })
    }, token);
    await sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'Treningi!A1', values: rows.sessions },
          { range: 'Serie!A1', values: rows.sets }
        ]
      })
    }, token);
    meta.lastSyncAt = new Date().toISOString();
    saveStateLocalOnly();
    sheetRuntime.needsReauth = false;
    sheetRuntime.lastError = '';
  } catch(err){
    if(err && err.code === 'no-client-id'){
      sheetRuntime.lastError = err.message;
      sheetRuntime.needsReauth = false;
    } else if(!err || !err.status || isSheetsAuthError(err)){
      sheetsAccessToken = null;
      sheetsTokenExpiresAt = 0;
      sheetRuntime.needsReauth = true;
      sheetRuntime.lastError = interactive ? 'Google nie dało dostępu do Arkuszy. Spróbuj jeszcze raz.' : '';
    } else {
      handleSheetError(err);
    }
  } finally {
    sheetSyncInFlight = false;
    sheetRuntime.syncing = false;
    renderSheetPanel();
    if(sheetSyncQueued){
      sheetSyncQueued = false;
      syncSheetNow(false);
    }
  }
}

async function connectGoogleSheet(){
  if(!isGoogleSignedIn()){
    if(typeof openCloudModal === 'function') openCloudModal();
    return;
  }
  sheetRuntime.syncing = true;
  sheetRuntime.lastError = '';
  sheetRuntime.needsReauth = false;
  renderSheetPanel();
  try {
    const token = await requestSheetsToken(true);
    const created = await sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: 'Forge Pro — historia' },
        sheets: [
          { properties: { title: 'Treningi' } },
          { properties: { title: 'Serie' } }
        ]
      })
    }, token);
    const meta = sheetMeta();
    meta.spreadsheetId = created.spreadsheetId;
    meta.spreadsheetUrl = created.spreadsheetUrl || ('https://docs.google.com/spreadsheets/d/' + created.spreadsheetId);
    meta.accountEmail = window.forgeAuthUser.email || '';
    meta.lastSyncAt = '';
    saveState(true, true);
    await syncSheetNow(false);
    if(!sheetRuntime.lastError) showToast('Arkusz podłączony');
  } catch(err){
    if(err && err.code === 'no-client-id'){
      sheetRuntime.lastError = err.message;
    } else if(isSheetsAuthError(err)){
      sheetsAccessToken = null;
      sheetsTokenExpiresAt = 0;
      sheetRuntime.needsReauth = false;
      sheetRuntime.lastError = 'Google nie dało dostępu do Arkuszy. Spróbuj jeszcze raz.';
    } else {
      handleSheetError(err);
    }
    sheetRuntime.syncing = false;
    renderSheetPanel();
  }
}

async function refreshSheetAccess(){
  sheetRuntime.needsReauth = false;
  sheetRuntime.lastError = '';
  await syncSheetNow(true);
  if(!sheetRuntime.lastError && !sheetRuntime.needsReauth){
    showToast('Historia wysłana do arkusza');
  }
}

async function copySheetLink(){
  const meta = state.googleSheet || {};
  const url = meta.spreadsheetUrl || (meta.spreadsheetId ? ('https://docs.google.com/spreadsheets/d/' + meta.spreadsheetId) : '');
  if(!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link do arkusza skopiowany');
  } catch(e){
    const input = document.getElementById('sheetLinkInput');
    if(input){
      input.focus();
      input.select();
    }
    showToast('Zaznacz link i skopiuj go ręcznie');
  }
}

function onSheetAuthReady(){
  if(!isGoogleSignedIn()){
    sheetsAccessToken = null;
    sheetsTokenExpiresAt = 0;
    renderSheetPanel();
    return;
  }
  renderSheetPanel();
  if(state.googleSheet?.spreadsheetId) syncSheetNow(false);
}
window.onSheetAuthReady = onSheetAuthReady;
