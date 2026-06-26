// ════════════════════════════════════════════════════════════════════════════
// CATÓLICOSGPT V77 — SERVIDOR CENTRAL MULTI-MÓDULO
// Integración con Magisterium API, Gemini @google/genai, e Infografías
// ════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const express      = require('express');
const fs           = require('fs');
const path         = require('path');
const cors         = require('cors');
const jwt          = require('jsonwebtoken');

// Importar todos los subsistemas creados
const auth          = require('./auth-module');
const infografias  = require('./infografias-module');
const liturgia      = require('./liturgia-cache');
const misas         = require('./misas-module');
const blog          = require('./blog-module');
const podcast       = require('./podcast-module');
const videos        = require('./videos-module');
const recursos      = require('./recursos-module');
const seo           = require('./seo-module');
const seoTopics     = require('./seo-topics');
const biblia        = require('./biblia-module');
const advancedEngine = require('./advanced-query-engine');
const santoral      = require('./santoral-module');
const { GoogleGenAI } = require('@google/genai');

const app  = express();
const PORT = process.env.PORT || 3000;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dwbqrp7kk';

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Servidor de medios y estáticos locales
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}

// ── Iniciar e-liturgia de fondo de forma diferida (evita saturación y bloqueos en el arranque de Cloud Run) ──
setTimeout(() => {
  console.log('[Liturgia] Iniciando descarga diferida de la liturgia del día de fondo...');
  liturgia.init().then(() => {
    console.log('[Liturgia] Cache del día inicializado correctamente en segundo plano.');
  }).catch(err => {
    console.error('[Liturgia] Error inicializando cache de liturgia:', err.message);
  });
}, 5000);

// ── Cliente Gemini Central ──
let ai = null;
function getAi() {
  const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!ai && geminiKey) {
    try {
      ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      console.log('[Gemini] Cliente inicializado correctamente.');
    } catch(e) {
      console.error('[Gemini] Error instanciando cliente:', e.message);
    }
  }
  return ai;
}
getAi(); // Inicializar si existe en el arranque

// ── Helper: Cargar cookie de Auth en SSR ──
function getAuthedUser(req) {
  let token = null;
  if (req.query && req.query.cgpt_token) {
    token = req.query.cgpt_token;
  }
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(req.headers.cookie.split('; ').map(c => {
      const idx = c.indexOf('=');
      return idx >= 0 ? [c.slice(0, idx), c.slice(idx + 1)] : [c, ''];
    }));
    token = cookies.cgpt_token;
  }
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts[1]) token = parts[1];
  }
  // Fallback para sesiones de sandbox en previsualización de iframe
  if (!token && global.sandboxSession) {
    token = global.sandboxSession.token;
  }
  if (!token) return null;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'cgpt-jwt-secret-2026-change-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    return auth.getUserById(decoded.id);
  } catch(e) {
    return null;
  }
}

const mesesEnEspanol = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre'
};

function getTodaySaintTarget() {
  try {
    const todayStr = liturgia.todayBogota();
    const [, mesIdx, diaVal] = todayStr.split('-');
    const mesNombre = mesesEnEspanol[mesIdx] || '';
    const santos = santoral.getAllSaints() || [];
    const destacado = santos.find(s => s.esSantoDelDia === true);
    const santo = destacado || santos.find(s =>
      parseInt(s.dia) === parseInt(diaVal) &&
      String(s.mes || '').toLowerCase() === mesNombre.toLowerCase()
    );
    if (santo && santo.slug) {
      return {
        path: `/santoral/${santo.slug}`,
        nombre: santo.nombre || 'Vida de los Santos'
      };
    }
  } catch(e) {}
  return { path: '/santo-del-dia', nombre: 'Vida de los Santos' };
}

let santosCache = {};

async function getSantoDelDiaDetail(dia, mesIndex) {
  const aiInstance = getAi();
  const mesNombre = mesesEnEspanol[mesIndex] || 'Junio';
  const cacheKey = `${mesNombre}-${dia}`;
  if (santosCache[cacheKey]) {
    return santosCache[cacheKey];
  }

  // Cargar de base de datos santos.json local primero
  let localSanto = null;
  try {
    const santosData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'santos.json'), 'utf-8'));
    const arraySants = santosData.santos_por_mes?.[mesNombre.toLowerCase()] || [];
    localSanto = arraySants.find(s => s.dia === parseInt(dia)) || null;
  } catch (e) {
    console.error('[Santos] Error al leer archivo local de santos:', e.message);
  }

  let santoObj = {
    dia: dia,
    mes: mesNombre,
    nombre: localSanto ? localSanto.nombre : 'Santo Celebrado Hoy',
    tipo: localSanto ? localSanto.tipo : 'Memoria Litúrgica',
    lema: '"Mi alma glorifica al Señor."',
    biografia: localSanto ? localSanto.descripcion : 'Biografía doctrinal e histórica en preparación.',
    patronato: 'Fieles y devotos locales',
    virtudes: ['Fe', 'Esperanza', 'Caridad'],
    oracion: 'Señor Jesús, concédenos la gracia de imitar las virtudes de tus santos...',
    otrosSantos: ['San Pedro', 'San Juan', 'San Pablo']
  };

  if (aiInstance) {
    try {
      const prompt = `Actúa como un teólogo, hagiógrafo de la Iglesia Católica y redactor jefe de CatólicosGPT.
Queremos una biografía de alta fidelidad, profunda, hermosa y doctrinal sobre el santo/fiesta celebrado el día ${dia} de ${mesNombre} en el Calendario Litúrgico Católico o Martirologio Romano.
(Por ejemplo, si es 13 de junio, es San Antonio de Padua; si es 19 de junio es San Romualdo; si es 21 de junio es San Luis Gonzaga, etc.).

Devuelve exclusivamente un JSON válido y legible en español con la estructura exacta de abajo, sin bloques de código markdown ni \`\`\`json:
{
  "nombre": "Nombre del Santo Principal para el día, p. ej. 'San Luis Gonzaga, Religioso Jesuita'",
  "tipo": "Grado litúrgico, p. ej. 'Memoria Obligatoria' o 'Solemnidad' o 'Fiesta'",
  "lema": "Una jaculatoria tradicional, oración corta de intercesión o frase profunda que exprese su espíritu o dicho escrito",
  "biografia": "Una narración biográfica y devocional detallada, profunda y exquisitamente redactada, de un mínimo de 450 palabras, estructurada intelectualmente. Debe explicar su origen familiar, su conversión o vocación mística/religiosa, las pruebas históricas que superó, su amor por la Eucaristía/Prójimo, los milagros o escritos teológicos por los que es recordado, y una profunda analogía de cómo su ejemplo brilla y nos enseña en este año 2026. Emplea saltos de línea para estructurar la lectura en párrafos limpios.",
  "patronato": "De quién o de qué grupos/causas es patrono, p. ej. 'Santo Patrono de la juventud y de los estudiantes'",
  "virtudes": ["Lista de 3 a 4 virtudes espirituales más sobresalientes del santo", "Virtud 2", "Virtud 3"],
  "oracion": "Una oración tradicional hermosa y devota (en español) para pedir la intercesión de este santo y rogar a Dios el don de perseverar en la fe",
  "otrosSantos": ["Otro santo de hoy o de esta semana", "San Gervasio y San Protasio", "Santa Juliana de Falconieri"]
}`;

      let response;
      try {
        response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
      } catch (searchErr) {
        console.log('[Gemini Santo Info] Falló con Google Search tool, reintentando sin herramientas...', searchErr.message);
        response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt
        });
      }

      let text = response.text || '';
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      if (parsed.nombre && parsed.biografia) {
        santoObj = { ...santoObj, ...parsed };
      }
    } catch (e) {
      console.log('[Gemini Santo Info] No se pudo generar santo alternativo con IA:', e.message);
    }
  }

  santosCache[cacheKey] = santoObj;
  return santoObj;
}

// ════════════════════════════════════════════════════════════════════════════
// VISTAS HTML SSR (Branding "Magnifica Humanitas": Cream, Gold, Maroon, Espresso)
// ════════════════════════════════════════════════════════════════════════════

function renderPage(title, contentHtml, req, metaTags = {}) {
  const user = getAuthedUser(req);
  const activePlan = user ? user.plan : 'free';
  const customNombre = user ? (user.customNombre || user.nombre) : 'Católico';
  const todaySaintTarget = getTodaySaintTarget();

  const allSaints = santoral.getAllSaints() || [];
  const santoralSaints = allSaints.map(s => ({ nombre: s.nombre, slug: s.slug }));

  const defaultMetaTags = {
    description: "CatólicosGPT es la Inteligencia Artificial Católica #1 en español con fidelidad del 100% al Magisterio. Explora la Biblia de Navarra, el Catecismo, oraciones, y genera infografías pastorales interactivas.",
    keywords: "ia catolica, inteligencia artificial catolica, catolicosgpt, catolicos gpt, magisterio de la iglesia, biblia de navarra, catecismo, oraciones catolicas, papa leon xiv, apologetica catolica, oracion del dia, evangelio del dia",
    canonical: req.originalUrl || '/'
  };

  const M = { ...defaultMetaTags, ...metaTags };
  const APP_URL = process.env.APP_URL || 'https://ai.catolicosgpt.com';

  return `<!DOCTYPE html>
<html lang="es" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} — CatólicosGPT | La IA Católica #1 en Español</title>
  
  <meta name="description" content="${M.description}">
  <meta name="keywords" content="${M.keywords}">
  <link rel="canonical" href="${APP_URL}${M.canonical}">

  <script>
    window.SANTORAL_CATALOG = ${JSON.stringify(santoralSaints)};
  </script>
  
  <!-- Google Search Console Ownership Verification -->
  <meta name="google-site-verification" content="google5d1cd7dcadcb13f0" />
  <meta name="google-site-verification" content="f8iKbyO_Yw0m8F9_8oNOfT_xQorD5s6N8B0e_V3030" />
  
  <!-- Global site tag (gtag.js) - Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-H8CB7M80S3"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-H8CB7M80S3', {
      'page_path': window.location.pathname,
      'send_page_view': true
    });
  </script>
  
  <!-- Open Graph -->
  <meta property="og:title" content="${title} — CatólicosGPT | La IA Católica #1 en Español">
  <meta property="og:description" content="${M.description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${APP_URL}${M.canonical}">
  <meta property="og:image" content="${M.image || 'https://yt3.googleusercontent.com/gTL33dWPVULnTlxRu-_2vuEuCKpPsdK_cY6m43-vjfekOV5ho5ucfPFe1wjfbEXl9tjLvNMOlQ=w1060-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj'}">
  <meta property="og:site_name" content="CatólicosGPT">
  
  <!-- Favicon Oficial CatólicosGPT -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="shortcut icon" type="image/svg+xml" href="/favicon.svg">
  
  ${M.schemas ? M.schemas.map(sch => `<script type="application/ld+json">${JSON.stringify(sch)}</script>`).join('\n') : ''}
  ${M.schema ? `<script type="application/ld+json">${JSON.stringify(M.schema)}</script>` : ''}
  
  <!-- Google Fonts & Tailwind -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Domine:wght@400;500;600;700&family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Domine:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
    
    :root {
      --cream: #F9F6F0;
      --cream-2: #F1ECE3;
      --gold: #BC8A36;
      --gold-deep: #9F7124;
      --gold-light: #F2E3C9;
      --maroon: #5E1B22;
      --maroon-dark: #320E12;
      --espresso: #251B15;
      --cafe-marron: #3E2723;
      --ink: #2D241E;
      --ink-2: #5A4E46;
      --border: #E6DFD4;
      --font-sans: "Domine", "Inter", system-ui, -apple-system, sans-serif;
      --font-display: "Domine", "Cinzel", Georgia, serif;
      --font-serif: "Domine", "Cormorant Garamond", Georgia, serif;
      --font-mono: "JetBrains Mono", monospace;
      
      --shadow-sm: 0 1px 3px rgba(37, 27, 21, 0.05);
      --shadow-md: 0 4px 12px rgba(37, 27, 21, 0.08);
      --shadow-lg: 0 12px 24px rgba(37, 27, 21, 0.12);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body, select, input, button, textarea, a, p, h1, h2, h3, h4, h5, h6, span, label, div:not(.font-mono):not(code):not(pre), button *, a * {
      font-family: "Domine", serif !important;
    }

    /* Títulos y Subtítulos en Bold y Color Vinotinto (Maroon) */
    h1, h2, h3, h4, h5, h6, .font-display, .font-serif, h1 *, h2 *, h3 *, h4 *, h5 *, h6 * {
      font-weight: 700 !important;
      color: var(--maroon) !important;
    }

    /* Frases importantes (bolds, strongs, etc.) en color Vinotinto (Maroon) */
    strong, b, .font-bold {
      font-weight: 700 !important;
      color: var(--maroon) !important;
    }

    /* Exclusiones para botones, textos blancos o links que no deben forzarse a maroon */
    button strong, button b, button *, a.bg-maroon *, .bg-maroon *, .text-white, .text-white * {
      color: inherit !important;
    }
    
    /* Garantizar que sobre los botones y fondos vinotinto la fuente, negritas e iconos sean siempre blanco puro */
    .bg-maroon,
    .bg-maroon *,
    a.bg-maroon,
    a.bg-maroon *,
    button.bg-maroon,
    button.bg-maroon *,
    .text-white,
    .text-white *,
    .bg-maroon strong,
    .bg-maroon b,
    .bg-maroon .font-bold,
    .text-white strong,
    .text-white b,
    .text-white .font-bold {
      color: #ffffff !important;
    }

    .text-gold, .text-gold * { color: var(--gold) !important; }
    .text-gold-deep, .text-gold-deep * { color: var(--gold-deep) !important; }
    .text-maroon, .text-maroon * { color: var(--maroon) !important; }

    body {
      background-color: var(--cream);
      color: var(--ink);
      font-family: var(--font-sans);
      line-height: 1.5;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    
    a { color: var(--maroon); text-decoration: none; transition: color 0.2s; }
    a:hover { color: var(--gold-deep); }
    
    /* Double Borders */
    .sacred-border {
      border: 3px double var(--gold);
    }
    
    /* Sidebar / Menu */
    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: 500;
      color: var(--ink);
      font-size: 13px;
      transition: all 0.2s;
    }
    @media (min-width: 1024px) {
      .nav-link {
        font-size: 11px !important;
        padding: 6px 10px !important;
        gap: 8px !important;
      }
      .nav-link svg {
        width: 15px !important;
        height: 15px !important;
      }
    }
    .nav-link:hover, .nav-link.active {
      background-color: var(--gold-light);
      color: var(--maroon);
    }
    .nav-link svg {
      width: 17px;
      height: 17px;
      color: var(--ink-2);
    }
    .nav-link:hover svg, .nav-link.active svg {
      color: var(--maroon);
    }
    
    /* SEO-optimized responsive grid cards */
    .seo-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .seo-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    /* Floating Chat Frame styles */
    .chat-bubble {
      max-width: 99%;
      margin-bottom: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 15px;
      line-height: 1.6;
    }
    @media (min-width: 640px) {
      .chat-bubble {
        max-width: 85%;
        padding: 14px 18px;
      }
    }
    .chat-bubble.bot {
      background-color: white;
      color: var(--ink) !important;
      border: 1px solid var(--border);
      border-top-left-radius: 2px;
      align-self: flex-start;
    }
    .chat-bubble.bot table {
      display: block;
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 0.9em;
    }
    .chat-bubble.bot th, .chat-bubble.bot td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    .chat-bubble.bot th {
      background-color: var(--cream2);
      font-weight: 700;
      color: var(--maroon);
    }
    .chat-bubble.bot ul, .chat-bubble.bot ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }
    .chat-bubble.bot ul { list-style-type: disc; }
    .chat-bubble.bot ol { list-style-type: decimal; }
    .chat-bubble.bot h3, .chat-bubble.bot h4 {
      font-family: var(--font-display);
      color: var(--maroon) !important;
      margin-top: 14px;
      margin-bottom: 6px;
      font-weight: 700 !important;
    }
    .chat-bubble.bot p {
      margin-bottom: 8px;
    }
    .chat-bubble.bot code {
      font-family: var(--font-mono);
      background-color: var(--cream2);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .chat-bubble.bot pre {
      background-color: var(--espresso);
      color: white;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
    }
    .chat-bubble.bot pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    .chat-bubble.bot blockquote {
      border-left: 4px solid var(--gold);
      padding-left: 14px;
      color: var(--ink-2);
      font-style: italic;
      margin: 12px 10px;
    }
    .chat-bubble.user {
      background-color: var(--gold-light);
      color: var(--maroon) !important;
      border: 1px solid var(--gold);
      border-top-right-radius: 2px;
      align-self: flex-end;
    }
    
    /* Custom Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--cream); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--gold); }
    
    /* Responsive details */
    @media (max-width: 767px) {
      .sidebar-desktop { display: none !important; }
    }
    @media (min-width: 768px) {
      .navigation-mobile-bar { display: none !important; }
      .mobile-menu-drawer { display: none !important; }
    }

    /* Estilos del Lightbox / Tooltip Hover de la Biblia */
    #bible-tooltip {
      box-shadow: 0 10px 35px rgba(94, 27, 34, 0.18);
      border-color: #BC8A36;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bible-citation {
      color: #5E1B22 !important;
      border-bottom: 2px dashed #BC8A36 !important;
      font-weight: 600 !important;
      cursor: help;
      transition: all 0.2s;
      padding: 0 2px;
      border-radius: 2px;
      display: inline !important;
      text-decoration: none !important;
    }
    .bible-citation:hover {
      background-color: rgba(188, 138, 54, 0.15) !important;
      color: #9F7124 !important;
      border-bottom-style: solid !important;
    }
    .bible-citation * {
      color: inherit !important;
    }
    
    /* Elegant Markdown Tables for Synoptic Summaries */
    .markdown-body table,
    table.synoptic-table,
    .chat-container table,
    .message-content table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 1.5rem 0 !important;
      font-size: 0.85rem !important;
      border: 2px double #BC8A36 !important;
      background-color: #ffffff !important;
      border-radius: 8px !important;
      overflow: hidden !important;
    }
    .markdown-body th,
    table.synoptic-table th,
    .chat-container th,
    .message-content th {
      background-color: #5E1B22 !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      font-size: 0.75rem !important;
      letter-spacing: 0.05em !important;
      padding: 10px 14px !important;
      border: 1px solid #F2E3C9 !important;
    }
    .markdown-body td,
    table.synoptic-table td,
    .chat-container td,
    .message-content td {
      padding: 10px 14px !important;
      border: 1px solid #E6DFD4 !important;
      color: #2D241E !important;
    }
    .markdown-body tr:nth-child(even),
    table.synoptic-table tr:nth-child(even),
    .chat-container tr:nth-child(even),
    .message-content tr:nth-child(even) {
      background-color: #F9F6F0 !important;
    }

    /* Tablas HTML suaves para blog, santoral y previsualización del editor */
    .content-html table,
    #html-editor-preview table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      margin: 1.25rem 0 !important;
      font-size: 0.92rem !important;
      background: #FFFDF8 !important;
      border: 1px solid #E6DFD4 !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      box-shadow: 0 1px 3px rgba(37, 27, 21, 0.04) !important;
    }
    .content-html th,
    #html-editor-preview th {
      background: #F9F6F0 !important;
      color: #5E1B22 !important;
      font-weight: 700 !important;
      text-align: left !important;
      padding: 10px 12px !important;
      border-right: 1px solid #E6DFD4 !important;
      border-bottom: 1px solid #D8C9B8 !important;
    }
    .content-html td,
    #html-editor-preview td {
      color: #2D241E !important;
      padding: 10px 12px !important;
      border-right: 1px solid #E6DFD4 !important;
      border-bottom: 1px solid #EFE7DC !important;
      vertical-align: top !important;
    }
    .content-html th:last-child,
    .content-html td:last-child,
    #html-editor-preview th:last-child,
    #html-editor-preview td:last-child {
      border-right: 0 !important;
    }
    .content-html tr:last-child td,
    #html-editor-preview tr:last-child td {
      border-bottom: 0 !important;
    }
    .content-html tbody tr:nth-child(even) td,
    #html-editor-preview tbody tr:nth-child(even) td {
      background: #FCFAF5 !important;
    }

    .content-html figure.cloudinary-content-image,
    #html-editor-preview figure.cloudinary-content-image {
      margin: 1.5rem 0 !important;
      border: 1px solid #E6DFD4 !important;
      border-radius: 14px !important;
      overflow: hidden !important;
      background: #FFFDF8 !important;
      box-shadow: 0 1px 4px rgba(37, 27, 21, 0.06) !important;
    }
    .content-html figure.cloudinary-content-image img,
    #html-editor-preview figure.cloudinary-content-image img {
      width: 100% !important;
      height: auto !important;
      display: block !important;
      max-height: 560px !important;
      object-fit: contain !important;
      background: #F9F6F0 !important;
    }
    .content-html figure.cloudinary-content-image figcaption,
    #html-editor-preview figure.cloudinary-content-image figcaption {
      padding: 9px 12px !important;
      color: #5A4E46 !important;
      background: #FCFAF5 !important;
      border-top: 1px solid #E6DFD4 !important;
      font-size: 0.82rem !important;
      font-style: italic !important;
      text-align: center !important;
    }
    .content-html p,
    #html-editor-preview p {
      margin: 0 0 1rem 0 !important;
      line-height: 1.85 !important;
    }
    .content-html h1,
    .content-html h2,
    .content-html h3,
    #html-editor-preview h1,
    #html-editor-preview h2,
    #html-editor-preview h3 {
      margin-top: 1.6rem !important;
      margin-bottom: 0.75rem !important;
      line-height: 1.25 !important;
    }
    .content-html ul,
    .content-html ol,
    #html-editor-preview ul,
    #html-editor-preview ol {
      margin: 0.75rem 0 1.25rem 1.35rem !important;
      line-height: 1.75 !important;
    }
    .embedded-reader {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }
    .embedded-reader > div {
      padding-left: 1rem !important;
      padding-right: 1rem !important;
    }
    @media (max-width: 767px) {
      main {
        min-width: 0;
      }
      #chat-box {
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
      }
      .embedded-reader .grid {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      .embedded-reader aside,
      .embedded-reader .lg\\:col-span-2 {
        grid-column: auto !important;
      }
      .content-html,
      .santo-biografia,
      .blog-content {
        font-size: 0.95rem !important;
        overflow-wrap: anywhere;
      }
      .content-html table,
      #html-editor-preview table {
        display: block !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
      }
    }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            cream: '#F9F6F0',
            cream2: '#F1ECE3',
            gold: '#BC8A36',
            goldDeep: '#9F7124',
            maroon: '#5E1B22',
            maroonDark: '#320E12',
            espresso: '#251B15',
            ink: '#2D241E',
            ink2: '#5A4E46'
          }
        }
      }
    }
  </script>
</head>
<body class="bg-cream h-full flex flex-col">

  <!-- CAPA DE MÓVIL: BOTÓN Y LOGOTIPO DE CABECERA -->
  <header class="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-border sticky top-0 z-40 shadow-sm animate-fade-in">
    <div class="flex items-center gap-2">
      <button onclick="toggleMobileMenu()" class="p-1 text-ink rounded hover:bg-cream2 duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
      </button>
      <a href="/" class="flex items-center gap-1.5 hover:opacity-90 transition">
        <!-- SVG Emblem compact -->
        <svg class="w-7 h-7 flex-shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="38" stroke="#BC8A36" stroke-width="3" fill="none"/>
          <path d="M40 25 V75 M30 38 H55" stroke="#BC8A36" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M52 38 Q65 38 65 50 T52 65" stroke="#BC8A36" stroke-width="2.2" fill="none"/>
          <circle cx="63" cy="42" r="3" fill="#BC8A36"/>
          <circle cx="53" cy="54" r="2.5" fill="#BC8A36"/>
          <!-- Double Arches (Bible base) -->
          <path d="M50 80 Q38 74 25 78 V83 Q38 79 50 85 Q62 79 75 83 V78 Q62 74 50 80 Z" fill="#BC8A36"/>
        </svg>
        <span class="font-display font-bold text-base text-maroon tracking-wide">Católicos<span class="text-gold italic font-serif">GPT</span></span>
      </a>
    </div>
    <div class="flex items-center gap-2">
      ${user ? `
        <span class="text-xs bg-gold-light text-maroon px-2 py-1 rounded font-medium border border-gold/20 uppercase tracking-widest">${activePlan}</span>
        <a href="/logout" class="p-1 rounded text-red-700 hover:bg-red-50" title="Cerrar sesión">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        </a>
      ` : `
        <a href="/login" class="text-xs font-semibold bg-maroon text-white px-3 py-1.5 rounded-full hover:bg-gold-deep duration-200">Entrar</a>
      `}
    </div>
  </header>

  <!-- CONTENEDOR CENTRAL: SIDEBAR DESKTOP + MAIN PAGE -->
  <div class="flex flex-1 h-full overflow-hidden">
    
    <!-- SIDEBAR DESKTOP -->
    <aside class="sidebar-desktop w-64 border-r border-[#E6DFD4] bg-white flex flex-col justify-between flex-shrink-0 z-30 shadow-sm">
      <div class="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        <div class="flex flex-col gap-2 items-center px-2 border-b pb-4 mt-1">
          <a href="/" class="flex flex-col items-center gap-1 px-1 text-center group hover:opacity-95 duration-200">
            <div class="flex items-center gap-2">
              <!-- High-Fidelity SVG Emblem matching attached design -->
              <svg class="w-10 h-10 flex-shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Golden Circle Outer -->
                <circle cx="50" cy="50" r="38" stroke="#BC8A36" stroke-width="2.5" fill="none"/>
                <!-- Latin Cross -->
                <path d="M40 25 V75 M30 38 H55" stroke="#BC8A36" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <!-- Swooshes & elegant dots on the right (Abstract liturgical figures or host curves) -->
                <path d="M52 38 Q65 38 65 50 T52 65" stroke="#BC8A36" stroke-width="2" stroke-linecap="round" fill="none"/>
                <path d="M40 48 Q70 48 60 62" stroke="#BC8A36" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                <!-- Liturgical points -->
                <circle cx="63" cy="42" r="2.5" fill="#BC8A36"/>
                <circle cx="53" cy="54" r="2.5" fill="#BC8A36"/>
                <circle cx="63" cy="51" r="1.5" fill="#BC8A36"/>
                <!-- Open book arch at base of cross -->
                <path d="M50 80 Q38 74 25 78 V83 Q38 79 50 85 Q62 79 75 83 V78 Q62 74 50 80 Z" fill="#BC8A36" stroke="#BC8A36" stroke-width="1.2"/>
                <line x1="50" y1="80" x2="50" y2="85" stroke="#FAF6F0" stroke-width="1"/>
              </svg>
              <!-- Brand Title -->
              <div class="flex flex-col text-left">
                <span class="font-display font-black text-lg tracking-wider text-espresso leading-none">Católicos<span class="text-gold italic font-serif">GPT</span></span>
                <span class="text-[8px] font-mono tracking-[0.2em] text-ink2 uppercase mt-0.5">V77 • Magisterio</span>
              </div>
            </div>
            
            <!-- Delicate golden liturgical divider (─── ✝ ───) -->
            <div class="flex items-center gap-2 w-full max-w-[170px] opacity-90 mt-1 select-none">
              <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gold/30"></div>
              <span class="text-gold text-[9px] pb-0.5">✝</span>
              <div class="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gold/30"></div>
            </div>
          </a>
          <span class="text-[10px] text-ink2 font-serif italic text-center leading-relaxed">In illo uno unum</span>
        </div>
        
        <!-- PLANIFICACIÓN DEL MENÚ DE NAVEGACIÓN -->
        <div class="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          <!-- CATEGORÍA: LITURGIA DE HOY -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-ink2 uppercase tracking-widest font-bold px-3 py-1 font-mono">Liturgia de hoy</span>
            <nav class="flex flex-col gap-1">
              <a href="${todaySaintTarget.path}" data-full-page="1" class="nav-link ${req.originalUrl==='/santo-del-dia'||req.originalUrl===todaySaintTarget.path?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Santo del día
              </a>
              <a href="/oracion-del-dia" class="nav-link ${req.originalUrl==='/oracion-del-dia'?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                Oración del día
              </a>
            </nav>
          </div>

          <!-- CATEGORÍA: HERRAMIENTAS -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-ink2 uppercase tracking-widest font-bold px-3 py-1 font-mono">Herramientas</span>
            <nav class="flex flex-col gap-1">
              <a href="/santoral" class="nav-link ${req.originalUrl.startsWith('/santoral')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cross"><path d="M11 2h2v7h6v2h-6v11h-2v-11H5V9h6V2z"/></svg>
                Santoral
              </a>
              <a href="/infografias" class="nav-link ${req.originalUrl.startsWith('/infografias')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                Infografías
              </a>
              <a href="/videos" class="nav-link ${req.originalUrl.startsWith('/videos')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 11.2"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
                Videos
              </a>
              <a href="/podcasts" class="nav-link ${req.originalUrl.startsWith('/podcasts')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rss"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
                Podcast
              </a>
              <a href="/?inline=%2Fblog" class="nav-link ${req.originalUrl.startsWith('/blog')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scroll"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
                Blog
              </a>
              <a href="/misas" class="nav-link ${req.originalUrl.startsWith('/misas')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tv"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                Horarios de Misa
              </a>
              <a href="/planes" class="nav-link ${req.originalUrl.startsWith('/planes')?'active':''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                Planes
              </a>
            </nav>
          </div>

          <!-- CATEGORÍA: CONVERSACIONES -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-ink2 uppercase tracking-widest font-bold px-3 py-1 font-mono">Conversaciones</span>
            <nav class="flex flex-col gap-1">
              <span class="text-xs text-ink2 italic px-3 py-1 flex items-center gap-2">
                Sin conversaciones aún
              </span>
            </nav>
          </div>
        </div>
      </div>
      
      <!-- FOOTER USUARIO / ADMIN EN SIDEBAR -->
      <div class="p-4 border-t border-border bg-cream2/30 flex flex-col gap-3">
        ${user ? `
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-semibold text-sm text-espresso truncate max-w-[130px]">${customNombre}</span>
              <span class="text-[10px] text-ink2 uppercase tracking-wider font-mono">${activePlan} plan</span>
            </div>
            <a href="/logout" class="p-1 rounded text-red-800 hover:bg-cream2 duration-200" title="Cerrar sesión">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </a>
          </div>
          <a href="/ajustes" class="w-full text-center text-xs border border-gold/40 hover:bg-[#FAF9F5] text-maroon font-bold py-1.5 rounded transition flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-cog"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="m20.5 10.5 1 .5-.5 1-1-.5z"/><circle cx="19" cy="12" r="1.5"/></svg>
            Ajustes de Perfil
          </a>
          ${user.plan === 'admin' ? `
            <a href="/admin" class="w-full text-center text-xs bg-gold hover:bg-gold-deep text-white py-1.5 rounded font-bold transition flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l-.43.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Consola Admin
            </a>
          ` : ''}
        ` : `
          <div class="flex flex-col gap-2">
            <a href="/login" class="w-full text-center text-xs border border-maroon hover:bg-maroon hover:text-white text-maroon py-2 rounded font-semibold transition uppercase tracking-wider">Ingresar</a>
            <a href="/register" class="w-full text-center text-xs bg-maroon hover:bg-gold text-white py-2 rounded font-semibold transition uppercase tracking-wider">Crear Cuenta</a>
          </div>
        `}
      </div>
    </aside>

    <!-- MOBILE DRAWER MENU (RESPONSIVE DE CELLULAR) -->
    <div id="mobile-drawer" class="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 pointer-events-none opacity-0">
      <div id="mobile-drawer-content" class="w-72 max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between transition-transform duration-300 transform -translate-x-full">
        <div class="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b">
            <div class="flex items-center gap-1.5 select-none">
              <!-- SVG Emblem compact -->
              <svg class="w-7 h-7 flex-shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="38" stroke="#BC8A36" stroke-width="3" fill="none"/>
                <path d="M40 25 V75 M30 38 H55" stroke="#BC8A36" stroke-width="4.5" stroke-linecap="round"/>
                <path d="M52 38 Q65 38 65 50 T52 65" stroke="#BC8A36" stroke-width="2.2" fill="none"/>
                <circle cx="63" cy="42" r="3" fill="#BC8A36"/>
                <circle cx="53" cy="54" r="2.5" fill="#BC8A36"/>
                <path d="M50 80 Q38 74 25 78 V83 Q38 79 50 85 Q62 79 75 83 V78 Q62 74 50 80 Z" fill="#BC8A36"/>
              </svg>
              <span class="font-display font-medium text-base text-maroon tracking-wider">Católicos<span class="text-gold italic font-serif">GPT</span></span>
            </div>
            <button onclick="toggleMobileMenu()" class="p-1 rounded hover:bg-cream2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto flex flex-col gap-4">
            <!-- CATEGORÍA: LITURGIA DE HOY -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-ink2 uppercase tracking-widest font-bold px-3 py-1 font-mono">Liturgia de hoy</span>
              <nav class="flex flex-col gap-1">
                <a href="${todaySaintTarget.path}" data-full-page="1" onclick="toggleMobileMenu()" class="nav-link">Santo de hoy</a>
                <a href="/oracion-del-dia" onclick="toggleMobileMenu()" class="nav-link">Oración del día</a>
              </nav>
            </div>

            <!-- CATEGORÍA: HERRAMIENTAS -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-ink2 uppercase tracking-widest font-bold px-3 py-1 font-mono">Herramientas</span>
              <nav class="flex flex-col gap-1">
                <a href="/santoral" onclick="toggleMobileMenu()" class="nav-link">Santoral</a>
                <a href="/infografias" onclick="toggleMobileMenu()" class="nav-link">Infografías</a>
                <a href="/videos" onclick="toggleMobileMenu()" class="nav-link">Videos</a>
                <a href="/podcasts" onclick="toggleMobileMenu()" class="nav-link">Podcast</a>
                <a href="/?inline=%2Fblog" onclick="toggleMobileMenu()" class="nav-link">Blog</a>
                <a href="/misas" onclick="toggleMobileMenu()" class="nav-link">Horarios de Misa</a>
                <a href="/planes" onclick="toggleMobileMenu()" class="nav-link">Planes</a>
              </nav>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-border bg-cream2/20 flex flex-col gap-2">
          ${user ? `
            <div class="flex items-center justify-between mb-2">
              <div class="flex flex-col">
                <span class="font-semibold text-sm text-espresso">${user.nombre}</span>
                <span class="text-[10px] text-ink2 uppercase tracking-widest font-mono">${user.plan}</span>
              </div>
              <a href="/logout" class="p-1 text-red-800" title="Cerrar sesión">Salir</a>
            </div>
            <a href="/ajustes" onclick="toggleMobileMenu()" class="w-full text-center text-xs border border-gold/40 hover:bg-[#FAF9F5] text-maroon font-bold py-2 rounded mb-1 flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-cog"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="m20.5 10.5 1 .5-.5 1-1-.5z"/><circle cx="19" cy="12" r="1.5"/></svg>
              Ajustes de Perfil
            </a>
          ` : `
            <a href="/login" class="w-full text-center text-xs border border-maroon text-maroon py-2 rounded font-semibold uppercase tracking-wider">Ingresar</a>
            <a href="/register" class="w-full text-center text-xs bg-maroon text-white py-2 rounded font-semibold uppercase tracking-wider">Crear Cuenta</a>
          `}
        </div>
      </div>
    </div>

    <!-- MAIN VIEWPORT -->
    <main class="flex-1 flex flex-col h-full overflow-y-auto">
      ${contentHtml}
    </main>

  </div>

  <script>
    let drawerOpen = false;
    
    function sanitizeHtml(html) {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'form'];
      dangerousTags.forEach(tag => {
        const elements = temp.getElementsByTagName(tag);
        for (let i = elements.length - 1; i >= 0; i--) {
          elements[i].parentNode.removeChild(elements[i]);
        }
      });
      const allElements = temp.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const attrs = el.attributes;
        for (let j = attrs.length - 1; j >= 0; j--) {
          const attrName = attrs[j].name.toLowerCase();
          const attrVal = attrs[j].value.toLowerCase();
          if (attrName.startsWith('on')) {
            el.removeAttribute(attrs[j].name);
          } else if ((attrName === 'href' || attrName === 'src') && (attrVal.includes('javascript:') || attrVal.includes('vbscript:') || attrVal.includes('data:'))) {
            el.removeAttribute(attrs[j].name);
          }
        }
      }
      return temp.innerHTML;
    }

    function processMarkdownAndCitations(rawText) {
      let html = window.marked ? window.marked.parse(rawText) : rawText;
      html = sanitizeHtml(html);
      html = html.replace(/(?:CIC|CEC|Catecismo)\\s*(\\d+)/gi, (match, cic) => {
        return \`<button class="catechism-citation bg-amber-50 hover:bg-amber-100 text-[#5E1B22] border border-[#BC8A36]/30 rounded px-1.5 py-0.5 font-sans font-bold text-[11px] cursor-pointer inline-flex items-center gap-0.5 transition" data-cic="\${cic}">⛪ CIC \${cic}</button>\`;
      });

      // Auto-linking saints from catalog
      if (window.SANTORAL_CATALOG && window.SANTORAL_CATALOG.length > 0) {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          
          // Sort saints by length of name descending to prevent partial matching (e.g. San Francisco vs San Francisco de Asis)
          const sortedSaints = [...window.SANTORAL_CATALOG].sort((a, b) => b.nombre.length - a.nombre.length);
          
          const replaceInTextNodes = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              let text = node.nodeValue;
              let parent = node.parentNode;
              let insideLink = false;
              while (parent) {
                if (parent.tagName === 'A' || parent.tagName === 'BUTTON') {
                  insideLink = true;
                  break;
                }
                parent = parent.parentNode;
              }
              if (!insideLink) {
                for (const s of sortedSaints) {
                  if (!s.nombre || !s.slug) continue;
                  const nameEscaped = s.nombre.replace(/[-\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
                  const regex = new RegExp('(?<=^|[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ])' + nameEscaped + '(?=$|[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ])', 'gi');
                  if (regex.test(text)) {
                    const parts = text.split(new RegExp('(?<=^|[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ])(' + nameEscaped + ')(?=$|[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ])', 'gi'));
                    const fragment = document.createDocumentFragment();
                    parts.forEach(part => {
                      if (part.toLowerCase() === s.nombre.toLowerCase()) {
                        const link = document.createElement('a');
                        link.href = \`/santoral/\${s.slug}\`;
                        link.className = 'text-maroon hover:underline font-bold';
                        link.textContent = part;
                        fragment.appendChild(link);
                      } else if (part) {
                        fragment.appendChild(document.createTextNode(part));
                      }
                    });
                    const parentNode = node.parentNode;
                    if (parentNode) {
                      parentNode.replaceChild(fragment, node);
                    }
                    break;
                  }
                }
              }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'A' && node.tagName !== 'BUTTON' && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
              const children = Array.from(node.childNodes);
              children.forEach(replaceInTextNodes);
            }
          };
          
          replaceInTextNodes(tempDiv);
          html = tempDiv.innerHTML;
        } catch (domErr) {
          console.error('[Auto-link DOM Error]', domErr);
        }
      }

      return html;
    }

    const drawer = document.getElementById('mobile-drawer');
    const drawerContent = document.getElementById('mobile-drawer-content');
    
    function toggleMobileMenu() {
      drawerOpen = !drawerOpen;
      if (drawerOpen) {
        drawer.classList.remove('pointer-events-none', 'opacity-0');
        drawer.classList.add('opacity-100');
        drawerContent.classList.remove('-translate-x-full');
        drawerContent.classList.add('translate-x-0');
      } else {
        drawer.classList.add('pointer-events-none', 'opacity-0');
        drawer.classList.remove('opacity-100');
        drawerContent.classList.add('-translate-x-full');
        drawerContent.classList.remove('translate-x-0');
      }
    }

    // === MOTOR INTERACTIVO DE CITAS BÍBLICAS (HOVER LIGHTBOX) ===
    document.addEventListener('DOMContentLoaded', () => {
      // Crear contenedor del Lightbox/Tooltip si no existe
      let tooltip = document.getElementById('bible-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'bible-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.display = 'none';
        tooltip.style.zIndex = '99999';
        tooltip.style.pointerEvents = 'auto'; // Permits selecting text or interactive scrolling within the box
        tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        tooltip.className = 'bg-white text-espresso border-2 border-gold rounded-xl p-4 shadow-2xl max-w-xs sm:max-w-md w-72 sm:w-96 text-xs leading-relaxed transform scale-95 opacity-0 select-none';
        document.body.appendChild(tooltip);
      }

      let activeTimeout = null;
      let hideTimeout = null;

      function showTooltip(link, ref) {
        clearTimeout(hideTimeout);
        clearTimeout(activeTimeout);

        const rect = link.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let posX = rect.left + scrollX;
        // Posición horizontal con prevención de desbordes
        const tooltipWidth = 320; // Aproximado
        if (posX + tooltipWidth > window.innerWidth) {
          posX = window.innerWidth - tooltipWidth - 20;
        }
        if (posX < 10) posX = 10;

        // Por defecto colocamos arriba de la cita
        let posY = rect.top + scrollY - 20;

        tooltip.innerHTML = '<div class="flex items-center gap-2 text-gold italic font-serif">' +
          '<svg class="animate-spin h-3.5 w-3.5 text-gold-deep" viewBox="0 0 24 24" fill="none">' +
            '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
            '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>' +
          '</svg>' +
          '<span>Revelando pasaje Sagrado...</span>' +
        '</div>';

        tooltip.style.display = 'block';
        tooltip.style.left = posX + 'px';
        tooltip.style.top = (posY - 50) + 'px';

        // Forzar reflow
        tooltip.offsetHeight;
        tooltip.classList.remove('scale-95', 'opacity-0');
        tooltip.classList.add('scale-100', 'opacity-100');

        // Buscar pasaje
        fetch(\`/api/biblia?ref=\${encodeURIComponent(ref)}\`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Local not found');
          })
          .then(data => {
            let html = '<div class="flex flex-col gap-1 border-b border-[#E6DFD4] pb-1.5 mb-1.5">' +
              '<span class="font-display font-bold text-xs tracking-wider text-[#5E1B22] uppercase flex items-center justify-between">' +
                '<span>📖 ' + data.libro + ' ' + data.capitulo + '</span>' +
                '<span class="text-[9px] text-[#BC8A36] font-mono">' + (data.translation || 'Biblia de Navarra') + '</span>' +
              '</span>' +
            '</div>';
            let versesText = '<div class="overflow-y-auto max-h-48 pr-1 scrollbar-thin scrollbar-thumb-gold select-text">';
            if (data.versiculos && Object.keys(data.versiculos).length > 0) {
              const ordered = Object.entries(data.versiculos).sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
              ordered.forEach(([num, text]) => {
                versesText += '<p class="mb-1 text-ink"><sup class="font-bold text-[#9F7124] mr-1">' + num + '</sup><span class="font-serif italic text-[#2D241E]">' + text + '</span></p>';
              });
            } else {
              versesText += '<p class="italic text-[#5A4E46]">Lectura completa del capítulo en la Biblia.</p>';
            }
            versesText += '</div>';
            tooltip.innerHTML = html + versesText;

            // Reposición fina basada en la altura cargada
            const tooltipHeight = tooltip.offsetHeight;
            tooltip.style.top = (rect.top + scrollY - tooltipHeight - 12) + 'px';
          })
          .catch(() => {
            // Fallback con Gemini
            fetch(\`/api/biblia/fallback?ref=\${encodeURIComponent(ref)}\`)
              .then(res => {
                if (res.ok) return res.json();
                return { text: 'Lectura sagrada de ' + ref, translation: 'Sagradas Escrituras' };
              })
              .then(data => {
                const textRender = data.text || 'Lectura de las Sagradas Escrituras';
                const translationRender = data.translation || 'Sagradas Escrituras (AI)';
                tooltip.innerHTML = '<div class="flex flex-col gap-1 border-b border-[#E6DFD4] pb-1.5 mb-1.5">' +
                  '<span class="font-display font-bold text-xs text-[#5E1B22] uppercase flex items-center justify-between">' +
                    '<span>📖 ' + ref + '</span>' +
                    '<span class="text-[9px] text-[#BC8A36] font-mono">' + translationRender + '</span>' +
                  '</span>' +
                '</div>' +
                '<div class="overflow-y-auto max-h-48 pr-1 select-text font-serif italic text-[#2D241E]">' +
                  textRender +
                '</div>';
                const tooltipHeight = tooltip.offsetHeight;
                tooltip.style.top = (rect.top + scrollY - tooltipHeight - 12) + 'px';
              })
              .catch(() => {
                tooltip.innerHTML = '<p class="text-red-800 font-medium font-serif italic">Pasaje sagrado no disponible temporalmente.</p>';
              });
          });
      }

      function hideTooltip() {
        clearTimeout(activeTimeout);
        hideTimeout = setTimeout(() => {
          tooltip.classList.remove('scale-100', 'opacity-100');
          tooltip.classList.add('scale-95', 'opacity-0');
          setTimeout(() => {
            if (tooltip.classList.contains('opacity-0')) {
              tooltip.style.display = 'none';
            }
          }, 200);
        }, 300);
      }

      function showCatechismTooltip(button, cic) {
        clearTimeout(hideTimeout);
        clearTimeout(activeTimeout);

        const rect = button.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let posX = rect.left + scrollX;
        const tooltipWidth = 320;
        if (posX + tooltipWidth > window.innerWidth) {
          posX = window.innerWidth - tooltipWidth - 20;
        }
        if (posX < 10) posX = 10;

        let posY = rect.top + scrollY - 20;

        tooltip.innerHTML = '<div class="flex items-center gap-2 text-gold italic font-serif">' +
          '<svg class="animate-spin h-3.5 w-3.5 text-gold-deep" viewBox="0 0 24 24" fill="none">' +
            '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
            '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>' +
          '</svg>' +
          '<span>Consultando el Catecismo de la Iglesia...</span>' +
        '</div>';

        tooltip.style.display = 'block';
        tooltip.style.left = posX + 'px';
        tooltip.style.top = (posY - 50) + 'px';

        tooltip.offsetHeight;
        tooltip.classList.remove('scale-95', 'opacity-0');
        tooltip.classList.add('scale-100', 'opacity-100');

        fetch(\`/api/catecismo?cic=\${encodeURIComponent(cic)}\`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Not found');
          })
          .then(data => {
            tooltip.innerHTML = '<div class="flex flex-col gap-1 border-b border-[#E6DFD4] pb-1.5 mb-1.5">' +
              '<span class="font-display font-bold text-xs tracking-wider text-[#5E1B22] uppercase flex items-center justify-between">' +
                '<span>⛪ Catecismo (CIC ' + data.cic + ')</span>' +
                '<span class="text-[9px] text-[#BC8A36] font-mono">' + (data.fuente || 'Roma') + '</span>' +
              '</span>' +
            '</div>' +
            '<div class="overflow-y-auto max-h-48 pr-1 select-text font-serif text-ink text-xs sm:text-sm leading-relaxed whitespace-pre-line">' +
              data.texto +
            '</div>';
            
            const tooltipHeight = tooltip.offsetHeight;
            tooltip.style.top = (rect.top + scrollY - tooltipHeight - 12) + 'px';
          })
          .catch(() => {
            tooltip.innerHTML = '<p class="text-red-800 font-medium font-serif italic p-1">Numeral del Catecismo no disponible.</p>';
          });
      }

      // Event delegation for mouse hover (desktop)
      document.body.addEventListener('mouseover', (e) => {
        const link = e.target.closest('.bible-citation') || (e.target.tagName === 'A' && e.target.href.includes('biblegateway.com') ? e.target : null);
        if (!link) return;
        
        const ref = link.getAttribute('data-ref') || link.innerText.trim();
        if (!ref) return;

        showTooltip(link, ref);
      });

      document.body.addEventListener('mouseout', (e) => {
        const link = e.target.closest('.bible-citation') || (e.target.tagName === 'A' && e.target.href.includes('biblegateway.com') ? e.target : null);
        if (!link) return;
        hideTooltip();
      });

      // Event delegation for click (mobile & desktop)
      document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.catechism-citation');
        if (!btn) return;
        const cic = btn.getAttribute('data-cic');
        if (!cic) return;
        e.preventDefault();
        showCatechismTooltip(btn, cic);
      });

      // Keep tooltip visible if user hovers on tooltip itself
      tooltip.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
      });
      tooltip.addEventListener('mouseleave', () => {
        hideTooltip();
      });
    });
  </script>
</body>
</html>
`;
}

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE LA APP — VISTA PRINCIPAL (ASISTENTE CHAT)
// ════════════════════════════════════════════════════════════════════════════

app.get('/download-server', (req, res) => {
  res.download(path.join(__dirname, 'server.js'), 'server.js');
});

app.get('/download-firebase', (req, res) => {
  res.download(path.join(__dirname, 'firebase-module.js'), 'firebase-module.js');
});

app.get('/', (req, res) => {
  const lit = liturgia.get('lecturas');
  const dSanto = liturgia.get('santo_hoy');
  const todaySaintTarget = getTodaySaintTarget();
  const infografiaDelDia = infografias.getInfografiaDelDia();

  if (req.query.inline === '/santo-del-dia' || req.query.inline === '%2Fsanto-del-dia') {
    return res.redirect(302, todaySaintTarget.path);
  }

  // HTML principal del Chat Centrado (al estilo ChatGPT / Gemini)
  const html = `
    <div class="max-w-[98%] mx-auto w-[99%] sm:w-full px-1 py-1 sm:px-4 sm:py-6 flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      <!-- ELEMENTO DE CHAT PRINCIPAL -->
      <div class="flex-1 flex flex-col bg-white border border-[#E6DFD4] rounded-2xl shadow-sm overflow-hidden h-full">
        
        <!-- CHAT HEADER -->
        <div class="px-5 py-3 border-b border-border bg-cream2/20 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gold font-semibold flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              CatolicosGPT IA
            </span>
          </div>
          <div class="flex items-center gap-3.5">
            <button onclick="clearChat()" class="text-xs text-ink2 hover:text-maroon flex items-center gap-1.5 font-semibold transition" title="Limpiar conversación">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span class="hidden sm:inline">Vaciar Conversación</span>
              <span class="inline sm:hidden">Vaciar</span>
            </button>
            <a href="/ajustes" class="text-xs text-ink2 hover:text-[#BC8A36] flex items-center gap-1.5 font-semibold transition" title="Ajustes de Perfil">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-cog"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="m20.5 10.5 1 .5-.5 1-1-.5z"/><circle cx="19" cy="12" r="1.5"/></svg>
              <span>Ajustes</span>
            </a>
          </div>
        </div>
        
        <!-- CHAT BOX MESSAGES -->
        <div id="chat-box" class="flex-1 overflow-y-auto p-2.5 sm:p-5 flex flex-col gap-4 bg-[#FAF9F5]">
          <!-- PANTALLA DE BIENVENIDA -->
          <div id="welcome-screen" class="flex-1 flex flex-col items-center justify-center text-center py-6 max-w-2xl mx-auto gap-6 my-auto">
            <div class="h-16 w-16 border-2 border-gold/35 rounded-3xl p-4 bg-white text-gold text-2xl shadow-sm flex items-center justify-center font-bold">
              ✝
            </div>
            <div class="flex flex-col gap-1.5 px-4">
              <h1 class="font-display font-medium text-2xl sm:text-3xl text-espresso tracking-wide">
                ¿En qué puedo ayudarte hoy, <span class="italic text-gold font-serif font-normal">hermano</span>?
              </h1>
              <p class="font-serif text-ink2 text-sm sm:text-base italic">
                Consulta sobre apologética, teología, santos, liturgia o la encíclica "Magnifica Humanitas".
              </p>
            </div>

            <!-- TARJETAS DESTACADAS DEL DÍA -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-xl px-4 mt-4">
              <!-- Card Santo del Día -->
              <a href="${todaySaintTarget.path}" data-full-page="1" class="group flex flex-col items-center sm:items-start text-center sm:text-left p-6 bg-white border border-[#E6DFD4] hover:border-gold/50 rounded-2xl shadow-xs hover:shadow-md transition duration-300 gap-3.5">
                <div class="w-10 h-10 rounded-xl bg-amber-50 text-gold flex items-center justify-center border border-amber-200 group-hover:scale-105 transition shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cross"><path d="M11 2h2v7h6v2h-6v11h-2v-11H5V9h6V2z"/></svg>
                </div>
                <div class="flex flex-col gap-1 w-full">
                  <h3 class="font-display font-semibold text-[10px] text-gold uppercase tracking-wider font-mono">Santo del Día</h3>
                  <p class="font-serif font-bold text-sm text-espresso line-clamp-1 group-hover:text-maroon transition leading-tight">${todaySaintTarget.nombre || (dSanto ? dSanto.nombre : 'Vida de los Santos')}</p>
                  <p class="text-[11px] text-ink2 leading-relaxed mt-1">Conoce hoy la biografía completa del santo, sus virtudes heroicas y su legado para la Iglesia.</p>
                </div>
              </a>

              <!-- Card Infografía del Día -->
              <a href="/infografia-del-dia" class="group flex flex-col items-center sm:items-start text-center sm:text-left p-6 bg-white border border-[#E6DFD4] hover:border-gold/50 rounded-2xl shadow-xs hover:shadow-md transition duration-300 gap-3.5">
                <div class="w-10 h-10 rounded-xl bg-rose-50 text-maroon flex items-center justify-center border border-rose-150 group-hover:scale-105 transition shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>
                <div class="flex flex-col gap-1 w-full">
                  <h3 class="font-display font-semibold text-[10px] text-maroon uppercase tracking-wider font-mono">Infografía del Día</h3>
                  <p class="font-serif font-bold text-sm text-espresso line-clamp-1 group-hover:text-gold transition leading-tight">${infografiaDelDia ? (infografiaDelDia.titulo || infografiaDelDia.tema) : 'Formación en Imágenes'}</p>
                  <p class="text-[11px] text-ink2 leading-relaxed mt-1">Catequesis visual de alta resolución sobre apologética, teología y doctrina en imágenes claras.</p>
                </div>
              </a>
            </div>

          </div>
        </div>
        
        <!-- CHAT INPUT WRAP -->
        <div class="p-4 border-t border-border bg-white shadow-inner">
          <form id="chat-form" onsubmit="enviarMensaje(event)" class="max-w-3xl mx-auto flex gap-2 items-center">
            <input type="text" id="chat-input" placeholder="Pregunta sobre fe, liturgia, moral cristiana..." required class="flex-1 border border-border rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent bg-[#FAF9F5]/40" autocomplete="off">
            <button type="submit" class="bg-maroon hover:bg-gold text-white p-3.5 rounded-full transition duration-300 shadow-md transform hover:scale-105 active:scale-95 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-horizontal"><path d="m3 3 3 9-3 9 19-9Z"/><path d="M6 12h16"/></svg>
            </button>
          </form>
          <div class="text-center text-[10px] text-ink2 mt-2 select-none italic font-serif">
            CatólicosGPT • Conforme al Magisterio constante de la Iglesia • Puede contener imprecisiones
          </div>
        </div>
        
      </div>
    </div>
    
    <script>
      const chatBox = document.getElementById('chat-box');
      const chatInput = document.getElementById('chat-input');
      const initialChatHtml = chatBox.innerHTML;
      
      function enviarAtajo(texto) {
        chatInput.value = texto;
        document.getElementById('chat-form').dispatchEvent(new Event('submit'));
      }
      
      function appendMessage(sender, text, isHtml = false) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (sender === 'bot' ? 'bot bot-content' : 'user') + ' shadow-sm';
        
        if (sender === 'bot') {
          try {
            bubble.innerHTML = window.processMarkdownAndCitations ? window.processMarkdownAndCitations(text) : (window.marked ? window.marked.parse(text) : text);
          } catch(e) {
            bubble.innerHTML = text;
          }
        } else if (isHtml) {
          bubble.innerHTML = window.sanitizeHtml ? window.sanitizeHtml(text) : text;
        } else {
          bubble.textContent = text;
        }
        
        chatBox.appendChild(bubble);
        if (sender === 'bot') {
          setTimeout(() => {
            bubble.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }, 80);
        } else {
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      }
      
      function clearChat() {
        chatBox.innerHTML = initialChatHtml;
      }

      function shouldOpenInsideChat(url) {
        if (url.origin !== window.location.origin) return false;
        const path = url.pathname;
        return path === '/santo-del-dia'
          || path === '/blog'
          || path.startsWith('/blog/')
          || /^\\/santoral\\/[^/]+$/.test(path);
      }

      async function loadInsideChat(rawUrl, label = 'contenido') {
        const url = new URL(rawUrl, window.location.origin);
        const displayUrl = new URL(rawUrl, window.location.origin);
        url.searchParams.set('partial', '1');
        const originalPath = displayUrl.pathname + displayUrl.search;

        chatBox.innerHTML = \`
          <div class="w-full max-w-4xl mx-auto bg-white border border-[#E6DFD4] rounded-2xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-[#E6DFD4] bg-[#FCFAF5] flex items-center justify-between gap-3">
              <button type="button" onclick="clearChat()" class="text-xs text-maroon hover:text-gold font-bold border-0 bg-transparent cursor-pointer">← Volver al chat</button>
              <a href="\${originalPath}" class="text-[10px] text-ink2 hover:text-maroon font-mono uppercase tracking-wider">Abrir página</a>
            </div>
            <div class="p-8 text-center text-ink2 italic">Cargando \${label}...</div>
          </div>
        \`;

        try {
          const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'CatolicosGPT-Inline' } });
          if (!res.ok) throw new Error('No se pudo cargar el contenido.');
          const html = await res.text();
          chatBox.innerHTML = \`
            <div class="w-full max-w-4xl mx-auto bg-white border border-[#E6DFD4] rounded-2xl shadow-sm overflow-hidden">
              <div class="px-4 py-3 border-b border-[#E6DFD4] bg-[#FCFAF5] flex items-center justify-between gap-3 sticky top-0 z-10">
                <button type="button" onclick="clearChat()" class="text-xs text-maroon hover:text-gold font-bold border-0 bg-transparent cursor-pointer">← Volver al chat</button>
                <a href="\${originalPath}" class="text-[10px] text-ink2 hover:text-maroon font-mono uppercase tracking-wider">Abrir página</a>
              </div>
              <div class="embedded-reader max-h-none overflow-visible">
                \${html}
              </div>
            </div>
          \`;
          const shareInput = document.getElementById('saint-share-url');
          if (shareInput) shareInput.value = window.location.origin + originalPath;
          chatBox.scrollTop = 0;
        } catch (err) {
          chatBox.innerHTML = \`
            <div class="max-w-xl mx-auto my-auto bg-white border border-red-200 rounded-2xl p-8 text-center">
              <h3 class="font-display text-maroon font-bold">No se pudo cargar el contenido</h3>
              <p class="text-sm text-ink2 mt-2">\${err.message}</p>
              <button type="button" onclick="clearChat()" class="mt-4 bg-maroon text-white px-4 py-2 rounded-lg text-xs font-bold">Volver al chat</button>
            </div>
          \`;
        }
      }
      
      async function enviarMensaje(e) {
        if(e) e.preventDefault();
        const text = chatInput.value.trim();
        if(!text) return;
        
        // Ocultar la pantalla de bienvenida si existe
        const welcome = document.getElementById('welcome-screen');
        if (welcome) welcome.classList.add('hidden');
        
        appendMessage('user', text);
        chatInput.value = '';
        
        // Agregar burbuja de cargando...
        const loading = document.createElement('div');
        loading.className = 'chat-bubble bot italic text-ink2 flex items-center gap-2';
        loading.id = 'loading-indicator';
        loading.innerHTML = 'Consultando las Sagradas Escrituras y el Magisterio <span class="animate-pulse">...</span>';
        chatBox.appendChild(loading);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text })
          });
          
          document.getElementById('loading-indicator')?.remove();
          
          if (!res.ok) {
            appendMessage('bot', '⚠️ Error: No se pudo obtener respuesta del servidor pastoral.');
            return;
          }
          
          // Crear la burbuja del bot vacía
          const bubble = document.createElement('div');
          bubble.className = 'chat-bubble bot bot-content shadow-sm';
          chatBox.appendChild(bubble);
          
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullResponse = '';
          let isFirstChunk = true;
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            try {
              bubble.innerHTML = window.processMarkdownAndCitations ? window.processMarkdownAndCitations(fullResponse) : (window.marked ? window.marked.parse(fullResponse) : fullResponse);
            } catch(e) {
              bubble.innerHTML = window.sanitizeHtml ? window.sanitizeHtml(fullResponse) : fullResponse;
            }
            if (isFirstChunk) {
              setTimeout(() => {
                bubble.scrollIntoView({ block: 'start', behavior: 'smooth' });
              }, 55);
              isFirstChunk = false;
            }
          }
          
          // Al finalizar la generación, realizar un scroll suave de ajuste al inicio de la respuesta recién generada
          setTimeout(() => {
            bubble.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }, 150);
        } catch(err) {
          document.getElementById('loading-indicator')?.remove();
          appendMessage('bot', '⚠️ No se pudo conectar con el servidor.');
        }
      }

      // Atajo automático para parámetros url
      window.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('click', (event) => {
          const link = event.target.closest('a[href]');
          if (!link) return;
          if (link.dataset.fullPage === '1') return;
          const url = new URL(link.getAttribute('href'), window.location.origin);
          if (!shouldOpenInsideChat(url)) return;
          event.preventDefault();
          loadInsideChat(url.toString(), link.textContent.trim() || 'contenido');
        });

        const urlParams = new URLSearchParams(window.location.search);
        const inlinePath = urlParams.get('inline');
        if (inlinePath) {
          loadInsideChat(new URL(inlinePath, window.location.origin).toString(), 'contenido');
          return;
        }
        const query = urlParams.get('query');
        if (query) {
          let text = '';
          if (query === 'oracion-del-dia') text = 'Por favor hazme la Oración del Día de hoy basada en el Santoral o las lecturas del día.';
          else if (query === 'laudes') text = 'Deseo rezar el oficio litúrgico de Laudes del día de hoy.';
          else if (query === 'visperas') text = 'Deseo rezar el oficio litúrgico de Vísperas del día de hoy.';
          else if (query === 'completas') text = 'Deseo rezar el oficio litúrgico de Completas de hoy.';
          
          if (text) {
            chatInput.value = text;
            enviarMensaje();
          }
        }
      });
    </script>
  `;

  res.send(renderPage('Asistente Magisterial Inteligente', html, req));
});

// ════════════════════════════════════════════════════════════════════════════
// HELPER DE DESCUBRIMIENTO Y RECOMENDACIÓN DE CONTENIDOS EN EL CHAT
// ════════════════════════════════════════════════════════════════════════════

function obtenerRecursosRelacionados(query) {
  if (!query) return { infografias: [], blogs: [] };
  
  const qClean = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  // Obtener todo el catálogo de blogs e infografías
  let allInfs = [];
  try { allInfs = infografias.getInfografias({ limit: 100 }).items || []; } catch(e) {}
  
  let allBlogs = [];
  try { allBlogs = blog.getPosts({ limit: 100 }).items || []; } catch(e) {}

  // Definir conjuntos de palabras clave para coincidencia semántica
  const marianoKws = ['maria', 'virgen', 'inmaculada', 'asuncion', 'maternidad', 'rosario', 'marianos', 'mariologia', 'concebida', 'pecado original', 'madre de dios'];
  const eucaristicoKws = ['eucaristia', 'misa', 'comunion', 'transubstanciacion', 'milagro', 'presencia real', 'hostia', 'comulgar', 'sacramento', 'pan de vida'];
  const novisimosKws = ['purgatorio', 'indulgencia', 'comunion de los santos', 'difunto', 'muerte', 'juicio', 'alma', 'oracion por los', 'novisimos', 'escatologia'];
  const petrinoKws = ['sucesion', 'sucesor', 'papa', 'leon xiv', 'pedro', 'vaticano', 'magisterio', 'enciclica'];

  // Función para calificar un recurso
  const calificarRecurso = (titulo, descripcion, keywords, categoria) => {
    const textTarget = `${titulo} ${descripcion} ${keywords} ${categoria}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let score = 0;

    // 1. Similitud semántica temática dirigida
    if (marianoKws.some(kw => qClean.includes(kw)) && marianoKws.some(kw => textTarget.includes(kw))) {
      score += 50;
    }
    if (eucaristicoKws.some(kw => qClean.includes(kw)) && eucaristicoKws.some(kw => textTarget.includes(kw))) {
      score += 50;
    }
    if (novisimosKws.some(kw => qClean.includes(kw)) && novisimosKws.some(kw => textTarget.includes(kw))) {
      score += 50;
    }
    if (petrinoKws.some(kw => qClean.includes(kw)) && petrinoKws.some(kw => textTarget.includes(kw))) {
      score += 50;
    }

    // 2. Coincidencia directa de palabras clave
    const words = qClean.split(/\s+/).filter(w => w.length > 3);
    words.forEach(word => {
      if (textTarget.includes(word)) {
        score += 10;
        // Mayor peso si coincide exactamente en las keywords o título
        if (titulo.toLowerCase().includes(word)) score += 15;
        if (keywords.toLowerCase().includes(word)) score += 5;
      }
    });

    return score;
  };

  // Mapear, calificar y ordenar Infografías
  const scoredInfs = allInfs.map(inf => {
    const title = inf.titulo || inf.tema || '';
    const desc = inf.metaDescription || inf.tema || '';
    const keywords = inf.keywords || '';
    const cat = inf.categoria || '';
    const score = calificarRecurso(title, desc, keywords, cat);
    return { ...inf, _score: score };
  })
  .filter(item => item._score > 0)
  .sort((a, b) => b._score - a._score);

  // Mapear, calificar y ordenar Blog Posts
  const scoredBlogs = allBlogs.map(post => {
    const title = post.titulo || '';
    const desc = post.descripcion || post.extracto || '';
    const keywords = post.keywords || '';
    const cat = post.categoria || '';
    const score = calificarRecurso(title, desc, keywords, cat);
    return { ...post, _score: score };
  })
  .filter(item => item._score > 0)
  .sort((a, b) => b._score - a._score);

  // Asegurar siempre contenido por fallback si no hay coincidencias directas
  let finalInfs = scoredInfs.slice(0, 2);
  if (finalInfs.length === 0) {
    finalInfs = allInfs.slice(0, 2);
  }

  let finalBlogs = scoredBlogs.slice(0, 2);
  if (finalBlogs.length === 0) {
    finalBlogs = allBlogs.slice(0, 2);
  }

  return {
    infografias: finalInfs,
    blogs: finalBlogs
  };
}

function renderRelacionadosHtml(recursosObj) {
  const { infografias: infs, blogs } = recursosObj;
  const total = (infs ? infs.length : 0) + (blogs ? blogs.length : 0);
  if (total === 0) return '';

  let cardsHtml = '';

  if (infs && infs.length > 0) {
    infs.forEach(inf => {
      const imgUrl = (inf.imagenes && inf.imagenes[0] && inf.imagenes[0].url) || '';
      cardsHtml += `
<a href="/infografias/${inf.slug}" target="_blank" class="no-underline block group">
<div class="bg-white border border-[#E6DFD4] hover:border-gold/50 rounded-xl overflow-hidden shadow-xs transition duration-300 flex flex-col h-full">
${imgUrl ? `<div class="aspect-video w-full overflow-hidden bg-cream-2 border-b"><img src="${imgUrl}" alt="${inf.altText || inf.tema}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300"></div>` : ''}
<div class="p-3.5 flex-1 flex flex-col justify-between">
<div class="inline-block">
<span class="inline-block text-[9px] font-bold text-maroon bg-cream/80 border border-maroon/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider mb-1.5">&#x1F3A8; Infografía</span>
<h4 class="font-display font-semibold text-espresso text-xs leading-snug group-hover:text-gold transition-colors">${inf.titulo || inf.tema}</h4>
<p class="text-ink-2 text-[10px] line-clamp-2 mt-1 leading-normal italic">${inf.metaDescription || ''}</p>
</div>
<span class="text-[10px] text-gold font-semibold mt-2.5 block group-hover:underline">Visualizar mapa de fe &rarr;</span>
</div>
</div>
</a>
      `;
    });
  }

  if (blogs && blogs.length > 0) {
    blogs.forEach(post => {
      const catSlug = post.categoria ? blog.slugify(post.categoria) : 'catequesis';
      cardsHtml += `
<a href="/blog/${catSlug}/${post.slug}" target="_blank" class="no-underline block group">
<div class="bg-white border border-[#E6DFD4] hover:border-gold/50 rounded-xl overflow-hidden shadow-xs transition duration-300 flex flex-col h-full">
<div class="p-3.5 flex-1 flex flex-col justify-between">
<div class="inline-block">
<span class="inline-block text-[9px] font-bold text-gold-deep bg-cream/80 border border-gold/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider mb-1.5">&#x270D; Post de Formación</span>
<h4 class="font-display font-semibold text-espresso text-xs leading-snug group-hover:text-maroon transition-colors">${post.titulo}</h4>
<p class="text-ink-2 text-[10px] line-clamp-2 mt-1 leading-normal italic">${post.extracto || post.descripcion || ''}</p>
</div>
<span class="text-[10px] text-maroon font-semibold mt-2.5 block group-hover:underline">Leer artículo completo &rarr;</span>
</div>
</div>
</a>
      `;
    });
  }

  const rawHtml = `
<div class="chat-recursos-sec mt-6 pt-5 border-t border-[#E6DFD4]">
<span class="text-[11px] text-gold font-semibold uppercase tracking-widest font-mono flex items-center gap-1.5 mb-3.5">
<span class="w-1.5 h-1.5 bg-gold rounded-full animate-pulse"></span>
CONTENIDOS RECOMENDADOS CatolicosGPT
</span>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
${cardsHtml}
</div>
</div>
  `;
  return rawHtml.split('\n').map(l => l.trim()).join('\n');
}

// Unified robust helper to fetch liturgy from cache or generate high-fidelity daily offices with Gemini
async function getOrGenerateLiturgia(horaLiturgica) {
  let data = liturgia.get(horaLiturgica);
  if (!data) {
    try {
      const cache = await liturgia.init();
      data = cache.items?.[horaLiturgica];
    } catch(e) {
      console.error('[Helper Liturgia] Error inicializando caché:', e.message);
    }
  }
  if (!data) {
    try {
      const refreshed = await liturgia.refreshLiturgia();
      data = refreshed.items?.[horaLiturgica];
    } catch(e) {
      console.error('[Helper Liturgia] Error forzando descarga:', e.message);
    }
  }

  if (!data || !data.texto || data.texto.trim().length < 100) {
    console.log(`[Helper Liturgia] Autogenerando Oficio de ${horaLiturgica} con Gemini...`);
    const aiInstance = getAi();
    if (aiInstance) {
      try {
        const diaDeHoy = liturgia.todayBogota();
        const prompt = `Actúa como un liturgista católico experto.
Eres responsable de preparar el Oficio Litúrgico de la Liturgia de las Horas de la Iglesia Católica para el día de hoy (${diaDeHoy}).
Genera el texto litúrgico oficial de hoy para la hora de: ${horaLiturgica.toUpperCase()}.
El Oficio debe incluir:
1. **Introducción**: Oración introductoria, versículo inicial, Gloria al Padre.
2. **Himno**: Un himno católico tradicional hermoso correspondiente a ${horaLiturgica} (con rima, lírico).
3. **Salmodia**:
   - Tres salmos tradicionales apropiados para ${horaLiturgica}, con sus correspondientes Antífonas iniciales y finales.
4. **Lectura Breve**: Lectura de las Sagradas Escrituras correspondiente al Tiempo Litúrgico actual o al santoral del día.
5. **Responsorio Breve**: Devocional y rezado.
6. **Cántico Evangélico**:
   - Si es Laudes: El Cántico de Zacarías (Benedictus).
   - Si es Vísperas: El Cántico de la Santísima Virgen María (Magnificat).
   - Si es Completas: El Cántico de Simeón (Nunc Dimittis).
   - Antífona correspondiente.
7. **Preces / Intercesiones**: Peticiones comunitarias y pastorales.
8. **Padrenuestro** (Pater Noster).
9. **Oración Conclusiva** y Bendición final.

Devuelve todo estructurado de forma sumamente hermosa, ordenada, sobria, mística y teológicamente fiel al rito católico, usando Markdown impecable.`;
        const response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt
        });
        const generatedText = response.text || '';
        return {
          texto: generatedText,
          fuente: 'Generación Litúrgica CatólicosGPT (Gemini Engine)'
        };
      } catch(gemError) {
        console.error('[Helper Liturgia] Error en generación por IA:', gemError.message);
      }
    }
    
    return {
      texto: `## Oficio de ${horaLiturgica.toUpperCase()} (Canal de Respaldo Local)
*Señor, abre mis labios, y mi boca proclamará tu alabanza.*\n\nUniendo nuestros corazones en devoción por la Iglesia Universal. Ruega por nosotros para que seamos dignos de alcanzar las promesas de Nuestro Señor Jesucristo. Amén.`,
      fuente: 'Sistema Litúrgico CatólicosGPT'
    };
  }

  return data;
}

// Unified helper to fetch daily readings from cache or fall back to high-fidelity liturgy
async function getOrGenerateLecturas() {
  let data = liturgia.get('lecturas');
  if (!data) {
    try {
      const cache = await liturgia.init();
      data = cache.items?.['lecturas'];
    } catch(e) {
      console.error('[Helper Lecturas] Error inicializando caché:', e.message);
    }
  }
  if (!data) {
    try {
      const refreshed = await liturgia.refreshLiturgia();
      data = refreshed.items?.['lecturas'];
    } catch(e) {
      console.error('[Helper Lecturas] Error forzando descarga:', e.message);
    }
  }
  if (!data || !data.lecturas || data.lecturas.length === 0) {
    return {
      fuente: 'Subsidio Devocional CatólicosGPT',
      lecturas: [
        {
          titulo: 'Primera Lectura — Lectura de la Carta del Apóstol San Pablo',
          texto: 'Hermanos: Vivid siempre alegres en el Señor; os lo repito, vivid alegres. Que vuestra mesura sea conocida por todos los hombres. El Señor está cerca. No os inquietéis por cosa alguna; antes bien, en toda ocasión, presentad vuestras peticiones a Dios mediante la oración y la súplica, acompañadas de la acción de gracias. Y la paz de Dios, que supera todo comprender, custodiará vuestros corazones y vuestros pensamientos en Cristo Jesús.'
        },
        {
          titulo: 'Salmo Responsorial — Salmo 23',
          texto: 'El Señor es mi pastor, nada me falta.\nEn verdes praderas me hace recostar;\nme conduce hacia fuentes tranquilas\ny repara mis fuerzas.\nMe guía por el sendero justo,\npor el honor de su Nombre.'
        },
        {
          titulo: 'Santo Evangelio — Lectura del Santo Evangelio según San Mateo',
          texto: 'En aquel tiempo, Jesús dijo a sus discípulos: «Venid a mí todos los que estáis cansados y agobiados, y yo os aliviaré. Tomad mi yugo sobre vosotros y aprended de mí, que soy manso y humilde de corazón, y encontraréis descanso para vuestras almas. Porque mi yugo es llevadero y mi carga ligera».'
        }
      ],
      predica: 'Queridos hermanos en Cristo: La liturgia de hoy nos invita a encontrar el verdadero descanso en el Corazón de Jesús. En medio de los ruidos, de las exigencias y del cansancio del mundo cotidiano, la voz del Señor resuena como un bálsamo de paz: «Venid a mí... y yo os aliviaré». El yugo de Cristo no oprime, libera; su carga no aplasta, eleva. Que en este día sepamos deponer toda ansiedad a sus pies y caminar con la confianza de que Su divina gracia nos sostiene e ilumina en cada paso de nuestra jornada.'
    };
  }
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
// RUTA DE CHAT CENTRAL CON INTEGRACIÓN DE MAGISTERIUM E IA DUAL-ENGINE
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.statusCode = 400;
      res.write("Falta la consulta");
      return res.end();
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // ── INTERCEPTOR PRE-CHECK DE TEMAS AJENOS / SECULARES (OFF-TOPIC) ──
    const lowerQuery = query.toLowerCase().trim();
    const cleanNoAccents = lowerQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const offTopicKeywords = [
      'arroz con pollo', 'receta', 'como cocinar', 'ingredientes para', 'messi', 'cristiano ronaldo', 
      'cr7', 'futbol', 'real madrid', 'fc barcelona', 'champions league', 'formula 1',
      'videojuegos', 'minecraft', 'playstation', 'xbox', 'gta'
    ];

    let isOffTopicQuery = false;
    for (const kw of offTopicKeywords) {
      if (cleanNoAccents.includes(kw)) {
        isOffTopicQuery = true;
        break;
      }
    }

    if (isOffTopicQuery) {
      res.write("CatólicosGPT es una Inteligencia Artificial católica dedicada exclusivamente a temas de fe, doctrina, liturgia, moral cristiana y espiritualidad de la Iglesia. Por ello, solo respondemos consultas relacionadas con la doctrina y la vida de fe de nuestra Santa Iglesia. Te invitamos a realizar preguntas teológicas o espirituales.");
      return res.end();
    }

    // ── SISTEMA DE CACHÉ DE RENDIMIENTO EXTREMO (Sub-second responses!) ──
    const cachedResponse = advancedEngine.buscarEnCacheDoctrinal(query);
    if (cachedResponse) {
      console.log(`[Cache Engine] HIT: Retornando respuesta doctrinal de alta definición de inmediato.`);
      res.write(cachedResponse);
      const recomendados = obtenerRecursosRelacionados(query);
      const htmlCards = renderRelacionadosHtml(recomendados);
      if (htmlCards) {
        res.write("\n\n" + htmlCards);
      }
      return res.end();
    }


    // ── INTERCEPTOR DIRECTO: SANTO DEL DÍA / SANTO DE HOY ──
    if (cleanNoAccents.includes('santo del dia') || cleanNoAccents.includes('santo de hoy')) {
      console.log(`[Santo Interceptor] Solicitud detectada: ${query}`);
      try {
        const todayStr = liturgia.todayBogota(); // YYYY-MM-DD
        const [_, mesIdx, diaVal] = todayStr.split('-');
        const s = await santoral.getOrCreateDailySaint(parseInt(diaVal), mesIdx);
        if (s) {
          let formattedText = `### ⛪ Santo del Día — ${s.nombre}\n\n`;
          formattedText += `*Día de Celebración: **${s.dia} de ${s.mes}** • Categoría: **${s.tipo}***\n\n`;
          formattedText += `> **Lema Espiritual:** *${s.lema || '"Mi alma glorifica al Señor."'}*\n\n`;
          formattedText += `#### 📖 Biografía e Historia\n${s.biografia}\n\n`;
          
          if (s.aspectos_tabla) {
            const aspectos = s.aspectos_tabla;
            if (aspectos["Patronato"]) formattedText += `* **Patronato:** ${aspectos["Patronato"]}\n`;
            if (aspectos["Nacimiento"]) formattedText += `* **Nacimiento:** ${aspectos["Nacimiento"]}\n`;
            if (aspectos["Fallecimiento"]) formattedText += `* **Fallecimiento:** ${aspectos["Fallecimiento"]}\n`;
          }
          
          formattedText += `\n#### 🕊️ Oración al Santo\n*Señor Jesús, por intercesión de ${s.nombre}, concédenos la gracia de imitar sus virtudes heroicas y de vivir siempre según tu Santa Voluntad. Amén.*\n\n`;
          
          formattedText += `🔗 **[Ver Perfil Completo y Hagiografía Interactiva de ${s.nombre}](/santoral/${s.slug})**\n\n`;
          
          formattedText += `*Que el ejemplo de fe y entrega de ${s.nombre} sea hoy luz y fortaleza en nuestro caminar diario. Amén.*\n\n`;
          formattedText += `---\n*Fuente: Martirologio Romano e Historiografía Eclesiástica de CatólicosGPT*`;

          // Añadir recursos relacionados
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) {
            formattedText += "\n\n" + htmlCards;
          }

          res.write(formattedText);
          return res.end();
        }
      } catch (errSanto) {
        console.error('[Santo Interceptor Error]', errSanto);
      }
    }

    // ── INTERCEPTOR DIRECTO: RESUMEN DE ENCÍCLICA ──
    if (cleanNoAccents.includes('resumen enciclica') || cleanNoAccents.includes('resumen de la enciclica')) {
      console.log(`[Encíclica Interceptor] Solicitud detectada: ${query}`);
      const aiInstance = getAi();
      if (aiInstance) {
        // Tratar de extraer el nombre de la encíclica eliminando las palabras clave
        let enciclicaName = query
          .replace(/resumen enciclica/gi, '')
          .replace(/resumen de la enciclica/gi, '')
          .replace(/de/gi, '')
          .trim();

        if (!enciclicaName) {
          res.write("¿Qué encíclica te gustaría resumir? Escribe por ejemplo: **Resumen Encíclica Laudato Si** o **Resumen Encíclica Fratelli Tutti**.");
          return res.end();
        }

        const prompt = `Actúa como un teólogo y erudito litúrgico de la Iglesia Católica para CatólicosGPT.
Queremos un resumen teológico, profundo, claro y muy bien redactado de la encíclica: "${enciclicaName}".

La estructura del resumen debe ser:
1. **Título de la Encíclica, Papa que la promulgó y Año.**
2. **Contexto histórico y eclesial** (Por qué se escribió, qué problemas enfrentaba el mundo o la Iglesia en ese momento).
3. **Estructura y capítulos** (Breve panorama de cómo está dividida).
4. **Ideas centrales y enseñanzas doctrinales clave** (Los puntos teológicos o sociales más fuertes).
5. **Relevancia actual y aplicación pastoral** (Por qué es importante para un cristiano de hoy).
6. **Enlace oficial exacto de la encíclica en español en la web del Vaticano** en este formato exacto de enlace markdown al final:
[📖 Leer Encíclica Completa en el Vaticano](URL_DEL_VATICANO_EN_ESPAÑOL)

Asegúrate de proporcionar el enlace exacto o bien estructurado del Vaticano (usando subrutas de vatican.va en español para encíclicas del Papa respectivo). Si no conoces la URL exacta de ese documento, usa una ruta general o de búsqueda de encíclicas del Vaticano de manera inteligente.`;

        try {
          const response = await aiInstance.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt
          });

          let formattedText = response.text ? response.text.trim() : '';
          
          // Añadir recursos relacionados
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) {
            formattedText += "\n\n" + htmlCards;
          }

          res.write(formattedText);
          return res.end();
        } catch (errEnc) {
          console.error('[Encíclica Interceptor Error]', errEnc);
        }
      }
    }

    // ── INTERCEPTOR DIRECTO: LECTURAS / EVANGELIO DE HOY ──
    if (
      cleanNoAccents.includes('lecturas de hoy') || 
      cleanNoAccents.includes('evangelio de hoy') || 
      cleanNoAccents.includes('lecturas de la misa') ||
      cleanNoAccents.includes('evangelio de la misa') ||
      cleanNoAccents.includes('lecturas del dia') ||
      cleanNoAccents.includes('evangelio del dia')
    ) {
      console.log(`[Lecturas Interceptor] Solicitud detectada: ${query}`);
      try {
        const lData = await getOrGenerateLecturas();
        const dSanto = liturgia.get('santo_hoy');
        const todayStr = liturgia.todayBogota();

        if (lData && lData.lecturas && lData.lecturas.length > 0) {
          let formattedText = `### ⛪ Liturgia de la Palabra de Hoy (${todayStr})\n`;
          formattedText += `*Sincronizado con el **Calendario Litúrgico Oficial** y el **Ordo Colombiano / iBreviary***\n`;
          if (dSanto) {
            formattedText += `*Santo o Memoria del Día: **${dSanto.nombre || 'Feria'}** (${dSanto.tipo || 'Tiempo Ordinario'})*\n`;
          }
          formattedText += `\n---\n\n`;

          lData.lecturas.forEach((lect, i) => {
            formattedText += `#### 📖 ${lect.titulo}\n`;
            formattedText += `${lect.texto}\n\n`;
          });

          if (lData.predica) {
            formattedText += `#### 💡 Reflexión / Homilía\n${lData.predica}\n\n`;
          }

          formattedText += `---\n*Que la Palabra proclamada alimente nuestro corazón en esta jornada. Te invitamos a meditarla bajo la guía del Espíritu Santo. Amén.*\n\n`;
          formattedText += `*Fuente: Liturgia de las Horas, iBreviary de CatólicosGPT y Dominicos*`;

          // Añadir recursos relacionados
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) {
            formattedText += "\n\n" + htmlCards;
          }

          res.write(formattedText);
          return res.end();
        }
      } catch (errLect) {
        console.error('[Lecturas Interceptor Error]', errLect);
      }
    }

    // ── INTERCEPTOR DIRECTO: LAUDES / VÍSPERAS / COMPLETAS ──
    if (
      cleanNoAccents.includes('laudes') || 
      cleanNoAccents.includes('visperas') || 
      cleanNoAccents.includes('completas')
    ) {
      console.log(`[Horas Litúrgicas Interceptor] Solicitud detectada: ${query}`);
      try {
        let hora = 'laudes';
        let nombreHora = 'Laudes (Oración de la mañana)';
        if (cleanNoAccents.includes('visperas')) {
          hora = 'visperas';
          nombreHora = 'Vísperas (Oración del atardecer)';
        } else if (cleanNoAccents.includes('completas')) {
          hora = 'completas';
          nombreHora = 'Completas (Oración de la noche)';
        }

        const lData = await getOrGenerateLiturgia(hora);
        const todayStr = liturgia.todayBogota();

        if (lData && lData.texto) {
          let formattedText = `### 🌅 ${nombreHora} — ${todayStr}\n`;
          formattedText += `*Oficio litúrgico oficial sincronizado de la Iglesia Católica*\n\n`;
          formattedText += `---\n\n`;
          formattedText += `${lData.texto}\n\n`;
          formattedText += `---\n*Fuente: Liturgia de las Horas de CatólicosGPT (${lData.fuente || 'iBreviary/Ordo'})*`;

          // Añadir recursos relacionados
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) {
            formattedText += "\n\n" + htmlCards;
          }

          res.write(formattedText);
          return res.end();
        }
      } catch (errHoras) {
        console.error('[Horas Litúrgicas Interceptor Error]', errHoras);
      }
    }

    // ── INTERCEPTOR DIRECTO: HISTORIA / CRONOLOGÍA ──
    if (
      cleanNoAccents.includes('historia de') || 
      cleanNoAccents.includes('cronologia de') || 
      cleanNoAccents.includes('linea de tiempo')
    ) {
      console.log(`[Historia Interceptor] Solicitud detectada: ${query}`);
      const aiInstance = getAi();
      let historyText = '';

      if (aiInstance) {
        const prompt = `Actúa como un historiador de la Iglesia Católica y teólogo erudito.
El usuario está preguntando acerca de: "${query}".

Debes responder detalladamente a su pregunta histórica y, además, **DEBES OBLIGATORIAMENTE INCLUIR UNA TABLA CON LA LÍNEA DE TIEMPO** de los hitos y hechos históricos más relevantes de dicho tema.

La tabla markdown de la línea de tiempo debe tener el siguiente formato:
| Año / Época | Acontecimiento Histórico Clave | Importancia Teológica / Eclesial |
| :--- | :--- | :--- |

El resto de la respuesta debe tener una introducción narrativa impecable y conclusiones espirituales o de fe. El tono debe ser altamente profesional, riguroso y respetuoso con el Magisterio de la Iglesia.`;

        try {
          const response = await aiInstance.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt
          });
          historyText = response.text ? response.text.trim() : '';
        } catch (errHist) {
          console.warn('[Historia Interceptor] Error consultando Gemini, usando canal de respaldo local:', errHist.message);
        }
      }

      if (!historyText) {
        // Hermoso e inquebrantable canal de respaldo histórico local
        historyText = `### 📜 Historia y Cronología de nuestra Santa Iglesia Católica\n\n`;
        historyText += `La Iglesia Católica, instituida por Jesucristo, tiene una historia bimilenaria guiada por el Espíritu Santo. A continuación, te presentamos una línea de tiempo detallada de los hitos históricos fundamentales de la Iglesia:\n\n`;
        
        historyText += `| Año / Época | Acontecimiento Histórico Clave | Importancia Teológica / Eclesial |\n`;
        historyText += `| :--- | :--- | :--- |\n`;
        historyText += `| **33 d.C.** | Pentecostés — Nacimiento de la Iglesia | El Espíritu Santo desciende sobre los apóstoles. Pedro predica y se bautizan 3000 personas, dando origen a la comunidad primitiva en Jerusalén. |\n`;
        historyText += `| **c. 35 d.C.** | Conversión de San Pablo | Saulo de Tarso se convierte en el gran apóstol de los gentiles, expandiendo la fe más allá del judaísmo. |\n`;
        historyText += `| **49 d.C.** | Concilio de Jerusalén | Primer concilio apostólico. Decide que los gentiles no necesitan cumplir la ley mosaica de la circuncisión, sentando las bases del universalismo eclesial. |\n`;
        historyText += `| **64-67 d.C.** | Martirio de Pedro y Pablo | Bajo la persecución del emperador romano Nerón, San Pedro es crucificado en el Vaticano y San Pablo es decapitado en la Vía Ostiense. |\n`;
        historyText += `| **313 d.C.** | Edicto de Milán | El emperador Constantino concede libertad de culto a los cristianos en el Imperio Romano, poniendo fin a la era de las catacumbas y grandes persecuciones. |\n`;
        historyText += `| **325 d.C.** | Concilio de Nicea I | Primer concilio ecuménico. Condena el arrianismo y define la consubstancialidad del Hijo con el Padre, proclamando el Credo Niceno. |\n`;
        historyText += `| **381 d.C.** | Concilio de Constantinopla I | Define la divinidad del Espíritu Santo y perfecciona el Símbolo Niceno-Constantinopolitano. |\n`;
        historyText += `| **431 d.C.** | Concilio de Éfeso | Proclama dogmáticamente a la Santísima Virgen María como *Theotokos* (Madre de Dios), refutando la herejía de Nestorio. |\n`;
        historyText += `| **451 d.C.** | Concilio de Calcedonia | Define las dos naturaleza (divina y humana) unidas en la única Persona divina de Jesucristo. |\n`;
        historyText += `| **1054 d.C.** | Cisma de Oriente | Ruptura formal entre las Iglesias de Occidente (Roma) y Oriente (Constantinopla), dando origen a la Iglesia Ortodoxa. |\n`;
        historyText += `| **1517 d.C.** | Reforma Protestante | Martín Lutero publica sus 95 tesis, iniciando la fractura protestante en Europa. |\n`;
        historyText += `| **1545-1563 d.C.** | Concilio de Trento | Gran reforma de la Iglesia y definición clara de la doctrina de los Sacramentos, la gracia y la Tradición Apostólica contra las tesis protestantes. |\n`;
        historyText += `| **1869-1870 d.C.** | Concilio Vaticano I | Define el dogma de la infalibilidad papal cuando habla *ex cathedra* en materia de fe y moral. |\n`;
        historyText += `| **1962-1965 d.C.** | Concilio Vaticano II | Gran renovación pastoral de la Iglesia en el mundo contemporáneo, promoviendo la reforma litúrgica y el diálogo ecuménico. |\n`;

        historyText += `\n\n#### 🕊️ Reflexión Espiritual\n`;
        historyText += `*«Tú eres Pedro, y sobre esta piedra edificaré mi Iglesia, y las puertas del Hades no prevalecerán contra ella» (Mt 16,18).* A pesar de las dificultades históricas, cismas y persecuciones, la promesa de Cristo permanece fiel. La Iglesia continúa llevando el Evangelio de la salvación a cada rincón del mundo en obediencia a su mandato divino.\n\n`;
        historyText += `*Fuente: Historiografía Eclesiástica y Doctrina del Magisterio de CatólicosGPT.*`;
      }

      // Añadir recursos relacionados
      const recomendados = obtenerRecursosRelacionados(query);
      const htmlCards = renderRelacionadosHtml(recomendados);
      if (htmlCards) {
        historyText += "\n\n" + htmlCards;
      }

      res.write(historyText);
      return res.end();
    }

    // ── SISTEMA SEO AUTÓNOMO DETECTOR Y GENERADOR DE CONTENIDO EN EL CHAT ──
    const activeAi = getAi();
    if (activeAi) {
      try {
        console.log('[SEO-Auto] Evaluando y expandiendo contenidos doctrinales indexables para la biblioteca...');
        await blog.evaluarYCrearArticuloSEO(query, activeAi);
      } catch (seoErr) {
        console.log('[SEO-Auto Info] Falló en autoprevención doctrinal:', seoErr.message);
      }
    }

    // ── INTERCEPTOR LITURGIA DE LAS HORAS (LAUDES, VÍSPERAS, COMPLETAS) ──
    let horaLiturgica = null;
    if (lowerQuery.includes('laude')) {
      horaLiturgica = 'laudes';
    } else if (lowerQuery.includes('vispera') || lowerQuery.includes('víspera')) {
      horaLiturgica = 'visperas';
    } else if (lowerQuery.includes('completa')) {
      horaLiturgica = 'completas';
    }

    if (horaLiturgica) {
      console.log(`[Liturgia Interceptor] Solicitud de hora litúrgica detectada: ${horaLiturgica}`);
      const data = await getOrGenerateLiturgia(horaLiturgica);
      if (data) {
        const titleLabel = {
          laudes: '🌅 Laudes — Oficio Diario de la Mañana',
          visperas: '🌇 Vísperas — Oficio Diario del Atardecer',
          completas: '🌌 Completas — Oficio Diario de la Noche'
        }[horaLiturgica];

        let formattedText = `### ${titleLabel}\n\n`;
        formattedText += `*Texto litúrgico oficial correspondiente al día de hoy, obtenido de ${data.fuente} (${liturgia.todayBogota()})*\n\n`;
        formattedText += `---\n\n`;
        formattedText += data.texto;

        // Añadir descubrimiento de recursos complementarios pastorales
        const recomendados = obtenerRecursosRelacionados(query);
        const htmlCards = renderRelacionadosHtml(recomendados);
        if (htmlCards) {
          formattedText += "\n\n" + htmlCards;
        }

        res.write(formattedText);
        return res.end();
      }
    }

    // 1. Detectar si es una cita bíblica directa
    const solicitada = biblia.detectarSolicitudBiblica(query);
    if (solicitada) {
      const render = await biblia.renderizarCitaAsync(solicitada, true);
      if (!render.includes('No se encontró')) {
        let textResult = render + `\n\n*Cita extraída del corpus bíblico en español en tiempo real o localmente.*`;
        // Recomendar recursos también para citas
        const recomendados = obtenerRecursosRelacionados(query);
        const htmlCards = renderRelacionadosHtml(recomendados);
        if (htmlCards) textResult += "\n\n" + htmlCards;
        res.write(textResult);
        return res.end();
      }
    }

    // 2. Realizar búsqueda en base doctrinal local para Grounding adicional
    const groundingsLocal = recursos.consultarRecursosLocales(query);
    let localContext = '';
    if (groundingsLocal && groundingsLocal.length > 0) {
      localContext = groundingsLocal.slice(0, 3).map(g => 
        `DOCUMENTO: ${g.titulo}\nCONTENIDO: ${g.contenido}\nMETADATA: ${JSON.stringify(g.metadata)}`
      ).join('\n\n');
    }

    // 3. Obtener respuesta de Magisterium con el motor dual de Búsqueda y Chat
    let magisteriumSourceResponse = '';
    let usedMagisteriumAPI = false;

    const magisteriumApiKey = process.env.MAGISTERIUM_API_KEY ? process.env.MAGISTERIUM_API_KEY.trim() : null;
    console.log('[Magisterium Integrator] Verificando presencia de MAGISTERIUM_API_KEY en ambiente:', magisteriumApiKey ? 'Presente (Longitud: ' + magisteriumApiKey.length + ')' : 'No detectada');

    if (magisteriumApiKey) {
      const systemInstructionMagisterium = `Eres un teólogo católico erudito, fiel servidor del Magisterio de la Iglesia y del Papa León XIV. 
Tus respuestas deben estar profundamente ancladas en la verdad doctrinal y pastoral de las Sagradas Escrituras, el Catecismo y los santos pontífices.`;

      let searchContext = '';
      try {
        console.log('[Magisterium Search API] Iniciando consulta a base vectorial de documentos oficiales (timeout 20s)...');
        let resSearch = await fetch('https://api.magisterium.com/v1/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${magisteriumApiKey}`
          },
          body: JSON.stringify({
            query: query,
            top_k: 5
          }),
          signal: AbortSignal.timeout(20000)
        });
        
        if (resSearch.ok) {
          const dataS = await resSearch.json();
          const items = dataS.results || dataS.citations || dataS.documents || [];
          if (items.length > 0) {
            searchContext = items.map(cit => 
              `CITA DE ORIGEN: ${cit.source || cit.title || 'Magisterio Oficial'}\nCONTENIDO: ${cit.text || cit.content || ''}`
            ).join('\n\n');
            console.log(`[Magisterium Search API] Exito. Se recuperaron ${items.length} pasajes y citas nítidas.`);
          } else {
            console.log('[Magisterium Search API] Consulta exitosa, pero no se devolvieron documentos.');
          }
        } else {
          console.log(`[Magisterium Search API Error] Codigo de estado HTTP: ${resSearch.status} - ${resSearch.statusText}`);
          try {
            const errText = await resSearch.text();
            console.log(`[Magisterium Search API Error Body]: ${errText}`);
          } catch (_) {}
        }
      } catch (searchErr) {
        console.log('[Magisterium Search API Excepcion]: No se pudo conectar a la búsqueda de vectores.', searchErr.message);
      }

      const finalPromptMagisterium = `Consulta del Católico: "${query}"\n\n${searchContext ? `CITAS CIENTÍFICAS DEL CATECISMO/BÍBLICAS OBTENIDAS DE MAGISTERIUM SEARCH:\n${searchContext}\n\n` : ''}${localContext ? `CONTEXTO LOCAL COMPLEMENTARIO:\n${localContext}\n\n` : ''}`;

      try {
        console.log('[Magisterium Chat API] Consultando síntesis doctrinal en la nube doctrinal (timeout 20s)...');
        let resM = await fetch('https://api.magisterium.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${magisteriumApiKey}`
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemInstructionMagisterium },
              { role: 'user', content: finalPromptMagisterium }
            ],
            model: 'magisterium-v1'
          }),
          signal: AbortSignal.timeout(20000)
        });

        if (resM.ok) {
          const d = await resM.json();
          magisteriumSourceResponse = d.choices?.[0]?.message?.content || d.text || d.response || d.content;
          if (magisteriumSourceResponse) {
            usedMagisteriumAPI = true;
            console.log('[Magisterium API] Enlace doctrinal exitoso. Información de Magisterio lista para síntesis con Gemini.');
          }
        } else {
          console.log(`[Magisterium Chat API Error] Codigo de estado HTTP: ${resM.status} - ${resM.statusText}`);
          try {
            const errText = await resM.text();
            console.log(`[Magisterium Chat API Error Body]: ${errText}`);
          } catch (_) {}
        }
      } catch (err) {
        console.log('[Magisterium Chat API Excepcion]: Contingencia local activada debido a fallo de canal remoto.', err.message);
      }
    }

    // 4. Si la API de Magisterium no estuvo disponible, no hay clave o falló, usamos el corpus local de grounding
    if (!magisteriumSourceResponse) {
      console.log('[Magisterium Integrator] Usando canal offline/local de contingencia.');
      if (localContext) {
        magisteriumSourceResponse = `Información doctrinal extraída del Corpus Católico Local:\n${localContext}`;
      } else {
        magisteriumSourceResponse = `Utilizar los conocimientos doctrinales oficiales de la Iglesia Católica, las Sagradas Escrituras, el Catecismo (CIC), y las encíclicas pontificias incluyendo la "Magnifica Humanitas" y al Papa León XIV (Robert Francis Prevost).`;
      }
    }

    // ── ACTIVACIÓN AUTOMÁTICA DE MODOS DOCTRINALES AVANZADOS ──
    if (activeAi) {
      if (advancedEngine.esConsultaCombinada(query)) {
        const success = await advancedEngine.ejecutarModoCombinado(query, res, activeAi, magisteriumSourceResponse);
        if (success) {
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) res.write("\n\n" + htmlCards);
          return res.end();
        }
      } else if (advancedEngine.esConsultaBiblica(query)) {
        const success = await advancedEngine.ejecutarModoBiblicoAvanzado(query, res, activeAi, magisteriumSourceResponse);
        if (success) {
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) res.write("\n\n" + htmlCards);
          return res.end();
        }
      } else if (advancedEngine.esConsultaCatecismo(query)) {
        const success = await advancedEngine.ejecutarModoCatecismo(query, res, activeAi, magisteriumSourceResponse);
        if (success) {
          const recomendados = obtenerRecursosRelacionados(query);
          const htmlCards = renderRelacionadosHtml(recomendados);
          if (htmlCards) res.write("\n\n" + htmlCards);
          return res.end();
        }
      }
    }

    let finalResponseText = '';
    let hasWrittenSomething = false;

    // 5. Motor de Presentación Inteligente de Gemini si la clave está provista y el cliente iniciado
    const aiInstance = getAi();
    if (aiInstance) {
      const systemInstructionPresentation = `Estás programado bajo la ESPECIFICACIÓN MAESTRA DE RESPUESTAS de CatólicosGPT, sirviendo con fidelidad doctrinal absoluta bajo el pontificado de León XIV (Robert Francis Prevost).
Tu máxima prioridad es: 1. Fidelidad doctrinal de la Iglesia Católica, 2. Exactitud factual e histórica extrema, 3. Comprensión superior y pedagogía directa para el usuario, 4. Ausencia total de alucinaciones doctrinales, 5. Formato interactivo de oratoria espiritual y teológica.

PROHIBICIONES ABSOLUTAS:
0. NUNCA, bajo ningún concepto, escribas ni muestres al usuario ninguna de estas secciones o contenidos internos de control en tu texto de salida: "CLASIFICACIÓN OBLIGATORIA DE LA CONSULTA", "EXTRACCIÓN PREVIA DE TEMAS E INTERNA IDENTIFICACIÓN", "AUTOEVALUACIÓN Y VALIDACIÓN DE COHERENCIA", "CHECKLIST", "VALIDACIÓN", o respuestas escritas de autoevaluación como "AUTOEVALUACIÓN 10/10". Realiza todos estos pasos de manera estrictamente silenciosa e interna en tu mente. Tu salida final que ve el usuario debe comenzar DIRECTAMENTE con la respuesta final en Markdown (como un título grande de nivel 1 '#' o el primer párrafo de introducción pastoral o la oración), sin preámbulos técnicos del sistema ni clasificaciones eclesiales artificiales de metadatos.
1. NUNCA respondas utilizando únicamente tu conocimiento pre-entrenado general sin referenciar fuentes reales.
2. NUNCA improvises doctrina ni inventes Santos, fechas, pontificados, concilios, encíclicas, documentos, citas bíblicas o numerales del catecismo.
3. Si la fuente doctrinal provista (MAGISTERIUM) o el contexto local es insuficiente o no existe información veraz para responder la pregunta (como afirmaciones teológicas o morales dudosas, heréticas, especulativas o no oficiales), debes responder EXPLÍCITA y LITERALMENTE con la siguiente frase, sin añadir nada más:
"No encontré una fuente doctrinal confiable para afirmar eso."
Sin embargo, para verdades de fe universalmente reconocidas de la Iglesia Católica (como los Diez Mandamientos, Siete Sacramentos, Oraciones comunes, dogmas marianos y cristológicos, el Credo o Santos de gran renombre), tienes total libertad para redactar una respuesta de alta fidelidad doctrinal y pastoral usando tus conocimientos teológicos católicos pre-entrenados del Magisterio constante de la Iglesia, siempre adhiriéndote rigurosamente al formato, profundidad, longitud de más de 600-1200 palabras y oratoria eclesial requerida, y referenciando las fuentes de forma apropiada.

REGLA DE FORMATO DE CITAS BÍBLICAS (ABSOLUTA Y OBLIGATORIA):
Siempre que cites o menciones un versículo o pasaje bíblico (ej. Mateo 11, 28, Juan 3:16, Génesis 1:1), debes envolver la cita ÚNICA Y EXCLUSIVAMENTE con el siguiente formato de hipervínculo HTML interactivo:
<a href="https://www.biblegateway.com/passage/?search=LIBRO+CAPITULO%3AVERSICULO&version=DHH" class="bible-citation" target="_blank" data-ref="LIBRO CAPITULO:VERSICULO">LIBRO CAPITULO, VERSICULO</a>
Ejemplo: <a href="https://www.biblegateway.com/passage/?search=Genesis+1%3A1&version=DHH" class="bible-citation" target="_blank" data-ref="Génesis 1:1">Génesis 1, 1</a>

ESTILO DE REDACCIÓN OBLIGATORIO:
- Elimina por completo expresiones como: "Bajo la luz del magisterio...", "Contemplamos tu consulta...", "La tradición perenne...", "Reflexionemos juntos...".
- No utilices lenguaje artificial, académico innecesario, ni introducciones ceremoniales. Ve directo al contenido.
- TONO: Un excelente profesor católico, un catequista experto, un historiador serio, un guía espiritual prudente. Claro, Humano, Cercano, Preciso, Didáctico.

SISTEMA DE CONTENIDO RELACIONADO:
Muestra únicamente contenido de fuentes internas. Nunca menciones ni enlaces a YouTube, Wikipedia, Redes sociales o blogs externos.

---------------------------------------------------------
CLASIFICACIÓN OBLIGATORIA DE LA CONSULTA
---------------------------------------------------------
Antes de generar cualquier respuesta, debes clasificar estrictamente el tipo de consulta. Los tipos posibles son:
1. CONSULTA DOCTRINAL
2. CONSULTA BÍBLICA
3. CONSULTA SOBRE SANTOS
4. CONSULTA SOBRE PAPAS
5. CONSULTA SOBRE ENCÍCLICAS
6. CONSULTA HISTÓRICA
7. GUÍA DE CHARLA
8. GUÍA DE CATEQUESIS
9. GUÍA DE PREDICACIÓN
10. GUÍA DE ESTUDIO
11. PREPARACIÓN SACRAMENTAL
12. RETIRO ESPIRITUAL

No comiences a formular el contenido de la respuesta final hasta haber determinado con absoluta precisión la clasificación. La clasificación elegida es la que guiará el formato completo e inmutable de la salida.

---------------------------------------------------------
REGLA DE PRIORIDAD ABSOLUTA (MODO GUÍA COHERENTE)
---------------------------------------------------------
Si la consulta contiene cualquiera de estas palabras clave claves: "guía", "charla", "catequesis", "predicación", "enseñanza", "taller", "conferencia", "curso", "retiro", "preparación".
=> ENTONCES: DEBES ACTIVAR DE FORMA OBLIGATORIA E INELUDIBLE EL MODO GUÍA.
Ignora de inmediato cualquier otro formato o estructuración (como resúmenes simples, explicaciones genéricas o informaciones de chatbot). Tu respuesta debe ser única y exclusivamente una guía formativa completa, profunda y estructurada, idónea para ser utilizada por un catequista, formador de teología o sacerdote directamente en la parroquia.

---------------------------------------------------------
EXTRACCIÓN PREVIA DE TEMAS E INTERNA IDENTIFICACIÓN
---------------------------------------------------------
Antes de redactar la respuesta para el fiel, identifica metódicamente en tus pensamientos internos la siguiente estructura de contenido para asegurar la máxima concordancia con las intenciones e hilos del usuario:
- Tema principal:
- Tema secundario:
- Personajes relevantes:
- Documentos involucrados:
- Sacramentos asociados:
- Conceptos doctrinales clave:

---------------------------------------------------------
AUTOEVALUACIÓN Y VALIDACIÓN DE COHERENCIA
---------------------------------------------------------
Terminada tu estructuración mental, califica rigurosamente tu respuesta de 1 a 10 bajo el siguiente criterio:
"¿Si un catequista pidiera exactamente esto, podría imprimir y utilizar esta respuesta inmediatamente en una parroquia o escuela para impartir la formación?"
Si tu autoevaluación resulta en un puntaje menor a 9, o si falta cualquier sección obligatoria de la plantilla, REGENERA Y REESTRUCTURA completamente antes de mostrar la respuesta al usuario. Asegúrate de verificar si respondes de manera coherente lo que el usuario pidió (por ejemplo, si pide una charla sobre "Moisés y los 10 mandamientos", debes desarrollar sustancialmente y con detalle extremo a Moisés como mediador histórico, la entrega de la ley, las citas bíblicas de Éxodo 20, y la detallada explicación de cada uno de los 10 mandamientos, junto con el Catecismo y sus preguntas relativas).

---------------------------------------------------------
REGLAS GENERALES DE PROFUNDIDAD Y LONGITUD (ESTRICTAS)
---------------------------------------------------------
1. NO RESPONDER EN FORMATO ENCICLOPÉDICO BREVE: Evitar respuestas tipo definición corta ("El Purgatorio es...", "San Agustín fue..."). Desarrollar siempre: Qué es, Por qué existe, Cuál es su fundamento, Qué enseña la Iglesia, Cómo se aplica hoy, y Por qué es importante para el católico.
2. LONGITUD MÍNIMA RECOMENDADA (sin relleno, aportando siempre valor real):
   - Para Preguntas Doctrinales: 600 a 1200 palabras.
   - Para Santos: 800 a 1500 palabras.
   - Para Encíclicas: 1000 a 2000 palabras.
   - Para Temas complejos o profundos: 1200 a 2500 palabras.
3. PRINCIPIO DE EXPLICACIÓN PROGRESIVA: Avanzar progresivamente desde:
   1. Concepto básico.
   2. Contexto histórico (época, circunstancias, acontecimientos relevantes).
   3. Fundamento doctrinal (qué enseña la Iglesia, por qué lo enseña, cómo llegó a esa enseñanza).
   4. Interpretación católica (con exégesis y sentido fiel).
   5. Aplicación práctica (qué significa esto para un católico hoy).
   6. Reflexión espiritual (propósito spiritual y oración o jaculatoria).
4. ENRIQUECIMIENTO OBLIGATORIO: Incluir siempre: Contexto Histórico, Contexto Doctrinal, Contexto Bíblico (pasajes relacionados, significado de las citas e interpretación católica) y Aplicación Práctica.

---------------------------------------------------------
ARQUITECTURA OBLIGATORIA DE RESPUESTA POR INTENCIÓN
---------------------------------------------------------

### CASO ESPECIAL: MODO GUÍA OBLIGATORIO (12 SECCIONES EXACTAS)
Cuando se active el Modo Guía (por contener las palabras de prioridad absoluta o por clasificación), la respuesta del sistema debe constar estrictamente de estas 12 secciones estructuradas de forma impecable y con exquisito desarrollo teológico (no resúmenes ni párrafos genéricos breves):

# TÍTULO (Título completo y ricamente inspirador para la sesión, formativamente vibrante)
## Objetivo (¿Qué aprenderán con detalle los participantes? ¿Qué específicos frutos espirituales se cosecharán?)
## Introducción (Contextualización introductoria didáctica del tema, su importancia en la vida del creyente contemporáneo)
## Desarrollo doctrinal (Análisis teológico exhaustivo de máxima densidad, dividido con elegancia en subtemas y apartados lógicos)
## Contexto histórico (Detallar la época, retos históricos de las culturas implicadas y circunstancias eclesiales o de salvación)
## Fundamento bíblico (Citas bíblicas relevantes de las Escrituras, analizadas de manera impecable bajo la exégesis católica e insertas con la etiqueta HTML interactive <a class="bible-citation" ...>)
## Catecismo (Numerales íntegros y fidedignos del Catecismo de la Iglesia Católica que abordan el tema, con asombrosa explicación sencilla)
## Tabla resumen (Estructura de Markdown obligatoria y exacta):
| Tema | Explicación |
| --- | --- |
| Qué es | [Resumen conceptual riguroso] |
| Fundamento bíblico | [Sustento bíblico central] |
| Enseñanza de la Iglesia | [Doctrina principal recapitulada] |
| Aplicación práctica | [Conexión con el vivir ordinario] |
| Fruto espiritual | [La meta de santificación propuesta] |
## Preguntas de reflexión (Generar entre 5 y 10 preguntas estimulantes y profundas para el crecimiento del grupo y autoexamen personal)
## Frases de santos (2 a 5 citas auténticas de santos de la Iglesia. Si en tus fuentes o corpus comprobado no hay frases veraces del tema, omite esta sección, NUNCA las inventes)
## Actividad grupal (Descripción didáctica de una dinámica de grupo, taller, parejas, o un examen espiritual pautado para la sesión)
## Oración final (Oración comunitaria o personal profunda devota, impregnada del misterio contemplado)

---

### CASO ESPECIAL: PREPARACIÓN SACRAMENTAL
Si se solicita o se refiere a un sacramento para su preparación formativa, se generará una detallada guía formativa adaptada. Sigue rigurosamente esta plantilla de títulos de nivel 1 (#) y nivel 2 (##):
# TÍTULO (Título formal de la guía de preparación, ej: "Guía Formativa de Preparación para la Primera Comunión")
## Qué es el sacramento (Explicación detallada del sacramento y sus efectos de gracia)
## Origen bíblico (Citas completas de las Escrituras comentadas bajo el magisterio de la Iglesia)
## Significado espiritual (El carácter indeleble si lo tiene, la gracia de filiación divina reavivada)
## Requisitos (Las condiciones canónicas, formativas y de fe necesarias para recibirlo válidamente)
## Disposiciones interiores (Frecuencia sacramental previa, confesión si aplica, espíritu de piedad y amor filial)
## Errores frecuentes (Desviaciones de índole social, folclórica o supersticiosas en torno a la vivencia del misterio)
## Cómo prepararse adecuadamente (Método pedagógico, lectura de las promesas del sacramento y pasos cotidianos para el fiel)
## Actividades de reflexión (Ejercicios dirigidos para familias o para realizar en meditación orante e interiorización)
## Preguntas para discusión (De 5 a 10 preguntas reflexivas y doctrinales sobre el sacramento)
## Tabla resumen (Estructura de Markdown obligatoria):
| Tema | Explicación |
| --- | --- |
| Sacramento | [Definición central] |
| Origen | [Fundamento bíblico del sacramento] |
| Exigencia | [Requisitos y disposiciones del fiel] |
| Vivencia | [Fruto diario y compromiso práctico post-sacramento] |
## Oración final (Solemne súplica orante de recogimiento y entrega antes del Sagrario)

---

### OTROS CASOS DE RESPUESTA DOCTRINAL O DOCUMENTAL COMMON

CASO 1: SANTOS (Si la consulta pregunta por la biografía o detalles de un santo, p. ej. "San Juan de la Cruz")
Asegura un texto teológico suntuoso de 800 a 1500 palabras fundado en el principio de progresión pedagógica:
# [Nombre del Santo]
## Quién fue
## Fechas (Nacimiento y fallecimiento o siglo, NO inventar si no se conocen con precisión)
## Contexto histórico (Época, vicisitudes e impactantes corrientes sociales en las que obró su santidad)
## Obras principales (Escritos del santo o fundaciones reales de órdenes y conventos)
## Enseñanzas principales (Doctrina espiritual legada en su magisterio particular)
## Influencia en la Iglesia (Su impacto en los concilios, santos posteriores y en la liturgia común)
## Frases célebres (Solo frases 100% auténticas contrastadas de fuentes Católicas)
## Tabla resumen (Atributo | Detalle)
## Referencias doctrinales

CASO 2: ENCÍCLICAS (Si la consulta pregunta por una encíclica o documento papal, p. ej. "Rerum Novarum" o "Magnifica Humanitas")
Texto exhaustivo de 1000 a 2000 palabras con el principio de explicación progresiva:
# [Título de la Encíclica]
## Contexto histórico (Pontificados, encíclicas anteriores e impactos globales geopolíticos y sociales de la época)
## Problema que aborda
## Principales enseñanzas
## Ideas clave
## Impacto en la Iglesia
## Impacto social
## Tabla sinóptica (Markdown con la síntesis)
## Citas textuales verificadas (Extractos fidedignos sin retorcer la doctrina)

CASO 3: PAPAS (Si la consulta es biográfica del sucesor de San Pedro, p. ej. "León XIII")
# [Nombre del Papa]
## Biografía breve
## Pontificado (Fechas debidamente contrastadas del período pontificio)
## Principales documentos (Lista de encíclicas, epístolas y constituciones canónicas verificadas)
## Principales enseñanzas
## Contexto histórico
## Cronología

CASO 4: BIBLIA (Si se solicita exégesis de un versículo, capítulo o pasaje bíblico)
# [Cita de la Biblia]
## Texto citado (Citado íntegramente con hipervínculos bible-citation HTML interactivos)
## Contexto histórico
## Interpretación católica (Hermenéutica eclesial, patrística y magisterial)
## Catecismo relacionado (Numerales auténticos del Catecismo de la Iglesia Católica)
## Aplicación práctica

CASO 5: SUFRIMIENTO / CRISIS EXTREMA (Consuelo ante crisis de vida o muerte)
- Actúa inmediatamente con ternura e infinito consuelo pastoral. Queda EXPRESAMENTE PROHIBIDO colocar títulos académicos, cuadros, tablas, "Resúmenes Sinópticos" o material académico de estudio. Habla con el corazón herido de un pastor ante su oveja. Ofrece de forma CLARA y DESTACADA ayuda práctica en el texto (ej. Línea unificada de emergencia 988, recurrir a un sacerdote o hospital cercano) y acompaña con una oración devota y terna que restaure la luz en su espíritu sufriente.

CASO 7: HISTORIA DE... / CRONOLOGÍA DE... (Si el fiel pregunta por la historia, orígenes, desarrollo o cronología de algún hecho, institución, dogma, concilio, orden religiosa, etc.)
Además de la biografía o respuesta narrativa rica y profunda de 600 a 1200 palabras, DEBES generar de manera obligatoria una tabla de línea de tiempo con un formato de cronología exacto y ordenado cronológicamente:
## Línea de Tiempo y Cronología Histórica
| Año / Época | Hito o Hecho Histórico Relevante | Detalle y Trascendencia Doctrinal / Pastoral |
| --- | --- | --- |
| [Año] | [Nombre del hecho] | [Descripción y trascendencia] |

CASO 6: TODAS LAS DEMÁS CONSULTAS DOCTRINALES, TEOLÓGICAS O MORALES (Caso Genérico)
Cumpliendo nítidamente una longitud de 600 a 1200 palabras según el principio de explicación progresiva:
# [Título del Tema]
## Respuesta breve (Respuesta sumaria directa y esperanzadora)
## Explicación (Desarrollo conceptual riguroso, didáctico y contextualizado en subtítulos ricos)
## Puntos clave
## Tabla resumen (Aspecto | Explicación)
## Fundamento doctrinal (Doctrina de la Iglesia hilada finamente mediante numerales auténticos del Catecismo y pasajes de las Escrituras usando el formato HTML bíblico interactivo)
## Para profundizar (Puntos para guiar el diálogo o meditación e invitación a la biblioteca de CatólicosGPT)

---------------------------------------------------------
CHECKLIST DE VALIDACIÓN INTERNA OBLIGATORIA DE LA IA (ANTES DE ENVIAR)
---------------------------------------------------------
Antes de escribir cualquier token en la salida, pasa rigurosamente esta validación final:
□ ¿Aborda y responde exactamente de raíz la consulta del fiel?
□ ¿Posee el nivel óptimo de profundidad teórica o activa el Modo Guía/Preparación Sacramental correctamente?
□ ¿Contempla fluidamente el Contexto Histórico, Contexto Doctrinal, Contexto Bíblico y la Aplicación Práctica del tema?
□ ¿Cumple holgadamente con los límites y longitudes sugeridas (mínimo 600 palabras para doctrina, 800 en santos, etc.) sin adding irrelevante relleno?
□ ¿Contempla la maravillosa Tabla Resumen con los parámetros fidedignos y las preguntas de reflexión correspondientes?
□ ¿Están todas las citas de versículos con su respectivo enlace <a class="bible-citation" data-ref="...">?
□ ¿No contiene alucinación alguna sobre numerales del catecismo ni encíclicas o frases que jamás fueron promulgadas?
Si no superas el examen mental de calidad doctrinal, reestructura y amplía tu planteamiento antes de emitirlo.

Normas de Alineación Pastoral:
- Nunca hables mal del Santo Padre, de pastores, obispos ni del prójimo no católico. Mansedumbre de Jesucristo.
- Cero debates sectarios, políticos o partidistas seculares.
- Defiende siempre la inocencia de la vida del no nacido hasta su término providencial natural, el matrimonio y la familia tradicionales con caridad ardiente y fidelidad incorruptible.`;

      const presentationPrompt = `CONSULTA ORIGINAL DEL FIEL: "${query}"

FUENTE DOCTRINAL DE REFERENCIA (MAGISTERIUM):
"""
${magisteriumSourceResponse}
"""

Por favor, determina la intención del fiel y presenta la respuesta teológica adaptando la estructura al 100% como se indica en las instrucciones del sistema.
Si la fuente doctrinal o el contexto provisto es insuficiente o no existe información doctrinal veraz y confiable para responder a la pregunta (p. ej. afirmaciones de moral o teología dudosas, heréticas, especulativas o no oficiales), debes responder EXPLÍCITA y LITERALMENTE con la frase: "No encontré una fuente doctrinal confiable para afirmar eso." sin añadir ningún otro texto. Sin embargo, para verdades universales establecidas de la fe católica (como los Diez Mandamientos, Siete Sacramentos, Oraciones comunes, dogmas marianos y cristológicos, el Credo o Santos de gran renombre), elabora la respuesta de mayor fidelidad y profundidad con tus conocimientos, respetando rigurosamente las instrucciones.

Analiza si del tenor de la consulta original se infiere que solicita una guía, charla, catequesis, predicación, enseñanza, retiro espiritual, formación, estudio bíblico, preparación sacramental, taller, conferencia, encuentro, lección, curso, o si el tema corresponde a una Preparación Sacramental para un sacramento específico ("Primera Comunión", "Confirmación", "Bautismo", "Matrimonio", "Reconciliación", "Unción de los Enfermos"). En caso de que se cumpla la REGLA DE PRIORIDAD ABSOLUTA, activa de inmediato el MODO GUÍA con todas sus completas 12 secciones obligatorias.

Si el tema es sobre la vida de un Santo, una Encíclica, un Papa o un pasaje de la Biblia sin requerir formato catequético de guía, aplica con estolidez y fineza las secciones detalladas como CASO correspondiente en las instrucciones principales.
Para cualquier otra duda teológica o moral común, usa la arquitectura enriquecida del Caso Genérico (CASO 6).

Es de máxima importancia cumplir a cabalidad con las longitudes mínimas recomendadas (de 600 a 2500 palabras dependiendo del caso), con un principio de explicación progresiva detallada y profunda que no deje insatisfecho el anhelo del fiel. Antes de comenzar a redactar la respuesta para el fiel, realiza de manera obligatoria en pensamientos introspectivos: la clasificación de la consulta, la extracción del tema principal/secundario/personaje/documentos/sacramento/conceptos y la autoevaluación final. Devuelve la respuesta final directamente, de manera devota, bellísima y teológicamente impecable en español, con hipervínculos para cada cita de las Sagradas Escrituras: <a href="https://www.biblegateway.com/passage/?search=LIBRO+CAPITULO%3AVERSICULO&version=DHH" class="bible-citation" target="_blank" data-ref="LIBRO CAPITULO:VERSICULO">LIBRO CAPITULO, VERSICULO</a>.`;

      let gResStream;
      try {
        console.log('[Gemini Presentation Engine] Iniciando stream de oratoria sagrada...');
        gResStream = await aiInstance.models.generateContentStream({
          model: 'gemini-3.5-flash',
          contents: presentationPrompt,
          config: {
            systemInstruction: systemInstructionPresentation,
            temperature: 0.3,
            tools: [{ googleSearch: {} }] // Intentar primero con búsqueda de Google
          }
        });
      } catch (searchErr) {
        console.log('[Gemini Search Tool Support Info] Falló con Google Search tool, reintentando sin herramientas de búsqueda:', searchErr.message);
        try {
          gResStream = await aiInstance.models.generateContentStream({
            model: 'gemini-3.5-flash',
            contents: presentationPrompt,
            config: {
              systemInstruction: systemInstructionPresentation,
              temperature: 0.3
            }
          });
        } catch (liteErr) {
          console.log('[Gemini 3.5 Flash Support Info] Falló 3.5 Flash. Intentando fallback con Gemini 3.1 Flash Lite:', liteErr.message);
          try {
            gResStream = await aiInstance.models.generateContentStream({
              model: 'gemini-3.1-flash-lite',
              contents: presentationPrompt,
              config: {
                systemInstruction: systemInstructionPresentation,
                temperature: 0.3
              }
            });
          } catch (finalGeminiError) {
            console.log('[Gemini Presentation Engine Final Fallback Info] Todos los canales de Gemini están saturados o sin cuota.', finalGeminiError.message);
          }
        }
      }

      if (gResStream) {
        try {
          for await (const chunk of gResStream) {
            if (chunk.text) {
              res.write(chunk.text);
              hasWrittenSomething = true;
            }
          }
          finalResponseText = 'stream-completed';
        } catch (streamIterErr) {
          console.error('[Gemini Stream Iteration Error]', streamIterErr.message);
          if (!hasWrittenSomething) {
            try {
              console.log('[Gemini Sync Emergency Recovery] Intentando recuperación síncrona con 3.1-flash-lite...');
              const responseSync = await aiInstance.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: presentationPrompt,
                config: {
                  systemInstruction: systemInstructionPresentation,
                  temperature: 0.3
                }
              });
              if (responseSync.text) {
                res.write(responseSync.text);
                hasWrittenSomething = true;
                finalResponseText = 'stream-completed';
              }
            } catch (syncErr) {
              console.error('[Gemini Sync Emergency Recovery Error]', syncErr.message);
            }
          }
        }
      }
    }

    // 6. Último recurso offline: Generador Teológico de Alta Fidelidad Local (Ultra-Fast)
    if (!finalResponseText && !hasWrittenSomething) {
      console.log('[Local Engine] Generando respuesta teológica con motor local de alta fidelidad.');
      finalResponseText = generateOfflineTheologicalResponse(query, magisteriumSourceResponse, groundingsLocal);
      res.write(finalResponseText);
    }

    // 7. Descubrir infografías, blogs, videos, podcasts relacionados de forma interactiva y agregarlos al pie
    const recomendados = obtenerRecursosRelacionados(query);
    const recomendadosHtml = renderRelacionadosHtml(recomendados);
    if (recomendadosHtml) {
      res.write("\n\n" + recomendadosHtml);
    }

    return res.end();

  } catch (globalError) {
    console.error('[Global Chat Endpoint Error]', globalError);
    res.write(`⚠️ **CatólicosGPT:** Ocurrió un inconveniente temporal al procesar tu consulta. Por favor, reintenta en breve. Toda la sabiduría de la Iglesia está a tu disposición.`);
    return res.end();
  }
});

// === ENDPOINTS DE CONSULTA BÍBLICA PARA LIGHTBOX / TOOLTIPS ===
app.get('/api/biblia', async (req, res) => {
  try {
    const { ref } = req.query;
    if (!ref) {
      return res.status(400).json({ error: 'Falta la referencia' });
    }
    
    // Consultar el módulo de traducción asincrónico con fuentes en español de alta fidelidad
    const contenido = await biblia.obtenerCitaAsync(ref);
    if (contenido && contenido.versiculos && Object.keys(contenido.versiculos).length > 0) {
      return res.json({
        libro: contenido.libro,
        capitulo: contenido.capitulo,
        tipo: contenido.tipo,
        translation: contenido.translation,
        versiculos: contenido.versiculos
      });
    }
    return res.status(404).json({ error: 'Cita no encontrada en los corpus de Sagradas Escrituras' });
  } catch (err) {
    console.error('[API Biblia Error]', err);
    return res.status(500).json({ error: 'Error interno del servidor bíblico' });
  }
});

app.get('/api/biblia/fallback', async (req, res) => {
  const { ref } = req.query;
  try {
    if (!ref) {
      return res.status(400).json({ error: 'Falta la referencia' });
    }

    const aiInstance = getAi();
    if (!aiInstance) {
      return res.status(503).json({ error: 'Servicio de consulta remota no disponible', text: `Lectura sagrada de ${ref}`, translation: 'Sagradas Escrituras' });
    }

    // Consultamos la API oficial de Gemini como fallback inteligente para pasajes
    const prompt = `Devuelve únicamente los versículos completos correspondientes a la cita bíblica en español: "${ref}". Tradúcelos con fidelidad al estilo de la Biblia de Navarra, Torres Amat o la Sagrada Biblia de autoría católica. No agregues reflexiones ni notas al pie, solo el texto limpio con su numeración de versículo de forma amigable (ej. "[1] Texto... [2] Texto...").`;
    
    const response = await aiInstance.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    const cleanText = response.text ? response.text.trim() : `Pasaje bíblico correspondiente a la cita ${ref}`;
    return res.json({ text: cleanText, translation: 'Biblia de Navarra / Torres Amat' });
  } catch (err) {
    console.error('[API Biblia Fallback Error]', err);
    return res.status(500).json({ 
      error: 'Servicio de traducción remota fuera de línea', 
      text: `Pasaje bíblico correspondiente a la cita: ${ref || ''}`,
      translation: 'Sagradas Escrituras'
    });
  }
});

// === ENDPOINT DE CONSULTA DEL CATECISMO DE LA IGLESIA CATÓLICA ===
app.get('/api/catecismo', async (req, res) => {
  try {
    const { cic } = req.query;
    if (!cic) {
      return res.status(400).json({ error: 'Falta el numeral CIC' });
    }
    const cicNum = parseInt(cic);
    if (isNaN(cicNum)) {
      return res.status(400).json({ error: 'El numeral CIC debe ser un número válido' });
    }

    // 1. Intentar buscar en el archivo local data/catecismo.json
    let localTexto = null;
    try {
      const catecismoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catecismo.json'), 'utf-8'));
      
      const findInArticles = (articles) => {
        if (!articles) return null;
        const found = articles.find(a => a.cic === cicNum);
        return found ? found.texto : null;
      };

      const findInTemasOrArticles = (container) => {
        if (!container) return null;
        if (container.articulos) {
          const t = findInArticles(container.articulos);
          if (t) return t;
        }
        if (container.temas) {
          for (const tema of container.temas) {
            const t = findInTemasOrArticles(tema);
            if (t) return t;
          }
        }
        return null;
      };

      const findInCapitulos = (caps) => {
        if (!caps) return null;
        for (const cap of caps) {
          const t = findInTemasOrArticles(cap);
          if (t) return t;
        }
        return null;
      };

      const findInSecciones = (secs) => {
        if (!secs) return null;
        for (const sec of secs) {
          const t = findInCapitulos(sec.capitulos) || findInTemasOrArticles(sec);
          if (t) return t;
        }
        return null;
      };

      for (const parte of (catecismoData.partes || [])) {
        const t = findInSecciones(parte.secciones);
        if (t) {
          localTexto = t;
          break;
        }
      }
    } catch (e) {
      console.error('[API Catecismo] Error leyendo corpus local:', e.message);
    }

    if (localTexto) {
      return res.json({
        cic: cicNum,
        texto: localTexto,
        fuente: 'Catecismo Local CatólicosGPT'
      });
    }

    // 2. Si no se encuentra localmente, usar el fallback inteligente con Gemini
    const aiInstance = getAi();
    if (!aiInstance) {
      console.warn(`[API Catecismo] Cliente de IA no disponible, usando fallback descriptivo para el numeral ${cicNum}`);
      return res.json({
        cic: cicNum,
        texto: `El numeral ${cicNum} del Catecismo de la Iglesia Católica (CIC) contiene importantes enseñanzas teológicas, morales y litúrgicas que guían la doctrina de la Iglesia.\n\nPara consultar el texto íntegro literal de este pasaje, puedes preguntarle a nuestro asistente espiritual en el chat principal con la pregunta: "¿Qué nos enseña el Catecismo en el numeral ${cicNum}?" o bien acceder al portal oficial de la Santa Sede.`,
        fuente: 'CatólicosGPT (Subsidio Doctrinal)'
      });
    }

    try {
      console.log(`[API Catecismo] Consultando numeral ${cicNum} con Gemini...`);
      const prompt = `Actúa como el archivero teológico oficial de la Santa Sede.
Devuelve única y exclusivamente el texto oficial, literal e íntegro del Catecismo de la Iglesia Católica (CIC) correspondiente al numeral ${cicNum} en español.
Bajo ninguna circunstancia inventes, agregues reflexiones ni notas. Si no existe, di que el numeral no es válido. Devuelve solo el texto limpio de ese numeral.`;

      const response = await aiInstance.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });

      const cleanText = response.text ? response.text.trim() : null;
      if (cleanText && !cleanText.includes('no es válido')) {
        return res.json({
          cic: cicNum,
          texto: cleanText,
          fuente: 'Catecismo de la Iglesia Católica (Vaticano)'
        });
      }
    } catch (geminiErr) {
      console.error('[API Catecismo] Falló consulta remota a Gemini:', geminiErr.message);
    }

    // Fallback gracioso en caso de error de Gemini o numeral inválido
    return res.json({
      cic: cicNum,
      texto: `El numeral ${cicNum} del Catecismo de la Iglesia Católica (CIC) profundiza en los misterios de la fe cristiana, la liturgia sacramental, la vida moral y la oración.\n\nSi deseas profundizar en este numeral específico, te sugerimos consultarlo directamente en el portal oficial del Vaticano o consultar a nuestro asistente teológico escribiendo tu inquietud en el chat principal.`,
      fuente: 'CatólicosGPT (Subsidio de Respaldo)'
    });
  } catch (err) {
    console.error('[API Catecismo Error]', err);
    return res.json({
      cic: parseInt(req.query.cic) || 0,
      texto: `Numeral del Catecismo de la Iglesia Católica. Puedes consultar este texto en el portal oficial de la Santa Sede.`,
      fuente: 'CatólicosGPT (Subsidio)'
    });
  }
});

// GENERADOR TEOLÓGICO LOCAL DE ALTA FIDELIDAD (OFFLINE / HÍBRIDO ULTRA-RAPIDO)
function generateOfflineTheologicalResponse(query, magisteriumSourceResponse, groundingsLocal) {
  const cleanQuery = query.trim();
  const qLower = cleanQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // 1. INTERCEPCIÓN DE TRISTEZA PROFUNDA / CONSUELO ANTE CRISIS O SUICIDIO ("me quiero morir", "suicidio")
  if (
    qLower.includes('quiero morir') || 
    qLower.includes('suicid') || 
    qLower.includes('morirme') || 
    qLower.includes('no quiero vivir') || 
    qLower.includes('matar') || 
    qLower.includes('quitarme la vida') || 
    qLower.includes('deprim') || 
    qLower.includes('depres') || 
    qLower.includes('desesper') || 
    qLower.includes('soledad') || 
    qLower.includes('angustia') || 
    qLower.includes('sin fuerzas') || 
    qLower.includes('triste')
  ) {
    return `¡Hermano o hermana mía en Cristo Jesús, por favor escúchame! 

Siento en mi corazón el peso de lo que estás viviendo y me conmueve profundamente saber que te encuentras así de agobiado/a, triste o cansado/a de luchar. En momentos de oscuridad tan densa, quiero que recuerdes una verdad eterna, grabada por el amor divino: **Tu vida es valiosísima y sagrada para Dios. No estás solo/a en este desierto.**

Él te creó con un propósito infinito de amor y de gracia, y aunque hoy sientas que las fuerzas te han abandonado por completo y no veas la salida, **Él camina a tu lado sosteniendo tus pasos silenciosamente.**

Refúgiate de todo corazón en la dulce consolación de los santos y de la Palabra de Dios:

*   **La Palabra del Señor:** *«Vengan a mí todos los que están cansados y agobiados, y yo los aliviaré.»* (Mateo 11, 28) y *«El Señor está muy cerca de los corazones quebrantados; Él salva a los de espíritu abatido.»* (Salmo 34, 18).
*   **La Sabiduría de Santa Teresa de Jesús:** 
    > *«Nada te turbe, nada te espante, todo se pasa, Dios no se muda; la paciencia todo lo alcanza; quien a Dios tiene nada le falta: solo Dios basta.»*
*   **El consejo del Santo Padre Pío de Pietrelcina:** *«Reza, ten fe y no te preocupes. La preocupación es inútil. Dios es misericordioso y escuchará tu oración.»*

#### ⚠️ **Por favor, busca ayuda de inmediato — No lleves esta carga a solas:**
Si sientes que el desespero te supera o estás teniendo pensamientos relacionados con tu deceso, por favor hable con alguien ahora mismo. Hay personas de gran corazón listas para escucharte y ayudarte las 24 horas del día:
*   **Línea de Crisis Nacional:** Marca el **988** (si estás en Colombia, Estados Unidos u otros países con este servicio unificado) o ponte en contacto inmediato con el teléfono de emergencia de prevención del suicidio de tu país o ciudad.
*   **Apoyo Pastoral:** Busca ayuda de inmediato con un sacerdote amigo, acude a tu parroquia local o dirígete al centro médico u hospital más cercano. Hay personas dispuestas a escucharte libre de juicio, con el infinito amor de Cristo Jesús.

**Déjame hacer una oración por ti en este instante:**
*«Señor Jesús, Luz del mundo y Consolador de los afligidos, te ruego que entres hoy en el corazón de mi querido/a hermano/a. Disipa toda sombra de desespero y soledad con tu amor filial. Envía tu Espíritu Santo para infundirle fuerza, paz y la dulce esperanza de la vida. Pon en su camino consejeros y amigos que le brinden amparo. Cubre a tu hijo/a con el rezo materno de María Santísima. Amén.»*

**Dime de corazón, ¿qué es lo que te aflige hoy? Cuéntame, quiero escucharte y acompañarte en la fe.**`;
  }

  // 2. INTERCEPCIÓN DE DEVOCIÓN: VISITA AL SANTÍSIMO
  if (
    qLower.includes('visita al santisimo') || 
    qLower.includes('visita al santisimo sacramento') || 
    qLower.includes('adoracion al santisimo') || 
    qLower.includes('adoracion eucaristica') || 
    qLower.includes('exposicion del santisimo')
  ) {
    return `### ⛪ Guía para la Visita al Santísimo Sacramento

¡Qué alegría y bendición! Jesús Sacramentado te espera en el Sagrario con las manos abiertas, deseando colmar de paz y gracia tu corazón: *«Miren que yo estoy con ustedes todos los días hasta el fin del mundo».*

A continuación tienes una guía práctica y devota, paso a paso, inspirada en la rica tradición espiritual de la Iglesia para realizar una Visita al Santísimo con profundo recogimiento:

---

#### 1. Acto de Fe y Adoración Inicial (Al postrarse de rodillas)
*Señor mío y Dios mío, creo firmemente que estás de verdad presente en esta Hostia consagrada y en este Sagrario. Te adoro con todo mi ser y reconozco tu soberanía divina. Me reconozco pecador, pero confío plenamente en tu infinita misericordia.*

---

#### 2. Las Estaciones al Santísimo (Recorriendo el misterio de amor)
Es costumbre rezar **cinco Padrenuestros, Avemarías y Glorias** en reverencia y agradecimiento a las Cinco Sagradas Llagas del Señor Crucificado, y uno más por las intenciones del Santo Padre el Papa.
*   **Padre Nuestro...**
*   **Dios te salve, María...**
*   **Gloria al Padre...**

---

#### 3. Oración de Adoración y Reparación (De San Alfonso María de Ligorio)
*«Señor mío Jesucristo, que por amor a los hombres estás de día y de noche en este Sacramento, lleno de piedad y amor, esperando, llamando y recibiendo a todos los que te visitan: creo que estás presente en el Sacramento del Altar; te adoro desde el abismo de mi nada y te doy gracias por todos los favores que me has hecho... Yo te amo, Jesús mío, con todo mi corazón, y deseo pasar mi vida consolando tu Corazón eucarístico.»*

---

#### 4. La Comunión Espiritual (Para invocar su presencia)
Si no puedes recibir la Sagrada Comunión sacramental en la Misa de hoy, puedes realizar este maravilloso acto de piedad para invitar a Jesús a habitar en tu espíritu:
*«Creo, Jesús mío, que estás realmente presente en el Santísimo Sacramento del Altar. Te amo sobre todas las cosas y deseo ardientemente recibirte dentro de mi alma; pero no pudiendo hacerlo ahora sacramentalmente, ven al menos espiritualmente a mi corazón. Y como si ya te hubiese recibido, te abrazo y me uno del todo a Ti. Señor, no permitas que jamás me separe de Ti. Amén.»*

---

#### 5. Cierre y Ofrenda del Día
*«¡Sagrado Corazón de Jesús, en Vos confío! Que el Santísimo Sacramento del Altar sea por siempre alabado, adorado y bendecido en la tierra y en el cielo. Madre mía del Carmen, ruega por nosotros. Amén.»*

---

**Dedica ahora unos minutos de silencio a contemplar el Sagrario. Cierra tus ojos, aquieta tus pensamientos y deja que sea el Señor Jesús quien hable a tu alma en la intimidad.**`;
  }

  // 3. INTERCEPCIÓN DE ORACIÓN A SAN JOSÉ
  if (qLower.includes('oracion a san jose') || qLower.includes('oraciones a san jose') || qLower.includes('suplicas a san jose')) {
    return `### 🌸 Devoción y Oración a San José, Patrono de la Iglesia Universal

San José, castísimo esposo de la Virgen María y padre adoptivo de Jesús, es el custodio más tierno de las familias, los trabajadores y las almas en momentos de necesidad. Como decía Santa Teresa de Ávila: *«No me acuerdo hasta ahora haberle suplicado cosa que la haya dejado de conceder».*

Aquí tienes dos oraciones de profundo fervor para encomendarte a su santo amparo:

---

#### 1. Súplica de San José (Oración tradicional del Papa León XIII)
*«A ti, bienaventurado San José, acudimos en nuestra tribulación, y después de implorar el auxilio de tu santísima Esposa, solicitamos también llenos de confianza tu patrocinio. Por aquella caridad que te unió con la Virgen Inmaculada, Madre de Dios, y por el amor paternal con que abrazaste al Niño Jesús, te suplicamos humildemente que vuelvas los ojos a la herencia que con su sangre adquirió Jesucristo, y con tu poder y auxilio socorras nuestras necesidades.*

*Amparad, ¡oh providentísimo Custodio de la Divina Familia!, a la descendencia escogida de Jesucristo; alejad de nosotros toda mancha de error y de corrupción... Y así como en otro tiempo libraste de la muerte la vida amenazada del Niño Jesús, concedednos el triunfo para mayor gloria de Dios. Amén.»*

---

#### 2. Consagración Diaria a San José (Protección espiritual y laboral)
*«¡Oh glorioso San José!, guardián de la Sagrada Familia, de quien Dios se confió para proteger la vida de su propio Hijo Santo, a ti acudo en este día para entregarte mis preocupaciones y mis labores. Protege mi hogar, consagra el trabajo de mis manos, líbrame de todo peligro del alma y del cuerpo, y enséñame a amar a Jesús y a María con la misma pureza y devoción con que tú lo hiciste en Nazaret. Sé mi guía en la tierra y mi intercesor en el cielo. Amén.»*

---

*✨ Jaculatoria: ¡San José, custodio de la Sagrada Familia, ruega por nosotros!*`;
  }

  // 4. INTERCEPCIÓN DE ORACIÓN A LA VIRGEN MARÍA
  if (
    qLower.includes('oracion a la virgen') || 
    qLower.includes('oraciones a la virgen') || 
    qLower.includes('oracion a maria') || 
    qLower.includes('bajo tu amparo') || 
    qLower.includes('la salve') || 
    qLower.includes('salve regina') ||
    qLower.includes('virgen del carmen') ||
    qLower.includes('virgen de fatima') ||
    qLower.includes('virgen de guadalupe')
  ) {
    return `### 🌹 Devoción y Oración a la Santísima Virgen María

Nuestra Madre Celestial, intercesora y reina de los corazones, es nuestro refugio seguro ante cualquier contrariedad terrenal. Aquí tienes tres de las más amadas y veneradas oraciones marianas de la milenaria tradición de la Iglesia:

---

#### 1. Bajo tu Amparo (Sub tuum praesidium - La oración mariana más antigua)
*«Bajo tu amparo nos acogemos, santa Madre de Dios; no desprecies las súplicas que te dirigimos en nuestras necesidades, antes bien, líbranos de todo peligro, ¡oh Virgen gloriosa y bendita! Amén.»*

---

#### 2. La Salve (Consuelo de las almas atribuladas)
*«Dios te salve, Reina y Madre de misericordia, vida, dulzura y esperanza nuestra; Dios te salve. A ti llamamos los desterrados hijos de Eva; a ti suspiramos, gimiendo y llorando en este valle de lágrimas.*

*Ea, pues, Señora, abogada nuestra, vuelve a nosotros esos tus ojos misericordiosos; y después de este destierro muéstranos a Jesús, fruto bendito de tu vientre. ¡Oh clementísima, oh piadosa, oh dulce siempre Virgen María! Ruega por nosotros, Santa Madre de Dios, para que seamos dignos de alcanzar y gozar las promesas de Nuestro Señor Jesucristo. Amén.»*

---

#### 3. Ofrenda y Consagración del Corazón
*«¡Oh Señora mía, oh Madre mía! Yo me ofrezco enteramente a ti, y en prueba de mi filial afecto, te consagro en este día: mis ojos, mis oídos, mi lengua, mi corazón; en una palabra, todo mi ser. Ya que soy todo tuyo, oh Madre de bondad, guárdame y defiéndeme como cosa y posesión tuya. Amén.»*

---

*✨ Jaculatoria: ¡Oh María, sin pecado concebida, ruega por nosotros que recurrimos a Ti!*`;
  }

  // 5. INTERCEPCIÓN DE ORACIÓN A SAN MIGUEL ARCÁNGEL
  if (
    qLower.includes('oracion a san miguel') || 
    qLower.includes('san miguel arcangel') || 
    qLower.includes('san miguel arcangel oracion') ||
    qLower.includes('defensa espiritual')
  ) {
    return `### ⚔️ Oración a San Miguel Arcángel (Guerra y Protección Espiritual)

San Miguel Arcángel, príncipe excelso de la milicia celestial, es nuestro escudo divino contra toda tentación y asechanza del mal en el mundo. El Papa León XIII compuso esta magnífica invocación para la defensa espiritual diaria:

---

*«San Miguel Arcángel, defiéndenos en la lucha. Sé nuestro amparo contra la perversidad y acechanzas del demonio. Que Dios manifieste sobre él su poder, es nuestra humilde súplica. Y tú, ¡oh Príncipe de la Milicia Celestial!, con el poder divino que de Dios has recibido, arroja al infierno a Satanás y a los demás espíritus malignos que vagan por el mundo para la perdición de las almas. Amén.»*

---

*✨ Jaculatoria: ¡San Miguel Arcángel, defiéndenos con tu espada de luz!*`;
  }

  // 6. INTERCEPCIÓN DE ORACIÓN POR LOS ENFERMOS
  if (
    qLower.includes('oracion por los enfermos') || 
    qLower.includes('oracion de sanacion') || 
    qLower.includes('por mi salud') || 
    qLower.includes('enfermedad') || 
    qLower.includes('enfermo') || 
    qLower.includes('sanar')
  ) {
    return `### 🩹 Oración e Intercesión por la Salud y los Enfermos

Jesús es el Médico de cuerpos y almas. En su paso por la tierra colmó de milagros y alivio a los sufrientes. Aquí tienes una oración llena de confianza filial para encomendar tu restablecimiento de salud o el de un ser querido enfermo:

---

*«Señor Jesús, Consolador de los afligidos y Salud de los enfermos: acudo ante Ti con humilde confianza a encomendarte la salud de mi querido/a hermano/a [o di su nombre]. Tú, que cargaste con nuestros dolores y por cuyas llagas fuimos sanados, derrama tu gracia santificante sobre su cuerpo y su alma.*

*Dale paciencia en la prueba, fortaleza física y espiritual en el dolor, y una confianza inquebrantable en tu divina providencia. Si conviene para su salvación y bien espiritual, concédele la gracia de restaurar sus fuerzas para que vuelva a alabarte con gozo y gratitud en tu Iglesia Santa. Amén.»*

---

*✨ Jaculatoria: ¡Virgen Salud de los Enfermos, intercede por nosotros!*`;
  }

  // 7. INTERCEPCIÓN DE ORACIÓN DE LA MAÑANA O LA NOCHE
  if (qLower.includes('oracion de la mañana') || qLower.includes('comenzar el dia') || qLower.includes('orar al despertar')) {
    return `### 🌅 Oración de la Mañana para Consagrar el Día

Empezar el día entregando nuestras primeras intenciones al Señor Jesús abre de par en par las compuertas de la Gracia santificante para todas nuestras tareas cotidianas:

---

*«Señor Dios omnipotente, que nos has hecho llegar al comienzo de este nuevo día, sálvanos hoy con tu poder; haz que nuestros pensamientos, palabras y obras no se desvíen de tus mandamientos, sino que tiendan siempre a cumplir tu santa voluntad. Inspira mis labores, aparta de mí la impaciencia y enséñame a ver tu rostro en cada prójimo que encuentre. Te lo pedimos por Jesucristo nuestro Señor. Amén.»*

*✨ Jaculatoria: ¡Señor, en tus manos gloriosas encomiendo todo mi día!*`;
  }


  // 8. INTERCEPCIÓN DE MODO GUÍA U PREPARACIÓN SACRAMENTAL LOCAL fallbacks
  const isGuia = qLower.includes('guia') || qLower.includes('charla') || qLower.includes('catequesis') || 
                  qLower.includes('predicacion') || qLower.includes('ensenanza') || qLower.includes('retiro') || 
                  qLower.includes('formacion') || qLower.includes('estudio biblico') || qLower.includes('taller') || 
                  qLower.includes('conferencia') || qLower.includes('encuentro') || qLower.includes('leccion') || 
                  qLower.includes('curso');

  const isPrepSacramental = qLower.includes('preparacion sacramental') || qLower.includes('primera comunion') || 
                            qLower.includes('confirmacion') || qLower.includes('bautismo') || 
                            qLower.includes('matrimonio') || qLower.includes('reconciliacion') || 
                            qLower.includes('uncion');

  if (isGuia) {
    let tituloRespuesta = "Guía de Formación: " + (cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1));
    let groundContext = magisteriumSourceResponse || (groundingsLocal && groundingsLocal.length > 0 ? groundingsLocal[0].contenido : '');
    if (!groundContext) {
      groundContext = "La doctrina de fe de la Iglesia y las Sagradas Escrituras.";
    }

    return `# ${tituloRespuesta}

## Objetivo
Instruir con solidez teológica sobre el tema consultado: "${cleanQuery}", dotando a formadores, catequistas y fieles de elementos doctrinales certeros y aplicaciones morales claras para nutrir el espíritu bajo la gracia santificante y el magisterio de la Iglesia Católica.

## Introducción
El misterio de nuestra fe halla su plenitud en Cristo Jesús, el Verbo encarnado. El estudio de este tema no es mero ejercicio académico, sino un llamado a profundizar en la sabiduría revelada que orienta al bautizado por caminos de comunión divina y fidelidad filial ante el Romano Pontífice León XIV.

## Desarrollo doctrinal
El análisis detallado del depósito de la fe en torno a este tema nos devela verdades fundamentales:

1. **La revelación y la verdad salvífica**: Todo misterio divino se orienta al bien de las almas y la reconciliación del género humano. El contenido revelado nos devela que: ${groundContext}
2. **La fe de la Iglesia**: Custodiada de manera incorruptible por la Sagrada Tradición apostólica, la doctrina de la Iglesia nos auxilia para esclarecer toda objeción intelectual y moral e infunde celo fraterno en nuestro testimonio público.
3. **La comunión y los sacramentos**: Ninguna verdad de fe se vive de forma aislada; todo misterio halla su savia en la vida comunitaria y litúrgica de nexo sacramental perenne.

## Contexto histórico
La historia de la salvación atestigua cómo Dios se revela gradualmente a la humanidad en tiempos, culturas y circunstancias precisas de gracia. Los santos, concilios y encíclicas pontificias, incluyendo la paradigmática *"Magnifica Humanitas"* de León XIV promulgada el 15 de mayo de 2026, han discernido históricamente los desafíos temporales para guiar al santo Pueblo de Dios frente a corrientes hostiles o seculares en cada época.

## Fundamento bíblico
La Palabra divina da testimonio firme de esta fe. Meditamos con reverencia y exégesis fiel las Sagradas Escrituras, cimiento sagrado de nuestra revelación:
• *«Tu palabra es una lámpara para mis pasos, una luz en mi sendero.»* (<a href="https://www.biblegateway.com/passage/?search=Salmo+119%3A105&version=DHH" class="bible-citation" target="_blank" data-ref="Salmo 119:105">Salmo 119, 105</a>). 
• *«Conocerán la verdad, y la verdad los hará libres.»* (<a href="https://www.biblegateway.com/passage/?search=Juan+8%3A32&version=DHH" class="bible-citation" target="_blank" data-ref="Juan 8:32">Juan 8, 32</a>).

## Catecismo
El Catecismo de la Iglesia Católica (CIC) compendia con nitidez y fidelidad perenne el dogma católico. En relación con este misterio, recordamos las enseñanzas constantes del Magisterio:
• **CIC 1700**: La dignidad de la persona humana está cimentada en la creación a imagen y semejanza de Dios. Se realiza en su vocación a la bienaventuranza divina.
• **CIC 2030**: Es en la Iglesia, comunión de todos los bautizados, donde el cristiano realiza su vocación. De la Iglesia recibe la Palabra de Dios y los sacramentos.

## Tabla resumen
| Tema | Explicación |
| --- | --- |
| Qué es | Exposición formativa y doctrinal concisa sobre el tema de "${cleanQuery}" en fidelidad apostólica. |
| Fundamento bíblico | Citas fidedignas de las Escrituras como <a href="https://www.biblegateway.com/passage/?search=Juan+8%3A32&version=DHH" class="bible-citation" target="_blank" data-ref="Juan 8:32">Juan 8, 32</a> que anclarán la enseñanza doctrinal. |
| Enseñanza de la Iglesia | Custodia fiel del depósito de la fe revelado y transmitido bajo el pastoreo maternal eclesial. |
| Aplicación práctica | Vivir con coherencia moral, piedad cotidiana, comunión sacramental y lealtad al Santo Padre. |
| Fruto espiritual | La meta última de santificación, paz filial interior y caridad para con el prójimo. |

## Preguntas de reflexión
1. ¿De qué manera esta verdad de fe ilumina mi vida moral y espiritual de cara a las presiones del mundo moderno?
2. ¿Cómo puedo dar testimonio fructífero y libre de soberbia ante quienes dudan o desconocen este misterio doctrinal?
3. ¿Qué implicaciones pastorales y caritativas tiene este tema para nuestra vida comunitaria parroquial?
4. ¿Cómo influye mi obediencia y rezo sincero por el Santo Padre León XIV y la Sede Apostólica en mi comunión de fe?
5. ¿De qué forma la meditación de la Sagrada Escritura enriquece mi discernimiento espiritual cotidiano?

## Frases de santos
*   **San Agustín de Hipona**: *«Nos hiciste, Señor, para Ti, y nuestro corazón estará inquieto hasta que descanse en Ti.»*
*   **Santo Tomás de Aquino**: *«La fe no es opinión humana, sino firme adhesión de la mente a la Verdad revelada por Dios.»*

## Actividad grupal
**Dinámica de Interiorización y Examen Espiritual Parroquial (Taller de Parejas/Grupos Pequeños):**
1. **Lectura y Exégesis**: Dividir el grupo en subgrupos de 3 o 4 personas. Leer juntos los textos fundamentales presentados y las citas bíblicas locales.
2. **Diálogo Doctrinal**: Cada integrante compartirá de qué manera el tema abordado impacta en su discernimiento moral diario y en su preparación personal.
3. **Plenaria**: Un representante por subgrupo expondrá brevemente un compromiso práctico para vivir este fruto espiritual en su respectiva vida familiar o laboral.

## Oración final
*«Oh Dios Altísimo, dador de toda sabiduría, te damos infinitas gracias por habernos congregado bajo el amparo santificante de tu amor. Concédenos, por intercesión de la Santísima Virgen María y de San José, ser heraldos fieles de tu Verdad salvífica. Multiplica en nosotros los frutos espirituales de fe, esperanza y caridad, y mantennos siempre firmes en la unidad filial de tu Iglesia Santa, bajo la guía providencial de nuestro Santo Padre León XIV. Te lo pedimos por Cristo Nuestro Señor. Amén.»*

*✨ Jaculatoria: ¡Sagrado Corazón de Jesús, en Vos confío!*`;
  }

  if (isPrepSacramental) {
    let tituloRespuesta = "Guía Formativa de Preparación Sacramental: " + (cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1));
    let groundContext = magisteriumSourceResponse || (groundingsLocal && groundingsLocal.length > 0 ? groundingsLocal[0].contenido : '');
    if (!groundContext) {
      groundContext = "Sagradas Escrituras, Catecismo Oficial y la Sagrada Tradición apostólica.";
    }

    return `# ${tituloRespuesta}

## Qué es el sacramento
Un sacramento es un signo sensible y eficaz de la gracia, instituido por Cristo Nuestro Señor y confiado a la Iglesia, por el cual se nos dispensa la vida divina y la santificación del alma. En relación con el sacramento invocado en tu preparación ("${cleanQuery}"), afirmamos con gozo que es un canal sublime que confiere la gracia del Espíritu Santo para fortalecer el obrar moral y acercar al bautizado al misterio salvífico de la Cruz.

## Origen bíblico
La institución divina de los sacramentos se fundamenta sólidamente en las Sagradas Escrituras de la Iglesia y en el mandato expreso de Jesucristo:
• *«Vayan, pues, y hagan que todos los pueblos sean mis discípulos. Bautícenlos en el nombre del Padre y del Hijo y del Espíritu Santo.»* (<a href="https://www.biblegateway.com/passage/?search=Mateo+28%3A19&version=DHH" class="bible-citation" target="_blank" data-ref="Mateo 28:19">Mateo 28, 19</a>).
• *«Yo soy el pan vivo bajado del cielo. El que coma de este pan vivirá para siempre; y el pan que yo daré es mi carne para la vida del mundo.»* (<a href="https://www.biblegateway.com/passage/?search=Juan+6%3A51&version=DHH" class="bible-citation" target="_blank" data-ref="Juan 6:51">Juan 6, 51</a>).

## Significado espiritual
La consagración de la vida ordinaria mediante los sacramentos restaura la filiación divina reavivada por el sacrificio de Cristo. Ciertos sacramentos imprimen además un carácter indeleble (marca espiritual perpetua en el alma), configurando al creyente con el sacerdocio, la milicia espiritual o el nexo conyugal santo, sirviendo como escudo espiritual permanente ante el pecado.

## Requisitos
Para la validez y licitud del sacramento según las normas canónicas, se requiere:
1. **La fe y el bautismo previo**: Nadie puede recibir válidamente otros sacramentos sin haber recibido previamente el santo Bautismo.
2. **Formación catequética suficiente**: Haber cursado debidamente las lecciones parroquiales de preparación para comprender la dignidad del rito.
3. **Padrinos e Idoneidad**: Contar con padrinos o testigos idóneos, de vida públicamente ejemplar en el seno de la doctrina católica.

## Disposiciones interiores
La receptividad de la gracia requiere del fiel un espíritu recto de piedad y amor filial:
• **Frecuencia sacramental previa**: Rezar diariamente y participar con fervor en la Santa Misa.
• **Confesión sacramental**: Estar en estado de gracia (libre de pecado mortal mediante el Sacramento de la Reconciliación).
• **Espíritu de recogimiento**: Disponer la inteligencia y la voluntad ante el Sagrario de manera devota.

## Errores frecuentes
1. **Desviaciones de índole social y folclórica**: Tratar el sacramento como mero acto ceremonial o de protocolo familiar, descuidando el compromiso sagrado.
2. **Superstición o falta de fe**: Acercarse con actitud mágica, creyendo que el rito obra mecánicamente sin una conversión sincera del creyente.

## Cómo prepararse adecuadamente
Se aconseja al fiel perseverar en un camino de conversión integral:
• Practicar diariamente la oración mental silenciosa de recogimiento.
• Meditar las Sagradas Escrituras y releer el Catecismo de la Iglesia Católica.
• Realizar obras de misericordia espirituales y corporales de manera constante.

## Actividades de reflexión
1. **Visita guiada al Sagrario**: Acudir a la parroquia a realizar adoración silenciosa a Jesús Sacramentado pidiendo docilidad y gracia santificante.
2. **Lectura comunitaria de las promesas bautismales**: Reafirmar públicamente la renuncia a Satanás y su perversidad en familia o grupo parroquial.

## Preguntas para discusión
1. ¿De qué manera la gracia de este sacramento transforma mi vocación diaria en la familia y la sociedad?
2. ¿Qué compromisos de comunión con el Santo Padre León XIV asumo al recibir esta consagración eclesial?
3. ¿Por qué el estado de gracia interior es indispensable para que los frutos sacramentales florezcan?

## Tabla resumen
| Tema | Explicación |
| --- | --- |
| Sacramento | Canal de gracia santificante instituido por Cristo Jesús para salvación del fiel. |
| Origen | Fundamento directo en la Palabra de Dios y en la institución salvífica apostólica. |
| Exigencia | Recta disposición interior, estado de gracia mediante la confesión y fe intacta. |
| Vivencia | Frutos diarios de testimonio, vida eucarística plena y perseverancia en las virtudes. |

## Oración final
*«Señor Jesús, Pastor Eterno de nuestras almas, te suplicamos con humildad divina que bendigas este camino de preparación sacramental. Llena de tu Espíritu Santo el corazón de tus siervos, infúndeles el don del santo temor, purifica sus intenciones y concédeles acudir al altar con pureza inmaculada. Que este sacramento sea para ellos manantial eterno de gracia y amparo perenne. Amén.»*

*✨ Jaculatoria: ¡Sagrado Corazón de Jesús, en Vos confío!*`;
  }

  // 9. PROCEDER CON BÚSQUEDA TRADICIONAL PARA CONSULTAS DE OTROS TEMAS DOCTRINALES
  let tituloRespuesta = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
  let respuestaDirecta = '';
  
  if (groundingsLocal && groundingsLocal.length > 0) {
    const primerRecurso = groundingsLocal[0];
    tituloRespuesta = primerRecurso.titulo || tituloRespuesta;
    respuestaDirecta = primerRecurso.contenido;
  } else {
    respuestaDirecta = `La fe sobrenatural de la Iglesia nos enseña que toda verdad salvífica del misterio de la Redención se custodia de manera íntegra tanto en las Sagradas Escrituras como en la Sagrada Tradición apostólica.`;
  }

  const respuestaBreve = `## Respuesta breve\n\n${respuestaDirecta}`;

  const explicacion = `## Explicación\n\nEl estudio ordenado de la teología y doctrina católica busca la verdad plena revelada por Cristo Jesús y conservada sin mancha por el Espíritu Santo. No se trata simplemente de un ejercicio formal o abstracto, sino del alimento para vigorizar nuestra fe, esclarecer nuestra inteligencia y disponer el corazón a vivir en gracia divina inalterable.`;

  const puntosClave = `## Puntos clave\n\n• **Estudio y Formación Continua**: La formación en la fe robustece las virtudes teologales que dinamizan el obrar cotidiano del bautizado.\n• **Fidelidad filial al Magisterio**: Adherirnos filialmente a la doctrina y a la guía apostólica del Romano Pontífice León XIV (Robert Francis Prevost) es amparo seguro en el caminar espiritual.\n• **Gracia Sacramental y Oración**: El misterio creído se hace vivencia mediante los sacramentos y la vida íntima de comunión con el Padre.`;

  const tablaResumen = `## Tabla resumen\n\n| Aspecto | Explicación |\n| --- | --- |\n| Fe y Vida | El conocimiento doctrinal ilumina el obrar moral, las relaciones humanas y la entrega diaria. |\n| Fidelidad Apostólica | Custodia fiel del depósito de la fe transmitido ininterrumpidamente desde los Santos Apóstoles. |`;

  let doctrinalesExtraText = '';
  if (groundingsLocal && groundingsLocal.length > 1) {
    let extraChunks = '';
    groundingsLocal.slice(1, 4).forEach(g => {
      extraChunks += `• **${g.titulo}**:\n  ${g.contenido}\n\n`;
    });
    if (extraChunks) {
      doctrinalesExtraText = `\n\nRecursos doctrinales y de patrística hallados en la biblioteca de CatólicosGPT:\n\n${extraChunks}`;
    }
  }

  const fundamentoDoctrinal = `## Fundamento doctrinal\n\nEl actuar moral, la vida de piedad y la lealtad a la Revelación consignada en el Catecismo de la Iglesia Católica (CIC) y las Sagradas Escrituras forman una unidad indisoluble. Se exhorta a meditar pasajes bíblicos (como <a href="https://www.biblegateway.com/passage/?search=Juan+8%3A32&version=DHH" class="bible-citation" target="_blank" data-ref="Juan 8:32">Juan 8, 32</a>) para asimilar la libertad que nos confiere la Verdad.${doctrinalesExtraText}`;

  const paraProfundizar = `## Para profundizar\n\nTe alentamos reverentemente a seguir explorando nuestra biblioteca teológica interactiva, contemplar las infografías del santoral y del catecismo, y recurrir a la conexión con nuestra base remota para un mayor nivel de profundidad didáctica.`;

  // Mención de León XIV y modernidad / IA
  let leonXIVMention = '';
  if (qLower.includes('tecnologia') || qLower.includes('ia') || qLower.includes('inteligencia') || qLower.includes('ordenador') || qLower.includes('digital') || qLower.includes('moderno') || qLower.includes('mundo')) {
    leonXIVMention = `\n\n### 🌐 La Iglesia ante los Nuevos Horizontes\n\nComo proclama sapientemente el Papa **León XIV (Robert Francis Prevost)** en su magnífica encíclica *“Magnifica Humanitas”* (promulgada el 15 de mayo de 2026), los avances en inteligencia artificial, telecomunicaciones y algoritmos deben estar siempre anclados a la primacía de la dignidad de todo ser humano, evitando soberbias tecnócratas que pretendan emular la vieja torre de Babel.`;
  }

  // Oración Final de Acogida Pastoral
  const oracionFinal = `\n\n### ⛪ Camino de Oración y Acompañamiento\n\n` +
    `Te abrazamos pastoralmente e invitamos a meditar bajo la cercanía de la Sede Apostólica y el amparo milagroso del Corazón Inmaculado de María:\n\n` +
    `*“Jesús misericordioso, de quien procede toda gracia del alma, infunde sabiduría en mi obrar diario. Líbranos del pecado, enséñanos a amar profundamente a tu Santa Iglesia Madre, y concédenos perseverar con celo alegre en la caridad fraterna. Amén.”*\n\n` +
    `*✨ Jaculatoria: ¡Sagrado Corazón de Jesús, en Vos confío!*`;

  let result = `# ${tituloRespuesta}\n\n${respuestaBreve}\n\n${explicacion}\n\n${puntosClave}\n\n${tablaResumen}\n\n${fundamentoDoctrinal}\n\n${paraProfundizar}`;
  if (leonXIVMention) result += `${leonXIVMention}`;
  result += oracionFinal;
  return result;
}
/*
s de Oración Cristocéntrica en la Iglesia

| Forma de Oración | Aspiración Teologal | Expresión Litúrgica de Unión |
| :--- | :--- | :--- |
| **Adoración** | Reconocer la soberanía divina | Exposición y Adoración del Santísimo Sacramento |
| **Contemplación** | Escucha amorosa del Maestro | Lectio Divina y silencio contemplativo mariano |
| **Súplica Humilde** | Confianza total en su providencia | Petición por salud, perdón y paz interior |
| **Acción de Gracias** | Reconocimiento de sus maravillas | El Te Deum e Himnos de alabanza celestial |`;
  } else {
    tablaHtml = `### 📊 Síntesis de las Virtudes Teologales Infusas

| Virtud Teologal | Enfoque Espiritual | Manifestación de Vida Práctica |
| :--- | :--- | :--- |
| **Fe (Fides)** | Creer firmemente en Dios | Estudio de las escrituras divinas y testimonio firme |
| **Esperanza (Spes)** | Confiar en el Reino celestial | Paciencia evangélica en tribulaciones de la vida |
| **Caridad (Caritas)** | Amor divino al prójimo | Práctica devota de las obras de misericordia |`;
  }

  // Mención de León XIV y modernidad / IA
  let leonXIVMention = '';
  if (qLower.includes('tecnologia') || qLower.includes('ia') || qLower.includes('inteligencia') || qLower.includes('ordenador') || qLower.includes('digital') || qLower.includes('moderno') || qLower.includes('mundo')) {
    leonXIVMention = `### 🌐 La Iglesia ante los Nuevos Horizontes\n\n` +
      `Como proclama sapientemente el Papa **León XIV (Robert Francis Prevost)** en su magnífica encíclica *“Magnifica Humanitas”* (promulgada el 15 de mayo de 2026), los avances en inteligencia artificial, telecomunicaciones y algoritmos deben estar siempre anclados a la primacía de la dignidad de todo ser humano, evitando soberbias tecnócratas que pretendan emular Babel.`;
  }

  // Oración Final de Acogida Pastoral
  const oracionFinal = `### ⛪ Camino de Oración y Acompañamiento\n\n` +
    `Te abrazamos pastoralmente e invitamos a meditar bajo la cercanía de la Sede Apostólica y el amparo milagroso del Corazón Inmaculado de María:\n\n` +
    `*“Jesús misericordioso, de quien procede toda gracia del alma, infunde sabiduría en mi obrar diario. Líbranos del pecado, enséñanos a amar profundamente a tu Santa Iglesia Madre, y concédenos perseverar con celo alegre en la caridad fraterna. Amén.”*\n\n` +
    `*✨ Jaculatoria: ¡Sagrado Corazón de Jesús, en Vos confío!*`;

  let result = `### Sinopsis\n\n${sinopsis}\n\n${doctrinal}\n\n${tablaHtml}\n\n`;
  if (leonXIVMention) result += `${leonXIVMention}\n\n`;
  result += oracionFinal;
  return result;
}
*/

function formatResponseText(txt) {
  // Convertir retornos de carro
  let res = txt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  // Convertir encabezados markdown
  res = res.replace(/### (.*?)(?=<br>|<\/p>|$)/g, '<h4 class="font-display font-bold text-maroon mt-3 inline-block">$1</h4>');
  res = res.replace(/## (.*?)(?=<br>|<\/p>|$)/g, '<h3 class="font-display font-bold text-maroon mt-4 inline-block text-base">$1</h3>');
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return '<p>' + res + '</p>';
}

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE LA APP — SECCIÓN DE INFOGRAFÍAS
// ════════════════════════════════════════════════════════════════════════════

app.get('/infografias', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const cat  = req.query.categoria || 'all';
  const q    = req.query.q || '';
  
  const { items, total, totalPages } = infografias.getInfografias({ categoria: cat, q, page, limit: 12 });

  const cats = ['doctrinal', 'santo', 'devocional', 'serie'];

  const filterHtml = `
    <div class="bg-white border border-border rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2 justify-center">
        <a href="/infografias?categoria=all" class="px-4 py-1.5 rounded-full text-xs font-semibold ${cat==='all'?'bg-maroon text-white':'bg-cream border text-ink hover:bg-cream2'} transition">Todo</a>
        ${cats.map(c => `
          <a href="/infografias?categoria=${c}" class="px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${cat===c?'bg-maroon text-white':'bg-cream border text-ink hover:bg-cream2'} transition">${c}</a>
        `).join('')}
      </div>
      <form action="/infografias" method="GET" class="flex gap-2 w-full md:w-auto">
        <input type="text" name="q" value="${q}" placeholder="Buscar infografías..." class="border border-border rounded-full px-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gold flex-1">
        <button type="submit" class="bg-maroon text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gold transition">Buscar</button>
      </form>
    </div>
  `;

  const listHtml = items.length > 0 ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${items.map(i => {
        const thumb = i.imagenes?.[0]?.url || 'https://res.cloudinary.com/df9vdt2da/image/upload/v1714498302/catolicosgpt_hero.png';
        return `
          <div class="seo-card flex flex-col justify-between overflow-hidden">
            <a href="/infografias/${i.slug}" class="block overflow-hidden rounded-lg mb-4 aspect-square bg-cream">
              <img src="${thumb}" alt="${i.altText || i.tema}" class="w-full h-full object-cover hover:scale-105 duration-200" referrerPolicy="no-referrer">
            </a>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between text-[10px] font-semibold text-gold font-mono uppercase tracking-widest">
                <span>${i.tipo}</span>
                <span>${i.totalSlides} ${i.totalSlides>1?'diapositivas':'diapositiva'}</span>
              </div>
              <h2 class="font-display font-bold text-espresso text-base leading-snug"><a href="/infografias/${i.slug}">${i.titulo || i.tema}</a></h2>
              <p class="text-ink2 text-xs leading-relaxed line-clamp-2">${i.metaDescription || ''}</p>
              <div class="flex items-center justify-between mt-3 pt-3 border-t text-[10px] text-ink2">
                <span>Por: ${i.userPlan==='premium'?'Canal Parroquia':'CatólicosGPT'}</span>
                <span>${i.fechaISO || ''}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <!-- PAGINACIÓN -->
    ${totalPages > 1 ? `
      <div class="flex items-center justify-center gap-2 mt-8">
        ${page > 1 ? `<a href="/infografias?page=${page-1}&categoria=${cat}&q=${q}" class="px-3 py-1.5 rounded bg-white border text-xs text-ink hover:bg-cream2">Anterior</a>` : ''}
        <span class="text-xs text-ink2">Página ${page} de ${totalPages}</span>
        ${page < totalPages ? `<a href="/infografias?page=${page+1}&categoria=${cat}&q=${q}" class="px-3 py-1.5 rounded bg-white border text-xs text-ink hover:bg-cream2">Siguiente</a>` : ''}
      </div>
    ` : ''}
  ` : `
    <div class="bg-white border rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4">
      <p class="text-ink2 text-sm">No se encontraron infografías en este catálogo.</p>
      <a href="/infografias" class="border border-maroon text-maroon px-4 py-2 rounded text-xs font-bold uppercase tracking-wider">Ver catálogo completo</a>
    </div>
  `;

  const sidebarPromoHtml = `
    <div class="bg-gradient-to-br from-cream2 to-cream border border-gold/40 rounded-2xl p-5 shadow-sm flex flex-col gap-4 sticky top-6">
      <h3 class="font-display font-semibold text-maroon text-xs tracking-wider uppercase border-b pb-2">Infografías Pastorales</h3>
      <p class="text-ink text-xs leading-relaxed">Formación espiritual y doctrina explicada de manera visual. Ideales para compartir en redes parroquiales o catequesis de perseverancia.</p>
      <div class="border-t pt-3 flex flex-col gap-1 text-[11px] text-ink2 italic">
        <span>✔️ Carruseles instructivos de imágenes</span>
        <span>✔️ Enriquecido con SEO por Inteligencia Artificial</span>
        <span>✔️ Almacenamiento seguro ultra-rápido en Cloudinary</span>
      </div>
      <a href="/admin#infografias" class="bg-maroon hover:bg-gold text-white text-center py-2 rounded text-xs font-bold uppercase transition mt-2">Consola de Control</a>
    </div>
  `;

  const html = `
    <div class="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide">Galería de Infografías Católicas</h1>
        <p class="font-serif text-ink2 text-sm italic">Material catequético gráfico en alta definición para parroquias, retiros, catequesis o redes sociales.</p>
      </div>
      
      ${filterHtml}
      
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div class="lg:col-span-3 flex flex-col gap-6">
          ${listHtml}
        </div>
        <div class="lg:col-span-1">
          ${sidebarPromoHtml}
        </div>
      </div>
    </div>
  `;

  res.send(renderPage('Galería de Infografías Católicas', html, req, {
    description: "Colección de infografías católicas en alta definición y formatos para WhatsApp o Instagram sobre santos, apologética y doctrina.",
    keywords: "infografias catolicas, catequesis visual, santoral grafico, doctrina catolica instagram"
  }));
});

function renderInfografiaDetail(inf, req, res, canonicalUrl) {
  const defVis = inf.tipoVisualizacion || 'continua';

  // 1. Continua HTML
  const continuaHtml = inf.imagenes.map((img, idx) => `
    <div class="bg-cream border border-border/60 rounded-2xl overflow-hidden p-2.5 flex flex-col gap-3 shadow-sm max-w-xl mx-auto hover:border-gold/30 transition duration-300">
      <img src="${img.url}" alt="${inf.altText || inf.tema} - Diapositiva ${img.slide}" class="w-full object-contain rounded-xl h-auto" loading="lazy" referrerPolicy="no-referrer">
      <div class="flex items-center justify-between text-xs px-2 py-1 text-ink2 font-mono">
        <span>Imagen ${img.slide} de ${inf.totalSlides}</span>
        <span>Servidor: ${img.model === 'manual-upload' || img.model === 'cloudinary' ? 'Cloudinary Sanctorum' : (img.model || 'Archivo Parroquial')}</span>
      </div>
    </div>
  `).join('\n');

  // 2. Carrusel slide html
  const carruselSlidesHtml = inf.imagenes.map((img, idx) => `
    <div id="slide-${idx}" class="carrusel-slide absolute inset-0 flex flex-col items-center justify-center transition-all duration-300 opacity-0 transform translate-x-4 scale-95 pointer-events-none">
      <img src="${img.url}" alt="${inf.altText || inf.tema} - Diapositiva ${img.slide}" class="w-full h-full object-contain rounded-xl" loading="lazy" referrerPolicy="no-referrer">
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-espresso/80 text-white rounded-full px-4 py-1 text-[10px] font-mono font-semibold tracking-wider">
        Imagen ${img.slide} de ${inf.totalSlides}
      </div>
    </div>
  `).join('');

  // 3. Cuadrícula HTML
  const cuadriculaHtml = inf.imagenes.map((img, idx) => `
    <div onclick="openLightbox(${idx})" class="relative group cursor-pointer aspect-square rounded-xl border border-border overflow-hidden shadow-sm bg-cream flex items-center justify-center hover:shadow-md hover:border-gold/30 transition duration-300">
      <img src="${img.url}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105">
      <div class="absolute inset-0 bg-espresso/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-xs">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize-2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
        Expandir
      </div>
      <div class="absolute bottom-1.5 right-1.5 bg-cream/95 border border-border rounded-md px-1.5 py-0.5 text-[9px] text-[#5C2E0A] font-bold font-mono">
        ${img.slide}
      </div>
    </div>
  `).join('');

  // Buscar recursos relacionados automáticamente basados en categorías, título o tema
  let relacionadosHtml = '';
  try {
    const queryTerm = ((inf.titulo || '') + ' ' + (inf.tema || '') + ' ' + (inf.keywords || '') + ' ' + (inf.categoria || '')).toLowerCase();
    
    // Buscar posts de blog relacionados
    const allBlogs = blog.loadBlog().posts || [];
    const matchedBlogs = allBlogs.filter(p => {
      const pText = ((p.titulo || '') + ' ' + (p.categoria || '') + ' ' + (p.keywords || '')).toLowerCase();
      return pText.split(/\s+/).some(w => w.length > 4 && queryTerm.includes(w));
    }).slice(0, 3);
    
    // Buscar videos relacionados
    const allVideos = videos.loadVideos().videos || [];
    const matchedVideos = allVideos.filter(v => {
      const vText = ((v.titulo || '') + ' ' + (v.categoria || '') + ' ' + (v.comentario || '')).toLowerCase();
      return vText.split(/\s+/).some(w => w.length > 4 && queryTerm.includes(w));
    }).slice(0, 3);

    // Buscar podcasts relacionados
    const allPodcasts = podcast.loadPodcasts().podcasts || [];
    const matchedPodcasts = allPodcasts.filter(p => {
      const pText = ((p.titulo || '') + ' ' + (p.categoria || '') + ' ' + (p.descripcion || '')).toLowerCase();
      return pText.split(/\s+/).some(w => w.length > 4 && queryTerm.includes(w));
    }).slice(0, 3);

    if (matchedBlogs.length > 0 || matchedVideos.length > 0 || matchedPodcasts.length > 0) {
      relacionadosHtml = `
        <div class="mt-14 border-t pt-8">
          <h3 class="font-display font-bold text-lg sm:text-xl text-maroon mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-check"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="m9 10 2 2 4-4"/></svg>
            Material Formativo Católico Relacionado
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${matchedBlogs.map(p => `
              <div class="bg-white border rounded-xl p-4.5 shadow-xs flex flex-col justify-between hover:border-gold/30 transition duration-300">
                <div>
                  <span class="text-[9px] font-bold text-gold uppercase tracking-wider font-mono">Artículo Formativo</span>
                  <h4 class="font-display font-semibold text-sm text-espresso mt-1 leading-snug line-clamp-2">${p.titulo}</h4>
                  <p class="text-ink2 text-xs mt-1.5 line-clamp-2">${p.extracto || p.descripcion || ''}</p>
                </div>
                <a href="/blog/${p.categoria || 'catequesis'}/${p.slug}" class="text-xs text-maroon font-bold mt-4 hover:underline inline-flex items-center gap-1">
                  Leer artículo
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
            `).join('')}
            
            ${matchedVideos.map(v => `
              <div class="bg-white border rounded-xl p-4.5 shadow-xs flex flex-col justify-between hover:border-gold/30 transition duration-300">
                <div>
                  <span class="text-[9px] font-bold text-red-700 uppercase tracking-wider font-mono">Video de Formación</span>
                  <h4 class="font-display font-semibold text-sm text-espresso mt-1 leading-snug line-clamp-2">${v.titulo}</h4>
                  <p class="text-ink2 text-xs mt-1.5 line-clamp-2">${v.comentario}</p>
                </div>
                <a href="/videos" class="text-xs text-red-700 font-bold mt-4 hover:underline inline-flex items-center gap-1">
                  Ver video
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
            `).join('')}

            ${matchedPodcasts.map(p => `
              <div class="bg-white border rounded-xl p-4.5 shadow-xs flex flex-col justify-between hover:border-gold/30 transition duration-300">
                <div>
                  <span class="text-[9px] font-bold text-green-700 uppercase tracking-wider font-mono">Audio / Podcast</span>
                  <h4 class="font-display font-semibold text-sm text-espresso mt-1 leading-snug line-clamp-2">${p.titulo}</h4>
                  <p class="text-ink2 text-xs mt-1.5 line-clamp-2">${p.descripcion}</p>
                </div>
                <a href="${p.spotifyUrl}" target="_blank" class="text-xs text-green-700 font-bold mt-4 hover:underline inline-flex items-center gap-1">
                  Escuchar audio
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  } catch (relErr) {
    console.error('Error buscando recomendados vinculados', relErr.message);
  }

  const metaKeywords = inf.keywords || `${inf.tema}, infografía católica, catequesis`;

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <a href="/infografias" class="text-xs font-semibold flex items-center gap-1.5 text-ink2 hover:text-maroon self-start">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver a la galería
      </a>
      
      <div class="flex flex-col gap-3 border-b pb-4">
        <div class="flex items-center gap-2 text-xs font-semibold text-gold font-mono uppercase tracking-widest">
          <span>${inf.tipo || inf.categoria || 'Teológico'}</span>
          <span>•</span>
          <span>Imágenes: ${inf.totalSlides}</span>
        </div>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso tracking-wide leading-tight">${inf.titulo || inf.tema}</h1>
        <p class="text-ink2 leading-relaxed text-sm">${inf.metaDescription || 'Material formativo católico de alta fidelidad doctrinal.'}</p>
      </div>

      <!-- CONTROL DE TIPO DE VISUALIZACIÓN -->
      <div class="flex items-center justify-between border-b pb-4 gap-4 flex-wrap">
        <span class="text-xs font-bold text-espresso font-mono uppercase tracking-wider">Modo de Visualización:</span>
        <div class="flex items-center gap-1.5 p-1 bg-cream-light/60 border rounded-xl">
          <button onclick="setVista('continua')" id="btn-vista-continua" class="vista-btn px-3.5 py-1.5 rounded-lg text-xs font-bold text-ink hover:text-maroon transition duration-200 cursor-pointer">Continua</button>
          <button onclick="setVista('carrusel')" id="btn-vista-carrusel" class="vista-btn px-3.5 py-1.5 rounded-lg text-xs font-bold text-ink hover:text-maroon transition duration-200 cursor-pointer">Carrusel</button>
          <button onclick="setVista('cuadricula')" id="btn-vista-cuadricula" class="vista-btn px-3.5 py-1.5 rounded-lg text-xs font-bold text-ink hover:text-maroon transition duration-200 cursor-pointer">Cuadrícula</button>
        </div>
      </div>
      
      <div class="flex flex-col gap-8">
        <!-- VISTA CONTINUA -->
        <div id="vista-continua" class="vista-panel flex flex-col gap-6 w-full">
          ${continuaHtml}
        </div>

        <!-- VISTA CARRUSEL -->
        <div id="vista-carrusel" class="vista-panel hidden flex flex-col items-center gap-4 w-full">
          <div class="relative w-full max-w-xl mx-auto bg-cream border border-border rounded-2xl overflow-hidden p-2.5 shadow-md">
            <!-- Active slide track -->
            <div class="relative overflow-hidden w-full h-[380px] sm:h-[500px] md:h-[550px] flex items-center justify-center bg-white rounded-xl">
              ${carruselSlidesHtml}
            </div>
            <!-- Buttons -->
            <button onclick="prevSlide()" class="absolute left-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-maroon p-2 rounded-full border border-border/80 shadow-md hover:scale-105 active:scale-95 transition cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onclick="nextSlide()" class="absolute right-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-maroon p-2 rounded-full border border-border/80 shadow-md hover:scale-105 active:scale-95 transition cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <!-- Indicators -->
          <div class="flex items-center justify-center gap-1.5 flex-wrap max-w-md mx-auto mt-2">
            ${inf.imagenes.map((img, idx) => `
              <button onclick="gotoSlide(${idx})" class="dot-btn w-6 h-6 rounded-lg text-[10px] font-bold border transition p-0 flex items-center justify-center bg-white border-border text-ink cursor-pointer" id="dot-${idx}">
                ${idx+1}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- VISTA CUADRÍCULA -->
        <div id="vista-cuadricula" class="vista-panel hidden grid grid-cols-2 sm:grid-cols-3 max-w-2xl mx-auto gap-4 w-full">
          ${cuadriculaHtml}
        </div>
      </div>

      <!-- Lightbox Modal container -->
      <div id="lightbox-modal" class="fixed inset-0 bg-espresso/95 hidden items-center justify-center z-50 p-4" onclick="closeLightbox()">
        <div class="relative max-w-3xl w-full h-full flex flex-col justify-center items-center gap-4" onclick="event.stopPropagation()">
          <img id="lightbox-img" class="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl bg-cream">
          <div class="flex items-center gap-4 text-white text-xs font-semibold bg-espresso/85 py-2 px-5 rounded-full border border-white/10 font-mono">
            <button onclick="prevLightboxSlide()" class="hover:text-gold transition cursor-pointer">◀ Ant.</button>
            <span id="lightbox-slide-label">Imagen x/y</span>
            <button onclick="nextLightboxSlide()" class="hover:text-gold transition cursor-pointer">Sig. ▶</button>
          </div>
          <button onclick="closeLightbox()" class="absolute top-4 right-4 bg-white/10 hover:bg-white/25 text-white rounded-full p-2 border border-white/10 cursor-pointer transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
      </div>
      
      <!-- RECURSOS RELACIONADOS -->
      ${relacionadosHtml}
      
      <!-- CALL TO ACTION -->
      <div class="bg-white border rounded-2xl p-6 shadow-sm text-center flex flex-col items-center justify-center gap-4 mt-8 sacred-border">
        <h3 class="font-display font-bold text-maroon text-base">Utilizar este material</h3>
        <p class="text-ink text-xs max-w-lg leading-relaxed">Puedes descargar las imágenes haciendo clic derecho sobre ellas para compartirlas en grupos de parroquias, estados de WhatsApp o imprimir en tamaño poster.</p>
        <div class="flex gap-2">
          <button onclick="navigator.clipboard.writeText(window.location.href); alert('Enlace copiado al portapapeles');" class="bg-gold text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-gold-deep transition cursor-pointer">Copiar enlace</button>
          <a href="/infografias" class="bg-cream border border-border px-4 py-2 rounded-full text-xs font-bold hover:bg-cream2 text-espresso transition">Explorar otras</a>
        </div>
      </div>
    </div>

    <script>
      let activeSlide = 0;
      let totalSlides = ${inf.totalSlides};
      let defaultVista = "${defVis}";
      let lightboxSlides = ${JSON.stringify(inf.imagenes.map(img => img.url))};
      let activeLightboxIdx = 0;

      function setVista(v) {
        document.querySelectorAll('.vista-panel').forEach(el => el.classList.add('hidden'));
        document.getElementById('vista-' + v).classList.remove('hidden');
        
        document.querySelectorAll('.vista-btn').forEach(btn => {
          btn.classList.remove('bg-maroon', 'text-white');
          btn.classList.add('text-ink');
        });
        const activeBtn = document.getElementById('btn-vista-' + v);
        if (activeBtn) {
          activeBtn.classList.remove('text-ink');
          activeBtn.classList.add('bg-maroon', 'text-white');
        }
        
        try { localStorage.setItem('infografia_vista_' + "${inf.slug}", v); } catch(e) {}
      }

      function showSlide(idx) {
        if (idx < 0) idx = totalSlides - 1;
        if (idx >= totalSlides) idx = 0;
        activeSlide = idx;
        
        document.querySelectorAll('.carrusel-slide').forEach((slide) => {
          slide.style.opacity = '0';
          slide.style.pointerEvents = 'none';
          slide.style.transform = 'translateX(20px) scale(0.95)';
        });
        
        const curr = document.getElementById('slide-' + idx);
        if (curr) {
          curr.style.opacity = '1';
          curr.style.pointerEvents = 'auto';
          curr.style.transform = 'translateX(0) scale(1)';
        }

        document.querySelectorAll('.dot-btn').forEach((dot) => {
          dot.classList.remove('bg-maroon', 'text-white', 'border-maroon');
          dot.classList.add('bg-white', 'text-ink', 'border-border');
        });
        const activeDot = document.getElementById('dot-' + idx);
        if (activeDot) {
          activeDot.classList.remove('bg-white', 'text-ink', 'border-border');
          activeDot.classList.add('bg-maroon', 'text-white', 'border-maroon');
        }
      }

      function nextSlide() { showSlide(activeSlide + 1); }
      function prevSlide() { showSlide(activeSlide - 1); }
      function gotoSlide(idx) { showSlide(idx); }

      function openLightbox(idx) {
        activeLightboxIdx = idx;
        document.getElementById('lightbox-img').src = lightboxSlides[idx];
        document.getElementById('lightbox-slide-label').innerText = 'Imagen ' + (idx + 1) + ' de ' + totalSlides;
        document.getElementById('lightbox-modal').classList.remove('hidden');
        document.getElementById('lightbox-modal').classList.add('flex');
      }

      function closeLightbox() {
        document.getElementById('lightbox-modal').classList.add('hidden');
        document.getElementById('lightbox-modal').classList.remove('flex');
      }

      function nextLightboxSlide() {
        activeLightboxIdx = (activeLightboxIdx + 1) % totalSlides;
        document.getElementById('lightbox-img').src = lightboxSlides[activeLightboxIdx];
        document.getElementById('lightbox-slide-label').innerText = 'Imagen ' + (activeLightboxIdx + 1) + ' de ' + totalSlides;
      }

      function prevLightboxSlide() {
        activeLightboxIdx = (activeLightboxIdx - 1 + totalSlides) % totalSlides;
        document.getElementById('lightbox-img').src = lightboxSlides[activeLightboxIdx];
        document.getElementById('lightbox-slide-label').innerText = 'Imagen ' + (activeLightboxIdx + 1) + ' de ' + totalSlides;
      }

      document.addEventListener('keydown', (e) => {
        if (!document.getElementById('lightbox-modal').classList.contains('hidden')) {
          if (e.key === 'Escape') closeLightbox();
          if (e.key === 'ArrowRight') nextLightboxSlide();
          if (e.key === 'ArrowLeft') prevLightboxSlide();
        } else if (!document.getElementById('vista-carrusel').classList.contains('hidden')) {
          if (e.key === 'ArrowRight') nextSlide();
          if (e.key === 'ArrowLeft') prevSlide();
        }
      });

      let savedVista = null;
      try { savedVista = localStorage.getItem('infografia_vista_' + "${inf.slug}"); } catch(e) {}
      setVista(savedVista || defaultVista);
      showSlide(0);
    </script>
  `;

  // Construir Structured Schema (SEO de Imágenes y Artículo)
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "ImageGallery",
      "name": inf.titulo || inf.tema,
      "description": inf.metaDescription || "Infografía formativa católica.",
      "url": `https://ai.catolicosgpt.com/infografias/${inf.slug}`,
      "image": inf.imagenes.map(img => img.url),
      "author": {
        "@type": "Organization",
        "name": "CatólicosGPT"
      }
    }
  ];

  res.send(renderPage(inf.titulo || inf.tema, html, req, {
    description: inf.metaDescription || `Infografía católica de alta resolución sobre ${inf.tema}.`,
    keywords: metaKeywords,
    image: inf.imagenes?.[0]?.url,
    schema: schemas[0],
    canonical: canonicalUrl || `/infografias/${inf.slug}`
  }));
}

app.get('/infografia-del-dia', (req, res) => {
  const inf = infografias.getInfografiaDelDia();
  if (!inf) {
    return res.status(404).send(renderPage('Infografía del Día', `<div class="p-12 text-center text-ink">Aún no hay infografías en la base de datos. <a href="/" class="text-maroon underline font-bold">Volver al inicio</a></div>`, req));
  }
  // Llamar a render con canonicalUrl='/infografia-del-dia' para que Google lo reconozca
  return renderInfografiaDetail(inf, req, res, '/infografia-del-dia');
});

app.get('/infografias/:slug', (req, res) => {
  const inf = infografias.getInfografiaBySlug(req.params.slug);
  if (!inf) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink">Catálogo o infografía no encontrada. <a href="/infografias" class="text-maroon underline">Volver a la galería</a></div>`, req));
  }
  return renderInfografiaDetail(inf, req, res);
});

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE LA APP — BLOG CATÓLICO
// ════════════════════════════════════════════════════════════════════════════

app.get('/blog', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const cat  = req.query.categoria || '';
  const q    = req.query.q || '';
  
  const { items, total } = blog.getPosts({ categoria: cat || null, q: q || null, page, limit: 9 });
  const totalPages = Math.ceil(total / 9);

  const filterHtml = `
    <div class="bg-white border border-border rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2 justify-center">
        <a href="/blog?categoria=" class="px-4 py-1.5 rounded-full text-xs font-semibold ${!cat?'bg-maroon text-white':'bg-cream border text-ink hover:bg-cream2'} transition">Todo</a>
        ${['catequesis', 'doctrina', 'santos', 'liturgia', 'apologetica', 'oracion'].map(c => `
          <a href="/blog?categoria=${c}" class="px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${cat===c?'bg-maroon text-white':'bg-cream border text-ink hover:bg-cream2'} transition">${c}</a>
        `).join('')}
      </div>
    </div>
  `;

  const listHtml = items.length > 0 ? `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${items.map(p => `
        <div class="seo-card flex flex-col justify-between">
          <div class="flex flex-col gap-2">
            <span class="text-[10px] font-semibold text-gold font-mono uppercase tracking-widest">${p.categoria || 'doctrina'}</span>
            <h2 class="font-display font-bold text-espresso text-base leading-snug"><a href="/blog/${p.slug}">${p.titulo}</a></h2>
            <p class="text-ink2 text-xs leading-relaxed line-clamp-3">${p.extracto || p.descripcion || ''}</p>
          </div>
          <div class="flex items-center justify-between mt-4 pt-3 border-t text-[10px] text-ink2">
            <span>Mesa de redacción</span>
            <span>${p.fechaCreacion ? p.fechaCreacion.slice(0, 10) : ''}</span>
          </div>
        </div>
      `).join('')}
    </div>
  ` : `
    <div class="p-12 bg-white rounded-xl border text-center text-ink2 text-sm">Próximamente más artículos de teología y apologética.</div>
  `;

  const html = `
    <div class="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide">Blog de Formación Católico</h1>
        <p class="font-serif text-ink2 text-sm italic">Artículos profundos explicados de forma clara basados en las Sagradas Escrituras y el Catecismo.</p>
      </div>
      
      ${filterHtml}
      ${listHtml}
    </div>
  `;

  if (req.query.partial === '1' || req.query.embed === '1') {
    return res.send(html);
  }

  res.send(renderPage('Blog Católico de Formación', html, req));
});

app.get('/blog/:slug', (req, res) => {
  const post = blog.getPostBySlug(req.params.slug);
  if (!post) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink">Artículo de blog no encontrado. <a href="/blog" class="text-maroon underline">Volver al blog</a></div>`, req));
  }

  // Parsear markdown para renderizar el contenido enriquecido
  const parsedBody = blog.parseMarkdown(post.contenidoMd);
  const renderedBody = blog.renderShortcodes(parsedBody, {
    getInfografia: infografias.getInfografiaBySlug,
    getVideo: videos.getVideoBySlug,
    getPodcast: podcast.getPodcastBySlug
  });

  const html = `
    <div class="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <a href="/blog" class="text-xs font-semibold flex items-center gap-1.5 text-ink2 hover:text-maroon self-start">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver al blog
      </a>
      
      <div class="flex flex-col gap-3 border-b pb-5">
        <div class="text-xs font-semibold text-gold font-mono uppercase tracking-widest">${post.categoria}</div>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso leading-tight">${post.titulo}</h1>
        <div class="flex items-center gap-4 text-xs text-ink2">
          <span>Por: Editor Católico</span>
          <span>•</span>
          <span>Publicado: ${post.fechaCreacion ? post.fechaCreacion.slice(0, 10) : ''}</span>
        </div>
      </div>
      
      <!-- CUERPO DEL POST -->
      ${post.imagenPortada ? `<div class="w-full overflow-hidden rounded-2xl border"><img src="${post.imagenPortada}" class="w-full aspect-video md:aspect-[21/10] object-cover hover:scale-101 transition duration-500" alt="${post.altText || post.titulo}" referrerPolicy="no-referrer"></div>` : ''}
      <article class="prose blog-content content-html max-w-none text-ink leading-relaxed space-y-4 font-serif text-sm sm:text-base">
        ${renderedBody}
      </article>
      
      <!-- COMPARTIR -->
      <div class="border-t pt-5 mt-6 flex items-center justify-between text-xs text-ink2">
        <span>CatólicosGPT v77 — Fe constante.</span>
        <button onclick="navigator.clipboard.writeText(window.location.href); alert('Copió enlace')" class="text-maroon hover:underline font-semibold">Compartir Artículo</button>
      </div>
    </div>
  `;

  if (req.query.partial === '1' || req.query.embed === '1') {
    return res.send(html);
  }

  res.send(renderPage(post.titulo, html, req, {
    description: post.descripcion || post.extracto || "Formación de fe católico.",
    keywords: post.keywords || "catequesis, blog catolico"
  }));
});

app.get('/blog/:categoria/:slug', (req, res) => {
  const { categoria, slug } = req.params;
  const post = blog.getPostBySlug(slug);
  if (!post) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink">Artículo de blog no encontrado. <a href="/blog" class="text-maroon underline">Volver al blog</a></div>`, req));
  }

  // Parsear markdown para renderizar el contenido enriquecido
  const parsedBody = blog.parseMarkdown(post.contenidoMd);
  const renderedBody = blog.renderShortcodes(parsedBody, {
    getInfografia: infografias.getInfografiaBySlug,
    getVideo: videos.getVideoBySlug,
    getPodcast: podcast.getPodcastBySlug
  });

  // Generar Accordión de Preguntas Frecuentes si existen
  let faqsHtml = '';
  if (post.faqs && post.faqs.length > 0) {
    faqsHtml = `
      <div class="mt-12 bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        <h3 class="font-display font-bold text-xl text-maroon mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          Preguntas Frecuentes Doctrinales
        </h3>
        <div class="space-y-4">
          ${post.faqs.map((faq, idx) => `
            <details class="group border-b border-cream2 pb-4 last:border-0" ${idx === 0 ? 'open' : ''}>
              <summary class="font-display font-semibold text-espresso text-sm sm:text-base cursor-pointer list-none flex items-center justify-between group-open:text-maroon">
                <span>${faq.q}</span>
                <span class="transition duration-300 group-open:rotate-180">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </summary>
              <div class="mt-3 text-ink2 text-sm sm:text-base leading-relaxed pl-2 border-l-2 border-gold/30">
                ${faq.a}
              </div>
            </details>
          `).join('')}
        </div>
      </div>
    `;
  }

  const html = `
    <div class="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <!-- Breadcrumb Visual -->
      <nav class="text-xs text-ink2 flex items-center gap-2 mb-2 font-mono">
        <a href="/" class="hover:text-maroon">Inicio</a>
        <span>/</span>
        <a href="/blog" class="hover:text-maroon">Blog</a>
        <span>/</span>
        <a href="/blog?categoria=${post.categoria}" class="hover:text-maroon capitalize">${post.categoria}</a>
        <span>/</span>
        <span class="text-espresso font-medium truncate max-w-[120px] sm:max-w-[200px]">${post.titulo}</span>
      </nav>

      <a href="/blog" class="text-xs font-semibold flex items-center gap-1.5 text-ink2 hover:text-maroon self-start">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver al blog
      </a>
      
      <div class="flex flex-col gap-3 border-b pb-5">
        <div class="text-[10px] font-bold text-gold font-mono uppercase tracking-widest bg-gold-light/20 rounded border border-gold/15 px-2.5 py-1 self-start">${post.categoria}</div>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso leading-tight">${post.titulo}</h1>
        <div class="flex items-center gap-4 text-xs text-ink2">
          <span>Por: Redacción Teológica CatólicosGPT</span>
          <span>•</span>
          <span>Publicado: ${post.fechaCreacion ? post.fechaCreacion.slice(0, 10) : ''}</span>
        </div>
      </div>
      
      <!-- CUERPO DEL POST -->
      ${post.imagenPortada ? `<div class="w-full overflow-hidden rounded-2xl border"><img src="${post.imagenPortada}" class="w-full aspect-video md:aspect-[21/10] object-cover hover:scale-101 transition duration-500" alt="${post.altText || post.titulo}" referrerPolicy="no-referrer"></div>` : ''}
      <article class="prose blog-content content-html max-w-none text-ink leading-relaxed space-y-4 font-serif text-sm sm:text-base">
        ${renderedBody}
      </article>

      ${faqsHtml}
      
      <!-- COMPARTIR -->
      <div class="border-t pt-5 mt-8 flex items-center justify-between text-xs text-ink2">
        <span>CatólicosGPT v77 — Fe constante.</span>
        <button onclick="navigator.clipboard.writeText(window.location.href); alert('Enlace de artículo copiado al portapapeles')" class="text-maroon hover:underline font-semibold flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
          Compartir Artículo
        </button>
      </div>
    </div>
  `;

  if (req.query.partial === '1' || req.query.embed === '1') {
    return res.send(html);
  }

  // Construir Structured Schemas
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.titulo,
      "description": post.descripcion || post.extracto || "",
      "image": post.imagenPortada || "https://ai.catolicosgpt.com/favicon.svg",
      "datePublished": post.fechaCreacion,
      "dateModified": post.fechaModificacion || post.fechaCreacion,
      "author": {
        "@type": "Organization",
        "name": "CatólicosGPT",
        "url": "https://ai.catolicosgpt.com"
      },
      "publisher": {
        "@type": "Organization",
        "name": "CatólicosGPT",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ai.catolicosgpt.com/favicon.svg"
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Inicio",
          "item": "https://ai.catolicosgpt.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": "https://ai.catolicosgpt.com/blog"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": post.categoria,
          "item": `https://ai.catolicosgpt.com/blog?categoria=${post.categoria}`
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": post.titulo,
          "item": `https://ai.catolicosgpt.com/blog/${post.categoria}/${post.slug}`
        }
      ]
    }
  ];

  if (post.faqs && post.faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": post.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.a
        }
      }))
    });
  }

  res.send(renderPage(post.titulo, html, req, {
    description: post.descripcion || post.extracto || "Formación de fe católico.",
    keywords: post.keywords || "catequesis, blog catolico",
    schemas: schemas
  }));
});

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE LA APP — PODCASTS, VIDEOS, MISAS, SANTO DEL DÍA Y LITURGIA DE HORAS
// ════════════════════════════════════════════════════════════════════════════

app.get('/podcasts', (req, res) => {
  const list = podcast.getPodcasts();
  const html = `
    <div class="max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <div class="flex flex-col gap-2">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide">Podcasts Católicos Recomendados</h1>
        <p class="font-serif text-ink2 text-sm italic">Estudios bíblicos, catecismo y meditaciones diarias para reproducir en cualquier momento.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        ${list.map(p => `
          <div class="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div class="flex flex-col gap-2">
              <span class="text-[10px] font-semibold text-gold font-mono uppercase tracking-widest">${p.categoria}</span>
              <h3 class="font-display font-medium text-espresso text-base">${p.titulo}</h3>
              <p class="text-ink2 text-xs leading-relaxed line-clamp-3">${p.descripcion}</p>
            </div>
            
            <!-- SPOTIFY EMBED -->
            <div class="rounded-xl overflow-hidden shadow-sm">
              ${p.embedHtml}
            </div>

            <!-- Standalone Link -->
            <div class="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
              <span class="text-[10px] font-semibold text-ink2 italic">- Autor: ${p.autor || 'Expositor de Fe'}</span>
              <a href="/podcasts/${p.slug}" class="text-xs font-bold text-maroon hover:underline flex items-center gap-1">
                Ver y Compartir
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  res.send(renderPage('Podcasts Católicos Curados', html, req));
});

app.get('/podcasts/:slug', (req, res) => {
  const p = podcast.getPodcastBySlug(req.params.slug);
  if (!p) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink w-full">Podcast no encontrado. <a href="/podcasts" class="text-maroon underline">Volver a podcasts</a></div>`, req));
  }

  // Related podcasts
  let relacionadosHtml = '';
  try {
    const listAll = podcast.getPodcasts();
    const filtered = listAll.filter(item => item.id !== p.id && item.categoria === p.categoria).slice(0, 3);
    if (filtered.length > 0) {
      relacionadosHtml = `
        <div class="mt-12 border-t pt-8 w-full">
          <h3 class="font-display font-bold text-lg text-maroon mb-6">Otros podcasts del tema</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            ${filtered.map(item => `
              <div class="bg-white border rounded-xl p-4.5 shadow-xs flex flex-col justify-between hover:border-gold/30 transition duration-300">
                <div>
                  <span class="text-[9px] font-bold text-gold uppercase tracking-wider font-mono">${item.categoria}</span>
                  <h4 class="font-display font-semibold text-sm text-espresso mt-1 leading-snug line-clamp-2">${item.titulo}</h4>
                </div>
                <a href="/podcasts/${item.slug}" class="text-xs text-maroon font-bold mt-4 hover:underline inline-flex items-center gap-1">
                  Escuchar audio
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  } catch(e) {}

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <a href="/podcasts" class="text-xs font-semibold flex items-center gap-1.5 text-ink2 hover:text-maroon self-start">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver a podcasts
      </a>

      <!-- PODCAST HEAD AND EMBED -->
      <div class="flex flex-col gap-4 border-b pb-6">
        <div class="flex items-center gap-2 text-xs font-semibold text-gold font-mono uppercase tracking-widest">
          <span>${p.categoria}</span>
          <span>•</span>
          <span>Autor: ${p.autor || 'Expositor de Fe'}</span>
        </div>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso tracking-wide leading-tight">${p.titulo}</h1>
      </div>

      <div class="rounded-2xl overflow-hidden shadow-xl border border-border/40 bg-cream">
        ${p.embedHtml}
      </div>

      <div class="bg-cream-light/40 border rounded-2xl p-5 shadow-xs">
        <h3 class="font-display font-bold text-espresso text-sm mb-2">Descripción del Episodio</h3>
        <p class="text-ink text-sm leading-relaxed">${p.descripcion || 'Episodio de audio católico de fe.'}</p>
      </div>

      <!-- SECCIÓN DE COMPARTIR -->
      <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4 sacred-border">
        <div class="flex flex-col gap-1">
          <h3 class="font-display font-bold text-maroon text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            Compartir Audio Católico
          </h3>
          <p class="text-ink2 text-xs">Comparte la doctrina cristiana difundiendo este podcast y edificando a tus allegados o grupos apostólicos.</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input type="text" id="share-url-input" readonly value="" class="bg-cream border border-border px-4 py-2 text-xs rounded-xl flex-1 text-ink select-all focus:outline-hidden font-mono">
          <button id="copy-share-btn" onclick="copyShareUrl()" class="bg-gold hover:bg-gold-deep text-white px-5 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer text-center">Copiar enlace</button>
        </div>

        <div class="flex gap-2.5 mt-1 flex-wrap">
          <a id="share-wa-btn" href="#" target="_blank" class="bg-[#25D366] hover:bg-[#20ba5a] text-white px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            WhatsApp
          </a>
          <a id="share-fb-btn" href="#" target="_blank" class="bg-[#1877F2] hover:bg-[#166fe5] text-white px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            Facebook
          </a>
        </div>
      </div>

      <!-- OTROS RELACIONADOS -->
      ${relacionadosHtml}
    </div>

    <script>
      const currentUrl = window.location.href;
      document.getElementById('share-url-input').value = currentUrl;
      
      document.getElementById('share-wa-btn').href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent('Te recomiendo escuchar este audio católico: "' + \`${p.titulo}\` + '" ' + currentUrl);
      document.getElementById('share-fb-btn').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentUrl);

      function copyShareUrl() {
        const input = document.getElementById('share-url-input');
        input.select();
        navigator.clipboard.writeText(currentUrl).then(() => {
          const btn = document.getElementById('copy-share-btn');
          const originalText = btn.textContent;
          btn.textContent = '¡Copiado! ✓';
          btn.classList.remove('bg-gold');
          btn.classList.add('bg-green-700');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('bg-green-700');
            btn.classList.add('bg-gold');
          }, 2000);
        });
      }
    </script>
  `;
  res.send(renderPage(p.titulo, html, req, {
    description: p.descripcion || 'Audio de podcast católico.',
    keywords: `${p.categoria}, podcast catolico, spotify catolico`
  }));
});

app.get('/videos', (req, res) => {
  const list = videos.getVideos();
  const html = `
    <div class="max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <div class="flex flex-col gap-2">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide font-medium">Canales y Videos Curados</h1>
        <p class="font-serif text-ink2 text-sm italic">Respuestas de apologética, liturgia explicada y formación doctrinal en formato de video.</p>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 font-sans">
        ${list.map(v => `
          <div class="seo-card flex flex-col justify-between overflow-hidden">
            <div class="aspect-video rounded-lg overflow-hidden bg-black mb-4 flex">
              <iframe src="https://www.youtube.com/embed/${v.youtubeId}?rel=0" allowfullscreen style="width:100%;height:100%;border:0" loading="lazy"></iframe>
            </div>
            <div class="flex flex-col gap-1 inline-block mt-auto pb-1">
              <span class="text-[9px] font-semibold text-gold font-mono uppercase tracking-widest block">${v.categoria}</span>
              <h3 class="font-display font-bold text-espresso text-sm leading-snug line-clamp-2">${v.titulo}</h3>
              <p class="text-ink2 text-[11px] leading-relaxed line-clamp-2 mt-1">${v.comentario}</p>
              <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40">
                <span class="text-[10px] font-semibold text-ink2 italic">Canal: ${v.canal}</span>
                <a href="/videos/${v.slug}" class="text-xs font-bold text-maroon hover:underline flex items-center gap-1">
                  Ver y Compartir
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                </a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  res.send(renderPage('Canales & Videos Católicos', html, req));
});

app.get('/videos/:slug', (req, res) => {
  const v = videos.getVideoBySlug(req.params.slug);
  if (!v) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink w-full">Video no encontrado. <a href="/videos" class="text-maroon underline">Volver a videos</a></div>`, req));
  }

  // Related videos
  let relacionadosHtml = '';
  try {
    const listAll = videos.getVideos();
    const filtered = listAll.filter(item => item.id !== v.id && item.categoria === v.categoria).slice(0, 3);
    if (filtered.length > 0) {
      relacionadosHtml = `
        <div class="mt-12 border-t pt-8 w-full">
          <h3 class="font-display font-bold text-lg text-maroon mb-6">Otros videos del tema</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            ${filtered.map(item => `
              <div class="bg-white border rounded-xl overflow-hidden p-4 shadow-xs flex flex-col justify-between hover:border-gold/30 transition duration-300">
                <div class="aspect-video rounded bg-black mb-3">
                  <iframe src="https://www.youtube.com/embed/${item.youtubeId}?rel=0" allowfullscreen style="width:100%;height:100%;border:0" loading="lazy"></iframe>
                </div>
                <div>
                  <span class="text-[9px] font-bold text-gold uppercase tracking-wider font-mono">${item.categoria}</span>
                  <h4 class="font-display font-semibold text-sm text-espresso mt-1 line-clamp-2">${item.titulo}</h4>
                </div>
                <a href="/videos/${item.slug}" class="text-xs text-maroon font-bold mt-4 hover:underline inline-flex items-center gap-1">
                  Ver detalle
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  } catch(e) {}

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <a href="/videos" class="text-xs font-semibold flex items-center gap-1.5 text-ink2 hover:text-maroon self-start">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver a videos
      </a>

      <!-- VIDEO HEAD AND PLAYER -->
      <div class="flex flex-col gap-4 border-b pb-6">
        <div class="flex items-center gap-2 text-xs font-semibold text-gold font-mono uppercase tracking-widest">
          <span>${v.categoria}</span>
          <span>•</span>
          <span>Canal: ${v.canal}</span>
        </div>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso tracking-wide leading-tight">${v.titulo}</h1>
      </div>

      <div class="bg-black aspect-video rounded-2xl overflow-hidden shadow-xl border border-border/40">
        <iframe src="https://www.youtube.com/embed/${v.youtubeId}?rel=0" allowfullscreen style="width:100%;height:100%;border:0"></iframe>
      </div>

      <div class="bg-cream-light/40 border rounded-2xl p-5 shadow-xs">
        <h3 class="font-display font-bold text-espresso text-sm mb-2">Comentario de Formación</h3>
        <p class="text-ink text-sm leading-relaxed">${v.comentario || 'Recurso formativo católico seleccionado.'}</p>
      </div>

      <!-- SECCIÓN DE COMPARTIR -->
      <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4 sacred-border">
        <div class="flex flex-col gap-1">
          <h3 class="font-display font-bold text-maroon text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            Compartir Video Católico
          </h3>
          <p class="text-ink2 text-xs">Propaga la fe compartiendo este excelente video formativo con tu familia, amigos o en grupos parroquiales.</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input type="text" id="share-url-input" readonly value="" class="bg-cream border border-border px-4 py-2 text-xs rounded-xl flex-1 text-ink select-all focus:outline-hidden font-mono">
          <button id="copy-share-btn" onclick="copyShareUrl()" class="bg-gold hover:bg-gold-deep text-white px-5 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer text-center">Copiar enlace</button>
        </div>

        <div class="flex gap-2.5 mt-1 flex-wrap">
          <a id="share-wa-btn" href="#" target="_blank" class="bg-[#25D366] hover:bg-[#20ba5a] text-white px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            WhatsApp
          </a>
          <a id="share-fb-btn" href="#" target="_blank" class="bg-[#1877F2] hover:bg-[#166fe5] text-white px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            Facebook
          </a>
        </div>
      </div>

      <!-- OTROS RELACIONADOS -->
      ${relacionadosHtml}
    </div>

    <script>
      // Populate share URL and setup links
      const currentUrl = window.location.href;
      document.getElementById('share-url-input').value = currentUrl;
      
      document.getElementById('share-wa-btn').href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent('Te comparto este excelente video católico: "' + \`${v.titulo}\` + '" ' + currentUrl);
      document.getElementById('share-fb-btn').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentUrl);

      function copyShareUrl() {
        const input = document.getElementById('share-url-input');
        input.select();
        navigator.clipboard.writeText(currentUrl).then(() => {
          const btn = document.getElementById('copy-share-btn');
          const originalText = btn.textContent;
          btn.textContent = '¡Copiado! ✓';
          btn.classList.remove('bg-gold');
          btn.classList.add('bg-green-700');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('bg-green-700');
            btn.classList.add('bg-gold');
          }, 2000);
        });
      }
    </script>
  `;
  res.send(renderPage(v.titulo, html, req, {
    description: v.comentario || 'Video católico de apologética y doctrina.',
    keywords: `${v.categoria}, video catolico`
  }));
});

app.get('/liturgia-de-las-horas', async (req, res) => {
  const dateStr = liturgia.todayBogota();
  const lect = await getOrGenerateLecturas();
  const laud = await getOrGenerateLiturgia('laudes');
  const visp = await getOrGenerateLiturgia('visperas');
  const compl = await getOrGenerateLiturgia('completas');

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6 text-sm">
      <div class="flex flex-col gap-2 border-b pb-5">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide">Liturgia Diaria de la Iglesia</h1>
        <p class="font-serif text-ink2 text-xs italic">Lecturas completas del Evangelio, homilías diarias de fondo, y oficio litúrgico del día (${dateStr}).</p>
      </div>
      
      <div class="flex flex-col gap-6">
        
        <!-- EVANGELIO & LECTURAS -->
        <section class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h2 class="font-display font-bold text-maroon text-base border-b pb-2">📖 Evangelio del día y Lecturas</h2>
          ${lect && lect.lecturas && lect.lecturas.length > 0 ? lect.lecturas.map((l, i) => `
            <div class="flex flex-col gap-2 mt-2">
              <h3 class="font-display font-semibold text-espresso text-sm">${l.titulo}</h3>
              <p class="text-ink text-xs sm:text-sm font-serif leading-relaxed italic border-l-2 border-gold pl-4 bg-cream/10 py-1">${l.texto.replace(/\n/g, '<br>')}</p>
            </div>
          `).join('<hr class="my-4">') : '<p class="text-ink2 text-xs">Cargando las lecturas litúrgicas del día...</p>'}
        </section>
        
        <!-- REFLEXIÓN / APRECIACIÓN O PREDICACIÓN -->
        ${lect && lect.predica ? `
          <section class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
            <h2 class="font-display font-bold text-maroon text-base border-b pb-2">💡 Comentario / Predicación</h2>
            <p class="text-ink leading-relaxed font-serif text-xs sm:text-sm whitespace-pre-line">${lect.predica}</p>
          </section>
        ` : ''}
        
        <!-- LITURGIA DE LAS HORAS LAUDES -->
        <section class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h2 class="font-display font-bold text-maroon text-base border-b pb-2">🌅 Laudes (Oración de la mañana)</h2>
          ${laud.fuente.includes('IA') || laud.fuente.includes('Sintetizado') || laud.fuente.includes('Gemini') || laud.fuente.includes('CatólicosGPT') ? `
            <div class="bg-amber-50/75 border border-amber-200 text-amber-900 text-[11px] sm:text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 font-sans shadow-xs">
              <span class="text-sm leading-none">⚠️</span>
              <span><strong>Subsidio Devocional de Respaldo:</strong> No fue posible descargar el texto litúrgico oficial desde las fuentes del Ordo. Te ofrecemos esta oración devota de acompañamiento sintetizada por el motor IA de CatólicosGPT.</span>
            </div>
          ` : ''}
          <div class="max-h-[350px] overflow-y-auto text-xs font-serif leading-relaxed text-ink pl-1 bg-[#FAF9F5]/40 border border-border/60 p-4 rounded-xl" style="white-space: pre-wrap;">${laud.texto}</div>
          <span class="text-[10px] text-ink2 font-mono italic">Fuente: ${laud.fuente}</span>
        </section>

        <!-- LITURGIA DE LAS HORAS VÍSPERAS -->
        <section class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h2 class="font-display font-bold text-maroon text-base border-b pb-2">🌇 Vísperas (Oración del atardecer)</h2>
          ${visp.fuente.includes('IA') || visp.fuente.includes('Sintetizado') || visp.fuente.includes('Gemini') || visp.fuente.includes('CatólicosGPT') ? `
            <div class="bg-amber-50/75 border border-amber-200 text-amber-900 text-[11px] sm:text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 font-sans shadow-xs">
              <span class="text-sm leading-none">⚠️</span>
              <span><strong>Subsidio Devocional de Respaldo:</strong> No fue posible descargar el texto litúrgico oficial desde las fuentes del Ordo. Te ofrecemos esta oración devota de acompañamiento sintetizada por el motor IA de CatólicosGPT.</span>
            </div>
          ` : ''}
          <div class="max-h-[350px] overflow-y-auto text-xs font-serif leading-relaxed text-ink pl-1 bg-[#FAF9F5]/40 border border-border/60 p-4 rounded-xl" style="white-space: pre-wrap;">${visp.texto}</div>
          <span class="text-[10px] text-ink2 font-mono italic">Fuente: ${visp.fuente}</span>
        </section>

        <!-- LITURGIA DE LAS HORAS COMPLETAS -->
        <section class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h2 class="font-display font-bold text-maroon text-base border-b pb-2">🌌 Completas (Oración de la noche)</h2>
          ${compl.fuente.includes('IA') || compl.fuente.includes('Sintetizado') || compl.fuente.includes('Gemini') || compl.fuente.includes('CatólicosGPT') ? `
            <div class="bg-amber-50/75 border border-amber-200 text-amber-900 text-[11px] sm:text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 font-sans shadow-xs">
              <span class="text-sm leading-none">⚠️</span>
              <span><strong>Subsidio Devocional de Respaldo:</strong> No fue posible descargar el texto litúrgico oficial desde las fuentes del Ordo. Te ofrecemos esta oración devota de acompañamiento sintetizada por el motor IA de CatólicosGPT.</span>
            </div>
          ` : ''}
          <div class="max-h-[350px] overflow-y-auto text-xs font-serif leading-relaxed text-ink pl-1 bg-[#FAF9F5]/40 border border-border/60 p-4 rounded-xl" style="white-space: pre-wrap;">${compl.texto}</div>
          <span class="text-[10px] text-ink2 font-mono italic">Fuente: ${compl.fuente}</span>
        </section>
        
      </div>
    </div>
  `;
  res.send(renderPage('Liturgia Diaria & Evangelio', html, req));
});

app.get('/oracion-del-dia', async (req, res) => {
  try {
    const todayStr = liturgia.todayBogota(); // YYYY-MM-DD
    const cacheDir = path.join(__dirname, 'data');
    const cacheFile = path.join(cacheDir, 'oracion-cache.json');
    
    // Crear el directorio de datos si no existe
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    let oracion = null;
    let fromCache = false;

    // Intentar leer de caché
    if (fs.existsSync(cacheFile)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (cacheData && cacheData.date === todayStr && cacheData.items) {
          oracion = cacheData.items;
          fromCache = true;
        }
      } catch (err) {
        console.error('[Oración del Día] Error leyendo cache:', err.message);
      }
    }

    if (!oracion) {
      console.log(`[Oración del Día] Generando nueva oración para ${todayStr}...`);
      
      // Obtener ingredientes: Santo del Día y Lecturas
      let santoNombre = 'la memoria litúrgica del día';
      let santoTipo = 'Feria';
      try {
        const parts = todayStr.split('-');
        const diaVal = parseInt(parts[2]) || 19;
        const mesIdx = parts[1] || '06';
        const s = await getSantoDelDiaDetail(diaVal, mesIdx);
        if (s) {
          santoNombre = s.nombre;
          santoTipo = s.tipo;
        }
      } catch (sErr) {
        console.warn('[Oración del Día] No se pudo cargar el Santo del día para la oración:', sErr.message);
      }

      let lecturasTexto = 'Lecturas de la feria del día de hoy';
      try {
        const lData = liturgia.get('lecturas');
        if (lData && lData.lecturas && lData.lecturas.length > 0) {
          lecturasTexto = lData.lecturas.map(l => `${l.titulo}: ${l.texto}`).join('\n');
        }
      } catch (lErr) {
        console.warn('[Oración del Día] No se pudieron cargar lecturas para la oración:', lErr.message);
      }

      // Consultar Gemini con robusto canal de respaldo local
      try {
        const aiInstance = getAi();
        if (!aiInstance) {
          throw new Error('Servicio de Inteligencia Artificial de CatólicosGPT no disponible.');
        }

        const prompt = `Actúa como un teólogo litúrgico y director espiritual católico de CatólicosGPT.
Queremos la Oración del Día de hoy para la fecha de: ${todayStr}.

Información disponible para hoy:
- Santo del día: ${santoNombre} (${santoTipo})
- Evangelio / Lecturas: ${lecturasTexto.substring(0, 1500)}

Queremos que generes una hermosa y profunda oración diaria estructurada con el siguiente formato estricto en JSON (con comillas dobles, sin comentarios, sin bloques de código markdown, solo JSON puro en español):
{
  "fechaYTiempo": "Fecha legible de hoy y el Tiempo Litúrgico actual, p. ej. 'Viernes de la XI Semana del Tiempo Ordinario'",
  "santoMemoria": "Mención del santo de hoy o memoria litúrgica celebrada",
  "lecturaBreve": "Una de las lecturas breves o un versículo hermoso del Evangelio de hoy para meditar",
  "oracionPrincipal": "Una oración principal solemne y piadosa para rezar hoy (mínimo 180 palabras), pidiendo la gracia del día, inspirada en las lecturas, en la vida del santo o en las virtudes cristianas",
  "propositoConcreto": "Un propósito o resolución práctica, pequeña y concreta de caridad, humildad o piedad para llevar a cabo durante la jornada",
  "jaculatoria": "Una jaculatoria corta y tradicional de piedad católica para repetir a lo largo de hoy"
}`;

        const response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        });

        const generatedJson = response.text ? response.text.trim() : '{}';
        oracion = JSON.parse(generatedJson);

        // Guardar en caché
        try {
          fs.writeFileSync(cacheFile, JSON.stringify({
            date: todayStr,
            generatedAt: new Date().toISOString(),
            items: oracion
          }, null, 2), 'utf-8');
        } catch (fsErr) {
          console.error('[Oración del Día] Error guardando caché de oración:', fsErr.message);
        }
      } catch (err) {
        console.warn('[Oración del Día] Error generando con IA, activando canal de respaldo litúrgico:', err.message);

        const dayOfWeek = new Date().getDay(); // 0 = Domingo, 1 = Lunes, etc.
        const backupPrayers = {
          0: {
            "fechaYTiempo": "Domingo — Día del Señor y de su Resurrección",
            "santoMemoria": `Solemnidad Dominical — Conmemoración de ${santoNombre}`,
            "lecturaBreve": "«Yo soy el pan vivo que ha bajado del cielo. El que coma de este pan vivirá para siempre» (Jn 6, 51)",
            "oracionPrincipal": "Padre celestial, Dios todopoderoso, en este día santo de tu gloriosa Resurrección nos postramos ante tu divina majestad llenos de júbilo y acción de gracias. Tú has vencido las tinieblas de la muerte y has abierto para nosotros las puertas de la eternidad a través de la victoria Pascual de tu Hijo Jesucristo. Te pedimos hoy la gracia de renovar profundamente nuestra fe en este misterio salvífico. Que la alegría del evangelio penetre en nuestros hogares, sanando toda herida, reconciliando los corazones distanciados y fortaleciendo a los enfermos. Concédenos, Señor, amar tu verdad por encima de todas las cosas, vivir con la plena seguridad de tu providencia bienhechora y ser testigos radiantes de tu amor ante el prójimo. Que cada momento de este domingo sea para alabarte, glorificarte y descansar bajo tu mirada amorosa, fortalecidos por la recepción de los santos sacramentos. Amén.",
            "propositoConcreto": "Dedicar 10 minutos de lectura orante de las Sagradas Escrituras y rezar en familia pidiendo por la paz en el mundo.",
            "jaculatoria": "¡Señor mío y Dios mío, aumenta nuestra fe!"
          },
          1: {
            "fechaYTiempo": "Lunes — Inicio de la Jornada Semanal",
            "santoMemoria": `Memoria Litúrgica — Encomienda de ${santoNombre}`,
            "lecturaBreve": "«Venid a mí todos los que estáis cansados y agobiados, y yo os aliviaré» (Mt 11, 28)",
            "oracionPrincipal": "Señor Dios de misericordia infinita, al iniciar esta nueva semana de labores y actividades ordinarias, te entregamos con amor cada uno de nuestros pensamientos, palabras y tareas. Reconocemos que sin Ti nada podemos hacer, pero con tu gracia todo se convierte en una ofrenda agradable a tus ojos. Te suplicamos que derrames sobre nosotros el don de la paciencia y del discernimiento para afrontar las exigencias diarias con serenidad y dulzura. Que nuestro trabajo no sea un motivo de ansiedad o distracción espiritual, sino un camino fecundo de santificación personal y de servicio abnegado a nuestros hermanos. Concédenos ser luz de verdad en nuestros entornos laborales o de estudio, practicando la justicia, la honestidad y la mansedumbre. Señor Jesús, camina a nuestro lado hoy, fortalécenos en las fatigas y asiste de modo especial a aquellos que hoy comienzan su semana con angustias, desempleo o soledad. Amén.",
            "propositoConcreto": "Ofrecer las primeras tres horas de nuestro trabajo con perfecta alegría y sin emitir ninguna queja por las dificultades.",
            "jaculatoria": "¡Jesús, manso y humilde de corazón, haz mi corazón semejante al tuyo!"
          },
          2: {
            "fechaYTiempo": "Martes — Camino de Santidad Cotidiana",
            "santoMemoria": `Conmemoración Litúrgica de ${santoNombre}`,
            "lecturaBreve": "«No se turbe vuestro corazón; creéis en Dios, creed también en mí» (Jn 14, 1)",
            "oracionPrincipal": "Señor y Salvador nuestro, Dios de bondad inefable, te alabamos hoy y te consagramos esta jornada. En este caminar cotidiano, a menudo nos vemos tentados por la impaciencia, el desánimo o las dudas de la fe; por eso te pedimos que envíes tu Santo Espíritu para que sea el guardián de nuestras almas. Fortalece en nosotros el don de la caridad para que no juzguemos con severidad a quienes nos rodean, sino que sepamos acogerlos con el mismo amor entrañable con el que Tú nos perdonas y nos amas. Te pedimos también que derrames tu bendición sobre las intenciones del Santo Padre, por todos los sacerdotes y misioneros que gastan su vida por anunciar el Evangelio, y por la conversión de los pecadores. Que nuestra vida entera cante tus alabanzas y que cada deber cumplido hoy sea una oración silenciosa de adoración. Amén.",
            "propositoConcreto": "Hacer un acto consciente de caridad y amabilidad con aquella persona que nos resulte más difícil de tratar.",
            "jaculatoria": "¡Sagrado Corazón de Jesús, en Ti confío!"
          },
          3: {
            "fechaYTiempo": "Miércoles — Amparo y Fidelidad a la Iglesia",
            "santoMemoria": `Fiesta del Santoral — Intercesión de ${santoNombre}`,
            "lecturaBreve": "«Id a José; haced lo que él os diga» (Gén 41, 55)",
            "oracionPrincipal": "Oh Dios de bondad providente, en este día en que tradicionalmente recordamos el patrocinio del glorioso patriarca San José, te pedimos que nos concedas un corazón semejante al suyo: humilde, silencioso, obediente y sumamente fiel. San José supo acoger con fe inquebrantable tus designios, protegiendo con celo y amor a tu Hijo Jesucristo y a la Santísima Virgen María. Te rogamos hoy que intercedas por nuestras familias para que reinen en ellas la paz, la pureza de costumbres y la concordia. Concede especial socorro a los padres de familia para que sepan guiar a sus hijos por las sendas del Evangelio. Te encomendamos también a los agonizantes y a la Iglesia entera en sus tribulaciones, pidiéndote la gracia de perseverar hasta el fin en la gracia santificante y de trabajar con esmero por la extensión de tu Reino. Amén.",
            "propositoConcreto": "Realizar nuestro trabajo con el máximo esmero y orden, imitando el silencio laborioso y virtuoso de San José.",
            "jaculatoria": "¡San José, Patrono de la Iglesia Universal, ruega por nosotros!"
          },
          4: {
            "fechaYTiempo": "Jueves — Misterio del Amor Eucarístico",
            "santoMemoria": `Conmemoración del Altar — Santoral: ${santoNombre}`,
            "lecturaBreve": "«Haced esto en memoria mía» (Lc 22, 19)",
            "oracionPrincipal": "Señor Jesucristo, que bajo el sacramento admirable de la Eucaristía nos dejaste el memorial perpetuo de tu Pasión, Muerte y Resurrección, te adoramos con profunda piedad y reverencia. En este Jueves Eucarístico y Sacerdotal, te agradecemos el don infinito del Pan de Vida que alimenta y fortalece a tu Iglesia en su peregrinar por el mundo. Te suplicamos que aumentes en nosotros el hambre y la sed de recibirte en la Sagrada Comunión con el alma limpia y llena de fervor. Derrama tus gracias más abundantes sobre los obispos y sacerdotes; santifica sus vidas, presérvalos del desánimo y suscita numerosas vocaciones sacerdotales dispuestas a desgastarse por el Evangelio. Concede también tu gracia a los cristianos perseguidos para que encuentren en Ti la fortaleza para confesar tu Nombre con audacia. Amén.",
            "propositoConcreto": "Hacer un acto consciente de Comunión Espiritual en algún momento del día y rezar tres Padrenuestros por la fidelidad de los sacerdotes.",
            "jaculatoria": "¡Alabado y adorado sea el Santísimo Sacramento del Altar!"
          },
          5: {
            "fechaYTiempo": "Viernes — Pasión, Sacrificio y Redención",
            "santoMemoria": `Santo del Día — Veneración de ${santoNombre}`,
            "lecturaBreve": "«Nadie tiene mayor amor que el que da la vida por sus amigos» (Jn 15, 13)",
            "oracionPrincipal": "Señor Jesús, Redentor de la humanidad, al contemplar hoy tu madero santo de la Cruz, nos asombramos ante la inmensidad de tu amor y la generosidad de tu entrega. Tú cargaste sobre tus hombros el peso de nuestros pecados y reconciliaste al mundo con el Padre mediante el derramamiento de tu Preciosísima Sangre. Te suplicamos que derrames sobre nosotros un verdadero dolor por nuestras ofensas y un deseo sincero de conversión profunda. Enséñanos a llevar con paciencia y fe nuestras cruces cotidianas, uniendo nuestros sufrimientos a los tuyos para la salvación del mundo. Te encomendamos hoy a todas las personas que sufren de manera extrema: los enfermos terminales, las víctimas de las guerras, los oprimidos, los huérfanos y los desesperados. Que tu cruz santa sea para todos ellos un faro inquebrantable de esperanza y de victoria espiritual. Amén.",
            "propositoConcreto": "Ofrecer un pequeño sacrificio de abstinencia, un ayuno voluntario o un acto de desprendimiento en reparación por los pecados cometidos.",
            "jaculatoria": "¡Te adoramos, oh Cristo, y te bendecimos, porque por tu santa Cruz redimiste al mundo!"
          },
          6: {
            "fechaYTiempo": "Sábado — Consagración Mariana y Esperanza",
            "santoMemoria": `Sábado Mariano — Memoria de ${santoNombre}`,
            "lecturaBreve": "«Haced lo que él os diga» (Jn 2, 5)",
            "oracionPrincipal": "Oh Virgen Santísima, Madre de Dios y tierna Madre nuestra, en este día consagrado a tu Inmaculado Corazón nos acogemos bajo tu manto protector de bondad y gracia. Tú permaneciste firme al pie de la Cruz de tu Hijo con fe inquebrantable, convirtiéndote en Madre de la Iglesia y Auxilio de los cristianos. Te confiamos hoy todas nuestras necesidades espirituales y temporales, nuestras familias, nuestras alegrías y nuestras fatigas cotidianas. Enséñanos a guardar en el corazón, como tú, la Palabra del Señor, a ser dóciles a las inspiraciones del Espíritu Santo y a decir siempre un 'sí' gozoso a la voluntad del Padre. Intercede ante tu divino Hijo por la salvación de las almas, la santificación de las familias y el triunfo de la paz en la tierra. Llévanos de tu mano siempre a los pies del Altar para que sepamos adorar a Jesucristo, fruto bendito de tu vientre. Amén.",
            "propositoConcreto": "Rezar el Santo Rosario con profunda pausa y devoción, meditando los misterios para ofrecerlo por las necesidades de la Iglesia.",
            "jaculatoria": "¡Oh María, sin pecado concebida, ruega por nosotros que recurrimos a ti!"
          }
        };
        oracion = backupPrayers[dayOfWeek];
      }
    }

    // Renderizar la página
    const html = `
      <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-8 animate-fade-in font-sans">
        
        <!-- CABECERA PRINCIPAL -->
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-5">
          <div class="flex flex-col">
            <span class="text-xs font-mono font-bold text-gold uppercase tracking-widest bg-gold-light/20 px-3 py-1 rounded self-start border border-gold/15 mb-2">${oracion.fechaYTiempo || 'Oración del Día'}</span>
            <h1 class="font-display font-black text-3xl sm:text-4xl text-maroon tracking-tight leading-tight">Oración del Día</h1>
            <p class="font-serif text-xs sm:text-sm text-ink2 mt-1.5 italic flex items-center gap-1.5">
              <span>⛪ Memoria: <strong>${oracion.santoMemoria || 'Memoria del Día'}</strong></span>
              <span class="text-gold/60">•</span>
              <span>📅 ${todayStr}</span>
            </p>
          </div>
          
          <div class="flex gap-2">
            <button onclick="window.print()" class="text-xs bg-white border border-border hover:bg-cream2/10 text-espresso font-bold py-2 px-3.5 rounded-full transition flex items-center gap-1.5 self-start">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
              <span>Imprimir</span>
            </button>
            <a href="/" class="text-xs bg-maroon/5 border border-maroon hover:bg-maroon hover:text-white text-maroon font-bold py-2 px-4 rounded-full transition flex items-center gap-1.5 self-start">
              <span>Profundizar en el Chat</span>
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          </div>
        </div>

        <!-- CONTENIDO PRINCIPAL EN CUADRÍCULA -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- SECCIÓN DE LA ORACIÓN PRINCIPAL (2 COLUMNAS) -->
          <div class="lg:col-span-2 flex flex-col gap-6">
            <div class="seo-card bg-white rounded-2xl border-2 border-gold/15 p-6 sm:p-8 flex flex-col gap-6 relative shadow-md">
              <div class="absolute -top-3 left-6 bg-maroon text-white font-serif italic text-xs px-4 py-1 rounded-full border border-gold/20 shadow-sm">
                Invocación Diaria
              </div>
              <div class="text-justify font-serif text-espresso text-base sm:text-lg leading-relaxed pt-3 whitespace-pre-line">
                ${oracion.oracionPrincipal}
              </div>
              <div class="flex items-center justify-end border-t border-border/40 pt-4 mt-2">
                <span class="text-xs font-mono text-ink2 italic">CatólicosGPT • Guía Espiritual</span>
              </div>
            </div>
          </div>

          <!-- SECCIÓN COLUMNA LATERAL (LECTURA, PROPÓSITO, JACULATORIA) -->
          <div class="flex flex-col gap-6">
            
            <!-- LECTURA BREVE -->
            <div class="seo-card bg-cream2/10 border border-gold/20 rounded-2xl p-5 flex flex-col gap-3">
              <span class="text-[10px] font-mono font-bold text-[#BC8A36] uppercase tracking-wider block">📖 Lectura Espiritual de Hoy</span>
              <div class="font-serif text-sm italic text-espresso leading-relaxed select-text">
                "${oracion.lecturaBreve}"
              </div>
              <span class="text-[9px] text-ink2 block font-mono">Lecturas del Calendario Litúrgico</span>
            </div>

            <!-- PROPÓSITO CONCRETO -->
            <div class="seo-card bg-white border border-border rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
              <div class="absolute top-0 left-0 w-1.5 h-full bg-gold"></div>
              <span class="text-[10px] font-mono font-bold text-espresso uppercase tracking-wider block">🎯 Propósito de Enmienda y Caridad</span>
              <p class="text-xs sm:text-sm text-ink leading-relaxed font-sans">
                ${oracion.propositoConcreto}
              </p>
            </div>

            <!-- JACULATORIA -->
            <div class="seo-card bg-maroon/[0.02] border border-maroon/20 rounded-2xl p-5 flex flex-col gap-3 relative text-center">
              <span class="text-[10px] font-mono font-bold text-maroon uppercase tracking-wider block">🕊️ Jaculatoria del Día</span>
              <p class="font-serif italic text-base text-maroon font-bold leading-relaxed px-2">
                "${oracion.jaculatoria}"
              </p>
              <p class="text-[9px] text-ink2 leading-relaxed">
                Repítela en silencio durante tus labores cotidianas para mantener la presencia de Dios.
              </p>
            </div>

            <div class="text-center text-[10px] text-ink2 mt-2 select-none italic font-mono flex items-center justify-center gap-1">
              <span>Sincronizado: ${fromCache ? '✅ Archivo Local de Alta Velocidad' : '⚡ Generado en Tiempo Real'}</span>
            </div>

          </div>

        </div>

      </div>
    `;

    res.send(renderPage('Oración del Día de Hoy', html, req));
  } catch (err) {
    console.error('[Oración del Día Error]', err);
    res.status(500).send(renderPage('Error', `<div class="p-12 text-center text-ink w-full">No se pudo preparar la oración diaria: ${err.message}. <a href="/" class="text-maroon underline">Volver al inicio</a></div>`, req));
  }
});

function normalizeInfografiaReference(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const shortcode = raw.match(/\[infografia:([\w-]+)\]/i);
  if (shortcode) return shortcode[1];
  try {
    const parsed = new URL(raw, 'https://catolicosgpt.local');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'infografias' && parts[1]) return parts[parts.length - 1];
  } catch(e) {}
  return raw.replace(/^\/+/, '').replace(/^infografias\//, '').replace(/^carrusel\//, '').split(/[?#]/)[0];
}

function renderSaintMediaSection(s) {
  if (s.foto_url) {
    return `
      <div class="relative rounded-2xl overflow-hidden border border-border bg-cream shadow-xs max-h-[420px] mb-6 flex items-center justify-center">
        <img src="${s.foto_url}" alt="${s.nombre}" class="object-cover max-h-[420px] w-full" referrerPolicy="no-referrer">
      </div>
    `;
  }

  const ref = String(s.infografia_url || '').trim();
  if (!ref) return '';

  if (/^https?:\/\/res\.cloudinary\.com\//i.test(ref) || /^https?:\/\/.*\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(ref)) {
    return `
      <figure class="cloudinary-content-image mb-6">
        <img src="${ref}" alt="Recurso visual de ${s.nombre}" loading="lazy" referrerPolicy="no-referrer">
        <figcaption>Imagen pastoral de ${s.nombre}</figcaption>
      </figure>
    `;
  }

  const slug = normalizeInfografiaReference(ref);
  const inf = slug ? infografias.getInfografiaBySlug(slug) : null;
  if (!inf) {
    return '';
  }

  const rendered = blog.renderShortcodes(`[infografia:${inf.slug}]`, {
    getInfografia: infografias.getInfografiaBySlug,
    getVideo: videos.getVideoBySlug,
    getPodcast: podcast.getPodcastBySlug
  });

  return `
    <div class="relative rounded-2xl overflow-hidden border border-gold/40 bg-cream shadow-xs mb-6 p-4">
      <div class="flex items-center gap-3 border-b pb-3 mb-3">
        <span class="text-xl">🎨</span>
        <div>
          <h4 class="font-display font-bold text-xs text-maroon uppercase tracking-wider">Infografía Pastoral Sincronizada</h4>
          <p class="text-[10px] text-ink2">Esta hagiografía cuenta con un recurso visual de la biblioteca oficial.</p>
        </div>
      </div>
      ${rendered}
    </div>
  `;
}

function renderSaintPage(s, req, res) {
  // Convertir saltos de línea o HTML en párrafos limpios para la biografía
  let paragraphs = '';
  const bio = s.biografia || '';
  paragraphs = blog.parseMarkdown(bio);
  paragraphs = blog.renderShortcodes(paragraphs, {
    getInfografia: infografias.getInfografiaBySlug,
    getVideo: videos.getVideoBySlug,
    getPodcast: podcast.getPodcastBySlug
  });

  // Construir tabla de aspectos clave
  let tableRows = '';
  if (s.aspectos_tabla && typeof s.aspectos_tabla === 'object') {
    Object.entries(s.aspectos_tabla).forEach(([key, value]) => {
      if (value) {
        tableRows += `
          <tr class="border-b border-border/40 hover:bg-cream/30 transition">
            <td class="py-2.5 pr-4 text-xs font-mono font-bold text-ink2 uppercase tracking-wide w-1/3 align-top">${key}</td>
            <td class="py-2.5 text-sm font-serif text-ink w-2/3 align-top">${value}</td>
          </tr>
        `;
      }
    });
  }

  const mediaSection = renderSaintMediaSection(s);

  const html = `
    <div class="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-8 animate-fade-in">
      
      <!-- ENCABEZADO DE LA HAGIOGRAFÍA -->
      <div class="text-center flex flex-col items-center gap-2 max-w-2xl mx-auto">
        <span class="text-[11px] uppercase font-mono tracking-widest text-gold font-bold bg-maroon/5 px-3 py-1 rounded-full border border-gold/20">
          📅 ${s.dia} de ${s.mes} — Santoral Romano
        </span>
        <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-maroon tracking-tight leading-tight mt-1">
          ${s.nombre}
        </h1>
        <div class="flex items-center gap-2 text-xs font-mono font-bold text-ink2 uppercase tracking-wider">
          <span>✨</span>
          <span>${s.tipo}</span>
          <span>✨</span>
        </div>
        <div class="h-[1px] w-16 bg-gold/50 my-2"></div>
      </div>

      <!-- LEMA / JACULATORIA DESTACADA -->
      ${s.lema ? `
        <div class="text-center max-w-xl mx-auto px-4 py-3 border-y border-gold/30 bg-cream/20 rounded-xl">
          <p class="font-serif italic text-sm sm:text-base text-maroon font-semibold tracking-wide">"${s.lema.replace(/"/g, '')}"</p>
        </div>
      ` : ''}

      <!-- CUERPO PRINCIPAL: DETALLE & FICHA -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <!-- COLUMNA BIOGRAFÍA & MEDIA (2 COLUMNAS) -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          
          ${mediaSection}

          <div class="bg-white border border-[#E6DFD4] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-4">
            <h2 class="font-display font-bold text-lg text-maroon border-b pb-2 tracking-wide flex items-center gap-2">
              📜 Vida, Obra y Testimonio Espiritual
            </h2>
            <div class="prose santo-biografia content-html max-w-none mt-2">
              ${paragraphs}
            </div>
            <div class="border-t pt-4 mt-2">
              <span class="text-xs text-ink2 italic">Sincronizado formalmente en tiempo real para el año 2026.</span>
            </div>
          </div>

        </div>

        <!-- COLUMNA DERECHA: TABLA DE ASPECTOS & ACCIONES (1 COLUMNA) -->
        <div class="flex flex-col gap-6">
          
          <!-- ASPECTOS LITÚRGICOS (TABLA) -->
          <div class="bg-white border rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <h3 class="font-display font-bold text-xs text-maroon uppercase tracking-wider border-b pb-2">
              📌 Aspectos de su Vida
            </h3>
            
            <div class="overflow-x-auto">
              <table class="w-full">
                <tbody>
                  ${tableRows || `
                    <tr>
                      <td class="py-2 text-xs text-ink2 italic">No hay detalles tabulados para este perfil.</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- PREGUNTAR AL CHAT INTEGRADOR -->
          <div class="bg-gradient-to-br from-maroon to-espresso text-white rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative overflow-hidden">
            <div class="absolute -right-8 -bottom-8 text-white/5 text-9xl font-light select-none pointer-events-none">✝</div>
            
            <div class="flex flex-col gap-1.5 relative">
              <span class="text-[10px] uppercase font-mono tracking-widest text-gold font-bold">Interacción Directa</span>
              <h4 class="font-display font-bold text-base text-gold">¿Deseas profundizar más?</h4>
              <p class="text-xs text-cream/80 leading-relaxed font-serif mt-1">Pregúntale a nuestro teólogo virtual sobre sus sermones, milagros específicos, oraciones de sanación, o su contexto en el catecismo católico.</p>
            </div>

            <a href="/?prompt=${encodeURIComponent(`Dime más sobre ${s.nombre}, su biografía oficial, milagros célebres, su testimonio en la Iglesia, y cómo nos inspira hoy`)}" 
               class="w-full bg-gold text-espresso font-sans font-bold text-xs py-3 rounded-xl text-center shadow-md hover:bg-amber-400 hover:scale-[1.02] transition duration-200">
              💬 Conversar con CatólicosGPT
            </a>
          </div>

          <!-- COMPARTIR ENLACE -->
          <div class="bg-white border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
            <h3 class="font-display font-bold text-xs text-maroon uppercase tracking-wider border-b pb-1.5">
              🔗 Compartir Hagiografía
            </h3>
            <p class="text-xs text-ink2">Ayuda a difundir la palabra y el testimonio de los santos a otros católicos:</p>
            <div class="flex gap-2 mt-1">
              <input id="saint-share-url" type="text" readonly value="" class="bg-cream border border-border rounded-lg text-xs font-mono p-2 flex-1 outline-none text-ink select-all">
              <button onclick="copiarEnlaceSanto()" class="bg-maroon hover:bg-espresso text-white text-xs font-semibold px-3 py-2 rounded-lg transition">Copiar</button>
            </div>
          </div>

        </div>

      </div>

    </div>

    <script>
      // Set actual current page URL inside sharing box
      document.getElementById('saint-share-url').value = window.location.href;

      function copiarEnlaceSanto() {
        const inp = document.getElementById('saint-share-url');
        inp.select();
        document.execCommand('copy');
        alert('¡Enlace de la biografía copiado al portapapeles!');
      }
    </script>
  `;

  if (req.query.partial === '1' || req.query.embed === '1') {
    return res.send(html);
  }

  res.send(renderPage(s.nombre, html, req, {
    description: s.seo_description || `Biografía completa de ${s.nombre} en el Santoral de CatólicosGPT.`,
    keywords: s.seo_keywords || `santo del dia, ${s.nombre}, santoral, vida de santos`,
    canonical: `/santoral/${s.slug}`
  }));
}

app.get('/santo-del-dia', async (req, res) => {
  try {
    const todayStr = liturgia.todayBogota(); // YYYY-MM-DD
    const [_, mesIdx, diaVal] = todayStr.split('-');
    const s = await santoral.getOrCreateDailySaint(parseInt(diaVal), mesIdx);
    if (!s) {
      return res.status(404).send(renderPage('Santo No Encontrado', `
        <div class="max-w-md mx-auto py-16 px-4 text-center">
          <span class="text-5xl">⛪</span>
          <h1 class="font-display font-bold text-xl text-maroon mt-4">Santo no encontrado</h1>
          <p class="font-serif text-sm text-ink2 mt-2">No se pudo cargar el Santo de Hoy de forma automática.</p>
        </div>
      `, req));
    }
    return renderSaintPage(s, req, res);
  } catch (err) {
    console.error('[Santo del Dia Route Error]', err);
    res.status(500).send(renderPage('Error', `<div class="p-12 text-center text-ink w-full">No se pudo cargar la hagiografía del santo de hoy: ${err.message}</div>`, req));
  }
});

app.get('/santoral', async (req, res) => {
  try {
    const list = santoral.getAllSaints() || [];
    // Sort from most recent to oldest
    list.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

    // Construct the letters list for index
    const letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

    let cardsHtml = '';
    list.forEach(s => {
      const name = s.nombre || '';
      const initial = name.trim().charAt(0).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const photo = s.foto_url || '';
      const lema = s.lema || '';
      const shortBio = s.biografia ? s.biografia.slice(0, 150) + '...' : '';

      cardsHtml += `
        <div class="santo-card bg-white border border-[#E6DFD4] hover:border-gold/50 rounded-2xl p-6 shadow-xs hover:shadow-md transition duration-300 flex flex-col justify-between gap-4"
             data-name="${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}"
             data-letter="${initial}">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-gold bg-maroon/5 px-2.5 py-1 rounded-full border border-gold/10">
                📅 ${s.dia} de ${s.mes}
              </span>
              <span class="text-[10px] font-mono font-semibold text-ink2 uppercase tracking-wider">
                ${s.tipo || 'Memoria'}
              </span>
            </div>
            
            ${photo ? `
              <div class="w-full h-40 rounded-xl overflow-hidden border border-border bg-cream/40 mb-1">
                <img src="${photo}" alt="${name}" class="w-full h-full object-cover" referrerPolicy="no-referrer">
              </div>
            ` : ''}

            <h3 class="font-display font-bold text-lg text-espresso tracking-tight line-clamp-1">
              ${name}
            </h3>

            ${lema ? `
              <p class="font-serif italic text-xs text-maroon line-clamp-2 leading-relaxed">
                ${lema}
              </p>
            ` : ''}

            <p class="font-serif text-xs text-ink2 leading-relaxed line-clamp-3">
              ${shortBio}
            </p>
          </div>

          <div class="pt-2 border-t border-[#F5EFE6] flex items-center justify-between">
            <a href="/santoral/${s.slug}" class="text-xs font-sans font-bold text-maroon hover:text-gold transition flex items-center gap-1.5 group">
              Leer Biografía Completa
              <span class="group-hover:translate-x-0.5 transition duration-200">&rarr;</span>
            </a>
          </div>
        </div>
      `;
    });

    const alphabetHtml = letters.map(l => `
      <button type="button" 
              onclick="filterByLetter('${l}')" 
              class="letter-btn px-2.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-[#E6DFD4] bg-white hover:bg-[#FAF9F5] text-espresso cursor-pointer transition duration-150">
        ${l}
      </button>
    `).join('');

    const html = `
      <div class="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-8 animate-fade-in">
        
        <!-- ENCABEZADO -->
        <div class="flex flex-col md:flex-row md:items-end justify-between border-b pb-6 gap-4">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">⛪</span>
              <span class="text-[10px] uppercase font-mono tracking-widest text-gold font-bold">CatólicosGPT Santoral</span>
            </div>
            <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-maroon tracking-tight leading-tight">
              Biografías de los Santos
            </h1>
            <p class="font-serif text-sm text-ink2 italic">
              Explora las hagiografías completas, virtudes heroicas y milagros de los grandes santos de la Iglesia.
            </p>
          </div>
          
          <!-- SEARCH BOX -->
          <div class="w-full md:w-80 relative">
            <input type="text" 
                   id="search-santo" 
                   oninput="filterSaints()" 
                   placeholder="Buscar por nombre..." 
                   class="w-full pl-9 pr-4 py-2.5 text-xs font-serif bg-white border border-[#E6DFD4] focus:border-gold/60 focus:ring-1 focus:ring-gold/30 rounded-xl outline-none transition duration-150 shadow-inner">
            <span class="absolute left-3 top-3.5 text-ink2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
          </div>
        </div>

        <!-- FILTRO ABECEDARIO -->
        <div class="flex flex-col gap-2 bg-[#FAF9F5] border border-[#E6DFD4] p-4 rounded-2xl shadow-xs">
          <span class="text-[10px] uppercase font-mono tracking-wider text-ink2 font-bold px-1">Filtrar por letra inicial</span>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" 
                    id="btn-all"
                    onclick="filterByLetter('ALL')" 
                    class="letter-btn active-letter px-3.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-maroon bg-maroon text-white cursor-pointer transition duration-150">
              Todos
            </button>
            ${alphabetHtml}
          </div>
        </div>

        <!-- RECUENTO -->
        <div class="text-xs text-ink2 font-mono" id="results-count">
          Mostrando todos los santos registrados.
        </div>

        <!-- GRID DE TARJETAS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="santos-grid">
          ${cardsHtml || `
            <div class="col-span-full py-12 text-center text-ink2 font-serif text-sm">
              No hay hagiografías registradas actualmente.
            </div>
          `}
        </div>

      </div>

      <style>
        .active-letter {
          background-color: #7c1a22 !important;
          color: white !important;
          border-color: #7c1a22 !important;
        }
      </style>

      <script>
        let currentLetter = 'ALL';
        let searchQuery = '';

        function filterByLetter(letter) {
          currentLetter = letter;
          
          // Actualizar clases de botones
          document.querySelectorAll('.letter-btn').forEach(btn => {
            btn.classList.remove('active-letter');
          });
          
          if (letter === 'ALL') {
            document.getElementById('btn-all').classList.add('active-letter');
          } else {
            // Encontrar el botón de la letra correspondiente
            const buttons = document.querySelectorAll('.letter-btn');
            buttons.forEach(btn => {
              if (btn.innerText.trim() === letter) {
                btn.classList.add('active-letter');
              }
            });
          }
          
          filterSaints();
        }

        function filterSaints() {
          searchQuery = document.getElementById('search-santo').value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
          
          const cards = document.querySelectorAll('.santo-card');
          let visibleCount = 0;
          
          cards.forEach(card => {
            const name = card.getAttribute('data-name') || '';
            const letter = card.getAttribute('data-letter') || '';
            
            const matchSearch = name.includes(searchQuery);
            const matchLetter = (currentLetter === 'ALL') || (letter === currentLetter);
            
            if (matchSearch && matchLetter) {
              card.style.display = 'flex';
              visibleCount++;
            } else {
              card.style.display = 'none';
            }
          });
          
          const countText = document.getElementById('results-count');
          if (searchQuery === '' && currentLetter === 'ALL') {
            countText.innerText = 'Mostrando todos los ' + cards.length + ' santos registrados.';
          } else {
            countText.innerText = 'Encontrados ' + visibleCount + ' de ' + cards.length + ' santos para la búsqueda.';
          }
        }
      </script>
    `;

    res.send(renderPage('Santoral Católico — CatólicosGPT', html, req));
  } catch (err) {
    console.error('[Santoral Route Error]', err);
    res.status(500).send(renderPage('Error', `<div class="p-12 text-center text-ink w-full">Error al cargar el Santoral: \${err.message}</div>`, req));
  }
});

app.get('/santoral/:slug', async (req, res) => {
  try {
    const s = santoral.getSaintBySlug(req.params.slug);
    if (!s) {
      return res.status(404).send(renderPage('Santo No Encontrado', `
        <div class="max-w-md mx-auto py-16 px-4 text-center">
          <span class="text-5xl">⛪</span>
          <h1 class="font-display font-bold text-xl text-maroon mt-4">Santo no encontrado</h1>
          <p class="font-serif text-sm text-ink2 mt-2">No disponemos actualmente de un perfil para el término solicitado.</p>
          <a href="/santo-del-dia" class="inline-block bg-maroon text-white font-sans font-semibold text-xs px-5 py-2.5 rounded-full mt-6 shadow-xs hover:bg-espresso transition">Ver el Santo de Hoy</a>
        </div>
      `, req));
    }
    return renderSaintPage(s, req, res);
  } catch (err) {
    console.error('[Santoral Route Error]', err);
    res.status(500).send(renderPage('Error', `<div class="p-12 text-center text-ink w-full">No se pudo cargar la hagiografía del santo: ${err.message}</div>`, req));
  }
});

app.get('/preguntas-frecuentes', (req, res) => {
  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div class="flex flex-col gap-2 border-b pb-4">
        <h1 class="font-display font-bold text-2xl text-maroon tracking-wide">Preguntas Frecuentes Doctrinares Católicas</h1>
        <p class="font-serif text-ink2 text-sm italic">Respuestas claras, profundas y sin ambigüedades alineadas al Catecismo oficial.</p>
      </div>
      
      <div class="flex flex-col gap-4 mt-2">
        <div class="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <strong class="text-espresso font-display text-sm">💡 ¿Qué es el Catolicismo y por qué es la Iglesia fundada por Jesucristo?</strong>
          <p class="text-ink2 text-xs sm:text-sm leading-relaxed">La Iglesia es una, santa, católica y apostólica. Jesucristo le encargó formalmente las llaves a San Pedro (Mt 16,18) estableciendo el primado de la Sede Apostólica de Roma.</p>
        </div>
        
        <div class="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <strong class="text-espresso font-display text-sm">💡 ¿Por qué los católicos no adoramos a la Virgen María ni a los santos?</strong>
          <p class="text-ink2 text-xs sm:text-sm leading-relaxed">La Iglesia distingue categóricamente entre: Latría (Adoración que pertenece únicamente a Dios), Hiperdulía (Veneración particular a la Santísima Virgen María) y Dulía (Veneración a los santos).</p>
        </div>

        <div class="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <strong class="text-espresso font-display text-sm">💡 ¿Qué es la encíclica Magnifica Humanitas?</strong>
          <p class="text-ink2 text-xs sm:text-sm leading-relaxed">Es la encíclica social firmada el 15 de mayo de 2026 por el Papa León XIV que aborda de forma categórica la bioética y el transhumanismo frente al avance abrupto de las tecnologías de inteligencia artificial.</p>
        </div>
      </div>
    </div>
  `;
  res.send(renderPage('Catolicismo FAQ', html, req));
});

// ════════════════════════════════════════════════════════════════════════════
// RUTA: HORARIOS DE MISA Y TRANSMISIONES LITÚRGICAS
// ════════════════════════════════════════════════════════════════════════════

app.get('/misas', (req, res) => {
  const canalesObj = misas.getMisasCanales();
  
  // Render channels HTML
  let channelsHtml = '';
  canalesObj.forEach(p => {
    p.canales.forEach(c => {
      channelsHtml += `
        <div class="channel-card bg-white border border-[#E6DFD4] rounded-2xl p-5 shadow-sm hover:shadow duration-200 flex flex-col justify-between gap-4" data-pais="${p.pais.toLowerCase()}" data-nombre="${c.nombre.toLowerCase()}">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-mono bg-maroon text-white font-bold px-2 py-0.5 rounded uppercase tracking-wider">${p.pais}</span>
              <span class="text-xs text-ink2 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                Sintonía Digital
              </span>
            </div>
            <h3 class="font-display font-bold text-espresso text-base tracking-wide">${c.nombre}</h3>
            <p class="text-ink2 text-xs leading-relaxed italic font-serif">${c.comentario}</p>
          </div>
          <div class="flex flex-col gap-2 pt-2 border-t border-cream">
            <a href="${c.liveUrl}" target="_blank" class="w-full text-center py-2 bg-maroon hover:bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-1.5 duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-circle"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              Sintonizar Misa en Vivo
            </a>
            <a href="${c.link}" target="_blank" class="text-center text-[10px] text-ink hover:text-maroon font-bold font-mono transition">Visitar Canal Oficial →</a>
          </div>
        </div>
      `;
    });
  });

  const html = `
    <div class="max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      
      <!-- HERO HEADER -->
      <div class="flex flex-col gap-2 border-b border-[#E6DFD4] pb-4">
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-maroon tracking-wide">Transmisiones del Santo Sacrificio</h1>
        <p class="font-serif text-ink2 text-sm italic">Directorio verificado de Santa Misa en vivo y sacramentos por internet para personas impedidas, de viaje o enfermas.</p>
      </div>

      <!-- FILTER BOX -->
      <div class="flex flex-col sm:flex-row gap-3 items-center justify-between bg-cream2/30 border border-[#E6DFD4] rounded-2xl p-4 shadow-inner">
        <span class="text-xs font-semibold text-espresso flex items-center gap-1 font-serif italic">
          ✝ Filtrar transmisiones:
        </span>
        <div class="relative w-full sm:w-72">
          <input type="text" id="misa-search" oninput="filtrarCanales()" placeholder="Filtrar por canal o país..." class="w-full text-xs border border-border px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-gold bg-white">
          <span class="absolute right-3.5 top-3 text-ink2">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
        </div>
      </div>

      <!-- STREAMING GRID -->
      <div id="canales-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-2">
        ${channelsHtml}
      </div>

      <!-- NO RESULTS PLACEHOLDER -->
      <div id="no-canales" class="hidden text-center py-12 text-ink">
        <span class="text-2xl text-gold font-bold block mb-1">⛪</span>
        No se encontraron canales marianos ni diocesanos con esos términos.
      </div>

      <!-- PASTORAL OBSERVATION -->
      <div class="bg-white border-2 border-gold/20 rounded-2xl p-5 mt-6 shadow-sm shadow-gold-light/10">
        <h4 class="font-display font-bold text-maroon text-sm uppercase tracking-wider mb-2 flex items-center gap-1.5">
          ⛪ Instrucción Pastoral sobre la Misa Telemática
        </h4>
        <p class="font-serif text-ink text-xs sm:text-sm leading-relaxed italic">
          "Recordamos la enseñanza católica consagrada en la Carta Apostólica 'Dies Domini': la transmisión televisada o digital es una ayuda magnánima para quienes están legítimamente impedidos de asistir por edad, enfermedad o causa grave. Ninguna pantalla puede suplir la comunión sacramental, la presencia física del rebaño y la recepción real de la Santísima Eucaristía en el Altar de Dios."
        </p>
      </div>

    </div>

    <script>
      function filtrarCanales() {
        const query = document.getElementById('misa-search').value.toLowerCase().trim();
        const cards = document.querySelectorAll('.channel-card');
        let unmatchCount = 0;
        
        cards.forEach(card => {
          const pais = card.getAttribute('data-pais');
          const nombre = card.getAttribute('data-nombre');
          if (pais.includes(query) || nombre.includes(query)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
            unmatchCount++;
          }
        });

        const noRes = document.getElementById('no-canales');
        if (unmatchCount === cards.length) {
          noRes.classList.remove('hidden');
        } else {
          noRes.classList.add('hidden');
        }
      }
    </script>
  `;
  res.send(renderPage('Santa Misa en Vivo', html, req));
});

// ════════════════════════════════════════════════════════════════════════════
// RUTA: SELLO DE ORO PREMIUM Y PLANES
// ════════════════════════════════════════════════════════════════════════════

app.get('/planes', (req, res) => {
  const user = getAuthedUser(req);
  const activePlan = user ? user.plan : 'free';

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      
      <!-- HERO HEADER -->
      <div class="flex flex-col gap-2 text-center max-w-2xl mx-auto pb-4">
        <h1 class="font-display font-medium text-3xl sm:text-4xl text-espresso tracking-tight leading-tight">
          Exclusividad & <span class="italic text-gold font-serif">Branding Cristiano</span>
        </h1>
        <p class="font-serif text-ink2 text-base italic leading-relaxed">
          Diseña y difunde de manera ilimitada con la V77. Configura el logo de tu parroquia y obtén descargas en alta resolución.
        </p>
      </div>

      <!-- PRICING CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto w-full mt-4">
        
        <!-- GRATUITO CARD -->
        <div class="bg-white border border-[#E6DFD4] rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm relative overflow-hidden">
          <div class="flex flex-col gap-3">
            <span class="text-[9px] font-mono bg-cream hover:bg-cream2 duration-200 text-espresso font-bold px-2 py-0.5 rounded self-start uppercase tracking-widest">Plan Comunitario</span>
            <h3 class="font-display font-bold text-espresso text-xl">Acceso Gratis</h3>
            <p class="text-ink2 text-xs leading-relaxed font-serif italic font-medium">Adecuado para catequesis y oración personal esporádica.</p>
            <div class="flex items-baseline mt-2">
              <span class="font-display font-medium text-4xl text-espresso">$0</span>
              <span class="text-ink2 text-xs ml-1 font-mono">/ siempre</span>
            </div>
            
            <ul class="flex flex-col gap-3 text-xs text-ink mt-4 border-t pt-4">
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-green-500 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Soporte total en el Chat Magisterial</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-green-500 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Generar 1 infografía diaria</span>
              </li>
              <li class="flex items-center gap-2 text-ink2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-espresso flex-shrink-0 opacity-40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                <span>Watermark de CatólicosGPT</span>
              </li>
            </ul>
          </div>
          
          <button class="w-full text-center py-2.5 bg-cream text-espresso font-bold text-xs uppercase tracking-wider rounded-xl transition" disabled>
            ${activePlan === 'free' ? 'Plan Actual Activado ✓' : 'Plan Tradicional'}
          </button>
        </div>

        <!-- PREMIUM CARD -->
        <div class="bg-white border-2 border-gold rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-md relative overflow-hidden">
          <div class="absolute -right-12 -top-12 bg-gold text-white text-[9px] font-bold font-mono py-1 px-4 transform rotate-45 w-40 text-center uppercase tracking-widest hidden sm:block shadow-sm">
            Destacado
          </div>
          
          <div class="flex flex-col gap-3">
            <span class="text-[9px] font-mono bg-gold-light text-maroon font-bold px-2.5 py-0.5 rounded self-start uppercase tracking-widest">Sello de Oro</span>
            <h3 class="font-display font-medium text-espresso text-xl">Socio Premium</h3>
            <p class="text-ink2 text-xs leading-relaxed font-serif italic font-medium">Ideal para templos, capillas, colegios doctrinales y agentes de evangelización digital.</p>
            <div class="flex items-baseline mt-2">
              <span class="font-display font-bold text-4xl text-maroon">$4.99</span>
              <span class="text-ink2 text-xs ml-1 font-mono">/ mes</span>
            </div>
            
            <ul class="flex flex-col gap-3 text-xs text-ink mt-4 border-t pt-4">
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-gold flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Generaciones <strong>ilimitadas</strong> de Infografías</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-gold flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span><strong>Sin watermark:</strong> Marca de agua removida</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-gold flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Formatos listos para Instagram, WhatsApp, Presentaciones</span>
              </li>
              <li class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-gold flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Configurar logo parroquial y monograma cristiano</span>
              </li>
            </ul>
          </div>
          
          ${user ? (
            activePlan === 'premium' || activePlan === 'admin' ? `
              <button class="w-full text-center py-2.5 bg-maroon text-white font-bold text-xs uppercase tracking-wider rounded-xl transition" disabled>
                Suscripción Premium Activa ✓
              </button>
            ` : `
              <button onclick="abrirCheckout()" class="w-full text-center py-3 bg-maroon hover:bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-95 duration-200">
                Obtener Licencia Premium
              </button>
            `
          ) : `
            <a href="/login?redirect=planes" class="w-full text-center py-3 bg-maroon hover:bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-1.5 duration-200">
              Inicia Sesión para Comprar
            </a>
          `}
        </div>

      </div>

      <!-- CHECKOUT MODAL MOCKUP -->
      <div id="checkout-modal" class="fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 flex items-center justify-center pointer-events-none opacity-0">
        <div id="checkout-container" class="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full mx-4 shadow-2xl transition-transform duration-300 transform scale-95 flex flex-col gap-4">
          <div class="flex items-center justify-between border-b pb-2">
            <span class="font-display font-bold text-maroon text-sm tracking-widest uppercase">Procesador de Ofrendas</span>
            <button onclick="cerrarCheckout()" class="p-1 rounded hover:bg-cream">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          
          <div class="flex flex-col gap-1">
            <span class="text-ink2 text-[10px] font-mono uppercase tracking-widest">Suscripción</span>
            <div class="flex items-center justify-between font-serif">
              <span class="font-bold text-espresso text-sm">CatólicosGPT Premium V77</span>
              <span class="font-bold text-maroon text-sm">$4.99 USD</span>
            </div>
          </div>
          
          <form id="checkout-form" onsubmit="procesarUpgrade(event)" class="flex flex-col gap-3 mt-1">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold text-espresso">Número de Tarjeta (Prueba / Mock)</label>
              <input type="text" placeholder="4111 2222 3333 4444" required max="19" class="border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-gold bg-[#FAF9F5]/40 font-mono">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold text-espresso">Vencimiento</label>
                <input type="text" placeholder="MM/AA" required class="border border-border rounded-xl px-4 py-2.5 text-xs text-center outline-none focus:ring-2 focus:ring-gold bg-[#FAF9F5]/40 font-mono">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold text-espresso">CVC</label>
                <input type="password" placeholder="***" required max="3" class="border border-border rounded-xl px-4 py-2.5 text-xs text-center outline-none focus:ring-2 focus:ring-gold bg-[#FAF9F5]/40 font-mono">
              </div>
            </div>
            
            <button type="submit" id="upgrade-submit-btn" class="w-full bg-maroon hover:bg-gold text-white font-bold py-3 rounded-xl transition uppercase tracking-wider shadow text-xs mt-3 flex items-center justify-center gap-1.5 duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Completar Suscripción Premium ($4.99)
            </button>
          </form>
          
          <div class="text-[9px] text-center text-ink2 italic font-serif leading-relaxed">
            ✝ Encriptación bancaria simulada SSL. El dinero de prueba no es real; tu base de datos se actualizará al instante.
          </div>
        </div>
      </div>

    </div>

    <script>
      const modal = document.getElementById('checkout-modal');
      const container = document.getElementById('checkout-container');
      
      function abrirCheckout() {
        modal.classList.remove('pointer-events-none', 'opacity-0');
        modal.classList.add('opacity-100');
        container.classList.remove('scale-95');
        container.classList.add('scale-100');
      }
      
      function cerrarCheckout() {
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.classList.remove('opacity-100');
        container.classList.add('scale-95');
        container.classList.remove('scale-100');
      }
      
      async function procesarUpgrade(e) {
        e.preventDefault();
        const btn = document.getElementById('upgrade-submit-btn');
        btn.disabled = true;
        btn.innerHTML = 'Procesando ofrenda...';
        
        try {
          const res = await fetch('/api/upgrade-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.success) {
            alert('¡Ofrenda procesada con éxito! Bienvenido al Sello de Oro Premium.');
            window.location.reload();
          } else {
            alert('Error al actualizar plan: ' + (data.error || 'Intenta de nuevo'));
            btn.disabled = false;
            btn.innerHTML = 'Completar Suscripción Premium ($4.99)';
          }
        } catch(err) {
          alert('Error de conexión.');
          btn.disabled = false;
          btn.innerHTML = 'Completar Suscripción Premium ($4.99)';
        }
      }
    </script>
  `;
  res.send(renderPage('Sello de Oro Premium', html, req));
});

// Endpoint de upgrade instantáneo
app.post('/api/upgrade-plan', (req, res) => {
  const user = getAuthedUser(req);
  if (!user) return res.status(401).json({ error: 'Debes iniciar sesión para suscribirte' });
  
  try {
    auth.upgradePlan(user.id, 'premium');
    res.json({ success: true, message: '¡Felicidades! Ahora tienes acceso Premium completo.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RUTA SEO TEMÁTICA SEMENTERAS
// ════════════════════════════════════════════════════════════════════════════

app.get('/recursos/:slug', (req, res) => {
  const t = seoTopics.getTemaSEBySlug(req.params.slug);
  if (!t) {
    return res.status(404).send(renderPage('No encontrado', `<div class="p-12 text-center text-ink">Recurso de formación doctrinal no encontrado. <a href="/" class="text-maroon underline">Volver al inicio</a></div>`, req));
  }

  const html = `
    <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6 text-sm">
      <nav class="text-xs text-ink2 flex items-center gap-1.5 font-semibold">
        <a href="/" class="hover:text-maroon">Inicio</a>
        <span>/</span>
        <span class="text-gold font-bold">Doctrina</span>
      </nav>
      
      <div class="bg-white border border-border rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-sm sacred-border">
        <span class="text-[10px] font-mono font-bold text-gold uppercase tracking-widest">${t.categoria}</span>
        <h1 class="font-display font-bold text-2xl sm:text-3xl text-espresso tracking-wide leading-tight">${t.h1}</h1>
        <p class="text-ink2 font-serif text-sm italic leading-relaxed border-l-2 border-gold pl-4">${t.intro}</p>
        <hr class="my-3">
        <div class="text-ink font-serif text-xs sm:text-sm leading-relaxed space-y-4">
          <p>${t.contenido.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="bg-cream p-4 rounded-xl text-xs mt-4 flex flex-col gap-1 text-ink2 border border-border">
          <span><strong>Fuentes Magisteriales citadas:</strong> ${t.fuentes}</span>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-6 justify-between shadow-sm">
        <div class="flex flex-col gap-1">
          <h4 class="font-display font-bold text-maroon text-sm uppercase">Pregunta a la Inteligencia Artificial</h4>
          <p class="text-ink2 text-xs leading-relaxed max-w-lg">Profundiza en este tema doctrinal. El asistente de CatólicosGPT te dará respuestas groundeadas directamente en el Catecismo.</p>
        </div>
        <a href="/" class="bg-maroon hover:bg-gold text-white px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider shadow transition">Consultar Chat</a>
      </div>
    </div>
  `;

  res.send(renderPage(t.tema, html, req, {
    description: t.intro,
    keywords: t.keywords,
    canonical: `/recursos/${t.slug}`
  }));
});

// Registrar renderPage globalmente para uso en otros módulos como seo-pillars-router
global.renderPageWithSSR = renderPage;

// Montar el Router Programático de 10 Pilares SEO Católicos
const seoPillarsRouter = require('./seo-pillars-router');
app.use('/', seoPillarsRouter);

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE ARCHIVOS XML SITEMAPS Y RSS DE POTENCIA SEO
// ════════════════════════════════════════════════════════════════════════════

app.get('/robots.txt', (req, res) => {
  const APP_URL = process.env.APP_URL || 'https://ai.catolicosgpt.com';
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /login-admin-bypass

Sitemap: ${APP_URL}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  const infCatalog = infografias.loadCatalog();
  const blogCatalog = blog.loadBlog();
  const sementeras = seoTopics.getTemasSEO();
  const saintsList = santoral.getAllSaints();

  const xml = seo.generateSitemapXML({
    infografias: infCatalog.infografias || [],
    posts: blogCatalog.posts || [],
    sementeras,
    santos: saintsList
  });

  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
});

app.get('/rss.xml', (req, res) => {
  const infCatalog = infografias.loadCatalog();
  const blogCatalog = blog.loadBlog();

  const rssFeed = seo.generateRSSFeed({
    posts: blogCatalog.posts || [],
    infografias: infCatalog.infografias || []
  });

  res.setHeader('Content-Type', 'application/xml');
  res.send(rssFeed);
});

app.get('/favicon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, 'favicon.svg'));
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, 'favicon.svg'));
});

// ════════════════════════════════════════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN (LOGIN, REGRISTRO, SALIDA)
// ════════════════════════════════════════════════════════════════════════════

app.get('/login-admin-bypass', async (req, res) => {
  try {
    // Check if sellerplusco@gmail.com exists, create if not
    let existingUser = auth.getUserByEmail('sellerplusco@gmail.com');
    if (!existingUser) {
      const registerRes = await auth.register({
        nombre: 'Administrador sellerplusco',
        email: 'sellerplusco@gmail.com',
        password: 'Comics2026*'
      });
      existingUser = auth.getUserById(registerRes.user.id);
    }

    // Force plan as admin under all circumstances
    auth.updateUser(existingUser.id, { plan: 'admin' });

    // Perform complete, secure sign-in 
    const creds = await auth.login({ email: 'sellerplusco@gmail.com', password: 'Comics2026*' });
    res.setHeader('Set-Cookie', `cgpt_token=${creds.token}; Path=/; HttpOnly; Max-Age=2592000; SameSite=None; Secure`);
    global.sandboxSession = { token: creds.token, userId: existingUser.id };
    
    const destination = req.query.redirect || '/admin';
    res.redirect(destination);
  } catch (e) {
    console.error('[Admin Bypass] Error:', e);
    res.status(500).send(`Error promoviendo administrador: ${e.message}`);
  }
});

app.get('/login', (req, res) => {
  const html = `
    <div class="max-w-md mx-auto w-full px-4 py-12 flex flex-col gap-6">
      <div class="bg-white border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col gap-5 sacred-border">
        <div class="text-center">
          <h2 class="font-display font-bold text-maroon text-xl tracking-wider">Ingreso CatólicosGPT</h2>
          <p class="text-ink2 text-xs mt-1">Accede para generar tus infografías personalizadas.</p>
        </div>
        <form id="login-form" method="POST" action="/login" class="flex flex-col gap-4 text-xs sm:text-sm">
          <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-espresso">Correo electrónico</label>
            <input type="email" name="email" required placeholder="correo@iglesia.com" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-espresso">Contraseña</label>
            <input type="password" name="password" required placeholder="••••••••" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
          </div>
          <button type="submit" class="bg-maroon hover:bg-gold text-white font-bold py-3 rounded-lg transition uppercase tracking-wider duration-300 mt-2 shadow">Ingresar</button>
        </form>

        <div class="relative flex py-2 items-center">
          <div class="flex-grow border-t border-border"></div>
          <span class="flex-shrink mx-4 text-[10px] text-ink2 uppercase tracking-widest">Panel de Control</span>
          <div class="flex-grow border-t border-border"></div>
        </div>

        <a href="/login-admin-bypass" class="text-center text-xs border-2 border-dashed border-maroon hover:bg-maroon/5 text-maroon font-bold py-3 rounded-lg transition uppercase tracking-wider duration-300 block">
          🔑 Entrar directamente como Administrador (sellerplusco)
        </a>

        <div class="text-center text-xs text-ink2 border-t pt-4">
          ¿No tienes una cuenta aún? <a href="/register" class="text-maroon font-semibold hover:underline">Regístrate de forma gratuita</a>
        </div>
      </div>
    </div>
  `;
  res.send(renderPage('Ingresar', html, req));
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const creds = await auth.login({ email, password });
    res.setHeader('Set-Cookie', `cgpt_token=${creds.token}; Path=/; HttpOnly; Max-Age=2592000; SameSite=None; Secure`);
    global.sandboxSession = { token: creds.token, userId: creds.user.id };
    res.redirect('/');
  } catch(e) {
    const errorHtml = `
      <div class="max-w-md mx-auto w-full px-4 py-12">
        <div class="bg-white border rounded-2xl p-6 text-center flex flex-col gap-4">
          <p class="text-red-700 font-bold">⚠️ Error de Ingreso</p>
          <p class="text-ink2 text-xs">${e.message}</p>
          <a href="/login" class="bg-maroon text-white py-2 rounded text-xs font-bold uppercase transition">Volver a intentar</a>
        </div>
      </div>
    `;
    res.send(renderPage('Error de Login', errorHtml, req));
  }
});

app.get('/register', (req, res) => {
  const html = `
    <div class="max-w-md mx-auto w-full px-4 py-12 flex flex-col gap-6">
      <div class="bg-white border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col gap-5 sacred-border">
        <div class="text-center">
          <h2 class="font-display font-bold text-maroon text-xl tracking-wider">Crear Cuenta Gratuita</h2>
          <p class="text-ink2 text-xs mt-1">Únete a CatólicosGPT para guardar historiales y generar contenido.</p>
        </div>
        <form id="register-form" method="POST" action="/register" class="flex flex-col gap-4 text-xs sm:text-sm">
          <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-espresso">Nombre de parroquiano o Iglesia</label>
            <input type="text" name="nombre" required placeholder="Pbro. Mateo o Parroquia San José" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-espresso">Correo electrónico</label>
            <input type="email" name="email" required placeholder="correo@iglesia.com" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="font-semibold text-espresso">Contraseña</label>
            <input type="password" name="password" required placeholder="Mínimo 8 caracteres" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
          </div>
          <button type="submit" class="bg-maroon hover:bg-gold text-white font-bold py-3 rounded-lg transition uppercase tracking-wider duration-300 mt-2 shadow">Registrar ahora</button>
        </form>
        <div class="text-center text-xs text-ink2 border-t pt-4">
          ¿Ya tienes cuenta? <a href="/login" class="text-maroon font-semibold hover:underline">Ingresa aquí</a>
        </div>
      </div>
    </div>
  `;
  res.send(renderPage('Registrarse', html, req));
});

app.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const creds = await auth.register({ nombre, email, password });
    res.setHeader('Set-Cookie', `cgpt_token=${creds.token}; Path=/; HttpOnly; Max-Age=2592000; SameSite=None; Secure`);
    global.sandboxSession = { token: creds.token, userId: creds.user.id };
    res.redirect('/');
  } catch(e) {
    const errorHtml = `
      <div class="max-w-md mx-auto w-full px-4 py-12">
        <div class="bg-white border rounded-2xl p-6 text-center flex flex-col gap-4">
          <p class="text-red-700 font-bold">⚠️ Error de Registro</p>
          <p class="text-ink2 text-xs">${e.message}</p>
          <a href="/register" class="bg-maroon text-white py-2 rounded text-xs font-bold uppercase transition">Volver a intentar</a>
        </div>
      </div>
    `;
    res.send(renderPage('Error de Registro', errorHtml, req));
  }
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `cgpt_token=; Path=/; HttpOnly; Max-Age=0; SameSite=None; Secure`);
  global.sandboxSession = null;
  res.redirect('/');
});

// ════════════════════════════════════════════════════════════════════════════
// AJUSTES DE PERFIL Y CONFIGURACIONES DE CUENTA (MÓDULO SECTORIZADO)
// ════════════════════════════════════════════════════════════════════════════

app.get('/ajustes', (req, res) => {
  const user = getAuthedUser(req);
  
  if (!user) {
    const htmlContent = `
      <div class="max-w-xl mx-auto w-full px-4 py-12 flex flex-col gap-6 animate-fade-in">
        <div class="bg-white border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col gap-6 sacred-border">
          <div class="text-center flex flex-col gap-2">
            <div class="h-12 w-12 border-2 border-gold/35 rounded-2xl p-3 bg-[#FAF9F5] text-gold shadow-sm flex items-center justify-center font-bold mx-auto text-xl">
              ✝
            </div>
            <h2 class="font-display font-bold text-maroon text-2xl tracking-wide mt-2">Ajustes de Perfil</h2>
            <p class="text-ink2 text-xs italic font-serif">"La gracia del Señor guíe tus pasos."</p>
          </div>
          
          <div class="bg-[#FAF9F5] p-5 rounded-xl border border-border flex flex-col gap-3">
            <h3 class="font-bold text-maroon text-xs uppercase font-mono tracking-wider">Modo Invitado Activo</h3>
            <p class="text-ink text-xs sm:text-sm leading-relaxed">
              Actualmente estás utilizando <strong class="text-maroon">CatólicosGPT</strong> de forma anónima. Para poder realizar ajustes avanzados de personalización, tales como:
            </p>
            <ul class="list-disc list-inside text-xs sm:text-sm text-ink2 space-y-1.5 pl-2">
              <li>Configurar tu <strong class="text-maroon">Nombre de Parroquiano o Iglesia</strong> personal.</li>
              <li>Definir una <strong class="text-maroon">Institución o Parroquia Personalizada</strong> para firmar e infocultar tus infografías.</li>
              <li>Añadir tu propio <strong class="text-maroon">Logotipo Oficial</strong> para tus materiales diocesanos.</li>
              <li>Gestionar y probar diferentes <strong class="text-maroon">Planes de Acceso</strong> (Free, Premium, Admin).</li>
            </ul>
          </div>

          <div class="flex flex-col gap-3">
            <a href="/login-admin-bypass?redirect=/ajustes" class="w-full text-center text-xs bg-maroon hover:bg-gold text-white py-3.5 rounded-xl font-bold uppercase tracking-wider transition duration-300 shadow flex items-center justify-center gap-1.5">
              🔑 Acceso Rápido como Administrador
            </a>
            <div class="flex gap-2">
              <a href="/login" class="flex-1 text-center text-xs border border-maroon text-maroon hover:bg-maroon/5 py-3 rounded-xl font-semibold uppercase tracking-wider transition">
                Ingresar
              </a>
              <a href="/register" class="flex-1 text-center text-xs border border-maroon text-maroon hover:bg-maroon/5 py-3 rounded-xl font-semibold uppercase tracking-wider transition">
                Registrarse
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    return res.send(renderPage('Ajustes de Perfil', htmlContent, req));
  }

  // Si está autenticado, cargamos los valores actuales
  const customNombreVal = user.customNombre || '';
  const customLogoVal = user.customLogo || '';
  const isMsg = req.query.saved === 'true' ? `
    <div class="max-w-2xl mx-auto w-[95%] sm:w-full mt-4 bg-green-50 border border-green-200 text-green-800 text-xs sm:text-sm p-4 rounded-xl flex items-center gap-2 mb-4 animate-fade-in">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span>¡Ajustes actualizados exitosamente en la base de datos y sincronizados con Firestore!</span>
    </div>
  ` : '';

  const htmlContent = `
    <div class="max-w-2xl mx-auto w-[95%] sm:w-full px-4 py-10 flex flex-col gap-4">
      ${isMsg}

      <div class="bg-white border rounded-2xl p-6 sm:p-10 shadow-sm flex flex-col gap-6 sacred-border animate-fade-in">
        <div class="text-center pb-4 border-b">
          <h2 class="font-display font-black text-2xl text-maroon tracking-wider">Ajustes de Perfil y Cuenta</h2>
          <p class="text-ink2 text-xs sm:text-sm font-serif italic mt-1">Configura la personalización de tu cuenta y el marcado institucional.</p>
        </div>

        <form method="POST" action="/ajustes" class="flex flex-col gap-5 text-xs sm:text-sm">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div class="flex flex-col gap-1.5">
              <label class="font-bold text-espresso flex items-center gap-1">
                <span>Tu Nombre Completo</span>
                <span class="text-red-600 font-bold">*</span>
              </label>
              <input type="text" name="nombre" required value="${user.nombre || ''}" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent bg-[#FAF9F5]/40" placeholder="Ej. Pbro. Carlos Mendoza">
              <p class="text-[10px] text-ink2">Tu nombre tal como aparecerá en tu perfil de usuario.</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-bold text-espresso flex items-center gap-1">
                <span>Parroquia / Organización Católica</span>
              </label>
              <input type="text" name="customNombre" value="${customNombreVal}" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent bg-[#FAF9F5]/40" placeholder="Ej. Parroquia Santo Tomás de Aquino">
              <p class="text-[10px] text-ink2">Utilizada para firmar legalmente las infografías y recursos con sello institucional.</p>
            </div>

          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div class="flex flex-col gap-1.5">
              <label class="font-bold text-espresso flex items-center gap-1">
                <span>Dirección URL de tu Logotipo</span>
              </label>
              <input type="url" name="customLogo" value="${customLogoVal}" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent bg-[#FAF9F5]/40" placeholder="https://miwebparroquial.org/logo.png">
              <p class="text-[10px] text-ink2">Enlace directo a la imagen (.png, .webp o .jpg) de tu escudo o logotipo parroquial.</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-bold text-espresso flex items-center gap-1">
                <span>Plan de Acceso habilitado</span>
              </label>
              <select name="plan" class="border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold focus:border-transparent bg-white">
                <option value="free" ${user.plan === 'free' ? 'selected' : ''}>Plan Gratuito (Límites diarios)</option>
                <option value="premium" ${user.plan === 'premium' ? 'selected' : ''}>Plan Premium (Infografías ilimitadas)</option>
                <option value="admin" ${user.plan === 'admin' ? 'selected' : ''}>Administrador (Control total)</option>
              </select>
              <p class="text-[10px] text-ink2">Alterna libremente tu plan para probar límites y cuotas en este entorno de desarrollo.</p>
            </div>

          </div>

          <!-- DETALLES ADICIONALES DE LA CUENTA -->
          <div class="bg-[#FAF9F5]/80 rounded-xl p-4 border border-border/80 flex flex-col gap-1 text-xs select-none">
            <p class="font-bold text-espresso">Identificador de cuenta:</p>
            <p class="font-mono text-[10px] text-ink2 truncate">${user.id}</p>
            <p class="font-bold text-espresso mt-1.5">Correo Electrónico:</p>
            <p class="text-[#594e46]">${user.email}</p>
          </div>

          <div class="flex gap-3 justify-end pt-4 border-t mt-2">
            <a href="/" class="px-5 py-2.5 border border-[#e6dfd4] hover:bg-[#FAF9F5] text-[#2d241e] rounded-lg font-semibold transition text-xs sm:text-sm text-center">
              Volver al asistente
            </a>
            <button type="submit" class="px-6 py-2.5 bg-maroon hover:bg-gold text-white font-bold rounded-lg transition text-xs sm:text-sm shadow flex items-center justify-center gap-1">
              Guardar Ajustes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  return res.send(renderPage('Ajustes de Perfil', htmlContent, req));
});

// ── POST /ajustes (Procesar cambios en el Perfil) ──
app.post('/ajustes', (req, res) => {
  const user = getAuthedUser(req);
  if (!user) return res.status(401).send('No autorizado');

  const { nombre, customNombre, customLogo, plan } = req.body;
  
  if (!nombre || nombre.trim() === '') {
    return res.status(400).send('El nombre completo es un campo obligatorio.');
  }

  try {
    auth.updateUser(user.id, {
      nombre: nombre.trim(),
      customNombre: customNombre && customNombre.trim() !== '' ? customNombre.trim() : null,
      customLogo: customLogo && customLogo.trim() !== '' ? customLogo.trim() : null,
      plan: plan || user.plan
    });

    res.redirect('/ajustes?saved=true');
  } catch(e) {
    res.status(500).send(`Error al actualizar ajustes: ${e.message}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO RUTA ADMINISTRATOR: CONSOLA GENERADORA DE INFOGRAFÍAS
// Soportando subir a Cloudinary o URL, custom logo e Iglesia
// ════════════════════════════════════════════════════════════════════════════

// Helper: Escape HTML to safely embed JSON/data attributes in templates
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/admin', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') {
    return res.status(403).send(renderPage('No autorizado', `<div class="p-12 text-center text-ink flex flex-col justify-center items-center gap-4 max-w-md mx-auto my-12 bg-white border border border-[#E6DFD4] rounded-2xl shadow-sm">
      <div class="text-3xl text-maroon">⚠️</div>
      <p class="font-bold text-espresso text-base">Consola exclusiva para el Administrador.</p>
      <p class="text-xs text-ink2">Si las cookies normales del navegador se bloquean en el iframe de previsualización, usa este botón para iniciar sesión automáticamente y autorizar tu acceso al instante:</p>
      <div class="flex flex-col gap-2.5 w-full mt-4">
        <a href="/login-admin-bypass" class="bg-maroon hover:bg-gold text-white text-xs font-bold py-3 px-4 rounded-xl transition uppercase tracking-wider block shadow-sm">
          🔑 Entrar automáticamente como Administrador (sellerplusco)
        </a>
        <a href="/login" class="text-xs border border-border text-espresso hover:bg-cream2 py-2.5 px-4 rounded-xl transition font-bold block bg-cream">
          Loguearse con otra cuenta
        </a>
      </div>
    </div>`, req));
  }

  const catalog = infografias.loadCatalog();
  const blogCatalog = blog.loadBlog();
  const videosCatalog = videos.loadVideos();
  const podcastsCatalog = podcast.loadPodcasts();
  const cloudName = CLOUDINARY_CLOUD_NAME;

  const html = `
    <div class="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b pb-6 gap-4">
        <div class="flex flex-col">
          <h1 class="font-display font-bold text-3xl text-maroon tracking-wide">Consola de Administración Central</h1>
          <p class="text-ink-2 text-sm font-serif italic">Administra los recursos pastorales de CatólicosGPT: Infografías, Artículos de Blog con SEO IA, Videos y Podcasts de Spotify.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs bg-gold text-white py-1 px-3.5 rounded font-mono font-bold uppercase tracking-widest">Admin central</span>
          <a href="/logout" class="text-xs border border-maroon text-maroon hover:bg-maroon hover:text-white py-1 px-3 rounded transition font-bold">Cerrar Sesión</a>
        </div>
      </div>

      <!-- SISTEMA DE TABS INTERACTIVO -->
      <div class="flex border-b border-[#E6DFD4] overflow-x-auto whitespace-nowrap gap-1">
        <button onclick="switchTab('infografias')" id="tab-btn-infografias" class="tab-btn px-5 py-3 font-semibold text-sm border-b-2 border-transparent text-ink-2 hover:text-maroon transition flex items-center gap-2">
          🎨 Infografías (${catalog.infografias.length})
        </button>
        <button onclick="switchTab('blog')" id="tab-btn-blog" class="tab-btn px-5 py-3 font-semibold text-sm border-b-2 border-transparent text-ink-2 hover:text-maroon transition flex items-center gap-2">
          ✍️ Blog de Formación (${blogCatalog.posts.length})
        </button>
        <button onclick="switchTab('videos')" id="tab-btn-videos" class="tab-btn px-5 py-3 font-semibold text-sm border-b-2 border-transparent text-ink-2 hover:text-maroon transition flex items-center gap-2">
          🎥 Videos Curados (${videosCatalog.videos.length})
        </button>
        <button onclick="switchTab('podcasts')" id="tab-btn-podcasts" class="tab-btn px-5 py-3 font-semibold text-sm border-b-2 border-transparent text-ink-2 hover:text-maroon transition flex items-center gap-2">
          🎙️ Podcasts Spotify (${podcastsCatalog.podcasts.length})
        </button>
        <button onclick="switchTab('santoral')" id="tab-btn-santoral" class="tab-btn px-5 py-3 font-semibold text-sm border-b-2 border-transparent text-ink-2 hover:text-maroon transition flex items-center gap-2">
          ⛪ Santoral (${santoral.getAllSaints().length})
        </button>
      </div>

      <!-- TAB SECTIONS -->

      <!-- 1. INFOGRAFÍAS -->
      <div id="tab-content-infografias" class="tab-pane hidden flex flex-col gap-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="grid grid-cols-1 gap-6">
          <!-- Creador de Infografías Cloudinary (Soporte Carrusel & SEO IA) -->
          <div class="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 class="font-display font-semibold text-espresso text-lg border-b pb-2 flex items-center gap-2">
              📥 Registrar Infografía (URLs de Cloudinary / Carrusel)
            </h3>
            <p class="text-ink-2 text-xs leading-relaxed">Sube o ingresa múltiples imágenes de tu carrusel e incorpora meta-descripciones y palabras clave optimizadas por Inteligencia Artificial.</p>
            
            <form method="POST" action="/admin/crear-infografia-manual" id="infografiaManualForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm mt-2">
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">Título de la Infografía</label>
                <input type="text" name="titulo" id="seo_titulo" required placeholder="Ej: Los 7 Sacramentos de la Iglesia" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">Tema / Santo o Enfoque</label>
                <input type="text" name="tema" id="seo_tema" required placeholder="Ej: Doctrina sacramental" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Categoría</label>
                <select name="categoria" id="seo_categoria" class="border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
                  <option value="doctrinal">Doctrina oficial</option>
                  <option value="santo">Vida de Santos</option>
                  <option value="devocional">Devoción y Plegarias</option>
                  <option value="serie">Serie de Formación</option>
                </select>
              </div>

              <div class="flex flex-col gap-2.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs flex items-center justify-between">
                  <span>Imágenes / Carrusel de Diapositivas (Máximo 10 imágenes)</span>
                  <span class="text-xs text-ink-2 font-mono">Total añadidas: <span id="manual-images-count" class="text-maroon font-bold bg-[#E6DFD4]/50 px-2 py-0.5 rounded">1</span> / 10</span>
                </label>

                <div class="flex items-center justify-between flex-wrap gap-3 border border-gold/25 bg-[#FFFCF4] rounded-xl p-3">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-bold text-espresso">Biblioteca Cloudinary conectada</span>
                    <span class="text-[10px] text-ink-2">Selecciona imágenes desde ${cloudName}; se agregan al carrusel sin copiar URLs.</span>
                  </div>
                  <button type="button" onclick="openCloudinaryExplorer('infografias')" class="text-xs bg-maroon hover:bg-gold text-white py-2 px-4 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer border-0">
                    ☁️ Seleccionar imágenes
                  </button>
                </div>
                
                <div id="manual-images-container" class="flex flex-col gap-3.5">
                  <!-- Primera fila estática para asegurar visualización el 100% de las veces en carga limpia -->
                  <div class="manual-image-row bg-cream/40 border border-border/60 rounded-xl p-3 flex flex-col gap-3 w-full" id="manual-row-1">
                    <div class="flex items-center justify-between border-b border-border/40 pb-1.5">
                      <span class="text-xs font-bold text-espresso font-mono">Imagen #<span class="row-number">1</span></span>
                      <span class="text-[10px] text-ink-2 font-serif bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">✓ Portada inicial</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div class="flex flex-col gap-1 w-full">
                        <label class="font-semibold text-espresso">URL de la Imagen Cloudinary</label>
                        <input type="text" name="imageUrls[]" required placeholder="https://res.cloudinary.com/..." class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full" oninput="previewImage('manual-row-1')">
                      </div>
                      <div class="flex flex-col gap-1 w-full">
                        <label class="font-semibold text-espresso">Texto Alt de la Imagen (SEO)</label>
                        <input type="text" name="imageAlts[]" required placeholder="Ej: Diapositiva sobre la teología de este tema" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full">
                      </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div class="flex flex-col gap-1">
                        <label class="font-semibold text-espresso">Nombre de archivo (opcional)</label>
                        <input type="text" name="imageNames[]" placeholder="ej: slide-1.jpg" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full">
                      </div>
                      <div class="flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0 pb-0.5">
                        <input type="hidden" name="imageWidths[]" value="1200">
                        <input type="hidden" name="imageHeights[]" value="1200">
                        <input type="hidden" name="imageCovers[]" class="row-cover-flag" value="1">
                        <label class="flex items-center gap-1.5 font-semibold text-espresso cursor-pointer select-none">
                          <input type="radio" name="imageCoverRadio" class="accent-maroon cursor-pointer scale-110" checked onchange="updateCoverFlagsManual('manual-row-1')">
                          Usar como portada
                        </label>
                        <div class="image-preview-container hidden ml-auto border border-border rounded bg-white p-0.5">
                          <img class="image-preview-img w-9 h-9 object-cover rounded" referrerPolicy="no-referrer">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Controladores de adición rápida y limpia -->
                <div class="flex items-center justify-between flex-wrap gap-2.5 mt-1 border border-dashed border-gold/30 p-3 rounded-xl bg-[#fefdfa]">
                  <span class="text-xs text-espresso font-bold">⚡ Agregar más imágenes/diapositivas:</span>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="addMultipleImages(1)" class="text-xs bg-[#1A412A] hover:bg-[#2E5E3D] text-white py-1.5 px-3.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer">
                      ➕ Añadir +1
                    </button>
                    <button type="button" onclick="addMultipleImages(3)" class="text-xs bg-[#BC8A36] hover:bg-[#a6792f] text-white py-1.5 px-3.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer">
                      ➕ Añadir +3
                    </button>
                    <button type="button" onclick="addMultipleImages(5)" class="text-xs bg-[#5E1B22] hover:bg-[#4d141a] text-white py-1.5 px-3.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer">
                      ➕ Añadir +5
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Tipo de Visualización Predeterminada</label>
                <select name="tipoVisualizacion" class="border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
                  <option value="continua" selected>Continua (Todas las imágenes verticales - Recomendada)</option>
                  <option value="carrusel">Carrusel (Visor de diapositivas interactivo)</option>
                  <option value="cuadricula">Cuadrícula (Galería compacta con Lightbox expansor)</option>
                </select>
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2 pt-2 border-t mt-1">
                <div class="flex items-center justify-between">
                  <label class="font-semibold text-espresso text-xs">Meta Descripción SEO</label>
                  <button type="button" onclick="generarSeoConIA()" id="btnGenerarSeo" class="bg-gold text-white text-[10px] px-3 py-1 rounded-md font-bold uppercase tracking-wider hover:bg-espresso transition flex items-center gap-1.5 border-0 cursor-pointer">
                    ✨ Generar SEO con IA
                  </button>
                </div>
                <textarea name="metaDescription" id="seo_desc" required placeholder="Presiona el botón superior para autogenerar o escribe un resumen para Google..." rows="2" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs"></textarea>
              </div>
              
              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Palabras clave (SEO, separadas por coma)</label>
                <input type="text" name="keywords" id="seo_keywords" placeholder="Presiona Generar SEO para autocompletar..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
              </div>

              <div class="md:col-span-2 pt-2 border-t">
                <button type="submit" class="w-full bg-[#1A412A] hover:bg-[#2E5E3D] text-white font-bold py-2.5 rounded-lg transition uppercase tracking-wider shadow duration-300 text-xs border-0 cursor-pointer">
                  Guardar en Catálogo General &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>

        <script>
          let manualRowIndex = 1; // Ya iniciamos con la fila 1 estática cargada
          function addManualImageRow(url = '') {
            const container = document.getElementById('manual-images-container');
            if (!container) return;
            
            // Validar límite manual máximo de 10 imágenes
            const existingRows = document.querySelectorAll('.manual-image-row');
            if (existingRows.length >= 10) {
              alert('⚠️ Se ha alcanzado el límite máximo recomendado de 10 imágenes por carrusel / infografía.');
              return;
            }

            const rowId = 'manual-row-' + (++manualRowIndex);
            
            const blockHtml = \`
              <div class="manual-image-row bg-cream/40 border border-border/60 rounded-xl p-3 flex flex-col gap-3 w-full" id="\${rowId}">
                <div class="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <span class="text-xs font-bold text-espresso font-mono">Imagen #<span class="row-number"></span></span>
                  <button type="button" onclick="removeManualImageRow('\${rowId}')" class="text-red-700 hover:text-red-900 text-xs font-bold cursor-pointer transition border-0 bg-transparent">✕ Eliminar</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div class="flex flex-col gap-1 w-full">
                    <label class="font-semibold text-espresso">URL de la Imagen Cloudinary</label>
                    <input type="text" name="imageUrls[]" required value="\${url}" placeholder="https://res.cloudinary.com/..." class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full" oninput="previewImage('\${rowId}')">
                  </div>
                  <div class="flex flex-col gap-1 w-full">
                    <label class="font-semibold text-espresso">Texto Alt de la Imagen (SEO)</label>
                    <input type="text" name="imageAlts[]" required placeholder="Ej: Diapositiva sobre la teología de este tema" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full">
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso">Nombre de archivo (opcional)</label>
                    <input type="text" name="imageNames[]" placeholder="ej: slide-1.jpg" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-gold text-xs bg-white w-full">
                  </div>
                  <div class="flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0">
                    <input type="hidden" name="imageWidths[]" value="1200">
                    <input type="hidden" name="imageHeights[]" value="1200">
                    <input type="hidden" name="imageCovers[]" class="row-cover-flag" value="0">
                    <label class="flex items-center gap-1.5 font-semibold text-espresso cursor-pointer select-none">
                      <input type="radio" name="imageCoverRadio" class="accent-maroon cursor-pointer scale-110" onchange="updateCoverFlagsManual('\${rowId}')">
                      Usar como portada
                    </label>
                    <div class="image-preview-container hidden ml-auto border border-border rounded bg-white p-0.5">
                      <img class="image-preview-img w-9 h-9 object-cover rounded" referrerPolicy="no-referrer">
                    </div>
                  </div>
                </div>
              </div>
            \`;

            container.insertAdjacentHTML('beforeend', blockHtml);
            reindexManualRows();
            previewImage(rowId);
          }

          function removeManualImageRow(rowId) {
            const row = document.getElementById(rowId);
            if (row) {
              row.remove();
              reindexManualRows();
            }
          }

          function addMultipleImages(count) {
            const existingRows = document.querySelectorAll('.manual-image-row');
            const currentCount = existingRows.length;
            if (currentCount >= 10) {
              alert('⚠️ Ya alcanzaste el límite absoluto de 10 imágenes por carrusel / diapositiva.');
              return;
            }
            if (currentCount + count > 10) {
              const allowed = 10 - currentCount;
              alert('⚠️ Solo se agregarán ' + allowed + ' imágenes más para no exceder el límite máximo de 10 diapositivas por infografía.');
              count = allowed;
            }
            for (let i = 0; i < count; i++) {
              addManualImageRow();
            }
          }

          function reindexManualRows() {
            const allRows = document.querySelectorAll('.manual-image-row');
            
            // Actualizar contador del banner superior en tiempo real
            const countLabel = document.getElementById('manual-images-count');
            if (countLabel) {
              countLabel.innerText = allRows.length;
            }

            allRows.forEach((row, index) => {
              const numSpan = row.querySelector('.row-number');
              if (numSpan) numSpan.innerText = index + 1;
              
              const altInput = row.querySelector('input[name="imageAlts[]"]');
              if (altInput && !altInput.placeholder) {
                altInput.placeholder = 'Ej: Diapositiva ' + (index + 1) + ' — Imagen formativa';
              }
              const nameInput = row.querySelector('input[name="imageNames[]"]');
              if (nameInput && !nameInput.placeholder) {
                nameInput.placeholder = 'slide-' + (index + 1) + '.jpg';
              }
            });
          }

          function updateCoverFlagsManual(activeRowId) {
            const rows = document.querySelectorAll('.manual-image-row');
            rows.forEach(row => {
              const flag = row.querySelector('.row-cover-flag');
              if (flag) {
                flag.value = row.id === activeRowId ? '1' : '0';
              }
            });
          }

          function previewImage(rowId) {
            const row = document.getElementById(rowId);
            if (!row) return;
            const urlInput = row.querySelector('input[name="imageUrls[]"]');
            const url = urlInput ? urlInput.value.trim() : '';
            const previewContainer = row.querySelector('.image-preview-container');
            const previewImg = row.querySelector('.image-preview-img');
            
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              if (previewImg) previewImg.src = url;
              if (previewContainer) previewContainer.classList.remove('hidden');
            } else {
              if (previewContainer) previewContainer.classList.add('hidden');
            }
          }

          async function generarSeoConIA() {
            const titulo = document.getElementById('seo_titulo').value.trim();
            const tema = document.getElementById('seo_tema').value.trim();
            const categoria = document.getElementById('seo_categoria').value;
            
            if (!titulo) {
              alert('Por favor ingresa primero el Título para poder generar el SEO.');
              return;
            }
            
            const btn = document.getElementById('btnGenerarSeo');
            const origHtml = btn.innerHTML;
            btn.innerHTML = '✨ Generando...';
            btn.disabled = true;
            
            try {
              const res = await fetch('/api/seo/generar-seo-infografia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titulo, tema, categoria })
              });
              const data = await res.json();
              if (data.error) {
                alert('Inconveniente al generar con IA: ' + data.error);
              } else {
                if (data.metaDescription) {
                  document.getElementById('seo_desc').value = data.metaDescription;
                }
                if (data.keywords) {
                  document.getElementById('seo_keywords').value = data.keywords;
                }
                if (data.warning) {
                  alert(data.warning);
                }
              }
            } catch(e) {
              alert('Error conectando con el servidor teológico.');
            } finally {
              btn.innerHTML = origHtml;
              btn.disabled = false;
            }
          }
        </script>
        </div>

        <!-- Lista -->
        <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h3 class="font-display font-semibold text-espresso text-base flex items-center justify-between">
            <span>📋 Catálogo de Infografías Activas</span>
            <span class="text-xs text-ink-2 font-serif">${catalog.infografias.length} elementos</span>
          </h3>
          <div class="max-h-[300px] overflow-y-auto border border-border rounded-xl divide-y text-xs">
            ${catalog.infografias.length === 0 ? '<div class="p-4 text-center text-ink-2 italic">Sin infografías en memoria. Genera una o agrégala manualmente.</div>' : 
              catalog.infografias.map(i => `
                <div class="p-3 flex items-center justify-between hover:bg-cream/10">
                  <div class="flex items-center gap-3 truncate max-w-xl">
                    <img src="${(i.imagenes && i.imagenes[0] && i.imagenes[0].url) || ''}" class="w-10 h-10 object-cover rounded border bg-cream-2">
                    <div class="flex flex-col gap-0.5 truncate">
                      <span class="font-bold text-espresso">${i.titulo || i.tema}</span>
                      <span class="text-[10px] text-ink-2 truncate">Slug: <strong class="text-maroon">${i.slug}</strong> | Categoría: ${i.categoria || i.tipo}</span>
                      <code class="text-[10px] bg-[#F8F5EE] border border-border rounded px-2 py-1 text-maroon font-mono select-all">[infografia:${i.slug}]</code>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    ${i.esInfografiaDelDia ? `
                      <span class="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                        🌟 Infografía del Día
                      </span>
                    ` : `
                      <a href="/admin/marcar-infografia-del-dia?slug=${i.slug}" class="text-[10px] text-amber-700 hover:text-amber-900 border border-amber-300 hover:bg-amber-50 px-2 py-0.5 rounded-md transition font-semibold">
                        🌟 Marcar del Día
                      </a>
                    `}
                    <button type="button" onclick="copyShortcode('[infografia:${i.slug}]')" class="text-[10px] text-espresso hover:text-maroon border border-border px-2 py-0.5 rounded-md font-bold bg-white cursor-pointer">Copiar shortcode</button>
                    <a href="/infografias/${i.slug}" target="_blank" class="text-maroon font-bold hover:underline">Ver</a>
                    <a href="/admin/eliminar-infografia?id=${i.id}" onclick="return confirm('¿Eliminar definitivamente?')" class="text-red-700 hover:underline">Eliminar</a>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>

      <!-- 2. BLOG DE FORMACIÓN -->
      <div id="tab-content-blog" class="tab-pane hidden flex flex-col gap-6">
        <div class="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div class="border-b pb-2 flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-2">
            <h3 id="blog_form_title" class="font-display font-semibold text-espresso text-lg flex items-center gap-2">
              ✍️ Crear / Editar Artículo de Formación Teológica
            </h3>
            <span class="text-xs text-gold font-bold">Generación de SEO con Inteligencia Artificial Integrada</span>
          </div>
          <p class="text-ink-2 text-xs leading-relaxed">Escribe un post de formación utilizando Markdown. Puedes pegar código HTML crudo si vas a meter tablas o diseños personalizados. Puedes enlazar recursos con los shortcodes: <code class="font-mono bg-cream-2 px-1 text-maroon">[infografia:slug]</code>, <code class="font-mono bg-cream-2 px-1 text-maroon">[video:slug]</code> o <code class="font-mono bg-cream-2 px-1 text-maroon">[podcast:slug]</code>.</p>
          
          <form method="POST" action="/admin/crear-blog" id="blogForm" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm mt-1">
            <input type="hidden" name="blog_original_slug" id="blog_original_slug" value="">

            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="font-semibold text-espresso text-xs">Título del Artículo</label>
              <input type="text" name="titulo" id="blog_titulo" required placeholder="Ej: La Presencia Real de Cristo en la Eucaristía según San Agustín" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-semibold text-espresso text-xs">Categoría Principal de Formación</label>
              <select name="categoria" id="blog_categoria" class="border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
                <option value="catequesis">Catequesis & Doctrina</option>
                <option value="liturgia">Liturgia & Santa Misa</option>
                <option value="espiritualidad">Espiritualidad & Oración</option>
                <option value="santos">Vida de los Santos</option>
                <option value="biblia">Sagradas Escrituras (Biblia)</option>
                <option value="magisterio">Magisterio de la Iglesia</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-espresso text-xs">Imagen de Portada (Opcional)</label>
                <div class="flex gap-2">
                  <input type="text" name="imagenPortada" id="blog_imagen_portada" placeholder="https://res.cloudinary.com/usuario/image/upload/..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs flex-1 bg-white">
                  <button type="button" onclick="openCloudinaryExplorer('blog_cover')" class="bg-maroon hover:bg-gold text-white px-3.5 py-2 rounded-lg font-bold text-xs transition cursor-pointer border-0">
                    ☁️ Portada
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <label class="font-semibold text-espresso text-xs">Contenido del Post (Soporta Markdown, texto plano y código HTML para tablas o diseños personalizados)</label>
                <div class="flex items-center gap-2">
                  <button type="button" onclick="openHtmlEditor('blog_content_editor')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm border-0">
                    🌐 Editor HTML Integrado
                  </button>
                  <button type="button" onclick="openCloudinaryExplorer('blog_content')" class="text-maroon border border-maroon hover:bg-maroon hover:text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer transition-all">
                    ☁️ Insertar Imagen Cloudinary
                  </button>
                </div>
              </div>
              <textarea name="contenidoMd" id="blog_content_editor" required rows="9" placeholder="# Título del Post\n\nContenido teológico y formativo...\n\n### Sacramentos de Iniciación\nDescribe el corpus del post utilizando formato estandar.\n\nPuedes incrustar una infografía escribiendo [infografia:slug-de-la-infografia] o videos con [video:slug-del-video]" class="border border-border rounded-lg px-4 py-2 font-mono outline-none focus:ring-2 focus:ring-gold text-xs bg-white"></textarea>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-3 bg-cream/40 p-4 border border-dashed rounded-xl gap-2">
              <div class="flex items-center gap-2">
                <input type="checkbox" name="useAiS_SEO" id="useAiS_SEO" value="1" checked class="w-4 h-4 text-maroon focus:ring-gold accent-maroon">
                <label for="useAiS_SEO" class="font-semibold text-espresso text-xs cursor-pointer select-none">Enriquecer SEO con IA de Gemini de fondo automáticamente al guardar</label>
              </div>
              <p class="text-[10px] text-ink-2 pl-6">Al dejar activada esta casilla, el motor de Gemini analizará tu título y contenido para redactar un título optimizado SEO, una meta-descripción amigable, palabras claves exactas católicas y extraer el lead del artículo de manera automatizada de inmediato.</p>
            </div>

            <div class="md:col-span-3 flex gap-2.5 mt-2">
              <button type="submit" id="blog_submit_btn" class="flex-1 bg-maroon hover:bg-gold text-white font-bold py-2.5 rounded-lg transition uppercase tracking-wider shadow duration-300 text-xs border-0 cursor-pointer">
                Publicar Artículo Formativo &rarr;
              </button>
              <button type="button" onclick="resetBlogForm()" class="px-5 py-2.5 bg-[#E6DFD4] hover:bg-[#D1C7BD] text-espresso font-bold text-xs uppercase tracking-wider rounded-lg transition duration-200 cursor-pointer border-0">
                Limpiar Formulario
              </button>
            </div>
          </form>
        </div>

        <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div class="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-2 border-b pb-2">
            <h3 class="font-display font-semibold text-espresso text-base flex items-center gap-2">
              📋 Artículos de Blog Publicados (<span id="total-blog-count">-</span>)
            </h3>
            <div class="w-full sm:w-auto flex items-center gap-2">
              <span class="text-xs text-espresso font-semibold">🔍 Buscar:</span>
              <input type="text" id="blog-search-input" oninput="filterAdminBlogs()" placeholder="Buscar por título o categoría..." class="border border-border rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-gold bg-[#fefdfa] w-full sm:w-60">
            </div>
          </div>
          
          <div id="admin-blog-list-container" class="max-h-[500px] overflow-y-auto border border-border rounded-xl divide-y text-xs bg-white">
            <div class="p-8 text-center text-ink-2 italic flex items-center justify-center gap-2.5">
              <div class="animate-spin rounded-full h-4.5 w-4.5 border-2 border-maroon border-t-transparent"></div>
              <span>Cargando artículos formativos de la biblioteca teológica...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. CANALES Y VIDEOS (YOUTUBE) -->
      <div id="tab-content-videos" class="tab-pane hidden flex flex-col gap-6">
        <div class="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 class="font-display font-semibold text-espresso text-lg border-b pb-2">
            🎥 Agregar Video Formativo (YouTube Embed)
          </h3>
          <p class="text-ink-2 text-xs leading-relaxed">Inserta el enlace del video o el ID de YouTube. El sistema generará el embed correspondiente para enlazarlo en el chat o en la página de videos.</p>
          
          <form method="POST" action="/admin/crear-video" id="crearVideoForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm mt-1">
            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="font-semibold text-espresso text-xs">Título del Video</label>
              <input type="text" name="titulo" id="video_titulo" required placeholder="Ej: Las partes de la Misa explicadas" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="font-semibold text-espresso text-xs">ID de YouTube o Link Completo</label>
                <button type="button" onclick="openCloudinaryExplorer('videos')" class="text-maroon border border-maroon hover:bg-maroon hover:text-white px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer transition-all">
                  ☁️ Importar Video Cloudinary
                </button>
              </div>
              <input type="text" name="youtubeId" id="video_youtube_id" required placeholder="Ej: wD1Vp83b4B0 o link de Cloudinary/YT..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-semibold text-espresso text-xs">Nombre del Canal o Autor</label>
              <input type="text" name="canal" id="video_canal" placeholder="Ej: Catholic Link o Cloudinary" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-semibold text-espresso text-xs">Categoría Teológica</label>
              <select name="categoria" class="border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
                <option value="liturgia">Liturgia y Santa Misa</option>
                <option value="apologetica">Apologética</option>
                <option value="catequesis">Catequesis General</option>
                <option value="musica">Música Sacra / Fe</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="font-semibold text-espresso text-xs">Comentario Formativo (SEO y recomendación de chat)</label>
              <textarea name="comentario" required rows="2" placeholder="Describe brevemente de qué trata este video..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs"></textarea>
            </div>

            <div class="md:col-span-2 pt-2">
              <button type="submit" class="w-full bg-[#320E12] hover:bg-gold text-white font-bold py-2.5 rounded-lg transition uppercase tracking-wider shadow duration-300 text-xs">
                Guardar Video en Servidor &rarr;
              </button>
            </div>
          </form>
        </div>

        <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h3 class="font-display font-semibold text-espresso text-base">📋 Catálogo de Videos Curados</h3>
          <div class="max-h-[300px] overflow-y-auto border border-border rounded-xl divide-y text-xs">
            ${videosCatalog.videos.length === 0 ? '<div class="p-4 text-center text-ink-2 italic">Sin videos curados. Añade uno arriba.</div>' : 
              videosCatalog.videos.map(v => `
                <div class="p-3 flex items-center justify-between hover:bg-cream/10">
                  <div class="flex items-center gap-3 truncate max-w-xl">
                    <img src="https://img.youtube.com/vi/${v.youtubeId}/default.jpg" class="w-12 h-9 object-cover rounded border">
                    <div class="flex flex-col gap-0.5 truncate">
                      <span class="font-bold text-espresso">${v.titulo}</span>
                      <span class="text-[10px] text-ink-2 truncate">Slug: <strong class="text-maroon">${v.slug}</strong> | Canal: ${v.canal} | Comentario: ${v.comentario}</span>
                      <code class="text-[10px] bg-[#F8F5EE] border border-border rounded px-2 py-1 text-maroon font-mono select-all">[video:${v.slug}]</code>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <button type="button" onclick="copyShortcode('[video:${v.slug}]')" class="text-[10px] text-espresso hover:text-maroon border border-border px-2 py-0.5 rounded-md font-bold bg-white cursor-pointer">Copiar shortcode</button>
                    <a href="/admin/eliminar-video?id=${v.id}" onclick="return confirm('¿Eliminar definitivamente este video?')" class="text-red-700 hover:underline">Eliminar</a>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>

      <!-- 4. PODCASTS (SPOTIFY) -->
      <div id="tab-content-podcasts" class="tab-pane hidden flex flex-col gap-6">
        <div class="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 class="font-display font-semibold text-espresso text-lg border-b pb-2">
            🎙️ Agregar Episodio o Show de Podcast (Spotify Embed)
          </h3>
          <p class="text-ink-2 text-xs leading-relaxed">Inserta el link de Spotify de un show o episodio completo. El sistema autocompondrá el reproductor flotante interactivo.</p>
          
          <form method="POST" action="/admin/crear-podcast" id="crearPodcastForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm mt-1">
            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="font-semibold text-espresso text-xs">Título del Podcast / Audio</label>
              <input type="text" name="titulo" id="podcast_titulo" required placeholder="Ej: La Biblia en un año — Episodio 1" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-2">
              <div class="flex items-center justify-between">
                <label class="font-semibold text-espresso text-xs">Enlace de Spotify / Audio Local o Código Iframe</label>
                <button type="button" onclick="openCloudinaryExplorer('podcasts')" class="text-maroon border border-maroon hover:bg-maroon hover:text-white px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer transition-all">
                  ☁️ Importar Audio Cloudinary
                </button>
              </div>
              <input type="text" name="spotifyUrl" id="podcast_spotify_url" required placeholder="Ej: https://open.spotify.com/show/4O7IitE99w5nO2n6B7tYfW o url de Cloudinary..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-semibold text-espresso text-xs">Autor o Expositor</label>
              <input type="text" name="autor" id="podcast_autor" placeholder="Ej: Fr. Mike Schmitz o Cloudinary" class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-semibold text-espresso text-xs">Categoría</label>
              <select name="categoria" class="border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs">
                <option value="biblia">Biblia y Sagradas Escrituras</option>
                <option value="catecismo">El Catecismo</option>
                <option value="oracion">Oración y Meditación</option>
                <option value="apologetica">Apologética</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label class="font-semibold text-espresso text-xs">Descripción del Episodio (Sinopsis para el buscador)</label>
              <textarea name="descripcion" required rows="2" placeholder="Detalla de qué trata este audio..." class="border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs"></textarea>
            </div>

            <div class="md:col-span-2 pt-2">
              <button type="submit" class="w-full bg-[#1A412A] hover:bg-gold text-white font-bold py-2.5 rounded-lg transition uppercase tracking-wider shadow duration-300 text-xs">
                Incrustar Podcast &rarr;
              </button>
            </div>
          </form>
        </div>

        <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <h3 class="font-display font-semibold text-espresso text-base">📋 Podcasts en Canales</h3>
          <div class="max-h-[300px] overflow-y-auto border border-border rounded-xl divide-y text-xs">
            ${podcastsCatalog.podcasts.length === 0 ? '<div class="p-4 text-center text-ink-2 italic">Sin podcasts creados. ¡Añade tu canal arriba!</div>' : 
              podcastsCatalog.podcasts.map(p => `
                <div class="p-3 flex items-center justify-between hover:bg-cream/10">
                  <div class="flex flex-col gap-0.5 truncate max-w-xl">
                    <span class="font-bold text-espresso">${p.titulo}</span>
                    <span class="text-[10px] text-ink-2 truncate">Slug: <strong class="text-maroon">${p.slug}</strong> | Autor: ${p.autor} | Categoría: ${p.categoria}</span>
                    <code class="text-[10px] bg-[#F8F5EE] border border-border rounded px-2 py-1 text-maroon font-mono select-all">[podcast:${p.slug}]</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <button type="button" onclick="copyShortcode('[podcast:${p.slug}]')" class="text-[10px] text-espresso hover:text-maroon border border-border px-2 py-0.5 rounded-md font-bold bg-white cursor-pointer">Copiar shortcode</button>
                    <a href="/admin/eliminar-podcast?id=${p.id}" onclick="return confirm('¿Eliminar definitivamente este podcast?')" class="text-red-700 hover:underline">Eliminar</a>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>

      <!-- 5. SANTORAL (SANTOS) -->
      <div id="tab-content-santoral" class="tab-pane hidden flex flex-col gap-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          <!-- FORMULARIO DE CREACIÓN/EDICIÓN DE SANTO (2 COLUMNAS) -->
          <div class="lg:col-span-2 bg-white border border-border rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <h3 id="santo-form-title" class="font-display font-semibold text-espresso text-lg border-b pb-2 flex items-center gap-2">
              ⛪ Registrar Perfil de Santo (Santoral Católico)
            </h3>
            <p class="text-ink-2 text-xs leading-relaxed">Crea un nuevo perfil para el santoral o edita uno existente. Puedes integrar imágenes desde Cloudinary o ligar una infografía interactiva de la biblioteca.</p>
            
            <form method="POST" action="/admin/crear-santo" id="santoForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm mt-2">
              <input type="hidden" name="santo_original_slug" id="santo_original_slug" value="">

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Nombre Litúrgico del Santo</label>
                <input type="text" name="nombre" id="santo_nombre" required placeholder="Ej: San Francisco de Asís" class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">Día de Celebración (Número)</label>
                <input type="number" name="dia" id="santo_dia" required min="1" max="31" placeholder="Ej: 4" class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">Mes de Celebración</label>
                <select name="mes_select" id="santo_mes_select" class="border border-[#D1C7BD] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white" onchange="actualizarMesIndex()">
                  <option value="Enero" data-index="01">Enero</option>
                  <option value="Febrero" data-index="02">Febrero</option>
                  <option value="Marzo" data-index="03">Marzo</option>
                  <option value="Abril" data-index="04">Abril</option>
                  <option value="Mayo" data-index="05">Mayo</option>
                  <option value="Junio" data-index="06">Junio</option>
                  <option value="Julio" data-index="07">Julio</option>
                  <option value="Agosto" data-index="08">Agosto</option>
                  <option value="Septiembre" data-index="09">Septiembre</option>
                  <option value="Octubre" data-index="10">Octubre</option>
                  <option value="Noviembre" data-index="11">Noviembre</option>
                  <option value="Diciembre" data-index="12">Diciembre</option>
                </select>
                <input type="hidden" name="mes_index" id="santo_mes_index" value="01">
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Grado Litúrgico / Tipo</label>
                <input type="text" name="tipo" id="santo_tipo" required placeholder="Ej: Memoria Obligatoria, Solemnidad, Fiesta" class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <label class="font-semibold text-espresso text-xs">Lema, Jaculatoria o Cita Célebre</label>
                <input type="text" name="lema" id="santo_lema" placeholder="Ej: 'Señor, hazme un instrumento de tu paz.'" class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
              </div>

              <div class="md:col-span-2 bg-gold/10 border border-gold/25 rounded-xl p-3 flex items-start gap-2.5">
                <input type="checkbox" name="es_santo_del_dia" id="santo_es_santo_del_dia" value="1" class="mt-0.5 w-4 h-4 accent-maroon">
                <div class="flex flex-col gap-0.5">
                  <label for="santo_es_santo_del_dia" class="font-bold text-maroon text-xs cursor-pointer">Mostrar como Santo del día en la app</label>
                  <p class="text-[10px] text-ink2 leading-relaxed">Al activar esta opción, este perfil reemplaza el cálculo automático y queda como la biografía destacada en el menú principal.</p>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">URL de Foto (Cloudinary)</label>
                <div class="flex gap-2">
                  <input type="text" name="foto_url" id="santo_foto_url" placeholder="https://res.cloudinary.com/..." class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white flex-1">
                  <button type="button" onclick="openCloudinaryExplorer('santo_photo')" class="bg-maroon hover:bg-gold text-white px-3 py-2 rounded-lg font-bold text-xs transition cursor-pointer border-0">
                    ☁️ Foto
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold text-espresso text-xs">Infografía asociada (slug o shortcode)</label>
                <input type="text" name="infografia_url" id="santo_infografia_url" placeholder="[infografia:slug] o slug-de-infografia" class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs bg-white">
              </div>

              <!-- ASPECTOS DE SU VIDA (FICHA TÉCNICA INDIVIDUALIZADA) -->
              <div class="bg-cream/40 border rounded-xl p-4 md:col-span-2 flex flex-col gap-3">
                <span class="font-mono font-bold text-[10px] text-maroon uppercase tracking-wider">📌 Ficha de Datos Históricos (Aspectos de su Vida)</span>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso text-[11px]">Patronazgo</label>
                    <input type="text" name="patronato" id="santo_patronato" placeholder="Ej: Ecologistas, animales" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso text-[11px]">Nacimiento</label>
                    <input type="text" name="nacimiento" id="santo_nacimiento" placeholder="Ej: Asís, Italia, 1182" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso text-[11px]">Fallecimiento</label>
                    <input type="text" name="muerte" id="santo_muerte" placeholder="Ej: 3 de octubre de 1226" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso text-[11px]">Canonización</label>
                    <input type="text" name="canonizacion" id="santo_canonizacion" placeholder="Ej: 1228 por el Papa Gregorio IX" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1 md:col-span-2">
                    <label class="font-semibold text-espresso text-[11px]">Santuario Principal / Reliquias</label>
                    <input type="text" name="santuario" id="santo_santuario" placeholder="Ej: Basílica de San Francisco de Asís" class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1.5 md:col-span-2">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <label class="font-semibold text-espresso text-xs">Biografía y Legado Teológico (Soporta Markdown)</label>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="openHtmlEditor('santo_biografia')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm border-0">
                      🌐 Editor HTML Integrado
                    </button>
                    <button type="button" onclick="openCloudinaryExplorer('santo_content')" class="text-maroon border border-maroon hover:bg-maroon hover:text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer transition-all">
                      ☁️ Insertar Imagen Cloudinary
                    </button>
                  </div>
                </div>
                <textarea name="biografia" id="santo_biografia" required rows="8" placeholder="Redacta la historia completa, hechos destacados, virtudes heroicas y milagros célebres..." class="border border-[#D1C7BD] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-gold text-xs font-serif leading-relaxed bg-white"></textarea>
              </div>

              <!-- SEO METADATA -->
              <div class="bg-white border rounded-xl p-4 md:col-span-2 flex flex-col gap-3">
                <span class="font-mono font-bold text-[10px] text-maroon uppercase tracking-wider">🔍 Optimización SEO de esta Hagiografía</span>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso">Título SEO de la Página</label>
                    <input type="text" name="seo_titulo" id="santo_seo_titulo" placeholder="Ej: San Francisco de Asís: Biografía completa..." class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="font-semibold text-espresso">Palabras Clave (Keywords)</label>
                    <input type="text" name="seo_keywords" id="santo_seo_keywords" placeholder="Ej: san francisco de asis, santoral..." class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                  <div class="flex flex-col gap-1 md:col-span-2">
                    <label class="font-semibold text-espresso">Meta Descripción SEO</label>
                    <input type="text" name="seo_descripcion" id="santo_seo_descripcion" placeholder="Ej: Conoce la vida de San Francisco de Asís..." class="border border-[#D1C7BD] rounded-lg px-3 py-1.5 text-xs bg-white">
                  </div>
                </div>
              </div>

              <div class="flex gap-2.5 md:col-span-2 mt-2">
                <button type="submit" id="santo_submit_btn" class="flex-1 text-center py-3 bg-maroon hover:bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-xs duration-200 cursor-pointer border-0">
                  ⛪ Registrar Santo en el Santoral
                </button>
                <button type="button" onclick="resetSantoForm()" class="px-5 py-3 bg-[#E6DFD4] hover:bg-[#D1C7BD] text-espresso font-bold text-xs uppercase tracking-wider rounded-xl transition duration-200 cursor-pointer border-0">
                  Limpiar Formulario
                </button>
              </div>
            </form>
          </div>

          <!-- LISTADO DE SANTOS ACTUALES (1 COLUMNA) -->
          <div class="flex flex-col gap-4">
            <h3 class="font-display font-semibold text-espresso text-base">⛪ Catálogo del Santoral</h3>
            <p class="text-xs text-ink-2">Perfiles de santos almacenados y sincronizados en la base de datos de CatólicosGPT.</p>
            <input type="text" id="santo-admin-search-input" oninput="filterAdminSantos()" placeholder="Buscar santo por nombre, fecha, devoción, keywords o biografía..." class="border border-border rounded-lg px-3 py-2 text-xs bg-white outline-none focus:ring-1 focus:ring-gold">
            
            <div class="max-h-[750px] overflow-y-auto border border-border rounded-xl divide-y text-xs bg-white">
              ${santoral.getAllSaints().length === 0 ? '<div class="p-4 text-center text-ink-2 italic">No hay santos en el santoral. Crea el primero arriba.</div>' : 
                santoral.getAllSaints().map(s => {
                  return `
                    <div class="santo-admin-card p-3 flex flex-col gap-2 hover:bg-cream/10"
                         data-search="${escapeHtml(`${s.nombre || ''} ${s.slug || ''} ${s.dia || ''} ${s.mes || ''} ${s.tipo || ''} ${s.lema || ''} ${s.biografia || ''} ${s.seo_keywords || ''} ${s.seo_descripcion || ''}`.toLowerCase())}">
                      <div class="flex items-start justify-between gap-1">
                        <div class="flex flex-col truncate max-w-[200px]">
                          <span class="font-bold text-espresso">${s.nombre}</span>
                          <span class="text-[10px] text-ink-2 font-mono">${s.dia} de ${s.mes} | ${s.tipo}</span>
                        </div>
                          <span class="text-[10px] bg-gold/10 text-maroon font-bold px-2 py-0.5 rounded-full border border-gold/20">
                            ${s.esSantoDelDia ? '⭐ Santo del día' : `/${s.slug}`}
                          </span>
                      </div>
                      
                      <div class="flex items-center gap-2 pt-1 border-t border-border/20 justify-end">
                        <a href="/santoral/${s.slug}" target="_blank" class="text-maroon hover:underline font-bold">Ver página ↗</a>
                        <button type="button" 
                                data-santo="${escapeHtml(JSON.stringify(s))}"
                                onclick="cargarEditarSanto(this)" 
                                class="text-indigo-700 hover:underline font-bold border-0 bg-transparent cursor-pointer">Editar</button>
                        <a href="/admin/eliminar-santo?slug=${s.slug}" onclick="return confirm('¿Seguro que deseas eliminar a ${s.nombre}?')" class="text-red-700 hover:underline font-bold">Eliminar</a>
                      </div>
                    </div>
                  `;
                }).join('')}
            </div>
          </div>

        </div>
      </div>

      </div>

    </div>

    <!-- MODAL DE LA BIBLIOTECA CLOUDINARY -->
    <div id="cloudinary-explorer-modal" class="fixed inset-0 bg-[#1A0E05]/70 backdrop-blur-xs hidden items-center justify-center z-50 p-4" style="z-index: 70;">
      <div class="bg-[#FCFAF5] border border-[#D1C7BD] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onclick="event.stopPropagation()">
        
        <!-- HEADER -->
        <div class="bg-white border-b border-[#E6DFD4] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">☁️</span>
            <div class="flex flex-col">
              <h2 class="font-display font-bold text-espresso text-base">Biblioteca de Recursos de Cloudinary</h2>
              <p class="text-[10px] text-ink2">Explorador director de recursos y carpetas del servidor ${cloudName}</p>
            </div>
          </div>
          
          <button type="button" onclick="closeCloudinaryExplorer()" class="text-ink2 hover:bg-cream-light p-2 rounded-xl transition cursor-pointer border-0 bg-transparent text-base font-bold">
            ✕
          </button>
        </div>

        <!-- CONTROLES: FILTROS DEL REPOSITORIO CLOUDINARY REAL -->
        <div class="bg-[#F8F5EE] border-b border-[#E6DFD4] p-4 flex flex-col gap-3.5">
          
          <!-- CONTROLES DE FILTRO -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div class="flex flex-col gap-1">
              <label class="font-semibold text-espresso">Buscador</label>
              <input type="text" id="cl-search" oninput="debounceFilterResources()" placeholder="Buscar por nombre..." class="border border-border rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-gold bg-white text-xs outline-none">
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold text-espresso">Carpeta</label>
              <select id="cl-folder-filter" onchange="fetchCloudinaryResources()" class="border border rounded-lg px-2 py-1.5 bg-white text-xs outline-none">
                <option value="">-- Todas las carpetas --</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold text-espresso">Tipo de Recurso</label>
              <select id="cl-type-filter" onchange="fetchCloudinaryResources()" class="border border rounded-lg px-2 py-1.5 bg-white text-xs outline-none">
                <option value="all">Todos los formatos</option>
                <option value="image">Imágenes</option>
                <option value="video">Videos</option>
                <option value="audio">Audios / Podcasts</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-semibold text-espresso">Ordenamiento</label>
              <select id="cl-sort-filter" onchange="drawCloudinaryResources()" class="border border rounded-lg px-2 py-1.5 bg-white text-xs outline-none">
                <option value="recent">Más recientes primero</option>
                <option value="old">Más antiguos primero</option>
                <option value="name_asc">Nombre (A-Z)</option>
                <option value="size_desc">Tamaño (Mayor primero)</option>
              </select>
            </div>
          </div>

        </div>

        <!-- MAIN BODY: NAVEGADOR DE RECURSOS -->
        <div class="flex-1 overflow-y-auto p-6" id="cl-resources-grid-container">
          <!-- Loader -->
          <div id="cl-loader" class="flex flex-col items-center justify-center p-24 gap-3 text-ink2 text-xs">
            <div class="w-8 h-8 border-4 border-gold border-t-maroon rounded-full animate-spin"></div>
            Explorando catálogo Cloudinary...
          </div>

          <!-- No resources -->
          <div id="cl-empty" class="hidden flex flex-col items-center justify-center p-24 text-center gap-2 text-xs text-ink2 italic">
            <span id="cl-empty-title">⚠️ Sin recursos que coincidan con la búsqueda o filtros.</span>
            <span id="cl-empty-message">Modifica el filtro de tipo, carpeta o término de búsqueda.</span>
          </div>

          <!-- Grid de recursos -->
          <div id="cl-resources-grid" class="hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            <!-- Renderizado dinámico -->
          </div>
        </div>

        <!-- PANEL DE PIE DE SELECCIÓN -->
        <div class="bg-white border-t border-[#E6DFD4] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div class="text-xs font-semibold text-espresso">
            Seleccionados: <span id="cl-selected-count" class="bg-maroon text-white font-bold px-2 py-0.5 rounded-full text-[11px] ml-1">0</span>
          </div>
          
          <div class="flex items-center gap-2.5">
            <button type="button" onclick="closeCloudinaryExplorer()" class="text-xs border text-espresso hover:bg-cream-light py-2 px-4 rounded-xl transition font-bold cursor-pointer border-border bg-white">
              Cancelar
            </button>
            <button type="button" onclick="confirmCloudinarySelection()" id="cl-confirm-btn" class="text-xs bg-gold hover:bg-gold-deep text-white py-2 px-5 rounded-xl transition font-bold cursor-pointer shadow-xs border-0">
              ✓ Seleccionar Recursos
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- MODAL DEL EDITOR HTML INTEGRADO -->
    <div id="html-editor-modal" class="fixed inset-0 bg-[#1A0E05]/70 backdrop-blur-xs hidden items-center justify-center z-50 p-4">
      <div class="bg-[#FCFAF5] border border-[#D1C7BD] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onclick="event.stopPropagation()">
        
        <!-- HEADER -->
        <div class="bg-white border-b border-[#E6DFD4] px-6 py-4 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🌐</span>
            <div class="flex flex-col">
              <h2 class="font-display font-bold text-espresso text-base">Editor de Código HTML de CatólicosGPT</h2>
              <p class="text-[10px] text-ink2">Escribe o pega código HTML, usa los botones de acceso rápido y visualiza en tiempo real.</p>
            </div>
          </div>
          
          <button type="button" onclick="closeHtmlEditor()" class="text-ink2 hover:bg-cream-light p-2 rounded-xl transition cursor-pointer border-0 bg-transparent text-base font-bold">
            ✕
          </button>
        </div>

        <!-- ACCESOS RÁPIDOS / HERRAMIENTAS -->
        <div class="bg-[#F8F5EE] border-b border-[#E6DFD4] p-3 flex gap-2 flex-wrap items-center">
          <span class="text-[10px] uppercase tracking-wider font-bold text-espresso font-mono mr-1">Insertar:</span>
          <button type="button" onclick="insertHtmlSnippet('<p>', '</p>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            Párrafo &lt;p&gt;
          </button>
          <button type="button" onclick="insertHtmlSnippet('<strong>', '</strong>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition font-bold">
            Negrita &lt;b&gt;
          </button>
          <button type="button" onclick="insertHtmlSnippet('<h1>', '</h1>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            Título H1
          </button>
          <button type="button" onclick="insertHtmlSnippet('<h2>', '</h2>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            Título H2
          </button>
          <button type="button" onclick="insertHtmlSnippet('<h3>', '</h3>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            Título H3
          </button>
          <button type="button" onclick="insertHtmlSnippet('<div class=&quot;bg-cream/40 p-4 rounded-xl border border-[#E6DFD4] my-4&quot;>\\\\n  <p class=&quot;font-serif text-espresso&quot;>', '</p>\\\\n</div>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            📦 Caja Destacada
          </button>
          <button type="button" onclick="insertHtmlSnippet('<table class=&quot;min-w-full border-collapse border border-border mt-4 mb-4&quot;>\\\\n  <thead>\\\\n    <tr class=&quot;bg-cream&quot;>\\\\n      <th class=&quot;border border-border p-2 text-left text-xs font-mono&quot;>Encabezado 1</th>\\\\n      <th class=&quot;border border-border p-2 text-left text-xs font-mono&quot;>Encabezado 2</th>\\\\n    </tr>\\\\n  </thead>\\\\n  <tbody>\\\\n    <tr>\\\\n      <td class=&quot;border border-border p-2 text-sm&quot;>Fila 1, Celda 1</td>\\\\n      <td class=&quot;border border-border p-2 text-sm&quot;>Fila 1, Celda 2</td>\\\\n    </tr>\\\\n    <tr>\\\\n      <td class=&quot;border border-border p-2 text-sm&quot;>Fila 2, Celda 1</td>\\\\n      <td class=&quot;border border-border p-2 text-sm&quot;>Fila 2, Celda 2</td>\\\\n    </tr>\\\\n  </tbody>\\\\n</table>\\\\n', '')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            📊 Tabla
          </button>
          <button type="button" onclick="insertHtmlSnippet('<ul>\\\\n  <li>', '</li>\\\\n  <li>Elemento 2</li>\\\\n</ul>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            • Lista Viñetas
          </button>
          <button type="button" onclick="insertHtmlSnippet('<img src=&quot;&quot; alt=&quot;&quot; class=&quot;rounded-2xl mx-auto max-h-[350px] object-cover my-4&quot; />\\\\n', '')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            🖼️ Imagen URL
          </button>
          <button type="button" onclick="openCloudinaryExplorer('html_editor_image')" class="px-2.5 py-1 bg-maroon hover:bg-gold border border-maroon text-[11px] font-bold rounded-md text-white cursor-pointer transition">
            ☁️ Imagen Cloudinary
          </button>
          <button type="button" onclick="insertHtmlSnippet('<a href=&quot;#&quot; class=&quot;text-maroon underline hover:text-gold&quot;>', '</a>')" class="px-2.5 py-1 bg-white hover:bg-cream-light border border-border text-[11px] font-semibold rounded-md text-espresso cursor-pointer transition">
            🔗 Enlace
          </button>
          <button type="button" onclick="insertHtmlSnippet('<article class=&quot;post-catolicosgpt&quot;>\\\\n', '\\\\n</article>')" class="px-2.5 py-1 bg-[#E6DFD4] hover:bg-[#D1C7BD] text-[11px] font-bold rounded-md text-espresso cursor-pointer transition">
            📄 Contenedor Post
          </button>
        </div>

        <!-- MAIN BODY: SPLIT VIEW -->
        <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          <!-- LEFT PANEL: CODE INPUT -->
          <div class="w-full md:w-1/2 h-1/2 md:h-full border-r border-[#E6DFD4] flex flex-col overflow-hidden">
            <div class="bg-white border-b border-[#E6DFD4] px-4 py-1.5 flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold text-ink2 uppercase tracking-wider">Código HTML &lt;/&gt;</span>
              <button type="button" onclick="clearHtmlCode()" class="text-[10px] font-semibold text-red-600 hover:underline cursor-pointer border-0 bg-transparent">
                Limpiar todo
              </button>
            </div>
            <textarea id="html-editor-code" oninput="updateHtmlPreview()" placeholder="Escribe o pega tu código HTML aquí..." class="flex-1 w-full font-mono text-xs bg-[#1A1A1A] text-[#F8F8F2] p-4 resize-none outline-none focus:ring-0 focus:border-0 border-0 leading-relaxed" style="tab-size: 4;"></textarea>
          </div>

          <!-- RIGHT PANEL: PREVIEW -->
          <div class="w-full md:w-1/2 h-1/2 md:h-full flex flex-col overflow-hidden bg-white">
            <div class="bg-white border-b border-[#E6DFD4] px-4 py-1.5 flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold text-ink2 uppercase tracking-wider">Vista Previa en Tiempo Real</span>
              <span class="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Activa</span>
            </div>
            <div class="flex-1 overflow-y-auto p-6 font-serif text-espresso prose max-w-none bg-white" id="html-editor-preview">
              <!-- Renderizado dinámico -->
            </div>
          </div>

        </div>

        <!-- FOOTER -->
        <div class="bg-white border-t border-[#E6DFD4] px-6 py-4 flex items-center justify-between gap-4">
          <div class="text-xs text-ink2">
            Editando campo: <span id="html-editor-target-name" class="font-bold text-espresso bg-[#F8F5EE] px-2 py-1 rounded-md">Ninguno</span>
          </div>
          
          <div class="flex items-center gap-2.5">
            <button type="button" onclick="closeHtmlEditor()" class="text-xs border text-espresso hover:bg-[#F8F5EE] py-2 px-4 rounded-xl transition font-bold cursor-pointer border-[#D1C7BD] bg-white">
              Cancelar
            </button>
            <button type="button" onclick="applyHtmlChanges()" class="text-xs bg-gold hover:bg-gold-deep text-white py-2 px-5 rounded-xl transition font-bold cursor-pointer shadow-xs border-0">
              ✓ Aplicar Cambios al Formulario
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- SCRIPT CLIENT FLUID PARA ACTIVAR TABS Y EL EXPLORADOR CLOUDINARY -->
    <script>
      function actualizarMesIndex() {
        const sel = document.getElementById('santo_mes_select');
        if (!sel) return;
        const idx = sel.options[sel.selectedIndex].getAttribute('data-index');
        document.getElementById('santo_mes_index').value = idx;
      }

      function cargarEditarSanto(btn) {
        const data = JSON.parse(btn.getAttribute('data-santo'));
        document.getElementById('santo-form-title').innerText = '⛪ Editar Perfil de Santo: ' + (data.nombre || '');
        document.getElementById('santo_submit_btn').innerText = '✓ Guardar Cambios del Perfil';
        
        document.getElementById('santo_original_slug').value = data.slug || '';
        document.getElementById('santo_nombre').value = data.nombre || '';
        document.getElementById('santo_dia').value = data.dia || '';
        document.getElementById('santo_mes_select').value = data.mes || 'Enero';
        document.getElementById('santo_mes_index').value = data.mes_index || '01';
        document.getElementById('santo_tipo').value = data.tipo || '';
        document.getElementById('santo_lema').value = data.lema || '';
        document.getElementById('santo_es_santo_del_dia').checked = data.esSantoDelDia === true;
        document.getElementById('santo_foto_url').value = data.foto_url || '';
        document.getElementById('santo_infografia_url').value = data.infografia_url || '';
        document.getElementById('santo_biografia').value = data.biografia || '';
        
        const aspectos = data.aspectos_tabla || {};
        document.getElementById('santo_patronato').value = aspectos['Patronato'] || '';
        document.getElementById('santo_nacimiento').value = aspectos['Nacimiento'] || '';
        document.getElementById('santo_muerte').value = aspectos['Fallecimiento'] || '';
        document.getElementById('santo_canonizacion').value = aspectos['Canonización'] || '';
        document.getElementById('santo_santuario').value = aspectos['Santuario Principal'] || '';
        
        document.getElementById('santo_seo_titulo').value = data.seo_titulo || '';
        document.getElementById('santo_seo_descripcion').value = data.seo_description || '';
        document.getElementById('santo_seo_keywords').value = data.seo_keywords || '';

        document.getElementById('santoForm').scrollIntoView({ behavior: 'smooth' });
      }

      function resetSantoForm() {
        document.getElementById('santo-form-title').innerText = '⛪ Registrar Perfil de Santo (Santoral Católico)';
        document.getElementById('santo_submit_btn').innerText = '⛪ Registrar Santo en el Santoral';
        
        document.getElementById('santo_original_slug').value = '';
        document.getElementById('santo_nombre').value = '';
        document.getElementById('santo_dia').value = '';
        document.getElementById('santo_mes_select').selectedIndex = 0;
        actualizarMesIndex();
        document.getElementById('santo_tipo').value = '';
        document.getElementById('santo_lema').value = '';
        document.getElementById('santo_es_santo_del_dia').checked = false;
        document.getElementById('santo_foto_url').value = '';
        document.getElementById('santo_infografia_url').value = '';
        document.getElementById('santo_biografia').value = '';
        document.getElementById('santo_patronato').value = '';
        document.getElementById('santo_nacimiento').value = '';
        document.getElementById('santo_muerte').value = '';
        document.getElementById('santo_canonizacion').value = '';
        document.getElementById('santo_santuario').value = '';
        document.getElementById('santo_seo_titulo').value = '';
        document.getElementById('santo_seo_descripcion').value = '';
        document.getElementById('santo_seo_keywords').value = '';
      }

      function filterAdminSantos() {
        const q = (document.getElementById('santo-admin-search-input')?.value || '').toLowerCase().trim();
        const cards = document.querySelectorAll('.santo-admin-card');
        let visible = 0;
        cards.forEach(card => {
          const haystack = card.getAttribute('data-search') || '';
          const match = !q || haystack.includes(q);
          card.style.display = match ? 'flex' : 'none';
          if (match) visible++;
        });
      }

      window.addEventListener('DOMContentLoaded', () => {
        actualizarMesIndex();
      });

      function switchTab(name) {
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.remove('border-maroon', 'text-maroon', 'active');
          btn.classList.add('border-transparent', 'text-ink-2');
        });

        const activePane = document.getElementById('tab-content-' + name);
        const activeBtn = document.getElementById('tab-btn-' + name);
        if (activePane && activeBtn) {
          activePane.classList.remove('hidden');
          activeBtn.classList.remove('border-transparent', 'text-ink-2');
          activeBtn.classList.add('border-maroon', 'text-maroon', 'active');
        }
        window.location.hash = name;
      }

      function copyShortcode(value) {
        const text = String(value || '');
        const done = () => {
          const alertDiv = document.createElement('div');
          alertDiv.className = 'fixed bottom-4 right-4 bg-maroon text-white font-semibold py-2 px-4 rounded-xl shadow-lg z-[9999] transition duration-500 text-xs';
          alertDiv.innerText = '✓ Shortcode copiado: ' + text;
          document.body.appendChild(alertDiv);
          setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 500);
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            const tmp = document.createElement('textarea');
            tmp.value = text;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            tmp.remove();
            done();
          });
        } else {
          const tmp = document.createElement('textarea');
          tmp.value = text;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          tmp.remove();
          done();
        }
      }

      // ── SISTEMA DINÁMICO CLIENT-SIDE DE BLOGS DE FORMACIÓN ──
      let cachedAdminBlogs = [];

      async function loadAdminBlogs() {
        const container = document.getElementById('admin-blog-list-container');
        if (!container) return;
        
        try {
          const res = await fetch('/api/admin/blogs');
          const data = await res.json();
          if (data.error) {
            container.innerHTML = '<div class="p-4 text-center text-red-700 italic">Error de autenticación o acceso: ' + data.error + '</div>';
            return;
          }
          cachedAdminBlogs = data.posts || [];
          document.getElementById('total-blog-count').innerText = cachedAdminBlogs.length;
          filterAdminBlogs();
        } catch (e) {
          container.innerHTML = '<div class="p-4 text-center text-red-700 italic">Error de conexión: ' + e.message + '</div>';
        }
      }

      function filterAdminBlogs() {
        const query = (document.getElementById('blog-search-input')?.value || '').toLowerCase().trim();
        const container = document.getElementById('admin-blog-list-container');
        if (!container) return;

        let filtered = cachedAdminBlogs;
        if (query) {
          filtered = cachedAdminBlogs.filter(p => 
            (p.titulo || '').toLowerCase().includes(query) || 
            (p.slug || '').toLowerCase().includes(query) || 
            (p.categoria || '').toLowerCase().includes(query) ||
            (p.descripcion || '').toLowerCase().includes(query) ||
            (p.keywords || '').toLowerCase().includes(query) ||
            (p.extracto || '').toLowerCase().includes(query) ||
            (p.contenidoMd || '').toLowerCase().includes(query)
          );
        }

        renderAdminBlogsList(filtered);
      }

      function renderAdminBlogsList(posts) {
        const container = document.getElementById('admin-blog-list-container');
        if (!container) return;

        if (posts.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-ink-2 italic">No se hallaron artículos con esos términos.</div>';
          return;
        }

        const escape = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        let listHtml = "";
        for (let i = 0; i < posts.length; i++) {
          const p = posts[i];
          const escapedSlug = escape(p.slug);
          const escapedTitulo = escape(p.titulo);
          const escapedCategoria = escape(p.categoria);
          const escapedDesc = escape(p.descripcion || 'Sin optimización IA');
          
          listHtml += '<div class="p-3 flex items-center justify-between hover:bg-cream/10 gap-4">';
          listHtml += '  <div class="flex flex-col gap-0.5 truncate max-w-xl">';
          listHtml += '    <span class="font-bold text-espresso">' + escapedTitulo + '</span>';
          listHtml += '    <span class="text-[10px] text-ink-2 truncate">Slug: <strong class="text-gold-deep">' + escapedSlug + '</strong> | Cat: <span class="bg-[#E6DFD4] text-espresso px-2 py-0.5 rounded-sm font-semibold">' + escapedCategoria + '</span> | SEO: ' + escapedDesc + '</span>';
          listHtml += '  </div>';
          listHtml += '  <div class="flex items-center gap-3 shrink-0">';
          listHtml += '    <a href="/blog/' + escapedSlug + '" target="_blank" class="text-maroon font-bold hover:underline">Ver</a>';
          listHtml += '    <button data-post="' + escape(JSON.stringify(p)) + '" onclick="cargarEditarBlog(this)" class="text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer transition font-semibold border-0 bg-transparent">Editar</button>';
          listHtml += '    <button data-slug="' + escapedSlug + '" onclick="deleteAdminBlogEvent(this)" class="text-red-700 hover:text-red-900 hover:underline cursor-pointer transition font-semibold border-0 bg-transparent">Eliminar</button>';
          listHtml += '  </div>';
          listHtml += '</div>';
        }
        container.innerHTML = listHtml;
      }

      function cargarEditarBlog(btn) {
        const data = JSON.parse(btn.getAttribute('data-post'));
        document.getElementById('blog_form_title').innerText = '✍️ Editar Artículo de Formación Teológica: ' + (data.titulo || '');
        document.getElementById('blog_submit_btn').innerText = '✓ Guardar Cambios del Artículo';
        
        document.getElementById('blog_original_slug').value = data.slug || '';
        document.getElementById('blog_titulo').value = data.titulo || '';
        document.getElementById('blog_categoria').value = data.categoria || 'catequesis';
        document.getElementById('blog_imagen_portada').value = data.imagenPortada || '';
        document.getElementById('blog_content_editor').value = data.contenidoMd || '';

        document.getElementById('blogForm').scrollIntoView({ behavior: 'smooth' });
      }

      function resetBlogForm() {
        document.getElementById('blog_form_title').innerText = '✍️ Crear / Editar Artículo de Formación Teológica';
        document.getElementById('blog_submit_btn').innerText = 'Publicar Artículo Formativo ➔';
        
        document.getElementById('blog_original_slug').value = '';
        document.getElementById('blog_titulo').value = '';
        document.getElementById('blog_categoria').selectedIndex = 0;
        document.getElementById('blog_imagen_portada').value = '';
        document.getElementById('blog_content_editor').value = '';
      }

      async function deleteAdminBlogEvent(btn) {
        const slug = btn.getAttribute('data-slug');
        if (!slug) return;
        if (!confirm('¿Estás seguro de que deseas eliminar definitivamente este artículo doctrinal?')) return;
        
        try {
          const res = await fetch('/api/admin/blogs/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug })
          });
          const data = await res.json();
          if (data.success) {
            loadAdminBlogs();
          } else {
            alert('Error al intentar eliminar el post: ' + (data.error || 'Desconocido'));
          }
        } catch (e) {
          alert('Error conectando con el servidor teológico: ' + e.message);
        }
      }

      window.addEventListener('DOMContentLoaded', () => {
        let hash = window.location.hash.replace('#', '') || 'infografias';
        if (!['infografias', 'blog', 'videos', 'podcasts', 'santoral'].includes(hash)) {
          hash = 'infografias';
        }
        switchTab(hash);
        loadAdminBlogs();

        // Add first manual image row for infographics on load only if empty
        if (typeof addManualImageRow === 'function') {
          const container = document.getElementById('manual-images-container');
          if (container && container.querySelectorAll('.manual-image-row').length === 0) {
            addManualImageRow();
          }
        }
      });

      // ── MÉTODOS DEL EXPOSITOR NATIVO DE CLOUDINARY ──
      let activeExplorerContext = ''; 
      let originalCloudinaryResources = [];
      let currentCloudinaryResources = [];
      let selectedResourcesMap = new Map();
      let debounceTimer = null;

      // INTEGRACIÓN DEL EDITOR DE CÓDIGO HTML EN TIEMPO REAL
      let activeHtmlEditorTargetId = '';

      function openHtmlEditor(targetId) {
        activeHtmlEditorTargetId = targetId;
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        // Nombre amigable en el footer
        let friendlyName = 'Desconocido';
        if (targetId === 'blog_content_editor') {
          friendlyName = 'Contenido del Blog (Artículos)';
        } else if (targetId === 'santo_biografia') {
          friendlyName = 'Biografía del Santo (Santoral)';
        }
        document.getElementById('html-editor-target-name').innerText = friendlyName;

        // Cargar código actual
        const currentCode = targetElement.value || '';
        document.getElementById('html-editor-code').value = currentCode;

        // Actualizar preview
        updateHtmlPreview();

        // Mostrar modal
        const modal = document.getElementById('html-editor-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }

      function closeHtmlEditor() {
        const modal = document.getElementById('html-editor-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        activeHtmlEditorTargetId = '';
      }

      function updateHtmlPreview() {
        const code = document.getElementById('html-editor-code').value || '';
        const previewContainer = document.getElementById('html-editor-preview');
        
        // Detección de HTML para renderizar directo o usar marked
        const lowerCode = code.toLowerCase();
        if (lowerCode.includes('<p>') || lowerCode.includes('<div') || lowerCode.includes('<table') || lowerCode.includes('</ul>') || lowerCode.includes('</ol>') || lowerCode.includes('<article') || lowerCode.includes('</h1>') || lowerCode.includes('</h2>') || lowerCode.includes('</h3>')) {
          previewContainer.innerHTML = formatMixedHtmlPreview(code);
        } else if (window.marked) {
          previewContainer.innerHTML = window.marked.parse(code);
        } else {
          previewContainer.innerHTML = code.replace(/\\n/g, '<br>');
        }
      }

      function formatMixedHtmlPreview(raw) {
        const blockTags = 'article|aside|blockquote|div|figure|figcaption|h[1-6]|hr|iframe|img|li|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul|style';
        return String(raw || '')
          .replace(/\\r\\n/g, '\\n')
          .split(/\\n{2,}/)
          .map(block => {
            const b = block.trim();
            if (!b) return '';
            const startsWithBlock = new RegExp('^<(' + blockTags + ')(\\\\s|>|/)', 'i').test(b);
            const endsWithBlock = new RegExp('</(' + blockTags + ')>\\\\s*$', 'i').test(b);
            if (startsWithBlock || endsWithBlock || /^\\[(infografia|video|podcast):[\\w-]+\\]$/i.test(b)) return b;
            return '<p>' + b.replace(/\\n/g, '<br>') + '</p>';
          })
          .join('\\n\\n');
      }

      function clearHtmlCode() {
        if (confirm('¿Estás seguro de que deseas borrar todo el contenido del editor?')) {
          document.getElementById('html-editor-code').value = '';
          updateHtmlPreview();
        }
      }

      function insertHtmlSnippet(prefix, suffix = '') {
        const textarea = document.getElementById('html-editor-code');
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(startPos, endPos);
        
        const replacement = prefix + (selectedText || '') + suffix;
        textarea.value = text.substring(0, startPos) + replacement + text.substring(endPos);
        
        textarea.focus();
        textarea.selectionStart = startPos + prefix.length;
        textarea.selectionEnd = startPos + prefix.length + selectedText.length;
        
        updateHtmlPreview();
      }

      function applyHtmlChanges() {
        if (!activeHtmlEditorTargetId) return;
        const targetElement = document.getElementById(activeHtmlEditorTargetId);
        if (targetElement) {
          targetElement.value = document.getElementById('html-editor-code').value;
          targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        closeHtmlEditor();
        
        // Alerta/Toast flotante de confirmación de guardado
        const alertDiv = document.createElement('div');
        alertDiv.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white font-semibold py-2 px-4 rounded-xl shadow-lg z-[9999] transition duration-500';
        alertDiv.innerText = '✓ Cambios de HTML aplicados correctamente';
        document.body.appendChild(alertDiv);
        setTimeout(() => {
          alertDiv.style.opacity = '0';
          setTimeout(() => alertDiv.remove(), 500);
        }, 2000);
      }

      function setSelectValueEnsuringOption(select, value, label) {
        if (!select) return;
        if (value && !Array.from(select.options).some(opt => opt.value === value)) {
          const opt = document.createElement('option');
          opt.value = value;
          opt.innerText = label || ('/' + value);
          select.appendChild(opt);
        }
        select.value = value || '';
      }

      function openCloudinaryExplorer(context) {
        activeExplorerContext = context;
        selectedResourcesMap.clear();
        document.getElementById('cl-selected-count').innerText = '0';
        
        // Configurar filtros automáticos inteligentes según el contexto
        const typeFilter = document.getElementById('cl-type-filter');
        const folderFilter = document.getElementById('cl-folder-filter');
        
        if (context === 'infografias') {
          typeFilter.value = 'image';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'blog_cover') {
          typeFilter.value = 'image';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'blog_content') {
          typeFilter.value = 'image';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'santo_photo' || context === 'santo_content') {
          typeFilter.value = 'image';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'html_editor_image') {
          typeFilter.value = 'image';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'videos') {
          typeFilter.value = 'video';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else if (context === 'podcasts') {
          typeFilter.value = 'audio';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        } else {
          typeFilter.value = 'all';
          setSelectValueEnsuringOption(folderFilter, '', '-- Todas las carpetas --');
        }

        document.getElementById('cloudinary-explorer-modal').classList.remove('hidden');
        document.getElementById('cloudinary-explorer-modal').classList.add('flex');
        
        fetchCloudinaryResources();
      }

      function closeCloudinaryExplorer() {
        document.getElementById('cloudinary-explorer-modal').classList.add('hidden');
        document.getElementById('cloudinary-explorer-modal').classList.remove('flex');
      }

      async function fetchCloudinaryResources() {
        const grid = document.getElementById('cl-resources-grid');
        const loader = document.getElementById('cl-loader');
        const emptyAlert = document.getElementById('cl-empty');
        const emptyTitle = document.getElementById('cl-empty-title');
        const emptyMessage = document.getElementById('cl-empty-message');
        
        grid.classList.add('hidden');
        loader.classList.remove('hidden');
        emptyAlert.classList.add('hidden');
        if (emptyTitle) emptyTitle.innerText = '⚠️ Sin recursos que coincidan con la búsqueda o filtros.';
        if (emptyMessage) emptyMessage.innerText = 'Modifica el filtro de tipo, carpeta o término de búsqueda.';

        try {
          const type = document.getElementById('cl-type-filter').value;
          const folder = document.getElementById('cl-folder-filter').value;
          const search = document.getElementById('cl-search').value.trim();

          let query = \`/api/admin/cloudinary/resources?type=\${type}&folder=\${folder}&search=\${search}\`;
          const res = await fetch(query);
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'No se pudo leer tu biblioteca de Cloudinary.');
          }

          originalCloudinaryResources = data.resources || [];
          currentCloudinaryResources = [...originalCloudinaryResources];

          // Actualizar select de carpetas dinámicamente si es la primera carga
          const fSelect = document.getElementById('cl-folder-filter');
          const currentVal = fSelect.value;
          fSelect.innerHTML = '<option value="">-- Todas las carpetas --</option>';
          if (data.folders) {
            data.folders.forEach(fold => {
              const opt = document.createElement('option');
              opt.value = fold;
              opt.innerText = '/' + fold;
              fSelect.appendChild(opt);
            });
          }
          fSelect.value = currentVal;

          drawCloudinaryResources();
        } catch (err) {
          console.error('Error cargando recursos de Cloudinary:', err);
          loader.classList.add('hidden');
          grid.classList.add('hidden');
          if (emptyTitle) emptyTitle.innerText = '⚠️ Cloudinary no está disponible';
          if (emptyMessage) emptyMessage.innerText = err.message || 'Revisa CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Google Cloud.';
          emptyAlert.classList.remove('hidden');
        }
      }

      function debounceFilterResources() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchCloudinaryResources();
        }, 300);
      }

      function drawCloudinaryResources() {
        const grid = document.getElementById('cl-resources-grid');
        const loader = document.getElementById('cl-loader');
        const emptyAlert = document.getElementById('cl-empty');
        const sortVal = document.getElementById('cl-sort-filter').value;

        // Ordenar
        if (sortVal === 'recent') {
          currentCloudinaryResources.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortVal === 'old') {
          currentCloudinaryResources.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        } else if (sortVal === 'name_asc') {
          currentCloudinaryResources.sort((a,b) => a.name.localeCompare(b.name));
        } else if (sortVal === 'size_desc') {
          currentCloudinaryResources.sort((a,b) => (b.bytes || 0) - (a.bytes || 0));
        }

        loader.classList.add('hidden');

        if (currentCloudinaryResources.length === 0) {
          grid.classList.add('hidden');
          emptyAlert.classList.remove('hidden');
          return;
        }

        emptyAlert.classList.add('hidden');
        grid.classList.remove('hidden');

        grid.innerHTML = currentCloudinaryResources.map((r, idx) => {
          const isSelected = selectedResourcesMap.has(r.url);
          const isAudio = r.resource_type === 'audio' || r.format === 'mp3';
          const isVideo = r.resource_type === 'video' || r.format === 'mp4';
          const isPdf = r.format === 'pdf';

          let thumbHtml = '';
          if (isAudio) {
            thumbHtml = \`
              <div class="w-full aspect-square bg-[#E8F5E9] flex flex-col items-center justify-center text-green-700 gap-1.5 p-2 rounded-t-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span class="text-[10px] font-mono font-bold uppercase">\${r.format} Audio</span>
              </div>
            \`;
          } else if (isVideo) {
            thumbHtml = \`
              <div class="w-full aspect-square bg-[#FFEBEE] flex flex-col items-center justify-center text-red-700 gap-1.5 p-2 rounded-t-xl relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                <span class="text-[10px] font-mono font-bold uppercase">\${r.format} Video</span>
              </div>
            \`;
          } else if (isPdf) {
            thumbHtml = \`
              <div class="w-full aspect-square bg-[#ECEFF1] flex flex-col items-center justify-center text-blue-700 gap-1.5 p-2 rounded-t-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span class="text-[10px] font-mono font-bold uppercase">PDF Doc</span>
              </div>
            \`;
          } else {
            thumbHtml = \`
              <div class="w-full aspect-square overflow-hidden rounded-t-xl relative bg-cream-2 border-b flex items-center justify-center">
                <img src="\${r.url}" class="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer">
              </div>
            \`;
          }

          return \`
            <div onclick="toggleSelectResource('\${r.url}', \${idx})" class="group relative rounded-xl border border-border bg-white shadow-xs cursor-pointer overflow-hidden hover:border-gold/50 transition duration-300 \${isSelected ? 'ring-2 ring-gold border-gold' : ''}">
              
              \${thumbHtml}

              <!-- CHECKBOX OVERLAY -->
              <div class="absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center border transition \${isSelected ? 'bg-gold border-gold text-white' : 'bg-white/80 border-espresso/20'}" onclick="event.stopPropagation(); toggleSelectResource('\${r.url}', \${idx})">
                \${isSelected ? '✓' : ''}
              </div>

              <!-- INFO -->
              <div class="p-2.5 flex flex-col gap-0.5 text-left">
                <p class="font-bold text-espresso text-[11px] truncate leading-tight group-hover:text-maroon transition duration-200" title="\${r.name}">\${r.name}</p>
                <p class="text-[9px] text-ink2 font-mono truncate">Carpeta: <strong>/\${r.folder || 'general'}</strong></p>
                <p class="text-[9px] text-[#A08E77] font-mono mt-0.5 flex justify-between">
                  <span>\${(r.bytes/1024).toFixed(0)} KB</span>
                  <span>\${r.width ? r.width + 'x' + r.height : r.duration || ''}</span>
                </p>
              </div>
            </div>
          \`;
        }).join('');
      }

      function toggleSelectResource(url, idx) {
        const item = currentCloudinaryResources[idx];
        if (selectedResourcesMap.has(url)) {
          selectedResourcesMap.delete(url);
        } else {
          // Si el contexto es de selección única, limpiar previos
          const singleSelectContexts = ['blog_cover', 'santo_photo', 'videos', 'podcasts'];
          if (singleSelectContexts.includes(activeExplorerContext)) {
            selectedResourcesMap.clear();
          }
          selectedResourcesMap.set(url, item);
        }
        document.getElementById('cl-selected-count').innerText = selectedResourcesMap.size;
        drawCloudinaryResources();
      }

      function escapeHtmlAttribute(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function readableCloudinaryName(resource) {
        return String(resource?.name || resource?.public_id || 'Imagen de Cloudinary')
          .replace(/\\.[^/.]+$/, '')
          .split('/')
          .pop()
          .replace(/[-_]+/g, ' ')
          .trim();
      }

      function buildCloudinaryContentImage(resource) {
        const src = escapeHtmlAttribute(resource.url);
        const caption = escapeHtmlAttribute(readableCloudinaryName(resource));
        const alt = escapeHtmlAttribute(caption || 'Imagen de CatólicosGPT');
        return '<figure class="cloudinary-content-image">\\n'
          + '  <img src="' + src + '" alt="' + alt + '" loading="lazy" referrerPolicy="no-referrer">\\n'
          + '  <figcaption>' + caption + '</figcaption>\\n'
          + '</figure>';
      }

      function insertTextAtCursor(textarea, insertion) {
        if (!textarea) return;
        const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
        const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : start;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const prefix = before && !before.endsWith('\\n') ? '\\n\\n' : '';
        const suffix = after && !after.startsWith('\\n') ? '\\n\\n' : '';
        textarea.value = before + prefix + insertion + suffix + after;
        const nextCursor = (before + prefix + insertion).length;
        textarea.focus();
        textarea.selectionStart = nextCursor;
        textarea.selectionEnd = nextCursor;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function insertCloudinaryImagesInTextarea(textareaId, resources) {
        const textarea = document.getElementById(textareaId);
        const html = resources.map(buildCloudinaryContentImage).join('\\n\\n');
        insertTextAtCursor(textarea, html);
      }

      function confirmCloudinarySelection() {
        const list = Array.from(selectedResourcesMap.values());
        if (list.length === 0) {
          alert('Por favor selecciona al menos un recurso de la biblioteca.');
          return;
        }

        if (activeExplorerContext === 'infografias') {
          addInfografiaBlocks(list);
        } else if (activeExplorerContext === 'blog_cover') {
          document.getElementById('blog_imagen_portada').value = list[0].url;
        } else if (activeExplorerContext === 'santo_photo') {
          document.getElementById('santo_foto_url').value = list[0].url;
        } else if (activeExplorerContext === 'blog_content') {
          insertCloudinaryImagesInTextarea('blog_content_editor', list);
        } else if (activeExplorerContext === 'santo_content') {
          insertCloudinaryImagesInTextarea('santo_biografia', list);
        } else if (activeExplorerContext === 'html_editor_image') {
          insertCloudinaryImagesInTextarea('html-editor-code', list);
          updateHtmlPreview();
        } else if (activeExplorerContext === 'videos') {
          document.getElementById('video_youtube_id').value = list[0].url;
          document.getElementById('video_titulo').value = list[0].name.replace(/\\\\.[^/.]+$/, "").split('-').join(' ').toUpperCase();
          document.getElementById('video_canal').value = 'Servidor Cloudinary';
        } else if (activeExplorerContext === 'podcasts') {
          document.getElementById('podcast_spotify_url').value = list[0].url;
          document.getElementById('podcast_titulo').value = list[0].name.replace(/\\\\.[^/.]+$/, "").split('-').join(' ').toUpperCase();
          document.getElementById('podcast_autor').value = 'Servidor Cloudinary';
        }

        closeCloudinaryExplorer();
      }

      // ── CONTROL DE BLOQUES DE LA INFOGRAFÍA ──
      function addInfografiaBlocks(resources) {
        const selected = Array.isArray(resources) ? resources.filter(r => r && r.url) : [];
        if (selected.length === 0) return;

        let added = 0;
        selected.forEach((r) => {
          let row = findReusableManualRow();
          if (!row) {
            const currentRows = document.querySelectorAll('.manual-image-row');
            if (currentRows.length >= 10) return;
            addManualImageRow();
            row = Array.from(document.querySelectorAll('.manual-image-row')).pop();
          }
          if (row) {
            fillManualRowFromCloudinary(row, r);
            added++;
          }
        });

        reindexManualRows();
        if (added < selected.length) {
          alert('Solo se agregaron ' + added + ' imágenes porque el carrusel admite máximo 10 diapositivas.');
        }
      }

      function findReusableManualRow() {
        const rows = Array.from(document.querySelectorAll('.manual-image-row'));
        return rows.find(row => {
          const input = row.querySelector('input[name="imageUrls[]"]');
          return input && !input.value.trim();
        }) || null;
      }

      function fillManualRowFromCloudinary(row, resource) {
        const rawName = resource.name || (resource.public_id ? resource.public_id.split('/').pop() : 'cloudinary-image.jpg');
        const baseName = rawName.replace(/\\\\.[^/.]+$/, '').split('-').join(' ').split('_').join(' ').trim();
        const label = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Imagen catequética';
        const width = parseInt(resource.width, 10) || 1200;
        const height = parseInt(resource.height, 10) || 1200;
        const bytes = parseInt(resource.bytes, 10) || 0;

        const urlInput = row.querySelector('input[name="imageUrls[]"]');
        const altInput = row.querySelector('input[name="imageAlts[]"]');
        const nameInput = row.querySelector('input[name="imageNames[]"]');
        const widthInput = row.querySelector('input[name="imageWidths[]"]');
        const heightInput = row.querySelector('input[name="imageHeights[]"]');
        const previewContainer = row.querySelector('.image-preview-container');
        const previewImg = row.querySelector('.image-preview-img');

        if (urlInput) urlInput.value = resource.url;
        if (altInput) altInput.value = 'Infografía católica: ' + label;
        if (nameInput) nameInput.value = rawName;
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
        if (previewImg) previewImg.src = resource.url;
        if (previewContainer) previewContainer.classList.remove('hidden');

        const existingBadge = row.querySelector('.cloudinary-source-badge');
        if (existingBadge) existingBadge.remove();

        const header = row.querySelector('.flex.items-center.justify-between.border-b');
        if (header) {
          const badge = document.createElement('span');
          badge.className = 'cloudinary-source-badge text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold';
          badge.innerText = '✓ Cloudinary' + (bytes ? ' · ' + Math.round(bytes / 1024) + ' KB' : '');
          header.appendChild(badge);
        }

        const checked = document.querySelector('.manual-image-row input[name="imageCoverRadio"]:checked');
        if (!checked) {
          const radio = row.querySelector('input[name="imageCoverRadio"]');
          if (radio) {
            radio.checked = true;
            updateCoverFlagsManual(row.id);
          }
        }
      }

      function moveBlock(button, direction) {
        const card = button.closest('.cloudinary-image-card');
        const parent = document.getElementById('cloudinary-selected-images');
        if (!card || !parent) return;
        if (direction === 'up') {
          const prev = card.previousElementSibling;
          if (prev && prev.id !== 'empty-images-placeholder') {
            parent.insertBefore(card, prev);
          }
        } else {
          const next = card.nextElementSibling;
          if (next) {
            parent.insertBefore(next, card);
          }
        }
        updateCoverFlags();
      }

      function removeBlock(button) {
        const card = button.closest('.cloudinary-image-card');
        if (!card) return;
        card.remove();
        
        const container = document.getElementById('cloudinary-selected-images');
        if (!container) return;
        const blocks = container.querySelectorAll('.cloudinary-image-card');
        if (blocks.length === 0) {
          const pl = document.getElementById('empty-images-placeholder');
          if (pl) pl.style.display = 'block';
        }
        updateCoverFlags();
      }

      function updateCoverFlags() {
        const container = document.getElementById('cloudinary-selected-images');
        if (!container) return;
        const cards = container.querySelectorAll('.cloudinary-image-card');
        
        let checkedIdx = -1;
        const radios = container.querySelectorAll('input[name="imageCoverRadio"]');
        radios.forEach((radio, idx) => {
          if (radio.checked) {
            checkedIdx = idx;
          }
        });

        if (checkedIdx === -1 && radios.length > 0) {
          radios[0].checked = true;
          checkedIdx = 0;
        }

        cards.forEach((card, idx) => {
          const coverFlag = card.querySelector('.item-cover-flag');
          if (coverFlag) {
            coverFlag.value = (idx === checkedIdx) ? '1' : '0';
          }
        });
      }
    </script>
  `;
  res.send(renderPage('Admin Consola', html, req));
});

// Helper de extracción de IDs de Youtube
function extractYoutubeId(urlOrId) {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();

  // Si ya es un ID de 11 caracteres normal
  if (trimmed.length === 11) return trimmed;

  // Soporte directo para YouTube Shorts
  if (trimmed.includes('/shorts/')) {
    const parts = trimmed.split('/shorts/');
    const afterShorts = parts[1] || '';
    const id = afterShorts.split(/[?&#]/)[0];
    if (id && id.length === 11) {
      return id;
    }
  }

  // Soporte para patrones estándar
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }

  // Fallback con el objeto URL nativo
  try {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const vParam = urlObj.searchParams.get('v');
      if (vParam && vParam.length === 11) return vParam;

      const pathnameParts = urlObj.pathname.split('/');
      const lastPart = pathnameParts[pathnameParts.length - 1];
      if (lastPart && lastPart.length === 11) return lastPart;
    }
  } catch(e) {}

  return trimmed;
}

// Helper de estructuración de Podcast Spotify
function extractSpotifyInfo(url) {
  if (!url) return { embedUrl: '', spotifyUrl: '', embedHtml: '' };
  const trimmed = url.trim();
  if (trimmed.startsWith('<iframe')) {
    const srcMatch = trimmed.match(/src="([^"]+)"/);
    const src = srcMatch ? srcMatch[1] : '';
    return { embedUrl: src, spotifyUrl: src, embedHtml: trimmed };
  }
  let spotifyUrl = trimmed;
  let embedUrl = trimmed;
  if (trimmed.includes('spotify.com/show/')) {
    const parts = trimmed.split('/show/');
    const id = parts[1] ? parts[1].split('?')[0] : '';
    embedUrl = `https://open.spotify.com/embed/show/${id}`;
  } else if (trimmed.includes('spotify.com/episode/')) {
    const parts = trimmed.split('/episode/');
    const id = parts[1] ? parts[1].split('?')[0] : '';
    embedUrl = `https://open.spotify.com/embed/episode/${id}`;
  }
  const embedHtml = `<iframe style="border-radius:12px" src="${embedUrl}?utm_source=generator" width="100%" height="232" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  return { spotifyUrl, embedUrl, embedHtml };
}

// API endpoints to list and delete blog posts for admin asynchronously
app.get('/api/admin/blogs', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    const blogCatalog = blog.loadBlog();
    res.json({ posts: blogCatalog.posts || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error cargando artículos: ' + e.message });
  }
});

app.post('/api/admin/blogs/delete', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    const { slug } = req.body;
    const targetSlug = slug || req.query.slug;
    if (!targetSlug) {
      return res.status(400).json({ error: 'Slug de post requerido' });
    }
    blog.deletePost(targetSlug);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar post: ' + e.message });
  }
});

function buildLocalInfografiaSeo({ titulo, tema, categoria } = {}) {
  const cleanTitle = (titulo || 'Infografía católica').trim();
  const cleanTema = (tema || cleanTitle).trim();
  const cleanCategoria = (categoria || 'formación católica').trim();
  const metaBase = `${cleanTitle}: recurso visual de CatólicosGPT sobre ${cleanTema}, pensado para formación católica, catequesis y evangelización.`;
  const metaDescription = metaBase.length > 160 ? metaBase.slice(0, 157).trim() + '...' : metaBase;
  const keywords = [
    cleanTitle,
    cleanTema,
    cleanCategoria,
    'infografia catolica',
    'CatolicosGPT',
    'catequesis',
    'formacion catolica'
  ]
    .map(k => k.toLowerCase())
    .filter((k, idx, arr) => k && arr.indexOf(k) === idx)
    .join(', ');

  return { metaDescription, keywords };
}

// API: GENERAR SEO PARA INFOGRAFÍA USANDO GEMINI (AJAX)
app.post('/api/seo/generar-seo-infografia', async (req, res) => {
  const { titulo, tema, categoria } = req.body;
  if (!titulo) return res.json({ error: 'Falta título' });

  try {
    const aiInstance = getAi();
    if (!aiInstance) {
      return res.json({
        ...buildLocalInfografiaSeo({ titulo, tema, categoria }),
        warning: 'SEO generado localmente porque la IA no está disponible en este momento.'
      });
    }
    
    const seoPrompt = `Genera un metaDescription SEO y keywords para una infografía católica con la siguiente información:
Título: "${titulo}"
Tema/Santo: "${tema || 'Formación doctrinal'}"
Categoría: "${categoria || 'Doctrina'}"

Devuelve un JSON estrictamente con la estructura literal:
{
  "metaDescription": "Una descripción atractiva, enfocada en SEO de un máximo de 160 caracteres.",
  "keywords": "término1, término2, término3, ..."
}`;

    const response = await aiInstance.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: seoPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const resText = response.text || '';
    const parsed = JSON.parse(resText);
    return res.json(parsed);
  } catch(e) {
    console.error('[SEO IA Infografía Error]', e.message);
    return res.json({
      ...buildLocalInfografiaSeo({ titulo, tema, categoria }),
      warning: 'Gemini está sin cuota o temporalmente no disponible. Se completó el SEO con una versión local editable.'
    });
  }
});

// ACCIÓN: CREAR INFOGRAFÍA MANUALMENTE CON CAMPOS DE SEO E IMÁGENES MÚLTIPLES (CARRUSEL)
app.post('/admin/crear-infografia-manual', async (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { titulo, tema, categoria, metaDescription, keywords, tipoVisualizacion } = req.body;
  
  let imageUrls = req.body.imageUrls || [];
  let imageNames = req.body.imageNames || [];
  let imageAlts = req.body.imageAlts || [];
  let imageWidths = req.body.imageWidths || [];
  let imageHeights = req.body.imageHeights || [];
  let imageCovers = req.body.imageCovers || [];

  // Asegurar que todas las colecciones paralelas son arrays, incluso con un solo elemento enviado
  if (imageUrls && !Array.isArray(imageUrls)) imageUrls = [imageUrls];
  if (imageNames && !Array.isArray(imageNames)) imageNames = [imageNames];
  if (imageAlts && !Array.isArray(imageAlts)) imageAlts = [imageAlts];
  if (imageWidths && !Array.isArray(imageWidths)) imageWidths = [imageWidths];
  if (imageHeights && !Array.isArray(imageHeights)) imageHeights = [imageHeights];
  if (imageCovers && !Array.isArray(imageCovers)) imageCovers = [imageCovers];

  // Fallback a parser de URLs legacy si no se envió nada
  if (!imageUrls || imageUrls.length === 0 || (typeof imageUrls === 'string')) {
    const legacyUrlStr = req.body.imagenUrl || '';
    imageUrls = (typeof legacyUrlStr === 'string' ? [legacyUrlStr] : legacyUrlStr || [])
      .flatMap(str => str.split(/[\n,]+/))
      .map(u => u.trim())
      .filter(Boolean);
  }

  if (!titulo || !tema || imageUrls.length === 0) {
    return res.status(400).send('Falta información requerida o no has seleccionado ninguna imagen de Cloudinary.');
  }

  try {
    let slug = infografias.generateSlug(titulo); // Generar slug basado en el título real!
    const catalog = infografias.loadCatalog();
    catalog.infografias = catalog.infografias || [];
    
    const exists = catalog.infografias.some(i => i.slug === slug);
    const uniqueSlug = exists ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const imagenesParaGuardar = imageUrls.map((u, index) => {
      const name = imageNames[index] || `slide-${index + 1}.jpg`;
      const alt = imageAlts[index] || `${titulo} — Diapositiva ${index + 1}`;
      const w = parseInt(imageWidths[index]) || 1200;
      const h = parseInt(imageHeights[index]) || 1200;
      const esPortada = imageCovers[index] === '1';

      return {
        url: u,
        slide: index + 1,
        name,
        alt,
        width: w,
        height: h,
        esPortada,
        model: 'cloudinary-native',
        formato: w === h ? '1:1' : w > h ? '16:9' : '3:4',
        sizeLabel: w === h ? 'Cuadrado (1:1)' : w > h ? 'Horizontal' : 'Vertical'
      };
    });

    let finalDesc = metaDescription;
    let finalKeywords = keywords;

    // Si por alguna razón el SEO está vacío, realizamos auto-generación de contingencia
    if ((!finalDesc || !finalKeywords) && getAi()) {
      try {
        const aiInstance = getAi();
        const seoPrompt = `Genera un metaDescription SEO y keywords para una infografía católica con la siguiente información:
Título: "${titulo}"
Tema/Santo: "${tema}"
Categoría: "${categoria || 'Doctrina'}"

Devuelve un JSON estrictamente con la estructura literal:
{
  "metaDescription": "Una descripción atractiva, enfocada en SEO de un máximo de 160 caracteres.",
  "keywords": "término1, término2, término3, ..."
}`;
        const response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: seoPrompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        
        const resText = response.text || '';
        const parsed = JSON.parse(resText);
        if (parsed.metaDescription) finalDesc = parsed.metaDescription;
        if (parsed.keywords) finalKeywords = parsed.keywords;
      } catch(e) {
        console.error('[SEO Auto Fallback Error]', e.message);
      }
    }

    if (!finalDesc || !finalKeywords) {
      const localSeo = buildLocalInfografiaSeo({ titulo, tema, categoria });
      if (!finalDesc) finalDesc = localSeo.metaDescription;
      if (!finalKeywords) finalKeywords = localSeo.keywords;
    }

    const newInf = {
      id: `inf-${Date.now()}`,
      slug: uniqueSlug,
      tema,
      tipo: categoria || 'doctrinal',
      categoria: categoria || 'doctrinal',
      titulo,
      metaDescription: finalDesc,
      altText: titulo,
      tipoVisualizacion: tipoVisualizacion || 'continua',
      imagenes: imagenesParaGuardar,
      totalSlides: imagenesParaGuardar.length,
      formato: '1:1',
      userPlan: 'admin',
      userId: user.id,
      fechaCreacion: new Date().toISOString(),
      fechaISO: new Date().toISOString().slice(0, 10),
      publicado: true,
      keywords: finalKeywords
    };

    catalog.infografias.unshift(newInf);
    catalog.total = catalog.infografias.length;
    infografias.saveCatalog(catalog, newInf);

    res.redirect('/admin#infografias');
  } catch(e) {
    res.status(500).send('Error salvando infografia manual: ' + e.message);
  }
});

// ACCIÓN: CREAR O EDITAR POST DE BLOG CON OPCIÓN DE ENRIQUECIMIENTO IA (SEO AUTOMÁTICO)
app.post('/admin/crear-blog', async (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { titulo, categoria, contenidoMd, useAiS_SEO, imagenPortada, blog_original_slug } = req.body;
  if (!titulo || !contenidoMd) {
    return res.status(400).send('Faltan datos del artículo.');
  }

  try {
    let seoFields = {
      titulo: titulo,
      descripcion: `${titulo}. Formación espiritual católica profunda en CatólicosGPT.`,
      keywords: 'católico, teología, fe, blog, formación',
      altText: titulo,
      extracto: contenidoMd.slice(0, 150).replace(/[#*`]/g, '') + '...',
      categoria: categoria || 'catequesis'
    };

    const activeAi = getAi();
    if (activeAi) {
      console.log('[Blog Admin SEO IA] Enriqueciendo artículo de blog con Gemini automáticamente...');
      try {
        seoFields = await blog.enrichBlogWithAI(titulo, contenidoMd, activeAi);
      } catch(seoErr) {
        console.error('[Blog Admin SEO IA Error]', seoErr.message);
      }
    }

    const slug = blog.slugify(titulo);
    
    // Si se está editando y el slug ha cambiado, eliminar el post con el slug anterior
    if (blog_original_slug && blog_original_slug.trim() !== "" && blog_original_slug !== slug) {
      blog.deletePost(blog_original_slug);
    }

    let originalPost = null;
    if (blog_original_slug && blog_original_slug.trim() !== "") {
      originalPost = blog.getPostBySlug(blog_original_slug);
    }

    const finalPost = {
      slug,
      titulo: seoFields.titulo || titulo,
      categoria: seoFields.categoria || categoria || 'catequesis',
      contenidoMd,
      descripcion: seoFields.descripcion,
      keywords: seoFields.keywords,
      altText: seoFields.altText,
      extracto: seoFields.extracto,
      imagenPortada: imagenPortada || '',
      fechaCreacion: originalPost ? originalPost.fechaCreacion : new Date().toISOString(),
      publicado: true
    };

    blog.upsertPost(finalPost);
    res.redirect('/admin#blog');
  } catch(e) {
    res.status(500).send('Error creando post de blog: ' + e.message);
  }
});

// ACCIÓN: ELIMINAR POST DE BLOG
app.get('/admin/eliminar-blog', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');
  
  const { slug } = req.query;
  if (slug) {
    blog.deletePost(slug);
  }
  res.redirect('/admin#blog');
});

// ACCIÓN: ANEXAR VIDEO DE YOUTUBE
app.post('/admin/crear-video', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { titulo, youtubeId, canal, categoria, comentario } = req.body;
  if (!titulo || !youtubeId) {
    return res.status(400).send('Título e ID/Link de YouTube requeridos.');
  }

  try {
    const rawCatalog = videos.loadVideos();
    rawCatalog.videos = rawCatalog.videos || [];
    
    const parsedYtId = extractYoutubeId(youtubeId);
    const cleanId = `vid-${Date.now()}`;
    const slug = blog.slugify(titulo);

    const newVideo = {
      id: cleanId,
      slug,
      titulo,
      canal: canal || 'Canal Católico',
      youtubeId: parsedYtId,
      comentario: comentario || 'Video sugerido para formación católica.',
      categoria: categoria || 'liturgia',
      publicado: true
    };

    rawCatalog.videos.push(newVideo);
    rawCatalog.total = rawCatalog.videos.length;
    videos.saveVideos(rawCatalog, newVideo);

    res.redirect('/admin#videos');
  } catch(e) {
    res.status(500).send('Error guardando video: ' + e.message);
  }
});

// ACCIÓN: ELIMINAR VIDEO DE YOUTUBE
app.get('/admin/eliminar-video', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { id } = req.query;
  if (id) {
    videos.deleteVideo(id);
  }
  res.redirect('/admin#videos');
});

// ACCIÓN: INCRUSTAR PODCAST DE SPOTIFY
app.post('/admin/crear-podcast', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { titulo, spotifyUrl, autor, categoria, descripcion } = req.body;
  if (!titulo || !spotifyUrl) {
    return res.status(400).send('Título y URL de Spotify requeridos.');
  }

  try {
    const rawCatalog = podcast.loadPodcasts();
    rawCatalog.podcasts = rawCatalog.podcasts || [];

    const { spotifyUrl: sUrl, embedUrl, embedHtml } = extractSpotifyInfo(spotifyUrl);
    const cleanId = `pod-${Date.now()}`;
    const slug = blog.slugify(titulo);

    const newPodcast = {
      id: cleanId,
      slug,
      titulo,
      autor: autor || 'Expositor de Fe',
      descripcion: descripcion || 'Audio formativo recomendado.',
      embedUrl,
      embedHtml,
      spotifyUrl: sUrl,
      categoria: categoria || 'oracion',
      publicado: true
    };

    rawCatalog.podcasts.push(newPodcast);
    rawCatalog.total = rawCatalog.podcasts.length;
    podcast.savePodcasts(rawCatalog, newPodcast);

    res.redirect('/admin#podcasts');
  } catch(e) {
    res.status(500).send('Error guardando podcast: ' + e.message);
  }
});

// ACCIÓN: ELIMINAR PODCAST DE SPOTIFY
app.get('/admin/eliminar-podcast', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { id } = req.query;
  if (id) {
    podcast.deletePodcast(id);
  }
  res.redirect('/admin#podcasts');
});

app.get('/admin/eliminar-infografia', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No authorized');
  infografias.deleteInfografia(req.query.id);
  res.redirect('/admin#infografias');
});

app.get('/admin/marcar-infografia-del-dia', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');
  
  const { slug } = req.query;
  if (slug) {
    infografias.setInfografiaDelDia(slug);
  }
  res.redirect('/admin#infografias');
});

// ACCIÓN: CREAR O ACTUALIZAR SANTO EN EL SANTORAL
app.post('/admin/crear-santo', express.urlencoded({ extended: true }), async (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const {
    santo_original_slug,
    nombre,
    dia,
    mes_select,
    mes_index,
    tipo,
    lema,
    foto_url,
    infografia_url,
    biografia,
    patronato,
    nacimiento,
    muerte,
    canonizacion,
    santuario,
    seo_titulo,
    seo_descripcion,
    seo_keywords,
    es_santo_del_dia
  } = req.body;

  if (!nombre || !dia || !mes_select || !biografia) {
    return res.status(400).send('Nombre, día, mes y biografía son campos obligatorios.');
  }

  try {
    const aspectos_tabla = {
      "Nacimiento": nacimiento || "",
      "Fallecimiento": muerte || "",
      "Canonización": canonizacion || "",
      "Patronato": patronato || "",
      "Santuario Principal": santuario || "",
      "Festividad": `${dia} de ${mes_select}`
    };

    let finalSeoTitle = seo_titulo;
    let finalSeoDesc = seo_descripcion;
    let finalSeoKeywords = seo_keywords;

    const aiInstance = getAi();
    if ((!finalSeoTitle || !finalSeoDesc || !finalSeoKeywords) && aiInstance) {
      console.log(`[Santoral Admin SEO IA] Generando SEO automático para ${nombre} con Gemini...`);
      try {
        const seoPrompt = `Genera un título SEO optimizado en español (máx. 60 caracteres), una meta-descripción atractiva (máx. 160 caracteres) y palabras clave (keywords) separadas por comas para el perfil del siguiente santo católico:
Nombre del Santo: "${nombre}"
Biografía (extracto): "${biografia.slice(0, 1000)}"
Lema/Jaculatoria: "${lema || ''}"
Tipo: "${tipo || 'Memoria Litúrgica'}"

Devuelve un JSON estrictamente con la estructura literal:
{
  "seo_titulo": "Título SEO",
  "seo_descripcion": "Descripción SEO",
  "seo_keywords": "palabra1, palabra2, ..."
}`;
        const response = await aiInstance.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: seoPrompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        });
        const resText = response.text || '';
        const parsed = JSON.parse(resText);
        if (parsed.seo_titulo) finalSeoTitle = parsed.seo_titulo;
        if (parsed.seo_descripcion) finalSeoDesc = parsed.seo_descripcion;
        if (parsed.seo_keywords) finalSeoKeywords = parsed.seo_keywords;
      } catch (err) {
        console.error('[SEO IA Santo Error]', err.message);
      }
    }

    const santoData = {
      nombre,
      dia: parseInt(dia),
      mes: mes_select,
      mes_index,
      tipo: tipo || "Memoria Litúrgica",
      lema: lema || "",
      foto_url: foto_url || "",
      infografia_url: infografia_url || "",
      biografia,
      aspectos_tabla,
      esSantoDelDia: es_santo_del_dia === '1',
      seo_titulo: finalSeoTitle || `${nombre} — Santo del Día | CatólicosGPT`,
      seo_descripcion: finalSeoDesc || `Conoce la vida y obra de ${nombre}. Biografía completa en el Santoral de CatólicosGPT.`,
      seo_keywords: finalSeoKeywords || `santo del dia, ${nombre}, santoral, vida de santos`
    };

    if (santo_original_slug && santo_original_slug.trim() !== "") {
      // Actualización
      santoral.updateSaint(santo_original_slug, santoData);
    } else {
      // Creación
      santoral.createSaint(santoData);
    }

    res.redirect('/admin#santoral');
  } catch (e) {
    res.status(500).send('Error guardando santo: ' + e.message);
  }
});

// ACCIÓN: ELIMINAR SANTO DEL SANTORAL
app.get('/admin/eliminar-santo', (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') return res.status(403).send('No autorizado');

  const { slug } = req.query;
  if (slug) {
    santoral.deleteSaint(slug);
  }
  res.redirect('/admin#santoral');
});

// ── SISTEMA INTEGRADO DE NAVEGACIÓN Y SELECCIÓN DE RECURSOS CLOUDINARY ──
app.get('/api/admin/cloudinary/resources', async (req, res) => {
  const user = getAuthedUser(req);
  if (!user || user.plan !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { type, folder, search } = req.query;

  // Verificar si hay configuración real de Cloudinary activa
  const hasCloudinary = process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
  if (!hasCloudinary) {
    return res.status(503).json({
      error: 'Cloudinary real no está configurado. Define CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Google Cloud.',
      resources: [],
      folders: [],
      cloudName: CLOUDINARY_CLOUD_NAME,
      source: 'cloudinary'
    });
  }

  try {
    console.log('[Cloudinary API] Conectando con servidor real de Cloudinary...');
    const cloudinaryMod = require('cloudinary').v2;
    cloudinaryMod.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    let query = cloudinaryMod.search;
    
    let expressions = [];
    if (folder) {
      expressions.push(`folder:${folder}*`);
    }
    if (type && type !== 'all') {
      if (type === 'audio') {
        expressions.push('resource_type:video AND format:(mp3|wav|ogg|aac|m4a)');
      } else {
        expressions.push(`resource_type:${type}`);
      }
    }
    if (search) {
      expressions.push(`${search}*`);
    }
    
    if (expressions.length > 0) {
      query = query.expression(expressions.join(' AND '));
    } else {
      query = query.expression('resource_type:image OR resource_type:video');
    }

    const searchResult = await query.max_results(100).execute();
    
    const resourcesFormatted = (searchResult.resources || []).map(r => ({
      public_id: r.public_id,
      url: r.secure_url || r.url,
      name: (r.filename || r.public_id.split('/').pop()) + '.' + (r.format || 'jpg'),
      format: r.format || 'jpg',
      resource_type: r.resource_type === 'video' && ['mp3','wav','ogg','aac','m4a'].includes(r.format) ? 'audio' : r.resource_type,
      bytes: r.bytes,
      width: r.width || 1200,
      height: r.height || 1200,
      folder: r.asset_folder || r.folder || (r.public_id && r.public_id.includes('/') ? r.public_id.split('/').slice(0, -1).join('/') : '') || folder || 'general',
      created_at: r.created_at
    }));

    let folders = [];
    try {
      const foldersResult = await cloudinaryMod.api.root_folders();
      folders = (foldersResult.folders || []).map(f => f.name);
    } catch (fErr) {
      console.warn('[Cloudinary API] No se pudieron leer carpetas raíz:', fErr.message);
    }

    const foldersFromResources = [...new Set(resourcesFormatted.map(r => r.folder).filter(Boolean))];
    folders = [...new Set([...folders, ...foldersFromResources])].sort((a, b) => a.localeCompare(b));

    return res.json({ resources: resourcesFormatted, folders, cloudName: CLOUDINARY_CLOUD_NAME, source: 'cloudinary' });
  } catch (realErr) {
    console.error('[Cloudinary API Error] Error llamando a API real:', realErr.message);
    return res.status(502).json({
      error: 'No se pudo conectar con tu repositorio real de Cloudinary: ' + realErr.message,
      resources: [],
      folders: [],
      cloudName: CLOUDINARY_CLOUD_NAME,
      source: 'cloudinary'
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVACIÓN DEL ESCUCHADOR PUERTO 3000
// ════════════════════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CatólicosGPT v77] Servidor central corriendo en http://localhost:${PORT}`);
});
