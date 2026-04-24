const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { messages, systemPrompt, provider = 'anthropic', apiKey: clientKey } = JSON.parse(event.body);

    // Resolve API key: client-provided > Netlify env variable
    const resolveKey = (envName) => clientKey || process.env[envName];

    let content;

    if (provider === 'anthropic') {
      const key = resolveKey('ANTHROPIC_API_KEY');
      if (!key) return missingKeyError('ANTHROPIC_API_KEY');
      content = await callAnthropic(key, systemPrompt, messages);

    } else if (provider === 'gemini') {
      const key = resolveKey('GEMINI_API_KEY');
      if (!key) return missingKeyError('GEMINI_API_KEY');
      content = await callGemini(key, systemPrompt, messages);

    } else if (provider === 'openai') {
      const key = resolveKey('OPENAI_API_KEY');
      if (!key) return missingKeyError('OPENAI_API_KEY');
      content = await callOpenAI(key, systemPrompt, messages);

    } else {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Unbekannter Anbieter: ${provider}` }) };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ content }) };

  } catch (err) {
    console.error('Coach function error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

// ── Anthropic / Claude ────────────────────────────────────────
async function callAnthropic(key, systemPrompt, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic Fehler ${res.status}`);
  return data.content[0].text;
}

// ── Google Gemini ─────────────────────────────────────────────
async function callGemini(key, systemPrompt, messages) {
  // Convert Anthropic message format → Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(msg.content)
      ? msg.content.map(c => {
          if (c.type === 'image') return { inlineData: { mimeType: c.source.media_type, data: c.source.data } };
          if (c.type === 'text')  return { text: c.text };
          return { text: '' };
        })
      : [{ text: msg.content }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini Fehler ${res.status}`);
  return data.candidates[0].content.parts[0].text;
}

// ── OpenAI ────────────────────────────────────────────────────
async function callOpenAI(key, systemPrompt, messages) {
  // Convert Anthropic message format → OpenAI format
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content)
        ? msg.content.map(c => {
            if (c.type === 'image') return {
              type: 'image_url',
              image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` }
            };
            if (c.type === 'text') return { type: 'text', text: c.text };
            return { type: 'text', text: '' };
          })
        : msg.content
    }))
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: openaiMessages
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI Fehler ${res.status}`);
  return data.choices[0].message.content;
}

// ── Helper ────────────────────────────────────────────────────
function missingKeyError(envName) {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: `Kein API Key gefunden. Bitte in den Einstellungen einen Key eingeben oder ${envName} als Netlify Env Variable setzen.`
    })
  };
}
