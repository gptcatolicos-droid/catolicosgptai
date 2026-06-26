// ════════════════════════════════════════════════════════════════
// SANTORAL MODULE — Base de datos inteligente para el Santoral Católico
// Auto-generación con IA, SEO Indexable, Soporte para Administrador
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SANTORAL_FILE = path.join(DATA_DIR, 'santoral-db.json');
const ORIGINAL_SANTOS_FILE = path.join(DATA_DIR, 'santos.json');

const mesesEnEspanol = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
};

function getAi() {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9 -]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Collapse whitespace
    .replace(/-+/g, '-') // Collapse dashes
    .trim()
    .replace(/(^-|-$)/g, ''); // Trim leading/trailing dashes
}

// Carga la base de datos de santoral enriquecida
function loadSantoral() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(SANTORAL_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SANTORAL_FILE, 'utf-8'));
      return data;
    } catch (e) {
      console.error('[Santoral DB] Error al leer base de datos, reestructurando:', e.message);
    }
  }

  // Si no existe, inicializar con estructura básica
  const db = {
    santos: []
  };
  saveSantoral(db);
  return db;
}

function saveSantoral(db, itemToSync = null) {
  const nuevoTotal = (db && db.santos) ? db.santos.length : 0;
  if (nuevoTotal === 0) {
    try {
      const existente = JSON.parse(fs.readFileSync(SANTORAL_FILE, 'utf-8'));
      if (existente && existente.santos && existente.santos.length > 0) {
        console.error('[Santoral DB] BLOQUEADO: intento de guardar santoral vacío sobre datos existentes.');
        return false;
      }
    } catch (e) {}
  }
  try {
    fs.writeFileSync(SANTORAL_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Santoral DB] Error al guardar base de datos:', e.message);
  }

  if (itemToSync) {
    try {
      const firebaseSync = require('./firebase-module');
      firebaseSync.syncUploadSanto(itemToSync).catch(err => {
        console.error('[Firebase Sync] Error al sincronizar santo:', err.message);
      });
    } catch (e) {}
  }
  return true;
}

// Retorna el santo del día basándose en el calendario y genera biografía completa si es necesario
async function getOrCreateDailySaint(dia, mesIndex) {
  const db = loadSantoral();
  const mesNombre = mesesEnEspanol[mesIndex] || 'Junio';
  
  // Buscar santo para este día y mes
  let santo = db.santos.find(s => parseInt(s.dia) === parseInt(dia) && s.mes.toLowerCase() === mesNombre.toLowerCase());
  
  if (santo) {
    return santo;
  }

  // Buscar en santos.json original para ver si tenemos un nombre base
  let nombreBase = 'Santo Celebrado Hoy';
  let tipoBase = 'Memoria Litúrgica';
  let descBase = 'Biografía doctrinal e histórica en preparación.';
  
  try {
    if (fs.existsSync(ORIGINAL_SANTOS_FILE)) {
      const originalSantos = JSON.parse(fs.readFileSync(ORIGINAL_SANTOS_FILE, 'utf-8'));
      const arraySants = originalSantos.santos_por_mes?.[mesNombre.toLowerCase()] || [];
      const match = arraySants.find(s => parseInt(s.dia) === parseInt(dia));
      if (match) {
        nombreBase = match.nombre;
        tipoBase = match.tipo || 'Memoria Litúrgica';
        descBase = match.descripcion || descBase;
      }
    }
  } catch (e) {
    console.error('[Santoral] Error cargando santos.json original:', e.message);
  }

  // Generar un slug único para este santo
  let originalSlug = slugify(nombreBase);
  let slug = originalSlug;
  let counter = 1;
  while (db.santos.some(s => s.slug === slug)) {
    slug = `${originalSlug}-${counter}`;
    counter++;
  }

  // Intentar enriquecer usando Gemini
  const aiInstance = getAi();
  let richData = {
    nombre: nombreBase,
    tipo: tipoBase,
    lema: '"Mi alma glorifica al Señor."',
    biografia: descBase,
    aspectos_tabla: {
      "Nombre completo": nombreBase,
      "Fecha de Celebración": `${dia} de ${mesNombre}`,
      "Grado litúrgico": tipoBase,
      "Virtudes principales": "Fe, Esperanza, Caridad"
    },
    foto_url: "",
    infografia_url: "",
    seo_titulo: `${nombreBase} — Santo del Día, Vida y Obra | CatólicosGPT`,
    seo_descripcion: `Biografía completa de ${nombreBase}. Descubre su vida, obra, milagros, y legado espiritual en el Santoral de CatólicosGPT.`,
    seo_keywords: `santo del dia, ${nombreBase}, santoral catolico, vida de santos`
  };

  if (aiInstance) {
    try {
      console.log(`[Santoral IA] Auto-generando biografía completa para: ${nombreBase} (${dia} de ${mesNombre})`);
      const prompt = `Actúa como un teólogo erudito, hagiógrafo oficial de la Iglesia Católica y redactor jefe de SEO para CatólicosGPT.
Queremos una biografía de alta fidelidad, profunda, hermosa, doctrinal e indexable sobre el santo/fiesta celebrado el día ${dia} de ${mesNombre} en el Calendario Litúrgico Católico o Martirologio Romano: "${nombreBase}".

Devuelve exclusivamente un JSON válido y legible en español con la estructura exacta de abajo, sin bloques de código markdown ni \`\`\`json:
{
  "nombre": "Nombre litúrgico completo del Santo, p. ej. 'San Josemaría Escrivá de Balaguer'",
  "tipo": "Grado litúrgico, p. ej. 'Memoria Obligatoria', 'Solemnidad' o 'Fiesta'",
  "lema": "Una jaculatoria tradicional, oración corta de intercesión o frase profunda que exprese su espíritu o dicho escrito",
  "biografia": "Una narración biográfica y devocional extraordinariamente detallada, profunda y exquisitamente redactada, de un mínimo de 600 palabras, estructurada intelectualmente. Explica con esmero su origen familiar, su conversión o vocación mística/religiosa, las pruebas históricas que superó, su amor por la Eucaristía/Prójimo, los milagros o escritos teológicos por los que es recordado, y una profunda analogía de cómo su ejemplo brilla y nos enseña en el año 2026. Emplea saltos de línea para estructurar la lectura en párrafos limpios.",
  "aspectos_tabla": {
    "Nacimiento": "Lugar y fecha de nacimiento",
    "Fallecimiento": "Lugar y fecha de fallecimiento",
    "Beatificación": "Fecha y Papa que lo beatificó (si aplica)",
    "Canonización": "Fecha y Papa que lo canonizó (si aplica)",
    "Patronato": "De qué grupos, causas o profesiones es santo patrón",
    "Atributos principales": "Objetos o símbolos con que se le representa en el arte sacro",
    "Obra destacada": "Principales escritos, fundaciones o hitos apostólicos",
    "Festividad": "${dia} de ${mesNombre}"
  },
  "seo_titulo": "Título SEO optimizado de menos de 60 caracteres, p. ej. 'San Josemaría Escrivá: Biografía, Vida y Obra | CatólicosGPT'",
  "seo_descripcion": "Meta-descripción SEO persuasiva de menos de 160 caracteres sobre su vida y legado.",
  "seo_keywords": "Palabras clave separadas por comas, ej: san josemaria escriva, santoral, santo del dia, opus dei"
}`;

      const response = await aiInstance.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });

      let text = response.text || '';
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      if (parsed.nombre && parsed.biografia) {
        richData = { ...richData, ...parsed };
      }
    } catch (e) {
      console.error('[Santoral IA] Error generando datos ricos con Gemini:', e.message);
    }
  }

  // Construir el objeto completo
  const nuevoSanto = {
    slug,
    dia: parseInt(dia),
    mes: mesNombre,
    mes_index: mesIndex,
    nombre: richData.nombre,
    tipo: richData.tipo,
    lema: richData.lema,
    biografia: richData.biografia,
    aspectos_tabla: richData.aspectos_tabla,
    foto_url: richData.foto_url || "",
    infografia_url: richData.infografia_url || "",
    seo_titulo: richData.seo_titulo,
    seo_descripcion: richData.seo_descripcion,
    seo_keywords: richData.seo_keywords,
    creado_por_admin: false,
    fechaCreacion: new Date().toISOString()
  };

  db.santos.push(nuevoSanto);
  saveSantoral(db, nuevoSanto);
  return nuevoSanto;
}

// Obtener un santo por su slug
function getSaintBySlug(slug) {
  const db = loadSantoral();
  return db.santos.find(s => s.slug === slug) || null;
}

// Crear un santo manualmente por el Administrador
function createSaint(data) {
  const db = loadSantoral();
  
  let originalSlug = slugify(data.nombre);
  let slug = originalSlug;
  let counter = 1;
  while (db.santos.some(s => s.slug === slug)) {
    slug = `${originalSlug}-${counter}`;
    counter++;
  }

  const nuevoSanto = {
    slug,
    dia: parseInt(data.dia) || 1,
    mes: data.mes || 'Enero',
    mes_index: data.mes_index || '01',
    nombre: data.nombre,
    tipo: data.tipo || 'Memoria Litúrgica',
    lema: data.lema || '',
    biografia: data.biografia || '',
    aspectos_tabla: data.aspectos_tabla || {},
    foto_url: data.foto_url || "",
    infografia_url: data.infografia_url || "",
    seo_titulo: data.seo_titulo || `${data.nombre} | CatólicosGPT`,
    seo_descripcion: data.seo_descripcion || `Biografía de ${data.nombre}.`,
    seo_keywords: data.seo_keywords || `santo, santoral, ${data.nombre}`,
    creado_por_admin: true,
    fechaCreacion: new Date().toISOString()
  };

  db.santos.push(nuevoSanto);
  saveSantoral(db, nuevoSanto);
  return nuevoSanto;
}

// Actualizar un santo por su slug
function updateSaint(slug, updatedData) {
  const db = loadSantoral();
  const idx = db.santos.findIndex(s => s.slug === slug);
  if (idx === -1) return null;

  db.santos[idx] = {
    ...db.santos[idx],
    ...updatedData,
    dia: parseInt(updatedData.dia) || db.santos[idx].dia,
    aspectos_tabla: typeof updatedData.aspectos_tabla === 'string' 
      ? JSON.parse(updatedData.aspectos_tabla) 
      : (updatedData.aspectos_tabla || db.santos[idx].aspectos_tabla),
    fechaModificacion: new Date().toISOString()
  };

  saveSantoral(db, db.santos[idx]);

  return db.santos[idx];
}

// Obtener todos los santos en la DB para el administrador
function getAllSaints() {
  const db = loadSantoral();
  return db.santos;
}

// Eliminar un santo por su slug
function deleteSaint(slug) {
  const db = loadSantoral();
  db.santos = db.santos.filter(s => s.slug !== slug);
  saveSantoral(db);

  try {
    const firebaseSync = require('./firebase-module');
    firebaseSync.syncDeleteSanto(slug).catch(err => {
      console.error('[Firebase Sync] Error al eliminar santo de Firestore:', err.message);
    });
  } catch (e) {}

  return true;
}

module.exports = {
  getOrCreateDailySaint,
  getSaintBySlug,
  createSaint,
  updateSaint,
  deleteSaint,
  getAllSaints,
  loadSantoral,
  saveSantoral,
  slugify
};
