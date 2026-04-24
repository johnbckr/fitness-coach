let currentStep = 1;
const TOTAL_STEPS = 4;

function updateProgress() {
  const pct = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
  const fill = document.getElementById('ob-progress');
  if (fill) fill.style.width = pct + '%';

  const label = document.getElementById('ob-step-label');
  if (label) label.textContent = `Schritt ${currentStep} von ${TOTAL_STEPS}`;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById('ob-step-' + i);
    if (el) el.classList.toggle('hidden', i !== currentStep);
  }

  const back = document.getElementById('ob-back');
  const next = document.getElementById('ob-next');
  if (back) back.classList.toggle('hidden', currentStep === 1);
  if (next) next.textContent = currentStep === TOTAL_STEPS ? 'Los geht\'s 🚀' : 'Weiter →';
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    finishOnboarding();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById('ob-name')?.value.trim();
    const age = document.getElementById('ob-age')?.value;
    const weight = document.getElementById('ob-weight')?.value;
    const height = document.getElementById('ob-height')?.value;
    if (!name) { alert('Bitte gib deinen Namen ein.'); return false; }
    if (!age || age < 16 || age > 80) { alert('Bitte ein gültiges Alter eingeben.'); return false; }
    if (!weight || weight < 40) { alert('Bitte ein gültiges Gewicht eingeben.'); return false; }
    if (!height || height < 140) { alert('Bitte eine gültige Größe eingeben.'); return false; }
  }
  if (step === 2) {
    const days = document.getElementById('ob-days')?.value;
    if (!days) { alert('Bitte wähle deine Trainingstage aus.'); return false; }
  }
  return true;
}

function finishOnboarding() {
  const profile = {
    name:          document.getElementById('ob-name').value.trim(),
    age:           parseInt(document.getElementById('ob-age').value),
    gender:        document.getElementById('ob-gender').value,
    weight:        parseFloat(document.getElementById('ob-weight').value),
    height:        parseInt(document.getElementById('ob-height').value),
    bodyFat:       parseFloat(document.getElementById('ob-bf').value) || null,
    goal:          'recomp',
    fitnessLevel:  document.getElementById('ob-fitness').value,
    trainingDays:  parseInt(document.getElementById('ob-days').value),
    equipment:     document.getElementById('ob-equipment').value,
    diet:          document.getElementById('ob-diet').value,
    allergies:     document.getElementById('ob-allergies').value.trim(),
    mealsPerDay:   parseInt(document.getElementById('ob-meals').value),
    shiftWork:     document.getElementById('ob-shiftwork').value === 'yes',
    shiftDetails:  document.getElementById('ob-shift-details').value.trim(),
    activityLevel: document.getElementById('ob-activity').value,
    createdAt:     new Date().toISOString()
  };

  saveProfile(profile);
  document.getElementById('bottom-nav').classList.remove('hidden');
  navigate('dashboard');
}

// ── Selector buttons (days + meals) ──────────────────────────
function initSelectorButtons(containerId, hiddenInputId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const input = document.getElementById(hiddenInputId);
      if (input) input.value = btn.dataset.val;
    });
  });
}

// ── Shift work toggle ─────────────────────────────────────────
function initShiftWorkToggle() {
  const select = document.getElementById('ob-shiftwork');
  if (!select) return;
  select.addEventListener('change', () => {
    const group = document.getElementById('ob-shift-group');
    if (group) group.classList.toggle('hidden', select.value !== 'yes');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSelectorButtons('days-selector', 'ob-days');
  initSelectorButtons('meals-selector', 'ob-meals');
  initShiftWorkToggle();
  updateProgress();
});
