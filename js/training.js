function initTraining() {
  const raw = localStorage.getItem(KEYS.TRAINING_PLAN);
  if (raw) {
    try {
      renderTrainingPlan(JSON.parse(raw));
    } catch {
      document.getElementById('training-empty')?.classList.remove('hidden');
    }
  } else {
    document.getElementById('training-empty')?.classList.remove('hidden');
    document.getElementById('training-content')?.classList.add('hidden');
  }
}

async function generateTrainingPlan() {
  const profile = getProfile();
  if (!profile) return;

  document.getElementById('training-empty')?.classList.add('hidden');
  document.getElementById('training-loading')?.classList.remove('hidden');
  document.getElementById('training-content')?.classList.add('hidden');

  const days = profile.trainingDays;
  const split = days <= 3 ? 'Full Body' : days === 4 ? 'Upper/Lower' : 'Push/Pull/Legs';
  const daysCount = days <= 3 ? days : days === 4 ? 4 : Math.min(days, 6);

  const prompt = `Erstelle einen ${split}-Trainingsplan für ${daysCount} Trainingstage pro Woche.

Rahmendaten:
- Equipment: ${profile.equipment}
- Fitnesslevel: ${profile.fitnessLevel}
- Ziel: Recomp — Muskeln aufbauen + Fett verlieren
- Schwerpunkte: Schulterbreite (laterale Köpfe, Rear Delts), Core-Definition, V-Taper

Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{
  "split": "${split}",
  "days": [
    {
      "name": "Tag-Name",
      "focus": "Kurze Beschreibung der Muskelgruppen",
      "exercises": [
        { "name": "Übungsname", "sets": 4, "reps": "8-12", "pause": "90 Sek", "tip": "Technik-Tipp in einem Satz" }
      ]
    }
  ]
}

Füge pro Tag 5-7 Übungen ein. Nutze deutsche Übungsnamen.`;

  try {
    const response = await callCoach([{ role: 'user', content: prompt }]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Kein JSON in Antwort');

    const plan = JSON.parse(jsonMatch[0]);
    localStorage.setItem(KEYS.TRAINING_PLAN, JSON.stringify(plan));
    scheduleSyncToCloud();

    document.getElementById('training-loading')?.classList.add('hidden');
    renderTrainingPlan(plan);

  } catch (err) {
    console.error('Training plan error:', err);
    document.getElementById('training-loading')?.classList.add('hidden');
    document.getElementById('training-empty')?.classList.remove('hidden');

    const empty = document.getElementById('training-empty');
    if (empty) {
      const errMsg = empty.querySelector('.error-msg');
      if (!errMsg) {
        const p = document.createElement('p');
        p.className = 'error error-msg';
        p.textContent = 'Fehler beim Erstellen. Bitte erneut versuchen.';
        empty.appendChild(p);
      }
    }
  }
}

function renderTrainingPlan(plan) {
  const content = document.getElementById('training-content');
  if (!content) return;

  content.classList.remove('hidden');
  document.getElementById('training-empty')?.classList.add('hidden');

  content.innerHTML = `
    <div style="padding: 4px 0 8px; display: flex; align-items: center; justify-content: space-between;">
      <span class="plan-split-badge">${plan.split}</span>
      <span style="font-size:12px;color:var(--text3)">${plan.days.length} Tage</span>
    </div>
    <div class="training-tabs" id="training-tabs">
      ${plan.days.map((day, i) => `
        <button class="training-tab ${i === 0 ? 'active' : ''}"
                onclick="switchTrainingTab(${i})"
                data-tab="${i}">
          ${day.name.split(' ')[0]}
        </button>
      `).join('')}
    </div>
    ${plan.days.map((day, i) => `
      <div class="training-day ${i !== 0 ? 'hidden' : ''}" data-day="${i}">
        <div class="day-header">
          <h3>${day.name}</h3>
          <p class="day-focus">${day.focus}</p>
        </div>
        <div class="exercises">
          ${day.exercises.map((ex, j) => `
            <div class="exercise-card" id="ex-${i}-${j}">
              <div class="exercise-header" onclick="toggleExercise(${i}, ${j})">
                <span class="exercise-name">${ex.name}</span>
                <span class="exercise-meta">${ex.sets}×${ex.reps}</span>
                <span class="exercise-chevron">›</span>
              </div>
              <div class="exercise-details hidden">
                <div class="exercise-stats">
                  <span>🔁 ${ex.sets} Sätze</span>
                  <span>📊 ${ex.reps} Wdh</span>
                  <span>⏱️ ${ex.pause}</span>
                </div>
                <p class="exercise-tip">💡 ${ex.tip}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn-primary workout-done-btn"
                onclick="markWorkoutDone('${day.name}', this)">
          ✓ Training abgeschlossen
        </button>
      </div>
    `).join('')}
  `;
}

function switchTrainingTab(index) {
  document.querySelectorAll('.training-tab').forEach((t, i) => {
    t.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.training-day').forEach((d, i) => {
    d.classList.toggle('hidden', i !== index);
  });
}

function toggleExercise(dayIdx, exIdx) {
  const card = document.getElementById(`ex-${dayIdx}-${exIdx}`);
  if (!card) return;
  const details = card.querySelector('.exercise-details');
  const chevron = card.querySelector('.exercise-chevron');
  if (details) details.classList.toggle('hidden');
  if (chevron) chevron.textContent = details?.classList.contains('hidden') ? '›' : '⌄';
}

function markWorkoutDone(dayName, btn) {
  const log = JSON.parse(localStorage.getItem(KEYS.WORKOUT_LOG) || '[]');
  log.push({ date: new Date().toISOString(), type: dayName });
  localStorage.setItem(KEYS.WORKOUT_LOG, JSON.stringify(log));
  scheduleSyncToCloud();

  if (btn) {
    btn.textContent = '✅ Eingetragen!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = '✓ Training abgeschlossen';
      btn.disabled = false;
    }, 3000);
  }
}
