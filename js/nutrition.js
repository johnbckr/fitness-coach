function initNutrition() {
  renderMacros();
  renderMealLog();
}

function switchNutritionTab(tabName, btn) {
  document.querySelectorAll('.nutrition-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('ntab-' + tabName);
  if (target) target.classList.remove('hidden');
  if (btn) btn.classList.add('active');

  if (tabName === 'meallog') renderMealLog();
}

function renderMacros() {
  const profile = getProfile();
  const container = document.getElementById('macro-display');
  if (!container) return;

  if (!profile) {
    container.innerHTML = '<p style="color:var(--text3)">Profil nicht gefunden.</p>';
    return;
  }

  const tdee = calculateTDEE(profile);
  const targetCal = Math.round(tdee * 0.85);
  const protein = Math.round(profile.weight * 2.2);
  const fat = Math.round((targetCal * 0.25) / 9);
  const carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);

  const proteinPct = Math.round((protein * 4 / targetCal) * 100);
  const carbPct = Math.round((carbs * 4 / targetCal) * 100);
  const fatPct = Math.round((fat * 9 / targetCal) * 100);

  container.innerHTML = `
    <div class="calorie-target">${targetCal} kcal</div>
    <div class="macro-bar-item">
      <div class="macro-label">
        <span>Protein</span>
        <span>${protein}g · ${proteinPct}%</span>
      </div>
      <div class="macro-bar">
        <div class="macro-fill protein" style="width:${proteinPct}%"></div>
      </div>
    </div>
    <div class="macro-bar-item">
      <div class="macro-label">
        <span>Kohlenhydrate</span>
        <span>${carbs}g · ${carbPct}%</span>
      </div>
      <div class="macro-bar">
        <div class="macro-fill carbs" style="width:${carbPct}%"></div>
      </div>
    </div>
    <div class="macro-bar-item">
      <div class="macro-label">
        <span>Fett</span>
        <span>${fat}g · ${fatPct}%</span>
      </div>
      <div class="macro-bar">
        <div class="macro-fill fat" style="width:${fatPct}%"></div>
      </div>
    </div>
    <p class="macro-note">TDEE: ${tdee} kcal | Defizit: ${tdee - targetCal} kcal | Ziel: Recomp</p>
  `;
}

async function generateRecipe() {
  const ingredients = document.getElementById('recipe-ingredients')?.value.trim();
  const output = document.getElementById('recipe-output');
  if (!output) return;

  if (!ingredients) {
    alert('Bitte Zutaten eingeben (z.B. Hähnchen, Reis, Brokkoli)');
    return;
  }

  output.innerHTML = '<div class="loading-text">🧑‍🍳 Coach erstellt Rezept...</div>';

  const profile = getProfile();
  const tdee = calculateTDEE(profile);
  const targetCal = Math.round(tdee * 0.85);
  const meals = profile?.mealsPerDay || 3;
  const protein = Math.round((profile?.weight || 80) * 2.2);

  const prompt = `Erstelle ein High-Protein Rezept mit diesen Zutaten: ${ingredients}.

Ziele:
- Kalorien: ~${Math.round(targetCal / meals)} kcal
- Protein: mindestens ${Math.round(protein / meals)}g
- Ernährungsform: ${profile?.diet || 'Normal'}
${profile?.allergies ? `- Allergien vermeiden: ${profile.allergies}` : ''}
- Ziel: Recomp (Muskeln + Fett verlieren)

Struktur: **Rezeptname** | Zubereitungszeit | Nährwerte (kcal, Protein, Carbs, Fett) | Zutaten-Liste | Zubereitung (nummerierte Schritte)`;

  try {
    const response = await callCoach([{ role: 'user', content: prompt }]);
    output.innerHTML = `<div class="recipe-card">${formatMessage(response)}</div>`;
  } catch (err) {
    output.innerHTML = '<p class="error">Fehler beim Erstellen. Bitte erneut versuchen.</p>';
  }
}

async function generateMealPlan() {
  const output = document.getElementById('mealplan-output');
  if (!output) return;

  output.innerHTML = '<div class="loading-text">📋 Coach erstellt Tagesplan...</div>';

  const profile = getProfile();
  const tdee = calculateTDEE(profile);
  const targetCal = Math.round(tdee * 0.85);
  const protein = Math.round((profile?.weight || 80) * 2.2);

  const prompt = `Erstelle einen vollständigen Tages-Mahlzeitenplan.

Daten:
- Kalorien: ${targetCal} kcal gesamt
- Protein: ${protein}g gesamt
- Anzahl Mahlzeiten: ${profile?.mealsPerDay || 3}
- Ernährungsform: ${profile?.diet || 'Normal'}
${profile?.allergies ? `- Allergien: ${profile.allergies}` : ''}
${profile?.shiftWork ? `- Schichtarbeit: ${profile.shiftDetails || 'Ja'}` : ''}

Für jede Mahlzeit: Uhrzeit · Name · Hauptzutaten · Kalorien · Protein (g)
Am Ende: Tages-Summe der Makros.`;

  try {
    const response = await callCoach([{ role: 'user', content: prompt }]);
    output.innerHTML = `<div class="mealplan-card">${formatMessage(response)}</div>`;
  } catch (err) {
    output.innerHTML = '<p class="error">Fehler. Bitte erneut versuchen.</p>';
  }
}

function logMeal() {
  const input = document.getElementById('meal-log-input');
  const text = input?.value.trim();
  if (!text) return;

  const log = JSON.parse(localStorage.getItem(KEYS.MEAL_LOG) || '[]');
  log.unshift({ date: new Date().toISOString(), meal: text });
  if (log.length > 100) log.length = 100;
  localStorage.setItem(KEYS.MEAL_LOG, JSON.stringify(log));
  scheduleSyncToCloud();

  input.value = '';
  renderMealLog();
}

function renderMealLog() {
  const log = JSON.parse(localStorage.getItem(KEYS.MEAL_LOG) || '[]');
  const container = document.getElementById('meal-log-list');
  if (!container) return;

  if (!log.length) {
    container.innerHTML = '<p class="empty-text">Noch keine Mahlzeiten eingetragen</p>';
    return;
  }

  const today = new Date().toDateString();
  const todayItems = log.filter(i => new Date(i.date).toDateString() === today);

  container.innerHTML = `
    <p class="log-date-header">Heute (${todayItems.length} Mahlzeiten)</p>
    ${todayItems.length
      ? todayItems.map(item => `
        <div class="log-item">
          <span class="log-time">${new Date(item.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="log-meal">${item.meal}</span>
        </div>`).join('')
      : '<p class="empty-text">Noch nichts heute eingetragen</p>'
    }
  `;
}
