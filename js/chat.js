let chatHistory = [];
let isSending = false;

function initChat() {
  loadChatHistory();
  renderMessages();

  const input = document.getElementById('chat-input');
  if (input) {
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }
}

function loadChatHistory() {
  const s = localStorage.getItem(KEYS.CHAT_HISTORY);
  chatHistory = s ? JSON.parse(s) : [];
}

function saveChatHistory() {
  if (chatHistory.length > 60) chatHistory = chatHistory.slice(-60);
  localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(chatHistory));
  scheduleSyncToCloud();
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const chips = document.getElementById('chat-chips');

  if (!chatHistory.length) {
    const profile = getProfile();
    container.innerHTML = `
      <div class="chat-welcome">
        <div class="coach-avatar">🏋️</div>
        <p>Hey${profile ? ' <strong>' + profile.name + '</strong>' : ''}!<br>
        Ich kenne dein Ziel und bin hier um dich dorthin zu bringen.<br>
        Was brauchst du heute?</p>
      </div>`;
    if (chips) chips.classList.remove('hidden');
    return;
  }

  if (chips) chips.classList.add('hidden');

  container.innerHTML = chatHistory.map(msg => `
    <div class="message ${msg.role}">
      <div class="message-content">${formatMessage(msg.content)}</div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  isSending = true;

  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  chatHistory.push({ role: 'user', content: text });
  saveChatHistory();
  renderMessages();
  showTyping();

  try {
    const apiMessages = buildApiMessages();
    const response = await callCoach(apiMessages);

    hideTyping();
    chatHistory.push({ role: 'assistant', content: response });
    saveChatHistory();
    renderMessages();

  } catch (err) {
    hideTyping();
    chatHistory.push({ role: 'assistant', content: buildErrorMessage(err) });
    saveChatHistory();
    renderMessages();
  } finally {
    isSending = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function buildApiMessages() {
  // Build message array for API, injecting photos into first user message
  const photoCurrent = getPhoto('current');
  const photoGoal = getPhoto('goal');

  return chatHistory.map((msg, idx) => {
    // Inject photos into the very first user message of a new conversation
    if (idx === 0 && msg.role === 'user' && photoCurrent && photoGoal) {
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: photoCurrent.replace(/^data:image\/\w+;base64,/, '')
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: photoGoal.replace(/^data:image\/\w+;base64,/, '')
            }
          },
          {
            type: 'text',
            text: 'Bild 1 ist mein aktueller Stand, Bild 2 ist mein Zielkörper. Behalte beide immer im Blick.\n\n' + msg.content
          }
        ]
      };
    }
    return { role: msg.role, content: msg.content };
  });
}

function sendChip(text) {
  const input = document.getElementById('chat-input');
  if (input) input.value = text;
  sendMessage();
}

function clearChat() {
  if (!confirm('Chat-Verlauf löschen?')) return;
  chatHistory = [];
  saveChatHistory();
  renderMessages();
}

function buildErrorMessage(err) {
  const msg = err?.message || '';

  if (window.location.protocol === 'file:') {
    return '⚠️ **Lokale Datei erkannt**\n\nDie App muss über einen Server laufen damit der Coach funktioniert. Zwei Optionen:\n\n**Option 1 (empfohlen):** Nutze die Netlify URL deiner App\n**Option 2 (lokal):** Starte `netlify dev` im Terminal im Projektordner';
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::')) {
    return '⚠️ **Verbindungsfehler**\n\nDie Netlify Function ist nicht erreichbar. Mögliche Ursachen:\n• Kein Internet\n• App noch nicht auf Netlify deployed\n• Netlify Function hat einen Fehler';
  }

  if (msg.includes('API Key') || msg.includes('api_key') || msg.includes('authentication') || msg.includes('401')) {
    return '⚠️ **API Key Fehler**\n\nDer API Key ist ungültig oder abgelaufen. Geh in **Einstellungen → API** und prüfe deinen Key.';
  }

  if (msg.includes('quota') || msg.includes('429') || msg.includes('rate limit')) {
    return '⚠️ **Limit erreicht**\n\nDein API-Kontingent ist aufgebraucht oder du sendest zu schnell. Kurz warten und erneut versuchen.';
  }

  return `⚠️ **Fehler:** ${msg || 'Unbekannter Fehler'}\n\nPrüfe den API Key in den Einstellungen.`;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.id = 'typing-indicator';
  el.className = 'message assistant typing';
  el.innerHTML = '<div class="message-content"><div class="dots"><span></span><span></span><span></span></div></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing-indicator')?.remove();
}
