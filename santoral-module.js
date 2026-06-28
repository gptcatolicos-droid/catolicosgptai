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

const SEO_BASE_KEYWORDS = 'catolicosgpt, catolicos gpt, ia catolica, inteligencia artificial catolica, la ia catolica #1 en espanol';
const SANTORAL_REFERENCE = 'Martirologio Romano; Vatican News; ACI Prensa; EWTN';

const SANTORAL_SUPPLEMENT = [
  ['01', 1, 'Santa María, Madre de Dios', 'Solemnidad', 'Santa María, Madre de Dios, ruega por nosotros.'],
  ['01', 2, 'Santos Basilio Magno y Gregorio Nacianceno', 'Memoria Obligatoria', 'La fe se comprende mejor cuando se vive en la Iglesia.'],
  ['01', 17, 'San Antonio Abad', 'Memoria Obligatoria', 'Nada antepongas al amor de Cristo.'],
  ['01', 21, 'Santa Inés', 'Memoria Obligatoria', 'Cristo es mi esposo y mi corona.'],
  ['01', 24, 'San Francisco de Sales', 'Memoria Obligatoria', 'Todo por amor, nada por fuerza.'],
  ['01', 25, 'Conversión de San Pablo', 'Fiesta', 'Señor, ¿qué quieres que haga?'],
  ['01', 26, 'Santos Timoteo y Tito', 'Memoria Obligatoria', 'Guarda el buen depósito de la fe.'],
  ['01', 28, 'Santo Tomás de Aquino', 'Memoria Obligatoria', 'Contemplar y dar a otros lo contemplado.'],
  ['01', 31, 'San Juan Bosco', 'Memoria Obligatoria', 'Dadme almas y llevaos lo demás.'],
  ['02', 2, 'Presentación del Señor', 'Fiesta', 'Luz para alumbrar a las naciones.'],
  ['02', 3, 'San Blas', 'Memoria Libre', 'Protege nuestra voz para bendecir al Señor.'],
  ['02', 11, 'Nuestra Señora de Lourdes', 'Memoria Libre', 'Yo soy la Inmaculada Concepción.'],
  ['02', 14, 'Santos Cirilo y Metodio', 'Fiesta', 'Evangelizar es traducir la fe al corazón de los pueblos.'],
  ['02', 22, 'Cátedra de San Pedro', 'Fiesta', 'Tú eres Pedro, y sobre esta piedra edificaré mi Iglesia.'],
  ['03', 19, 'San José, Esposo de la Virgen María', 'Solemnidad', 'San José, custodio del Redentor, ruega por nosotros.'],
  ['03', 25, 'Anunciación del Señor', 'Solemnidad', 'Hágase en mí según tu palabra.'],
  ['04', 25, 'San Marcos Evangelista', 'Fiesta', 'Proclamad el Evangelio a toda criatura.'],
  ['04', 29, 'Santa Catalina de Siena', 'Fiesta', 'Si sois lo que debéis ser, prenderéis fuego al mundo.'],
  ['05', 1, 'San José Obrero', 'Memoria Libre', 'El trabajo hecho con amor santifica la vida diaria.'],
  ['05', 3, 'Santos Felipe y Santiago, apóstoles', 'Fiesta', 'Muéstranos al Padre y nos basta.'],
  ['05', 13, 'Nuestra Señora de Fátima', 'Memoria Libre', 'Mi Inmaculado Corazón será tu refugio.'],
  ['05', 14, 'San Matías Apóstol', 'Fiesta', 'Testigo de la Resurrección de Cristo.'],
  ['05', 31, 'Visitación de la Virgen María', 'Fiesta', 'Mi alma glorifica al Señor.'],
  ['06', 11, 'San Bernabé Apóstol', 'Memoria Obligatoria', 'Hijo de la consolación, anima nuestra fe.'],
  ['06', 13, 'San Antonio de Padua', 'Memoria Obligatoria', 'El Evangelio vivido predica más que las palabras.'],
  ['06', 24, 'Natividad de San Juan Bautista', 'Solemnidad', 'Conviene que Cristo crezca y yo disminuya.'],
  ['06', 29, 'Santos Pedro y Pablo', 'Solemnidad', 'Dos columnas apostólicas de la Iglesia.'],
  ['07', 3, 'Santo Tomás Apóstol', 'Fiesta', 'Señor mío y Dios mío.'],
  ['07', 11, 'San Benito Abad', 'Fiesta', 'Ora et labora.'],
  ['07', 16, 'Nuestra Señora del Carmen', 'Memoria Libre', 'Madre del Carmelo, condúcenos a Cristo.'],
  ['07', 22, 'Santa María Magdalena', 'Fiesta', 'He visto al Señor.'],
  ['07', 25, 'Santiago Apóstol', 'Fiesta', 'Apóstol peregrino, fortalece nuestra misión.'],
  ['07', 26, 'Santos Joaquín y Ana', 'Memoria Obligatoria', 'Raíces santas de la familia de María.'],
  ['07', 31, 'San Ignacio de Loyola', 'Memoria Obligatoria', 'En todo amar y servir.'],
  ['08', 1, 'San Alfonso María de Ligorio', 'Memoria Obligatoria', 'La oración es el gran medio de salvación.'],
  ['08', 4, 'San Juan María Vianney', 'Memoria Obligatoria', 'El sacerdocio es el amor del Corazón de Jesús.'],
  ['08', 6, 'Transfiguración del Señor', 'Fiesta', 'Este es mi Hijo amado: escuchadlo.'],
  ['08', 8, 'Santo Domingo de Guzmán', 'Memoria Obligatoria', 'Hablar con Dios o de Dios.'],
  ['08', 10, 'San Lorenzo Diácono y Mártir', 'Fiesta', 'Los pobres son el tesoro de la Iglesia.'],
  ['08', 11, 'Santa Clara de Asís', 'Memoria Obligatoria', 'Mira a Cristo, considera a Cristo, contempla a Cristo.'],
  ['08', 14, 'San Maximiliano María Kolbe', 'Memoria Obligatoria', 'Solo el amor crea.'],
  ['08', 15, 'Asunción de la Virgen María', 'Solemnidad', 'María fue llevada al cielo en cuerpo y alma.'],
  ['08', 20, 'San Bernardo de Claraval', 'Memoria Obligatoria', 'Mira la estrella, invoca a María.'],
  ['08', 21, 'San Pío X', 'Memoria Obligatoria', 'Restaurar todas las cosas en Cristo.'],
  ['08', 22, 'Santa María Reina', 'Memoria Obligatoria', 'Reina del cielo, ruega por nosotros.'],
  ['08', 24, 'San Bartolomé Apóstol', 'Fiesta', 'Un israelita de verdad, sin doblez.'],
  ['08', 27, 'Santa Mónica', 'Memoria Obligatoria', 'Las lágrimas de una madre pueden abrir caminos de gracia.'],
  ['08', 28, 'San Agustín', 'Memoria Obligatoria', 'Nos hiciste para ti, Señor.'],
  ['08', 29, 'Martirio de San Juan Bautista', 'Memoria Obligatoria', 'La verdad se anuncia aunque cueste la vida.'],
  ['09', 3, 'San Gregorio Magno', 'Memoria Obligatoria', 'Servidor de los servidores de Dios.'],
  ['09', 8, 'Natividad de la Virgen María', 'Fiesta', 'Tu nacimiento, Virgen Madre de Dios, anunció la alegría al mundo.'],
  ['09', 14, 'Exaltación de la Santa Cruz', 'Fiesta', 'En la Cruz está la salvación.'],
  ['09', 15, 'Nuestra Señora de los Dolores', 'Memoria Obligatoria', 'Una espada atravesará tu alma.'],
  ['09', 21, 'San Mateo Apóstol y Evangelista', 'Fiesta', 'Sígueme.'],
  ['09', 23, 'San Pío de Pietrelcina', 'Memoria Obligatoria', 'Reza, espera y no te preocupes.'],
  ['09', 29, 'Santos Arcángeles Miguel, Gabriel y Rafael', 'Fiesta', 'Defiéndenos, anúncianos y condúcenos.'],
  ['09', 30, 'San Jerónimo', 'Memoria Obligatoria', 'Ignorar las Escrituras es ignorar a Cristo.'],
  ['10', 1, 'Santa Teresa del Niño Jesús', 'Memoria Obligatoria', 'Mi vocación es el amor.'],
  ['10', 2, 'Santos Ángeles Custodios', 'Memoria Obligatoria', 'Ángel de mi guarda, dulce compañía.'],
  ['10', 4, 'San Francisco de Asís', 'Memoria Obligatoria', 'Señor, hazme un instrumento de tu paz.'],
  ['10', 7, 'Nuestra Señora del Rosario', 'Memoria Obligatoria', 'Con María contemplamos el rostro de Cristo.'],
  ['10', 15, 'Santa Teresa de Jesús', 'Memoria Obligatoria', 'Solo Dios basta.'],
  ['10', 18, 'San Lucas Evangelista', 'Fiesta', 'Médico y evangelista de la misericordia.'],
  ['10', 22, 'San Juan Pablo II', 'Memoria Libre', 'No tengáis miedo. Abrid las puertas a Cristo.'],
  ['10', 28, 'Santos Simón y Judas, apóstoles', 'Fiesta', 'Apóstoles fieles del Señor.'],
  ['11', 1, 'Todos los Santos', 'Solemnidad', 'La santidad es la vocación de todos los bautizados.'],
  ['11', 2, 'Conmemoración de los Fieles Difuntos', 'Conmemoración', 'Dales, Señor, el descanso eterno.'],
  ['11', 4, 'San Carlos Borromeo', 'Memoria Obligatoria', 'El pastor se entrega por su pueblo.'],
  ['11', 9, 'Dedicación de la Basílica de Letrán', 'Fiesta', 'Somos templo vivo de Dios.'],
  ['11', 11, 'San Martín de Tours', 'Memoria Obligatoria', 'Cristo está presente en el pobre.'],
  ['11', 21, 'Presentación de la Virgen María', 'Memoria Obligatoria', 'María se entrega enteramente al Señor.'],
  ['11', 22, 'Santa Cecilia', 'Memoria Obligatoria', 'Cantad a Dios con el corazón.'],
  ['11', 30, 'San Andrés Apóstol', 'Fiesta', 'Hemos encontrado al Mesías.'],
  ['12', 3, 'San Francisco Javier', 'Memoria Obligatoria', 'Ay de mí si no anuncio el Evangelio.'],
  ['12', 6, 'San Nicolás de Bari', 'Memoria Libre', 'La caridad discreta revela a Cristo.'],
  ['12', 8, 'Inmaculada Concepción de la Virgen María', 'Solemnidad', 'Llena de gracia desde el primer instante.'],
  ['12', 12, 'Nuestra Señora de Guadalupe', 'Fiesta', '¿No estoy yo aquí, que soy tu Madre?'],
  ['12', 13, 'Santa Lucía', 'Memoria Obligatoria', 'La luz de Cristo vence la oscuridad.'],
  ['12', 14, 'San Juan de la Cruz', 'Memoria Obligatoria', 'Al atardecer de la vida seremos examinados en el amor.'],
  ['12', 25, 'Natividad del Señor', 'Solemnidad', 'El Verbo se hizo carne y habitó entre nosotros.'],
  ['12', 26, 'San Esteban Protomártir', 'Fiesta', 'Señor, no les tengas en cuenta este pecado.'],
  ['12', 27, 'San Juan Apóstol y Evangelista', 'Fiesta', 'Dios es amor.'],
  ['12', 28, 'Santos Inocentes Mártires', 'Fiesta', 'Los pequeños son preciosos ante Dios.'],
  ['12', 31, 'San Silvestre I, papa', 'Memoria Libre', 'La Iglesia persevera en la historia con Cristo.']
];

function buildSupplementalSaint([mesIndex, dia, nombre, tipo, lema]) {
  const mes = mesesEnEspanol[mesIndex] || 'Enero';
  return {
    slug: slugify(nombre),
    dia,
    mes,
    mes_index: mesIndex,
    nombre,
    tipo,
    lema,
    biografia: `${nombre}\n\nVida y obra\n${nombre} se celebra el ${dia} de ${mes} dentro del santoral católico. Su memoria ayuda a la Iglesia a contemplar cómo la gracia de Cristo transforma la historia concreta de personas, familias, pueblos y comunidades.\n\nMilagros, devoción y legado espiritual\nLa devoción católica no mira a los santos como sustitutos de Cristo, sino como testigos que conducen a Él. Su ejemplo invita a vivir la fe con oración, caridad, fidelidad sacramental y obediencia al Evangelio.\n\nPreguntas para catequesis\n¿Qué virtud enseña este santo o fiesta? ¿Cómo puede una familia vivir hoy su mensaje? ¿Qué práctica concreta de oración, servicio o conversión propone su testimonio?`,
    aspectos_tabla: {
      "Festividad": `${dia} de ${mes}`,
      "Grado litúrgico": tipo,
      "Fuentes de referencia": SANTORAL_REFERENCE,
      "Enfoque catequético": "Vida de santos, santoral católico, devoción y formación espiritual"
    },
    foto_url: "",
    infografia_url: "",
    seo_titulo: `${nombre}: vida, obra y fiesta | CatólicosGPT`,
    seo_descripcion: `Conoce ${nombre}: vida, devoción, legado espiritual y celebración en el santoral católico de CatólicosGPT.`,
    seo_keywords: `${slugify(nombre).replace(/-/g, ' ')}, ${nombre}, santoral catolico, santo del dia, vida de santos, ${SEO_BASE_KEYWORDS}`,
    fuentes_referencia: SANTORAL_REFERENCE,
    creado_por_admin: false,
    fuente: 'Santoral complementario CatólicosGPT',
    fechaCreacion: new Date().toISOString()
  };
}

function sameLiturgicalDay(a, b) {
  return parseInt(a && a.dia) === parseInt(b && b.dia) &&
    String(a && a.mes_index || '').padStart(2, '0') === String(b && b.mes_index || '').padStart(2, '0');
}

function clearFeaturedForSameDay(db, daySource, keepSlug = null) {
  if (!db || !Array.isArray(db.santos) || !daySource) return db;
  db.santos = db.santos.map(s => {
    if (sameLiturgicalDay(s, daySource) && s.slug !== keepSlug) {
      return { ...s, esSantoDelDia: false };
    }
    return s;
  });
  return db;
}

function mergeSupplementalSantoral(db) {
  const target = db && Array.isArray(db.santos) ? db : { santos: [] };
  const bySlug = new Map(target.santos.map(s => [s.slug, s]));
  let changed = false;

  SANTORAL_SUPPLEMENT.map(buildSupplementalSaint).forEach(extra => {
    const existing = bySlug.get(extra.slug);
    if (!existing) {
      target.santos.push(extra);
      bySlug.set(extra.slug, extra);
      changed = true;
      return;
    }
    const filled = { ...existing };
    let localChanged = false;
    ['tipo', 'lema', 'biografia', 'seo_titulo', 'seo_descripcion', 'seo_keywords', 'fuentes_referencia'].forEach(key => {
      if (!filled[key] && extra[key]) {
        filled[key] = extra[key];
        localChanged = true;
      }
    });
    if (!filled.aspectos_tabla || Object.keys(filled.aspectos_tabla).length === 0) {
      filled.aspectos_tabla = extra.aspectos_tabla;
      localChanged = true;
    }
    if (localChanged) {
      const idx = target.santos.findIndex(s => s.slug === extra.slug);
      if (idx >= 0) target.santos[idx] = filled;
      changed = true;
    }
  });

  target.total = target.santos.length;
  if (changed) saveSantoral(target);
  return target;
}

// Carga la base de datos de santoral enriquecida
function loadSantoral() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(SANTORAL_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SANTORAL_FILE, 'utf-8'));
      if (data && Array.isArray(data.santos)) {
        return mergeSupplementalSantoral(data);
      }
    } catch (e) {
      console.error('[Santoral DB] Error al leer base de datos, intentando base inicial:', e.message);
    }
  }

  try {
    console.log('[Santoral Bulk] Base no encontrada; generando santoral completo de 365 días...');
    const bulk = require('./scripts/generate-bulk-content');
    const generated = bulk.generateSantoral();
    const merged = mergeSupplementalSantoral(generated);
    saveSantoral(merged);
    return merged;
  } catch (e) {
    console.error('[Santoral Bulk] No se pudo generar santoral completo:', e.message);
    const merged = mergeSupplementalSantoral({ santos: [] });
    saveSantoral(merged);
    return merged;
  }
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

  const destacado = db.santos.find(s =>
    s.esSantoDelDia === true &&
    parseInt(s.dia) === parseInt(dia) &&
    String(s.mes || '').toLowerCase() === mesNombre.toLowerCase()
  );
  if (destacado) {
    return destacado;
  }
  
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
    esSantoDelDia: data.esSantoDelDia === true,
    creado_por_admin: true,
    fechaCreacion: new Date().toISOString()
  };

  if (nuevoSanto.esSantoDelDia) clearFeaturedForSameDay(db, nuevoSanto);
  db.santos.push(nuevoSanto);
  saveSantoral(db, nuevoSanto);
  return nuevoSanto;
}

// Actualizar un santo por su slug
function updateSaint(slug, updatedData) {
  const db = loadSantoral();
  const idx = db.santos.findIndex(s => s.slug === slug);
  if (idx === -1) return null;

  const mergedData = {
    ...db.santos[idx],
    ...updatedData,
    dia: parseInt(updatedData.dia) || db.santos[idx].dia,
    aspectos_tabla: typeof updatedData.aspectos_tabla === 'string' 
      ? JSON.parse(updatedData.aspectos_tabla) 
      : (updatedData.aspectos_tabla || db.santos[idx].aspectos_tabla),
    fechaModificacion: new Date().toISOString()
  };
  if (mergedData.esSantoDelDia === true) clearFeaturedForSameDay(db, mergedData, mergedData.slug);
  db.santos[idx] = mergedData;

  saveSantoral(db, db.santos[idx]);

  return db.santos[idx];
}

function getFeaturedSaintForDay(dia, mesIndex) {
  const db = loadSantoral();
  const mesNombre = mesesEnEspanol[String(mesIndex).padStart(2, '0')] || '';
  const sameDay = (db.santos || []).filter(s =>
    parseInt(s.dia) === parseInt(dia) &&
    String(s.mes || '').toLowerCase() === mesNombre.toLowerCase()
  );
  return sameDay.find(s => s.esSantoDelDia === true) || sameDay[0] || null;
}

function setFeaturedSaint(slug) {
  const db = loadSantoral();
  const idx = (db.santos || []).findIndex(s => s.slug === slug);
  if (idx === -1) return null;
  const target = { ...db.santos[idx], esSantoDelDia: true, fechaModificacion: new Date().toISOString() };
  clearFeaturedForSameDay(db, target, target.slug);
  db.santos[idx] = target;
  saveSantoral(db, target);
  return target;
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
  getFeaturedSaintForDay,
  setFeaturedSaint,
  loadSantoral,
  saveSantoral,
  slugify
};
