const fs = require('fs');
const path = require('path');
const blog = require('./blog-module');
const openaiChat = require('./openai-chat-module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_PATH = path.join(DATA_DIR, 'daily-content-state.json');

const BLOG_TOPICS = [
  'sacramentos',
  'documentos eclesiales',
  'enciclicas y doctrina social',
  'vidas de santos',
  'dogmas catolicos',
  'apologetica catolica',
  'hermeneutica biblica',
  'teologia moral',
  'teologia del cuerpo',
  'Magisterio de la Iglesia'
];

const CATECHESIS_TOPICS = [
  'sacramentos',
  'oracion diaria',
  'mandamientos',
  'virtudes cristianas',
  'vida de santos',
  'Virgen Maria',
  'Biblia y Evangelios',
  'Eucaristia',
  'confesion',
  'vocacion y amistad con Cristo'
];

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch (_) {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Daily Content] No se pudo guardar estado:', e.message);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pickTopic(list, offset) {
  const daySeed = Math.floor(Date.now() / 86400000);
  return list[(daySeed + offset) % list.length];
}

function normalizeCategory(rawCategory, audience) {
  if (audience === 'niños') return 'catequesis-ninos';
  if (audience === 'jovenes') return 'catequesis-jovenes';
  return blog.slugify(rawCategory || 'doctrina');
}

function alreadyExists(title, posts) {
  const slug = blog.slugify(title || '');
  return posts.some(p => p.slug === slug || String(p.titulo || '').toLowerCase().trim() === String(title || '').toLowerCase().trim());
}

async function createOne({ contentType, audience, topic, categoryOverride }) {
  const catalog = blog.loadBlog();
  const posts = catalog.posts || [];
  const existingTitles = posts.map(p => p.titulo).filter(Boolean);
  const generated = await openaiChat.generateContentJson({
    contentType,
    audience,
    topic,
    existingTitles
  });

  if (alreadyExists(generated.titulo, posts)) {
    return { skipped: true, reason: 'duplicate', title: generated.titulo };
  }

  const post = {
    slug: blog.slugify(generated.titulo),
    titulo: generated.titulo,
    seoTitle: generated.seoTitle || generated.titulo,
    descripcion: generated.metaDescription || generated.extracto || '',
    extracto: generated.extracto || generated.metaDescription || '',
    keywords: generated.keywords || 'CatolicosGPT, ia catolica, catequesis catolica',
    categoria: categoryOverride || normalizeCategory(generated.categoria, audience),
    contenidoMd: generated.contenidoMd,
    faqs: generated.faqs || [],
    fechaCreacion: new Date().toISOString(),
    publicado: true,
    generadoAutomaticamente: true,
    fuenteGeneracion: 'openai-magisterium-context'
  };

  blog.upsertPost(post);
  return { created: true, slug: post.slug, title: post.titulo, category: post.categoria };
}

async function runDailyContentJob({ force = false } = {}) {
  if (process.env.DAILY_AUTO_CONTENT_ENABLED === '0') {
    return { skipped: true, reason: 'disabled' };
  }
  if (!openaiChat.isConfigured()) {
    return { skipped: true, reason: 'openai_not_configured' };
  }

  const key = todayKey();
  const state = readState();
  if (!force && state.lastRun === key) {
    return { skipped: true, reason: 'already_ran_today', key };
  }

  const existingToday = (blog.loadBlog().posts || []).filter(p =>
    p.generadoAutomaticamente === true &&
    String(p.fechaCreacion || '').slice(0, 10) === key
  );
  if (!force && existingToday.length >= 15) {
    state.lastRun = key;
    state.lastRunAt = new Date().toISOString();
    state.lastResults = [{ skipped: true, reason: 'existing_generated_posts_today', count: existingToday.length }];
    writeState(state);
    return { skipped: true, reason: 'existing_generated_posts_today', key, count: existingToday.length };
  }

  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(await createOne({
      contentType: 'blog de formación católica',
      audience: 'adultos',
      topic: pickTopic(BLOG_TOPICS, i)
    }));
  }

  for (let i = 0; i < 5; i++) {
    results.push(await createOne({
      contentType: 'guía práctica de catequesis para niños',
      audience: 'niños',
      topic: pickTopic(CATECHESIS_TOPICS, i),
      categoryOverride: 'catequesis-ninos'
    }));
  }

  for (let i = 0; i < 5; i++) {
    results.push(await createOne({
      contentType: 'guía práctica de catequesis para jóvenes',
      audience: 'jovenes',
      topic: pickTopic(CATECHESIS_TOPICS, i + 5),
      categoryOverride: 'catequesis-jovenes'
    }));
  }

  state.lastRun = key;
  state.lastRunAt = new Date().toISOString();
  state.lastResults = results;
  writeState(state);

  return { success: true, key, results };
}

function scheduleDailyContentJob() {
  const run = () => {
    runDailyContentJob().then(result => {
      if (!result.skipped) console.log('[Daily Content] Resultado:', JSON.stringify(result).slice(0, 500));
    }).catch(e => {
      console.error('[Daily Content] Error:', e.message);
    });
  };

  setTimeout(run, Number(process.env.DAILY_AUTO_CONTENT_START_DELAY_MS || 120000));
  setInterval(run, Number(process.env.DAILY_AUTO_CONTENT_INTERVAL_MS || 21600000));
}

module.exports = {
  runDailyContentJob,
  scheduleDailyContentJob
};
