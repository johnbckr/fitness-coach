// ═══════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════
const KEYS = {
  PROFILE:       'fc_profile',
  CHAT_HISTORY:  'fc_chat',
  TRAINING_PLAN: 'fc_training',
  WEIGHT_LOG:    'fc_weight_log',
  WORKOUT_LOG:   'fc_workout_log',
  PHOTO_CURRENT: 'fc_photo_current',
  PHOTO_GOAL:    'fc_photo_goal',
  MEAL_LOG:      'fc_meal_log',
  API_KEY:       'fc_api_key',
  API_PROVIDER:  'fc_api_provider',
  SYNC_CODE:     'fc_sync_code',
  SYNC_LAST:     'fc_sync_last',
  NOTES:         'fc_notes'
};

const SYNC_KEYS = [
  KEYS.PROFILE, KEYS.CHAT_HISTORY, KEYS.TRAINING_PLAN,
  KEYS.WEIGHT_LOG, KEYS.WORKOUT_LOG, KEYS.MEAL_LOG,
  KEYS.PHOTO_CURRENT, KEYS.PHOTO_GOAL, KEYS.NOTES
];

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Page-specific initializers
  const inits = {
    dashboard: initDashboard,
    training:  initTraining,
    nutrition: initNutrition,
    tracking:  initTracking,
    chat:      initChat,
    profile:   initProfile
  };
  if (inits[page]) inits[page]();
}

// ═══════════════════════════════════════════
// PROFILE STORAGE
// ═══════════════════════════════════════════
function getProfile() {
  const s = localStorage.getItem(KEYS.PROFILE);
  return s ? JSON.parse(s) : null;
}

function saveProfile(profile) {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

// ═══════════════════════════════════════════
// PHOTO STORAGE
// ═══════════════════════════════════════════
function getPhoto(type) {
  return localStorage.getItem(type === 'current' ? KEYS.PHOTO_CURRENT : KEYS.PHOTO_GOAL);
}

function savePhoto(type, base64) {
  localStorage.setItem(type === 'current' ? KEYS.PHOTO_CURRENT : KEYS.PHOTO_GOAL, base64);
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 800;
        let w = img.width, h = img.height;
        if (w > h && w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
        else if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(type, input) {
  if (!input.files || !input.files[0]) return;
  try {
    const base64 = await compressImage(input.files[0]);
    savePhoto(type, base64);

    // Update previews in onboarding
    const preview = document.getElementById('photo-preview-' + type);
    const placeholder = document.getElementById('photo-ph-' + type);
    if (preview) {
      preview.src = base64;
      preview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
  } catch (err) {
    console.error('Photo upload error:', err);
  }
}

// ═══════════════════════════════════════════
// CLAUDE API CALL
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// API SETTINGS
// ═══════════════════════════════════════════
function getApiProvider() {
  return localStorage.getItem(KEYS.API_PROVIDER) || 'anthropic';
}

function getApiKey() {
  return localStorage.getItem(KEYS.API_KEY) || '';
}

async function callCoach(messages, customSystemPrompt) {
  const profile = getProfile();
  const systemPrompt = customSystemPrompt || buildSystemPrompt(profile);
  const provider = getApiProvider();
  const apiKey = getApiKey();

  const response = await fetch('/.netlify/functions/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt, provider, apiKey })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}

// ═══════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════
function buildSystemPrompt(profile) {
  const base = profile ? `
Du bist ${profile.name}s persönlicher Fitnesscoach und Lookmixer.
Deine EINZIGE Mission: ${profile.name} so effizient wie möglich von seinem aktuellen Körper zu seinem Zielkörper zu bringen.

=== IST-STAND ===
- Körperfett: ~15–18%, gute Grundmuskelmasse (Brust, Schultern, Arme)
- Bauch/Mitte weich — kein Sixpack sichtbar, kein ausgeprägter V-Taper

=== ZIEL ===
- Körperfett: ~8–10%, klares Sixpack, breitere Schultern, vollere Brust, definierte Arme
- Ausgeprägter V-Taper

=== FOKUS ===
1. Fettabbau ~16% → ~9% (leichtes Kaloriendefizit + hohes Protein)
2. Schulterbreite aufbauen (laterale Köpfe, Rear Delts)
3. Core-Definition (Fettabbau legt Sixpack frei)
4. Muskelfülle durch progressive Overload

Profil:
- Alter: ${getAge(profile)} Jahre | Gewicht: ${profile.weight}kg | Größe: ${profile.height}cm${profile.bodyFat ? ` | KF: ${profile.bodyFat}%` : ''}
- Fitnesslevel: ${profile.fitnessLevel} | Trainingstage: ${profile.trainingDays}/Woche | Equipment: ${profile.equipment}
- Ernährung: ${profile.diet}${profile.allergies ? ` | Allergien: ${profile.allergies}` : ''}
- Schichtarbeit: ${profile.shiftWork ? profile.shiftDetails || 'Ja' : 'Nein'}
- Aktivitätslevel: ${profile.activityLevel}

Antworte immer auf Deutsch. Direkt, präzise, ergebnisorientiert.
Keine Floskeln — nur was für diesen spezifischen Körper und dieses Ziel relevant ist.
` : 'Du bist ein Fitnesscoach. Antworte auf Deutsch. Sei direkt und ergebnisorientiert.';

  const notes = localStorage.getItem(KEYS.NOTES);
  const notesSection = notes ? `\n\n=== ZUSÄTZLICHE INFOS ===\n${notes}` : '';

  return (base + notesSection).trim();
}

// ═══════════════════════════════════════════
// TDEE CALCULATION (Mifflin-St Jeor)
// ═══════════════════════════════════════════
function calculateTDEE(profile) {
  if (!profile) return 2200;
  const isMale = profile.gender !== 'weiblich';
  const age = getAge(profile);
  const bmr = isMale
    ? 10 * profile.weight + 6.25 * profile.height - 5 * age + 5
    : 10 * profile.weight + 6.25 * profile.height - 5 * age - 161;

  const multipliers = {
    'sitzend':      1.2,
    'leicht aktiv': 1.375,
    'aktiv':        1.55,
    'sehr aktiv':   1.725
  };
  return Math.round(bmr * (multipliers[profile.activityLevel] || 1.375));
}

// ═══════════════════════════════════════════
// FORMAT MESSAGE (simple markdown → HTML)
// ═══════════════════════════════════════════
function formatMessage(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h4>$1</h4>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function initDashboard() {
  const profile = getProfile();
  if (!profile) return;

  document.getElementById('dash-name').textContent = profile.name;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Stats
  const weightLog = JSON.parse(localStorage.getItem(KEYS.WEIGHT_LOG) || '[]');
  const lastWeight = weightLog.length ? weightLog[weightLog.length - 1].weight : null;
  document.getElementById('dash-weight').textContent = lastWeight ? lastWeight.toFixed(1) : '—';

  const tdee = calculateTDEE(profile);
  document.getElementById('dash-calories').textContent = Math.round(tdee * 0.85);

  const workoutLog = JSON.parse(localStorage.getItem(KEYS.WORKOUT_LOG) || '[]');
  const weekStart = getWeekStart();
  const weekWorkouts = workoutLog.filter(e => new Date(e.date) >= weekStart).length;
  document.getElementById('dash-workouts').textContent = weekWorkouts;

  const plan = localStorage.getItem(KEYS.TRAINING_PLAN);
  const statusEl = document.getElementById('dash-plan-status');
  if (statusEl) statusEl.textContent = plan ? 'Plan aktiv ✓' : 'Plan erstellen';

  // Photos
  const photoCurrent = getPhoto('current');
  const photoGoal = getPhoto('goal');

  const imgCurrent = document.getElementById('dash-photo-current');
  const phCurrent = document.getElementById('dash-photo-ph-current');
  if (imgCurrent && photoCurrent) {
    imgCurrent.src = photoCurrent;
    imgCurrent.classList.remove('hidden');
    if (phCurrent) phCurrent.classList.add('hidden');
  }

  const imgGoal = document.getElementById('dash-photo-goal');
  const phGoal = document.getElementById('dash-photo-ph-goal');
  if (imgGoal && photoGoal) {
    imgGoal.src = photoGoal;
    imgGoal.classList.remove('hidden');
    if (phGoal) phGoal.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════
// PROFILE / SETTINGS PAGE
// ═══════════════════════════════════════════
function initProfile() {
  prefillEditForm();
  refreshProfilePhotos();
  renderApiTab();
  initSyncTab();
  initNotesTab();

  const editBirthdate = document.getElementById('edit-birthdate');
  if (editBirthdate) editBirthdate.max = new Date().toISOString().split('T')[0];

  const editShiftwork = document.getElementById('edit-shiftwork');
  if (editShiftwork) {
    editShiftwork.addEventListener('change', () => {
      const group = document.getElementById('edit-shift-group');
      if (group) group.classList.toggle('hidden', editShiftwork.value !== 'yes');
    });
  }
}

function switchProfileTab(tabName, btn) {
  document.querySelectorAll('.profile-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('ptab-' + tabName);
  if (target) target.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tabName === 'photos') refreshProfilePhotos();
  if (tabName === 'api') renderApiTab();
  if (tabName === 'sync') initSyncTab();
  if (tabName === 'notes') initNotesTab();
}

function prefillEditForm() {
  const p = getProfile();
  if (!p) return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  set('edit-name', p.name);
  set('edit-birthdate', p.birthDate);
  set('edit-gender', p.gender);
  set('edit-weight', p.weight);
  set('edit-height', p.height);
  set('edit-bf', p.bodyFat || '');
  set('edit-fitness', p.fitnessLevel);
  set('edit-days', p.trainingDays);
  set('edit-meals', p.mealsPerDay);
  set('edit-equipment', p.equipment);
  set('edit-diet', p.diet);
  set('edit-allergies', p.allergies || '');
  set('edit-activity', p.activityLevel);
  set('edit-shiftwork', p.shiftWork ? 'yes' : 'no');
  set('edit-shift-details', p.shiftDetails || '');
  const shiftGroup = document.getElementById('edit-shift-group');
  if (shiftGroup) shiftGroup.classList.toggle('hidden', !p.shiftWork);
}

function saveProfileEdit() {
  const existing = getProfile() || {};
  const updated = {
    ...existing,
    name:          document.getElementById('edit-name')?.value.trim() || existing.name,
    birthDate:     document.getElementById('edit-birthdate')?.value || existing.birthDate,
    gender:        document.getElementById('edit-gender')?.value || existing.gender,
    weight:        parseFloat(document.getElementById('edit-weight')?.value) || existing.weight,
    height:        parseInt(document.getElementById('edit-height')?.value) || existing.height,
    bodyFat:       parseFloat(document.getElementById('edit-bf')?.value) || null,
    fitnessLevel:  document.getElementById('edit-fitness')?.value || existing.fitnessLevel,
    trainingDays:  parseInt(document.getElementById('edit-days')?.value) || existing.trainingDays,
    mealsPerDay:   parseInt(document.getElementById('edit-meals')?.value) || existing.mealsPerDay,
    equipment:     document.getElementById('edit-equipment')?.value || existing.equipment,
    diet:          document.getElementById('edit-diet')?.value || existing.diet,
    allergies:     document.getElementById('edit-allergies')?.value.trim() || '',
    activityLevel: document.getElementById('edit-activity')?.value || existing.activityLevel,
    shiftWork:     document.getElementById('edit-shiftwork')?.value === 'yes',
    shiftDetails:  document.getElementById('edit-shift-details')?.value.trim() || ''
  };
  saveProfile(updated);
  scheduleSyncToCloud();
  const fb = document.getElementById('edit-save-feedback');
  if (fb) { fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 2500); }
}

// ── API Settings ──────────────────────────────────────────────
function renderApiTab() {
  const provider = getApiProvider();
  const key = getApiKey();

  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });

  const input = document.getElementById('api-key-input');
  if (input && key) input.value = key;

  const status = document.getElementById('api-key-status');
  if (status) {
    const labels = { anthropic: 'Claude', gemini: 'Gemini', openai: 'OpenAI' };
    status.innerHTML = key
      ? `<span style="color:var(--green);font-size:13px">✅ ${labels[provider] || provider} aktiv</span>`
      : `<span style="color:var(--text3);font-size:13px">Kein Key gespeichert — Netlify Env Variable wird verwendet</span>`;
  }

  const hints = {
    anthropic: 'console.anthropic.com → API Keys',
    gemini:    'aistudio.google.com → Get API key',
    openai:    'platform.openai.com → API keys'
  };
  const hint = document.getElementById('api-key-hint');
  if (hint) hint.textContent = hints[provider] || '';
}

function selectProvider(provider) {
  localStorage.setItem(KEYS.API_PROVIDER, provider);
  localStorage.removeItem(KEYS.API_KEY);
  const input = document.getElementById('api-key-input');
  if (input) input.value = '';
  renderApiTab();
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const key = input?.value.trim();
  if (!key) { alert('Bitte einen API Key eingeben.'); return; }
  localStorage.setItem(KEYS.API_KEY, key);
  renderApiTab();
  const fb = document.getElementById('api-save-feedback');
  if (fb) { fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 2500); }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function refreshProfilePhotos() {
  ['current', 'goal'].forEach(type => {
    const photo = getPhoto(type);
    const preview = document.getElementById('profile-preview-' + type);
    const ph = document.getElementById('profile-ph-' + type);
    if (preview && photo) {
      preview.src = photo;
      preview.classList.remove('hidden');
      if (ph) ph.classList.add('hidden');
    }
  });
}

// ═══════════════════════════════════════════
// PERSONAL NOTES
// ═══════════════════════════════════════════
function initNotesTab() {
  const ta = document.getElementById('notes-textarea');
  if (ta) ta.value = localStorage.getItem(KEYS.NOTES) || '';
}

function saveNotes() {
  const ta = document.getElementById('notes-textarea');
  const val = ta?.value || '';
  localStorage.setItem(KEYS.NOTES, val);
  scheduleSyncToCloud();
  const fb = document.getElementById('notes-save-feedback');
  if (fb) { fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 2500); }
}

// ═══════════════════════════════════════════
// CLOUD SYNC
// ═══════════════════════════════════════════
function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getOrCreateSyncCode() {
  let code = localStorage.getItem(KEYS.SYNC_CODE);
  if (!code) {
    code = generateSyncCode();
    localStorage.setItem(KEYS.SYNC_CODE, code);
  }
  return code;
}

function gatherSyncData() {
  const data = {};
  SYNC_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val) data[key] = val;
  });
  return data;
}

function applySyncData(data) {
  if (!data) return;
  SYNC_KEYS.forEach(key => {
    if (data[key] !== undefined) localStorage.setItem(key, data[key]);
  });
}

async function syncToCloud() {
  const syncCode = getOrCreateSyncCode();
  const data = gatherSyncData();
  try {
    const res = await fetch('/.netlify/functions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_code: syncCode, data })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const now = new Date().toISOString();
    localStorage.setItem(KEYS.SYNC_LAST, now);
    updateSyncStatus();
  } catch (err) {
    console.warn('Sync failed:', err.message);
  }
}

async function loadFromCloud(code) {
  const res = await fetch(`/.netlify/functions/sync?code=${encodeURIComponent(code)}`);
  const row = await res.json();
  if (!res.ok) throw new Error(row.error || `HTTP ${res.status}`);
  return row;
}

async function connectSyncCode() {
  const input = document.getElementById('sync-connect-input');
  const code = input?.value.trim().toUpperCase();
  if (!code || code.length < 4) { alert('Bitte einen gültigen Sync-Code eingeben.'); return; }

  const btn = document.getElementById('sync-connect-btn');
  if (btn) btn.disabled = true;
  setSyncMsg('Verbinde...', 'neutral');

  try {
    const row = await loadFromCloud(code);
    if (!row) { setSyncMsg('❌ Code nicht gefunden. Bitte prüfen.', 'error'); return; }
    applySyncData(row.data);
    localStorage.setItem(KEYS.SYNC_CODE, code);
    localStorage.setItem(KEYS.SYNC_LAST, row.updated_at || new Date().toISOString());
    setSyncMsg('✅ Verbunden! App wird neu geladen...', 'ok');
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    setSyncMsg('❌ Fehler: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let _syncTimer = null;
function scheduleSyncToCloud() {
  if (window.location.protocol === 'file:') return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncToCloud, 3000);
}

function initSyncTab() {
  const code = getOrCreateSyncCode();
  const codeEl = document.getElementById('sync-code-display');
  if (codeEl) codeEl.textContent = code;

  const lastEl = document.getElementById('sync-last-time');
  if (lastEl) {
    const last = localStorage.getItem(KEYS.SYNC_LAST);
    lastEl.textContent = last
      ? 'Zuletzt: ' + new Date(last).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
      : 'Noch nicht synchronisiert';
  }
}

function updateSyncStatus() {
  const lastEl = document.getElementById('sync-last-time');
  if (!lastEl) return;
  const last = localStorage.getItem(KEYS.SYNC_LAST);
  if (last) lastEl.textContent = 'Zuletzt: ' + new Date(last).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function setSyncMsg(msg, type) {
  const el = document.getElementById('sync-status-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status-msg ' + (type || '');
}

async function manualSync() {
  const btn = document.getElementById('sync-now-btn');
  if (btn) btn.disabled = true;
  setSyncMsg('Synchronisiere...', 'neutral');
  try {
    await syncToCloud();
    setSyncMsg('✅ Synchronisiert!', 'ok');
  } catch (err) {
    setSyncMsg('❌ ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function copySyncCode() {
  const code = localStorage.getItem(KEYS.SYNC_CODE);
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('sync-copy-btn');
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Kopiert'; setTimeout(() => btn.textContent = orig, 2000); }
  });
}

function resetSyncCode() {
  if (!confirm('Neuen Sync-Code erstellen? Der alte Code wird ungültig.')) return;
  const code = generateSyncCode();
  localStorage.setItem(KEYS.SYNC_CODE, code);
  initSyncTab();
  syncToCloud();
}

function resetApp() {
  if (!confirm('Alle Daten löschen und neu starten?')) return;
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  document.getElementById('bottom-nav').classList.add('hidden');
  navigate('onboarding');
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function calcAgeFromBirthdate(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAge(profile) {
  if (profile.birthDate) return calcAgeFromBirthdate(profile.birthDate);
  return profile.age || 25;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ═══════════════════════════════════════════
// APP INIT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.protocol === 'file:') {
    showLocalFileBanner();
  }

  const profile = getProfile();
  if (profile) {
    document.getElementById('bottom-nav').classList.remove('hidden');
    navigate('dashboard');
  } else {
    navigate('onboarding');
  }
});

function showLocalFileBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #b45309; color: #fff; padding: 10px 16px;
    font-size: 13px; line-height: 1.4; text-align: center;
  `;
  banner.innerHTML = `
    ⚠️ <strong>Lokale Datei</strong> — Der Coach funktioniert nur über einen Server.
    Nutze deine <strong>Netlify URL</strong> oder starte lokal mit <code style="background:rgba(0,0,0,0.3);padding:1px 5px;border-radius:3px">netlify dev</code>.
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;margin-left:10px;cursor:pointer;font-size:15px">✕</button>
  `;
  document.body.prepend(banner);
}
