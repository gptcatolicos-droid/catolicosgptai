const fs = require('fs');
const path = require('path');
const blog = require('./blog-module');
const openaiChat = require('./openai-chat-module');
const catholicAgent = require('./catholic-agent');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_PATH = path.join(DATA_DIR, 'daily-content-state.json');

// Cuántos artículos se publican cada día.
const ARTICULOS_POR_DIA = Math.max(1, Number(process.env.DAILY_AUTO_CONTENT_COUNT) || 10);

// Los ejes son de qué se escribe; los enfoques, desde dónde se mira. Diez ejes
// sueltos no dan para diez artículos al día: al segundo día se vuelve a escribir
// sobre lo mismo y salen textos gemelos. Cruzándolos con los enfoques hay cien
// combinaciones por audiencia, y el registro de las ya usadas garantiza que no
// se repita ninguna hasta agotarlas.
const EJES_ADULTOS = [
  'los sacramentos',
  'los documentos del Magisterio',
  'las encíclicas y la doctrina social de la Iglesia',
  'la vida de los santos',
  'los dogmas católicos',
  'la apologética católica',
  'la lectura e interpretación de la Biblia',
  'la teología moral',
  'la teología del cuerpo y la familia',
  'la liturgia y la Santa Misa'
];

const EJES_CATEQUESIS = [
  'los sacramentos',
  'la oración de cada día',
  'los diez mandamientos',
  'las virtudes cristianas',
  'la vida de los santos',
  'la Virgen María',
  'la Biblia y los Evangelios',
  'la Eucaristía',
  'la confesión',
  'la vocación y la amistad con Jesús'
];

const ENFOQUES = [
  'qué enseña la Iglesia y por qué',
  'las preguntas que más hacen los fieles',
  'cómo se vive esto en el día a día',
  'las confusiones más comunes y su aclaración',
  'qué dice la Sagrada Escritura',
  'qué dice el Catecismo de la Iglesia Católica',
  'su historia y su desarrollo',
  'explicado con palabras sencillas',
  'las objeciones más frecuentes y su respuesta',
  'lo que enseñaron los santos sobre esto'
];

// Reparto del día. Catequesis IA estaba en cero: el reparto la alimenta a diario
// en lugar de dejar todo el cupo al blog de adultos.
const AUDIENCIAS = [
  { audiencia: 'adultos',  ejes: EJES_ADULTOS,    contentType: 'blog de formación católica',                 categoria: null,                  peso: 4 },
  { audiencia: 'niños',    ejes: EJES_CATEQUESIS, contentType: 'guía práctica de catequesis para niños',      categoria: 'catequesis-ninos',    peso: 3 },
  { audiencia: 'jovenes',  ejes: EJES_CATEQUESIS, contentType: 'guía práctica de catequesis para jóvenes',    categoria: 'catequesis-jovenes',  peso: 3 }
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

function normalizeCategory(rawCategory, audience) {
  if (audience === 'niños') return 'catequesis-ninos';
  if (audience === 'jovenes') return 'catequesis-jovenes';
  return blog.slugify(rawCategory || 'doctrina');
}

function alreadyExists(title, posts) {
  const slug = blog.slugify(title || '');
  return posts.some(p => p.slug === slug || String(p.titulo || '').toLowerCase().trim() === String(title || '').toLowerCase().trim());
}

// ── El temario del día ──────────────────────────────────────────────────────
// Se construyen todas las combinaciones eje×enfoque de una audiencia, se
// descartan las que ya se usaron alguna vez y se toman las que hagan falta. Si
// se agotan las trescientas, el registro se vacía y se vuelve a empezar: para
// entonces han pasado meses y el catálogo ya es otro.
function combosDisponibles(usados) {
  const disponibles = [];
  for (const bloque of AUDIENCIAS) {
    for (const eje of bloque.ejes) {
      for (const enfoque of ENFOQUES) {
        const clave = `${bloque.audiencia}::${eje}::${enfoque}`;
        if (usados.has(clave)) continue;
        disponibles.push({ clave, eje, enfoque, ...bloque });
      }
    }
  }
  return disponibles;
}

function temarioDelDia(state) {
  let usados = new Set(Array.isArray(state.combosUsados) ? state.combosUsados : []);
  let disponibles = combosDisponibles(usados);
  if (disponibles.length < ARTICULOS_POR_DIA) {
    console.log('[Daily Content] Se agotaron las combinaciones de temas; el registro vuelve a empezar.');
    usados = new Set();
    disponibles = combosDisponibles(usados);
  }

  // Se toma por audiencia según su peso, para que ninguna sección se quede sin
  // artículos cuando una tiene más combinaciones libres que otra.
  const plan = [];
  const pesoTotal = AUDIENCIAS.reduce((suma, a) => suma + a.peso, 0);
  for (const bloque of AUDIENCIAS) {
    const cupo = Math.round(ARTICULOS_POR_DIA * bloque.peso / pesoTotal);
    const suyas = disponibles.filter(c => c.audiencia === bloque.audiencia);
    plan.push(...suyas.slice(0, cupo));
  }
  // Redondear por audiencia puede dejar el plan corto o largo; se ajusta con lo
  // que quede libre.
  for (const combo of disponibles) {
    if (plan.length >= ARTICULOS_POR_DIA) break;
    if (!plan.includes(combo)) plan.push(combo);
  }
  return { plan: plan.slice(0, ARTICULOS_POR_DIA), usados };
}

// ── Un artículo ─────────────────────────────────────────────────────────────
// Primero se consulta Magisterium y solo después escribe OpenAI. Ese orden no es
// un detalle: en este proyecto OpenAI nunca produce doctrina de su propia
// memoria, únicamente redacta lo que Magisterium ya respondió con sus fuentes.
async function createOne({ contentType, audience, eje, enfoque, categoryOverride }) {
  const catalog = blog.loadBlog();
  const posts = catalog.posts || [];
  const existingTitles = posts.slice(0, 200).map(p => p.titulo).filter(Boolean);

  const consulta = `${eje}: ${enfoque}`;
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), Number(process.env.DAILY_CONTENT_RESEARCH_TIMEOUT_MS) || 60000);
  let investigacion;
  try {
    investigacion = await catholicAgent.research(consulta, 'auto', control.signal);
  } catch (err) {
    return { skipped: true, reason: 'magisterium_sin_respuesta', detail: err.message, topic: consulta };
  } finally {
    clearTimeout(corte);
  }

  const fuentes = [...(investigacion.citations || []), ...(investigacion.passages || [])]
    .filter(f => f && f.title)
    .slice(0, 8);

  const generated = await openaiChat.generateContentJson({
    contentType,
    audience,
    topic: consulta,
    existingTitles,
    fuenteDoctrinal: {
      texto: investigacion.answer,
      fuentes
    }
  });

  if (alreadyExists(generated.titulo, posts)) {
    return { skipped: true, reason: 'duplicate', title: generated.titulo, topic: consulta };
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
    fuentes: fuentes.map(f => ({ titulo: f.title, referencia: f.reference || '', url: f.url || '' })),
    fechaCreacion: new Date().toISOString(),
    publicado: true,
    generadoAutomaticamente: true,
    temaGenerado: consulta,
    fuenteGeneracion: 'magisterium+openai'
  };

  blog.upsertPost(post);
  return { created: true, slug: post.slug, title: post.titulo, category: post.categoria, topic: consulta };
}

async function runDailyContentJob({ force = false } = {}) {
  if (process.env.DAILY_AUTO_CONTENT_ENABLED === '0') {
    return { skipped: true, reason: 'disabled' };
  }
  if (!openaiChat.isConfigured()) {
    return { skipped: true, reason: 'openai_not_configured' };
  }
  if (!String(process.env.MAGISTERIUM_API_KEY || '').trim()) {
    return { skipped: true, reason: 'magisterium_not_configured' };
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
  if (!force && existingToday.length >= ARTICULOS_POR_DIA) {
    state.lastRun = key;
    state.lastRunAt = new Date().toISOString();
    state.lastResults = [{ skipped: true, reason: 'existing_generated_posts_today', count: existingToday.length }];
    writeState(state);
    return { skipped: true, reason: 'existing_generated_posts_today', key, count: existingToday.length };
  }

  const { plan, usados } = temarioDelDia(state);
  const results = [];
  let creados = 0;

  for (const combo of plan) {
    if (creados >= ARTICULOS_POR_DIA) break;
    let resultado;
    try {
      resultado = await createOne({
        contentType: combo.contentType,
        audience: combo.audiencia,
        eje: combo.eje,
        enfoque: combo.enfoque,
        categoryOverride: combo.categoria
      });
    } catch (err) {
      resultado = { skipped: true, reason: 'error', detail: err.message, topic: `${combo.eje}: ${combo.enfoque}` };
    }
    results.push(resultado);
    // La combinación se marca como usada tanto si salió artículo como si el
    // título ya existía: en ambos casos ese ángulo ya está cubierto y volver a
    // intentarlo mañana daría el mismo choque.
    if (resultado.created || resultado.reason === 'duplicate') usados.add(combo.clave);
    if (resultado.created) creados++;
  }

  state.lastRun = key;
  state.lastRunAt = new Date().toISOString();
  state.creadosUltimaVez = creados;
  state.combosUsados = Array.from(usados);
  state.lastResults = results;
  writeState(state);

  console.log(`[Daily Content] ${creados} de ${ARTICULOS_POR_DIA} artículos publicados hoy.`);
  return { success: true, key, creados, results };
}

function scheduleDailyContentJob() {
  const run = () => {
    runDailyContentJob().then(result => {
      if (result.skipped) console.log(`[Daily Content] Sin ejecutar: ${result.reason}.`);
      else console.log('[Daily Content] Resultado:', JSON.stringify(result).slice(0, 500));
    }).catch(e => {
      console.error('[Daily Content] Error:', e.message);
    });
  };

  setTimeout(run, Number(process.env.DAILY_AUTO_CONTENT_START_DELAY_MS || 120000));
  setInterval(run, Number(process.env.DAILY_AUTO_CONTENT_INTERVAL_MS || 21600000));
}

module.exports = {
  runDailyContentJob,
  scheduleDailyContentJob,
  // Expuestos para las pruebas: el temario es la pieza que garantiza que no se
  // repitan artículos, y eso hay que poder comprobarlo.
  temarioDelDia,
  ARTICULOS_POR_DIA
};
