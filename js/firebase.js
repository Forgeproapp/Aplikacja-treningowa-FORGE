import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, doc, setDoc, getDoc, getDocFromServer, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const BUILTIN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyChnyBst4ByA-K8UfasxArgAnyle1JPnog",
  authDomain: "forge-725df.firebaseapp.com",
  projectId: "forge-725df",
  storageBucket: "forge-725df.firebasestorage.app",
  messagingSenderId: "926503747482",
  appId: "1:926503747482:web:2f32634d883f229cfe8423"
};

let app = null;
let auth = null;
let db = null;
let unsubscribeSnapshot = null;
let currentUser = null;
let isSyncingFromRemote = false;
let initialReconcileDone = false;
let serverSyncReady = false;
let pendingCloudPush = false;
let cloudWriteSeq = 0;
let syncSession = 0;

const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const deviceLabel = isMobileDevice ? 'telefonu' : 'komputera';
const myClientId = 'cid_' + (isMobileDevice ? 'mob_' : 'pc_') + Math.random().toString(36).substring(2, 9);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'forge-pro-app';

function setCloudError(msg){
  const errBox = document.getElementById('cloudErrorBox');
  const errTxt = document.getElementById('cloudErrorText');
  if(errBox && errTxt){
    if(msg){
      errBox.style.display = 'block';
      errTxt.textContent = msg;
    } else {
      errBox.style.display = 'none';
      errTxt.textContent = '';
    }
  }
}

function handleFirebaseError(err){
  console.error('Firebase error:', err);
  let userMsg = err.message || String(err);
  if(err.code === 'auth/unauthorized-domain'){
    userMsg = 'Domena Twojego GitHuba nie jest dodana w Firebase Console -> Authentication -> Settings -> Authorized domains.';
  } else if(err.code === 'permission-denied'){
    userMsg = 'Reguły Firestore blokują zapis (permission-denied). Sprawdź Firestore -> Rules w Firebase Console.';
  } else if(err.code === 'auth/operation-not-allowed'){
    userMsg = 'Metoda logowania nie jest włączona w Firebase Console -> Authentication -> Sign-in method.';
  } else if(err.code === 'auth/popup-blocked'){
    userMsg = 'Przeglądarka zablokowała wyskakujące okienko logowania Google. Zezwól na pop-up.';
  }
  setCloudError(userMsg);
}

function getFirebaseConfig(){
  if(typeof __firebase_config !== 'undefined' && __firebase_config){
    try {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    } catch(e){}
  }
  return BUILTIN_FIREBASE_CONFIG;
}

async function initFirebase(){
  const cfg = getFirebaseConfig();
  if(!cfg) return;

  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch(cacheErr) {
      db = getFirestore(app);
    }

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      window.forgeAuthUser = user;
      window.forgeAuthKnown = true;
      updateCloudUI();
      if(typeof window.onSheetAuthReady === 'function'){
        window.onSheetAuthReady();
      }
      if(user){
        setCloudError(null);
        subscribeToSyncRoom();
        if(typeof window.consumeSharedPlanFromUrl === 'function'){
          window.consumeSharedPlanFromUrl();
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch(e){
          handleFirebaseError(e);
        }
      }
    });
  } catch(err){
    handleFirebaseError(err);
    window.forgeAuthKnown = true;
    if(typeof window.onSheetAuthReady === 'function'){
      window.onSheetAuthReady();
    }
  }
}

const SHARE_CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomShareCode(len){
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for(let i = 0; i < len; i++){
    out += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return out;
}

function waitForShareDb(timeoutMs){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if(db && auth && auth.currentUser) return resolve();
      if(Date.now() - start > timeoutMs) return reject(new Error('Chmura nie jest jeszcze gotowa'));
      setTimeout(tick, 120);
    };
    tick();
  });
}

window.saveSharedPlan = async function(planObj){
  await waitForShareDb(8000);
  const payload = JSON.stringify(planObj);
  for(let attempt = 0; attempt < 5; attempt++){
    const code = randomShareCode(6);
    const ref = doc(db, 'sharedPlans', code);
    const existing = await getDoc(ref);
    if(existing.exists()) continue;
    await setDoc(ref, {
      name: planObj.name || 'Plan',
      payload,
      createdAt: new Date().toISOString()
    });
    return code;
  }
  throw new Error('Nie udało się utworzyć krótkiego linku');
};

window.loadSharedPlan = async function(code){
  await waitForShareDb(8000);
  if(!/^[a-zA-Z0-9]{4,12}$/.test(code)) return null;
  const snap = await getDoc(doc(db, 'sharedPlans', code));
  if(!snap.exists()) return null;
  const data = snap.data();
  if(!data || typeof data.payload !== 'string') return null;
  const obj = JSON.parse(data.payload);
  if(!obj || !obj.name || !Array.isArray(obj.customDays)) return null;
  return obj;
};

function timeMs(value){
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function numericEditSeq(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function remoteEditSeq(remote){
  if(!remote) return 0;
  if(remote.editSeq !== undefined && remote.editSeq !== null && remote.editSeq !== ''){
    return numericEditSeq(remote.editSeq);
  }
  try {
    return numericEditSeq(JSON.parse(remote.stateJson || '{}').editSeq);
  } catch(e){
    return 0;
  }
}

function loggedEntryCount(obj){
  if(!obj) return 0;
  const history = Array.isArray(obj.history) ? obj.history.length : 0;
  const body = Array.isArray(obj.bodyLog) ? obj.bodyLog.length : 0;
  return history + body;
}

// 1 = local version is newer, -1 = remote is newer, 0 = same version.
function compareSyncVersions(remote){
  const localSeq = numericEditSeq(window.state?.editSeq);
  const remoteSeq = remoteEditSeq(remote);
  if(localSeq !== remoteSeq) return localSeq > remoteSeq ? 1 : -1;
  const localTime = timeMs(window.state?.lastUpdatedAt);
  const remoteTime = timeMs(remote?.updatedAt);
  if(localTime !== remoteTime) return localTime > remoteTime ? 1 : -1;
  return 0;
}

function hasLocalUserData(){
  return loggedEntryCount(window.state) > 0;
}

// Local timestamp can be newer just because the app was opened or closed.
// Push only real unsent edits, or a legacy local copy that actually holds
// more logged workouts than the cloud.
function shouldKeepLocalAndPush(remote){
  if(window.state?.forceCloudOverwrite) return true;
  if(compareSyncVersions(remote) <= 0) return false;
  if(window.state?.pendingCloudSync) return true;
  try {
    const remoteState = JSON.parse(remote.stateJson || '{}');
    return loggedEntryCount(window.state) > loggedEntryCount(remoteState);
  } catch(e){
    return false;
  }
}

function applyRemotePayload(remoteData, notify){
  if(!remoteData || !remoteData.stateJson) return false;
  let parsed;
  try {
    parsed = JSON.parse(remoteData.stateJson);
  } catch(e){
    console.error('Błąd parsowania stanu z chmury:', e);
    return false;
  }
  if(!parsed || typeof parsed !== 'object') return false;

  const previousUpdatedAt = window.state?.lastUpdatedAt || null;
  parsed.pendingCloudSync = false;
  parsed.forceCloudOverwrite = false;
  if(remoteData.updatedAt) parsed.lastUpdatedAt = remoteData.updatedAt;
  const seq = remoteEditSeq(remoteData);
  if(seq) parsed.editSeq = seq;

  pendingCloudPush = false;
  isSyncingFromRemote = true;
  try {
    if(typeof window.applyNewState === 'function'){
      window.applyNewState(parsed);
    }
    if(window.state){
      window.state.pendingCloudSync = false;
    }
  } finally {
    isSyncingFromRemote = false;
  }

  if(notify && previousUpdatedAt !== (remoteData.updatedAt || null) && typeof window.showToast === 'function'){
    const senderDevice = remoteData.senderDevice || 'chmury';
    const nowStr = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    window.showToast(`🔥 Pobrano dane z ${senderDevice}! (${nowStr})`);
  }
  return true;
}

function finishInitialReconcile(snap, session){
  if(session !== syncSession || initialReconcileDone) return;
  initialReconcileDone = true;
  serverSyncReady = true;

  if(!snap.exists()){
    pendingCloudPush = false;
    if(hasLocalUserData() || window.state?.pendingCloudSync || window.state?.forceCloudOverwrite){
      syncStateToCloud(true);
    } else {
      updateCloudUI();
    }
    return;
  }

  const remoteData = snap.data();
  if(remoteData && shouldKeepLocalAndPush(remoteData)){
    if(typeof window.showToast === 'function' && window.state?.pendingCloudSync){
      window.showToast('🔥 Twoje dane są nowsze niż w chmurze - wysyłam lokalne zmiany');
    }
    syncStateToCloud(true);
    updateCloudUI();
    return;
  }

  pendingCloudPush = false;
  if(remoteData && compareSyncVersions(remoteData) !== 0){
    applyRemotePayload(remoteData, false);
  } else if(window.state){
    window.state.pendingCloudSync = false;
  }
  updateCloudUI();
}

function subscribeToSyncRoom(){
  if(!db || !auth || !auth.currentUser) return;
  if(unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  const session = ++syncSession;
  initialReconcileDone = false;
  serverSyncReady = false;
  pendingCloudPush = false;
  const syncDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'data', 'workoutState');

  unsubscribeSnapshot = onSnapshot(syncDocRef, (snap) => {
    if(session !== syncSession) return;
    if(snap.metadata.hasPendingWrites) return;

    if(!initialReconcileDone){
      // Cache can be older than the phone. Never upload from it.
      if(snap.metadata.fromCache){
        if(snap.exists() && compareSyncVersions(snap.data()) < 0){
          applyRemotePayload(snap.data(), false);
        }
        return;
      }
      finishInitialReconcile(snap, session);
      return;
    }

    if(!snap.exists()) return;
    const remoteData = snap.data();
    if(!remoteData || !remoteData.stateJson) return;
    if(remoteData.senderId === myClientId){
      updateCloudUI();
      return;
    }
    if(compareSyncVersions(remoteData) < 0){
      applyRemotePayload(remoteData, true);
    }
    updateCloudUI();
  }, (err) => {
    handleFirebaseError(err);
    if(err.code === 'permission-denied') {
      updateCloudUI('Brak uprawnień');
    } else {
      updateCloudUI('Błąd chmury');
    }
  });

  reconcileFromServer(syncDocRef, session);
}

async function reconcileFromServer(syncDocRef, session){
  try {
    const snap = await getDocFromServer(syncDocRef);
    finishInitialReconcile(snap, session);
  } catch(err){
    console.warn('Serwer chmury niedostępny, dane lokalne zostają do czasu połączenia.', err);
  }
}

window.handleGoogleSignIn = async function(){
  if(!auth) return;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
    setCloudError(null);
    window.showToast('Zalogowano na konto Google! Pobieranie danych...');
    window.closeCloudModal();
    subscribeToSyncRoom();
  } catch(err){
    handleFirebaseError(err);
  }
};

window.handleSignOut = async function(){
  if(!auth) return;
  try {
    await signOut(auth);
    window.showToast('Wylogowano z chmury');
    window.closeCloudModal();
    updateCloudUI('Wylogowano');
  } catch(err){
    handleFirebaseError(err);
  }
};

async function syncStateToCloud(force){
  if(!db || !auth?.currentUser || isSyncingFromRemote) return;
  if(!window.state) return;
  if(!serverSyncReady){
    pendingCloudPush = true;
    return;
  }
  if(!force && !window.state.pendingCloudSync && !pendingCloudPush) return;

  const myWrite = ++cloudWriteSeq;
  pendingCloudPush = false;
  try {
    updateCloudUI('Wysyłanie...');
    const syncDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'data', 'workoutState');
    const updatedAt = window.state.lastUpdatedAt || new Date().toISOString();
    const editSeq = numericEditSeq(window.state.editSeq);
    const payloadState = JSON.parse(JSON.stringify(window.state));
    payloadState.pendingCloudSync = false;
    payloadState.forceCloudOverwrite = false;
    payloadState.lastUpdatedAt = updatedAt;
    payloadState.editSeq = editSeq;
    const serializedState = JSON.stringify(payloadState);
    if(typeof serializedState !== 'string') return;

    const statePayload = {
      stateJson: serializedState,
      updatedAt: updatedAt,
      editSeq: editSeq,
      senderId: myClientId,
      senderDevice: deviceLabel
    };

    await setDoc(syncDocRef, statePayload, { merge: true });
    if(myWrite !== cloudWriteSeq) return;
    if(numericEditSeq(window.state.editSeq) === editSeq){
      window.state.pendingCloudSync = false;
      window.state.forceCloudOverwrite = false;
      if(typeof window.saveStateLocalOnly === 'function'){
        window.saveStateLocalOnly();
      }
    }
    setCloudError(null);
    updateCloudUI();
  } catch(err){
    if(myWrite === cloudWriteSeq && window.state){
      window.state.pendingCloudSync = true;
    }
    handleFirebaseError(err);
    if(err.code === 'permission-denied') {
      updateCloudUI('Brak uprawnień');
    } else {
      updateCloudUI('Błąd zapisu');
    }
  }
}

function updateCloudUI(statusOverride){
  const btn = document.getElementById('cloudStatusBtn');
  const txt = document.getElementById('cloudStatusText');
  const headerLoginBtn = document.getElementById('headerLoginBtn');
  const activeKeyDisp = document.getElementById('cloudActiveSyncKeyDisplay');
  const emailDisp = document.getElementById('cloudUserEmailDisplay');
  const btnLogout = document.getElementById('btnLogout');
  const btnGoogle = document.getElementById('btnGoogleLogin');

  const isOnline = navigator.onLine;

  if(!isOnline){
    if(btn) btn.className = 'cloud-badge-btn';
    if(txt) txt.textContent = statusOverride || 'Offline';
    if(headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
    return;
  }

  if(currentUser && !currentUser.isAnonymous){
    if(btn) btn.className = 'cloud-badge-btn online';
    if(txt) txt.textContent = statusOverride || 'Zalogowany';
    if(activeKeyDisp) activeKeyDisp.textContent = `UID: ${currentUser.uid.substring(0, 12)}...`;
    if(emailDisp) emailDisp.textContent = `Konto: ${currentUser.email}`;
    if(btnLogout) btnLogout.style.display = 'block';
    if(btnGoogle) btnGoogle.style.display = 'none';
    if(headerLoginBtn) headerLoginBtn.style.display = 'none';
  } else if(currentUser && currentUser.isAnonymous){
    if(btn) btn.className = 'cloud-badge-btn guest';
    if(txt) txt.textContent = statusOverride || 'Gość (lokalnie)';
    if(activeKeyDisp) activeKeyDisp.textContent = `Tymczasowy gość (UID: ${currentUser.uid.substring(0, 8)}...)`;
    if(emailDisp) emailDisp.textContent = 'Uwaga: Zaloguj się przez Google, aby nie utracić danych!';
    if(btnLogout) btnLogout.style.display = 'none';
    if(btnGoogle) btnGoogle.style.display = 'block';
    if(headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
  } else {
    if(btn) btn.className = 'cloud-badge-btn guest';
    if(txt) txt.textContent = statusOverride || 'Gość (lokalnie)';
    if(activeKeyDisp) activeKeyDisp.textContent = 'Brak połączenia';
    if(emailDisp) emailDisp.textContent = 'Zaloguj się przez Google';
    if(btnLogout) btnLogout.style.display = 'none';
    if(btnGoogle) btnGoogle.style.display = 'block';
    if(headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
  }
}

window.openCloudModal = function(){
  updateCloudUI();
  document.getElementById('cloudModalOverlay').classList.add('open');
};

window.closeCloudModal = function(){
  document.getElementById('cloudModalOverlay').classList.remove('open');
};

window.syncStateToCloud = syncStateToCloud;

window.addEventListener('online', () => {
  updateCloudUI();
  if(!db || !auth?.currentUser) return;
  const syncDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'data', 'workoutState');
  if(!initialReconcileDone){
    reconcileFromServer(syncDocRef, syncSession);
  } else if(window.state?.pendingCloudSync){
    syncStateToCloud(true);
  }
});

initFirebase();
