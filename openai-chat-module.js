// OpenAI streaming chat adapter for CatolicosGPT.
// Uses the Responses API through fetch to avoid adding a new runtime dependency.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function getOpenAISettings() {
  const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
  return {
    apiKey,
    model: (process.env.OPENAI_CHAT_MODEL || 'gpt-4.1').trim(),
    seoModel: (process.env.OPENAI_SEO_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4.1').trim(),
    maxOutputTokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 4200)
  };
}

function isConfigured() {
  return Boolean(getOpenAISettings().apiKey);
}

function getConfiguredModelLabel() {
  return getOpenAISettings().model;
}

function extractDeltaFromEvent(event) {
  if (!event || typeof event !== 'object') return '';

  if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
    return event.delta;
  }

  if (event.type === 'response.refusal.delta' && typeof event.delta === 'string') {
    return event.delta;
  }

  if (typeof event.delta === 'string') return event.delta;
  if (typeof event.text === 'string') return event.text;

  return '';
}

async function createOpenAIStream(systemInstruction, prompt) {
  const settings = getOpenAISettings();
  if (!settings.apiKey) {
    return { skipped: true, response: null };
  }

  const body = {
    model: settings.model,
    instructions: systemInstruction,
    input: prompt,
    stream: true,
    store: false,
    max_output_tokens: Number.isFinite(settings.maxOutputTokens) ? settings.maxOutputTokens : 4200,
    temperature: 0.35
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_CHAT_TIMEOUT_MS || 90000))
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (_) {}
    throw new Error(`OpenAI ${response.status}: ${errorText || response.statusText}`);
  }

  return { skipped: false, response };
}

async function streamOpenAIChat({ systemInstruction, prompt, res }) {
  const { skipped, response } = await createOpenAIStream(systemInstruction, prompt);
  if (skipped || !response || !response.body) {
    return { wrote: false, skipped: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let wrote = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const rawEvents = buffer.split('\n\n');
    buffer = rawEvents.pop() || '';

    for (const rawEvent of rawEvents) {
      const dataLines = rawEvent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim());

      for (const line of dataLines) {
        if (!line || line === '[DONE]') continue;

        let event;
        try {
          event = JSON.parse(line);
        } catch (_) {
          continue;
        }

        if (event.type === 'error') {
          const message = event.error?.message || event.message || 'Error desconocido de OpenAI';
          throw new Error(message);
        }

        const delta = extractDeltaFromEvent(event);
        if (delta) {
          res.write(delta);
          wrote = true;
        }
      }
    }
  }

  return { wrote, skipped: false };
}

function extractResponseText(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.output_text === 'string') return data.output_text;

  const parts = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const c of content) {
      if (typeof c.text === 'string') parts.push(c.text);
      if (typeof c.output_text === 'string') parts.push(c.output_text);
    }
  }
  return parts.join('\n').trim();
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function generateSeoJson({ entityType, requestedField, context }) {
  const settings = getOpenAISettings();
  if (!settings.apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada.');
  }

  const systemInstruction = `Eres un especialista senior en SEO católico y formación doctrinal.
Generas metadata breve, fiel al Magisterio, clara para Google Search Console y útil para personas reales.
No inventes datos históricos concretos si el contexto no los trae.
Devuelve exclusivamente JSON válido, sin markdown ni explicación.`;

  const prompt = `Tipo de contenido: ${entityType}
Campo solicitado: ${requestedField || 'all'}

Contexto disponible:
${JSON.stringify(context || {}, null, 2)}

Genera JSON con esta estructura exacta:
{
  "seoTitle": "Título SEO en español, natural, máximo 60 caracteres",
  "metaDescription": "Meta descripción en español, natural, máximo 155 caracteres",
  "keywords": "8 a 14 keywords separadas por coma, sin repetir",
  "altText": "Texto alt claro para imagen principal si aplica"
}

Si el campo solicitado no es "all", igualmente devuelve todos los campos, pero optimiza especialmente el campo solicitado.`;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.seoModel,
      instructions: systemInstruction,
      input: prompt,
      store: false,
      max_output_tokens: Number(process.env.OPENAI_SEO_MAX_OUTPUT_TOKENS || 900),
      temperature: 0.25
    }),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_SEO_TIMEOUT_MS || 45000))
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (_) {}
    throw new Error(`OpenAI SEO ${response.status}: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const parsed = parseJsonObject(extractResponseText(data));
  if (!parsed) {
    throw new Error('OpenAI no devolvió JSON SEO válido.');
  }

  return {
    seoTitle: String(parsed.seoTitle || parsed.seo_titulo || '').trim(),
    metaDescription: String(parsed.metaDescription || parsed.seo_descripcion || parsed.descripcion || '').trim(),
    keywords: String(parsed.keywords || parsed.seo_keywords || '').trim(),
    altText: String(parsed.altText || parsed.alt_text || '').trim()
  };
}

module.exports = {
  isConfigured,
  getConfiguredModelLabel,
  streamOpenAIChat,
  generateSeoJson
};
