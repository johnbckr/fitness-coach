function initTracking() {
  renderWeightChart();
  renderWorkoutStreak();
  renderWorkoutLog();
}

function logWeight() {
  const input = document.getElementById('weight-input');
  const weight = parseFloat(input?.value);
  if (!weight || weight < 30 || weight > 300) {
    alert('Bitte ein gültiges Gewicht eingeben (30–300 kg)');
    return;
  }

  const log = JSON.parse(localStorage.getItem(KEYS.WEIGHT_LOG) || '[]');
  log.push({ date: new Date().toISOString(), weight });
  localStorage.setItem(KEYS.WEIGHT_LOG, JSON.stringify(log));

  if (input) input.value = '';

  const btn = document.getElementById('weight-log-btn');
  if (btn) {
    btn.textContent = '✅ Gespeichert!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Eintragen'; btn.disabled = false; }, 2000);
  }

  renderWeightChart();
  renderWorkoutStreak();
}

function renderWeightChart() {
  const log = JSON.parse(localStorage.getItem(KEYS.WEIGHT_LOG) || '[]');
  const svg = document.getElementById('weight-chart');
  const trendEl = document.getElementById('weight-trend');
  if (!svg) return;

  if (log.length < 2) {
    svg.setAttribute('viewBox', '0 0 340 160');
    svg.innerHTML = `
      <text x="170" y="85" text-anchor="middle" fill="#555" font-size="13" font-family="system-ui">
        ${log.length === 0 ? 'Trag dein Gewicht ein um den Verlauf zu sehen' : 'Mindestens 2 Einträge für den Chart'}
      </text>`;
    if (trendEl) trendEl.textContent = log.length === 1 ? `Aktuell: ${log[0].weight} kg` : '';
    return;
  }

  const recent = log.slice(-30);
  const weights = recent.map(e => e.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = Math.max(maxW - minW, 1);
  const padVal = range * 0.15;

  const W = 340, H = 160;
  const pL = 44, pR = 12, pT = 12, pB = 28;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const xPos = (i) => pL + (i / (recent.length - 1)) * cW;
  const yPos = (w) => pT + (1 - (w - (minW - padVal)) / (range + 2 * padVal)) * cH;

  const pathD = recent.map((e, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(e.weight).toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${xPos(recent.length - 1).toFixed(1)},${(H - pB).toFixed(1)} L${xPos(0).toFixed(1)},${(H - pB).toFixed(1)} Z`;

  // Y-axis labels
  const ySteps = 3;
  const yLabels = Array.from({ length: ySteps }, (_, i) => {
    const w = minW + (range * i / (ySteps - 1));
    return `<text x="${pL - 5}" y="${yPos(w) + 4}" text-anchor="end" fill="#666" font-size="11" font-family="system-ui">${w.toFixed(1)}</text>`;
  }).join('');

  // Data points (show every nth for readability)
  const step = Math.max(1, Math.floor(recent.length / 8));
  const dots = recent
    .filter((_, i) => i % step === 0 || i === recent.length - 1)
    .map((e, _, arr) => {
      const origIdx = recent.indexOf(e);
      return `<circle cx="${xPos(origIdx).toFixed(1)}" cy="${yPos(e.weight).toFixed(1)}" r="3.5" fill="#f97316"/>`;
    }).join('');

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f97316" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#f97316" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#wGrad)"/>
    <path d="${pathD}" fill="none" stroke="#f97316" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${yLabels}
    <line x1="${pL}" y1="${H - pB}" x2="${W - pR}" y2="${H - pB}" stroke="#2a2a2a" stroke-width="1"/>
  `;

  // Trend
  if (trendEl) {
    const last = log[log.length - 1].weight;
    const prev = log[log.length - 2].weight;
    const diff = +(last - prev).toFixed(1);
    const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
    const color = diff <= 0 ? '#22c55e' : '#ef4444';
    trendEl.innerHTML = `Letzter Eintrag: <strong>${last} kg</strong> <span style="color:${color}">${arrow} ${Math.abs(diff)} kg</span>`;
  }
}

function renderWorkoutStreak() {
  const log = JSON.parse(localStorage.getItem(KEYS.WORKOUT_LOG) || '[]');
  const streakEl = document.getElementById('streak-display');
  if (!streakEl) return;

  const weekStart = getWeekStart();
  const thisWeek = log.filter(e => new Date(e.date) >= weekStart);

  const profile = getProfile();
  const target = profile?.trainingDays || 4;
  const done = thisWeek.length;
  const pct = Math.round((done / target) * 100);

  streakEl.innerHTML = `
    <div style="font-size:22px;font-weight:800;color:var(--accent)">🔥 ${done} / ${target}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:4px">Trainings diese Woche · ${pct}%</div>
  `;
}

function renderWorkoutLog() {
  const log = JSON.parse(localStorage.getItem(KEYS.WORKOUT_LOG) || '[]');
  const container = document.getElementById('workout-log-list');
  if (!container) return;

  const recent = log.slice(-15).reverse();

  if (!recent.length) {
    container.innerHTML = '<p class="empty-text">Noch keine Trainings eingetragen</p>';
    return;
  }

  container.innerHTML = recent.map(entry => `
    <div class="log-item">
      <span class="log-workout-icon">✅</span>
      <div>
        <span class="log-workout-type">${entry.type}</span>
        <span class="log-workout-date">${new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  `).join('');
}

async function startCheckIn() {
  const profile = getProfile();
  const weightLog = JSON.parse(localStorage.getItem(KEYS.WEIGHT_LOG) || '[]');
  const workoutLog = JSON.parse(localStorage.getItem(KEYS.WORKOUT_LOG) || '[]');

  const lastWeight = weightLog.length ? weightLog[weightLog.length - 1].weight : null;
  const weekStart = getWeekStart();
  const weekWorkouts = workoutLog.filter(e => new Date(e.date) >= weekStart).length;
  const target = profile?.trainingDays || 4;

  const checkInPrompt = `Wöchentlicher Check-in — Mein aktueller Stand:
- Gewicht: ${lastWeight ? lastWeight + ' kg' : 'nicht eingetragen'}
- Trainings diese Woche: ${weekWorkouts} von ${target} geplant
- Datum: ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}

Führe meinen Check-in durch. Frag mich gezielt 3-4 Fragen zu dieser Woche (Energie, Schlaf, Ernährung, spürbarer Fortschritt). Danach gib mir ein konkretes Feedback und konkrete Anpassungen für die nächste Woche.`;

  navigate('chat');
  const input = document.getElementById('chat-input');
  if (input) input.value = checkInPrompt;
  await sendMessage();
}
