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
  API_PROVIDER:  'fc_api_provider'
};

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

  return base.trim();
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
  const profile = getProfile();
  if (profile) {
    document.getElementById('bottom-nav').classList.remove('hidden');
    navigate('dashboard');
  } else {
    navigate('onboarding');
  }
});
