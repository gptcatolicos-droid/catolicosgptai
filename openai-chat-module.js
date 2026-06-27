// OpenAI streaming chat adapter for CatolicosGPT.
// Uses the Responses API through fetch to avoid adding a new runtime dependency.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function getOpenAISettings() {
  const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
  return {
    apiKey,
    model: (process.env.OPENAI_CHAT_MODEL || 'gpt-4.1').trim(),
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

module.exports = {
  isConfigured,
  getConfiguredModelLabel,
  streamOpenAIChat
};
