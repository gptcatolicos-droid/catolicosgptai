const fs = require('fs');
const path = require('path');
const blog = require('./blog-module');
const openaiChat = require('./openai-chat-module');
const catholicAgent = require('./catholic-agent');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_PATH = path.join(DATA_DIR, 'daily-content-state.json');

// Cuántos artículos se publican cada día.
const ARTICULOS_POR_DIA = Math.max(1, Number(process.env.DAILY_AUTO_CONTENT_COUNT) || 10);

// De qué se escribe ya no lo decidimos nosotros: lo dice Search Console. El
// banco de consultas vive en seo-consultas.js, con la explicación de por qué
// está cada una y por qué faltan las de intención diaria y las de marca.
const { CONSULTAS, perfil } = require('./seo-consultas');

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
// Se toman las consultas que todavía no se han escrito. El registro vive en el
// disco persistente, así que no se repite ninguna mientras queden libres.
function temarioDelDia(state) {
  const usados = new Set(Array.isArray(state.consultasUsadas) ? state.consultasUsadas : []);
  const libres = CONSULTAS.filter(c => !usados.has(c.consulta));

  // Un mismo racimo -"sacramentos para niños", pongamos- no puede copar el día:
  // saldrían cinco artículos vecinos compitiendo entre ellos en Google.
  const porGrupo = new Map();
  const plan = [];
  for (const c of libres) {
    const usadosDelGrupo = porGrupo.get(c.grupo) || 0;
    if (usadosDelGrupo >= 2) continue;
    porGrupo.set(c.grupo, usadosDelGrupo + 1);
    plan.push(c);
    if (plan.length >= ARTICULOS_POR_DIA) break;
  }

  // Si el tope por racimo dejó el día corto, se completa con lo que quede.
  if (plan.length < ARTICULOS_POR_DIA) {
    for (const c of libres) {
      if (plan.length >= ARTICULOS_POR_DIA) break;
      if (!plan.includes(c)) plan.push(c);
    }
  }
  return { plan, usados, libres: libres.length };
}

// ── SEO: lo que se publica cumple o no se publica ───────────────────────────
// El modelo suele acertar, pero "suele" no basta cuando esto corre solo diez
// veces al día sin nadie mirando. Los límites de Google para título y
// descripción son duros: si el título pasa de 60 caracteres, Google lo corta y
// la búsqueda deja de verse en el resultado.
const LIMITE_SEO_TITULO = 60;
const MIN_META = 110;
const MAX_META = 158;

function recortarEnPalabra(texto, maximo) {
  const limpio = String(texto || '').trim().replace(/\s+/g, ' ');
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo);
  const ultimo = corte.lastIndexOf(' ');
  return (ultimo > maximo * 0.6 ? corte.slice(0, ultimo) : corte).replace(/[\s,;:.\-]+$/, '');
}

function normalizarSeo(generado, consulta) {
  const avisos = [];

  let seoTitle = String(generado.seoTitle || generado.titulo || '').trim();
  if (seoTitle.length > LIMITE_SEO_TITULO) {
    seoTitle = recortarEnPalabra(seoTitle, LIMITE_SEO_TITULO);
    avisos.push('seoTitle recortado');
  }

  let meta = String(generado.metaDescription || generado.extracto || '').trim().replace(/\s+/g, ' ');
  if (meta.length > MAX_META) {
    meta = recortarEnPalabra(meta, MAX_META);
    avisos.push('metaDescription recortada');
  }
  if (meta.length < MIN_META) avisos.push(`metaDescription corta (${meta.length})`);

  // Las palabras de la búsqueda tienen que estar en el título; si no, el
  // artículo no compite por lo que se escribió para competir.
  const palabras = consulta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => w.length > 3);
  const titularPlano = seoTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cubiertas = palabras.filter(w => titularPlano.includes(w)).length;
  if (palabras.length && cubiertas / palabras.length < 0.5) avisos.push('el título no recoge la búsqueda');

  return { seoTitle, metaDescription: meta, avisos };
}

// ── Un artículo ─────────────────────────────────────────────────────────────
// Primero se consulta Magisterium y solo después escribe OpenAI. Ese orden no es
// un detalle: en este proyecto OpenAI nunca produce doctrina de su propia
// memoria, únicamente redacta lo que Magisterium ya respondió con sus fuentes.
async function createOne(item) {
  const catalog = blog.loadBlog();
  const posts = catalog.posts || [];

  // El slug sale de la búsqueda, no del título que invente el modelo: es la URL
  // la que tiene que coincidir con lo que la gente escribe en Google.
  const slug = blog.slugify(item.consulta);
  if (posts.some(p => p.slug === slug)) {
    return { skipped: true, reason: 'ya existe', consulta: item.consulta, slug };
  }

  const datos = perfil(item.audiencia);
  const existingTitles = posts.slice(0, 120).map(p => p.titulo).filter(Boolean);

  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), Number(process.env.DAILY_CONTENT_RESEARCH_TIMEOUT_MS) || 60000);
  let investigacion;
  try {
    investigacion = await catholicAgent.research(item.consulta, 'auto', control.signal);
  } catch (err) {
    return { skipped: true, reason: 'magisterium_sin_respuesta', detail: err.message, consulta: item.consulta };
  } finally {
    clearTimeout(corte);
  }

  const fuentes = [...(investigacion.citations || []), ...(investigacion.passages || [])]
    .filter(f => f && f.title)
    .slice(0, 8);

  const generated = await openaiChat.generateContentJson({
    contentType: datos.contentType,
    audience: item.audiencia,
    consulta: item.consulta,
    existingTitles,
    fuenteDoctrinal: { texto: investigacion.answer, fuentes }
  });

  const seo = normalizarSeo(generated, item.consulta);

  const post = {
    slug,
    titulo: String(generated.titulo || item.consulta).trim(),
    seoTitle: seo.seoTitle,
    descripcion: seo.metaDescription,
    extracto: String(generated.extracto || seo.metaDescription).trim(),
    keywords: generated.keywords || item.consulta,
    categoria: datos.categoria || blog.slugify(generated.categoria || 'doctrina'),
    contenidoMd: generated.contenidoMd,
    faqs: generated.faqs || [],
    fuentes: fuentes.map(f => ({ titulo: f.title, referencia: f.reference || '', url: f.url || '' })),
    fechaCreacion: new Date().toISOString(),
    publicado: true,
    generadoAutomaticamente: true,
    consultaObjetivo: item.consulta,
    fuenteGeneracion: 'magisterium+openai'
  };

  blog.upsertPost(post);
  return {
    created: true,
    slug: post.slug,
    title: post.titulo,
    category: post.categoria,
    consulta: item.consulta,
    avisosSeo: seo.avisos
  };
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
  // "Ya se ejecutó hoy" no es lo mismo que "hoy ya están los diez". Si una
  // tanda se quedó a medias -una respuesta cortada, un fallo de red-, marcar el
  // día como hecho dejaba el blog con tres artículos hasta mañana. Mientras
  // falten, se vuelve a intentar en la siguiente pasada.
  const completoHoy = state.lastRun === key && Number(state.creadosUltimaVez || 0) >= ARTICULOS_POR_DIA;
  if (!force && completoHoy) {
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

  // Lo que falte para llegar a diez, no diez más.
  const faltan = Math.max(0, ARTICULOS_POR_DIA - existingToday.length);
  const { plan, usados } = temarioDelDia(state);
  const results = [];
  let creados = 0;

  for (const item of plan) {
    if (creados >= faltan) break;
    let resultado;
    try {
      resultado = await createOne(item);
    } catch (err) {
      resultado = { skipped: true, reason: 'error', detail: err.message, consulta: item.consulta };
    }
    results.push(resultado);
    // La consulta se marca como usada si salió artículo o si ya existía uno con
    // esa URL. Un fallo pasajero -la red, un tiempo de espera- no la quema: se
    // vuelve a intentar mañana.
    if (resultado.created || resultado.reason === 'ya existe') usados.add(item.consulta);
    if (resultado.created) creados++;
    if (resultado.created && resultado.avisosSeo && resultado.avisosSeo.length) {
      console.log(`[Daily Content] SEO ajustado en "${resultado.slug}": ${resultado.avisosSeo.join('; ')}.`);
    }
  }

  state.lastRun = key;
  state.lastRunAt = new Date().toISOString();
  state.creadosUltimaVez = existingToday.length + creados;
  state.consultasUsadas = Array.from(usados);
  state.lastResults = results;
  writeState(state);

  console.log(`[Daily Content] ${existingToday.length + creados} de ${ARTICULOS_POR_DIA} artículos publicados hoy (${creados} en esta pasada).`);
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
  // Expuestos para las pruebas: el temario garantiza que no se repita ninguna
  // búsqueda, y normalizarSeo que lo publicado cumpla los límites de Google.
  temarioDelDia,
  normalizarSeo,
  ARTICULOS_POR_DIA
};
