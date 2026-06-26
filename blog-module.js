// ════════════════════════════════════════════════════════════════
// BLOG MODULE — Artículos con Markdown + embed de infografías/videos
// Shortcodes:
//   [infografia:slug-de-infografia]  → renderiza card de infografía
//   [video:slug-de-video]            → renderiza embed YouTube
//   [podcast:slug-de-podcast]        → renderiza embed Spotify
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }
const BLOG_PATH = path.join(DATA_DIR, 'blog-catalog.json');
const BLOG_BACKUP = path.join(__dirname, 'data', 'blog-catalog.json');

const CATEGORY_TITLES = {
  doctrina: [
    "La Santísima Trinidad: Un solo Dios en tres Personas",
    "La Encarnación del Verbo y el Misterio de la Salvación",
    "La Transustanciación: Presencia Real de Jesús",
    "La Inmaculada Concepción del dogma mariano",
    "La Infalibilidad Papal según el Concilio Vaticano I",
    "El misterio de la resurrección de la carne",
    "El Reino de Dios y el fin de los tiempos",
    "La Comunión de los Santos: Iglesia militante, purgante y triunfante",
    "La Gracia Santificante frente a la gracia actual",
    "La creación de los ángeles y su jerarquía celeste",
    "El pecado original y sus consecuencias heredadas",
    "La justificación según la doctrina del Concilio de Trento",
    "La Divina Providencia y la existencia del mal",
    "La doble naturaleza de Cristo: Divina y Humana",
    "El infierno como autoexclusión definitiva de Dios",
    "La bienaventuranza eterna en la visión beatífica",
    "La Sucesión Apostólica y el depósito de la fe",
    "El Espíritu Santo como Consolador y dador de vida",
    "Las virtudes teologales: Fe, Esperanza y Caridad",
    "Los dones del Espíritu Santo en el alma humana",
    "La Santidad de la Iglesia a pesar de los pecadores",
    "El Papa León XIV y el magisterio extraordinario",
    "Las notas de la Iglesia: Una, Santa, Católica y Apostólica",
    "El purgatorio como purificación por fuego espiritual",
    "El misterio del cordero pascual y la alianza eterna",
    "La herencia patrística de los Padres de la Iglesia",
    "La predestinación y el libre albedrío humano",
    "Los misterios del reino de los cielos revelados",
    "La divina revelación y las fuentes apostólicas",
    "La ley eterna y la ley natural según el catecismo"
  ],
  catequesis: [
    "Los diez mandamientos de la ley de Dios explicados",
    "Los cinco mandamientos de la Iglesia Católica",
    "Examen de conciencia exhaustivo para una buena confesión",
    "Las obras de misericordia corporales y espirituales",
    "Los siete pecados capitales y sus virtudes contrarias",
    "Cómo prepararse para recibir la primera comunión",
    "La importancia de tener padrinos idóneos en bautismo",
    "El Credo de los Apóstoles: Artículo por artículo",
    "Significado espiritual del bautismo en recién nacidos",
    "Las virtudes cardinales: Prudencia, Justicia, Fortaleza y Templanza",
    "Los frutos del Espíritu Santo en la vida del creyente",
    "Cómo rezar el santo rosario: Guía básica para principiantes",
    "Las bienaventuranzas evangélicas explicadas detalladamente",
    "El año litúrgico y los colores litúrgicos del párroco",
    "La importancia de la limosna y el diezmo parroquial",
    "El sacramento de la confirmación como sello del espíritu",
    "El catecismo romano del Concilio de Trento hoy",
    "La jerarquía eclesiástica: Diáconos, Presbíteros y Obispos",
    "Qué es un sacramento y cómo funciona la gracia ex opere operato",
    "El ayuno católico y la abstinecia de carne explicados",
    "Cómo defender la santa fe católica en debates comunes",
    "El misterio del Santo Sacrificio de la Misa para niños",
    "Las indulgencias parciales y plenarias según el manual oficial",
    "La devoción mariana en el seno de la familia",
    "Los novísimos o postrimerías: Muerte, Juicio, Infierno y Gloria",
    "La consagración personal al Inmaculado Corazón de María",
    "La medalla milagrosa y sus grandes promesas de salvación",
    "El agua bendita y los sacramentales en el hogar",
    "La oración mental según Santa Teresa de Jesús",
    "Cómo hacer una hora santa eucarística con fruto"
  ],
  santos: [
    "San José, Custodio del Redentor y Patrono Universal",
    "San Benito de Nursia, su regla mística y su medalla",
    "San Agustín de Hipona: De pecador a gran teólogo",
    "San Francisco de Asís y el milagro de los estigmas",
    "San Ignacio de Loyola y los ejercicios espirituales",
    "San Pío de Pietrelcina y la dirección espiritual mística",
    "Santo Tomás de Aquino, Doctor Angélico y la Summa",
    "San Juan de la Cruz y la noche oscura del alma",
    "Santa Teresa de Ávila, reformadora del Carmelo y mística",
    "San Juan Bosco: El apóstol de la juventud",
    "San Antonio de Padua: Defensor de la doctrina y predicador",
    "San Judas Tadeo: Patrono de las causas imposibles",
    "Santa Teresita del Niño Jesús y el caminito espiritual",
    "San Juan Pablo II: El papa de las familias",
    "San Vicente de Paúl, apóstol de la caridad",
    "Santa Faustina Kowalska y los misterios de la divina misericordia",
    "San Felipe Neri, el santo de la alegría y del oratorio",
    "San Martín de Porres: Humildad heroica y milagros",
    "San Maximiliano Kolbe, caballero de la Inmaculada y mártir",
    "Santa Rita de Casia: Abogada de los casos totalmente perdidos",
    "San Bernardo de Claraval, cantor de la Virgen María",
    "San Francisco Javier, el gigante de las misiones",
    "Santa Clara de Asís, esposa de Cristo",
    "San Jerónimo, traductor de la Vulgata y defensor de escrituras",
    "San Alfonso María de Ligorio y la teología moral excelsa",
    "San Atanasio, defensor del dogma frente al arrianismo",
    "San Lorenzo mártir y las riquezas eternas de la Iglesia",
    "San Esteban Protomártir y la perseverancia de la fe",
    "San Charbel, monje del Líbano y milagroso de hoy",
    "San Francisco de Sales y la introducción a la vida devota"
  ],
  liturgia: [
    "Las tres partes esenciales de la Santa Misa explicadas",
    "El significado espiritual de los colores de las casullas",
    "La Liturgia de las Horas: Santificación de la jornada",
    "Diferencias rituales entre la misa de hoy y la tridentina",
    "El canto gregoriano, música oficial de la liturgia",
    "El uso litúrgico del incienso y su simbolismo místico",
    "El leccionario y el ciclo dominical trienal de lecturas",
    "Diferencias sacramentales entre rito romano y oriental",
    "La rúbrica litúrgica y la obediencia al misal de hoy",
    "El papel del coro parroquial y los cantos santos",
    "La adoración eucarística perpetua y la custodia sagrada",
    "Significado espiritual del altar consagrado y reliquias",
    "La vigilia pascual, madre de todas las santas vigilias",
    "El miércoles de ceniza y la llamada a la penitencia",
    "El triduo pascual: Del Jueves Santo al Domingo de Ramos",
    "La importancia sacra del sagrario y la lámpara",
    "El año litúrgico católico explicativo paso a paso",
    "Los ministros extraordinarios de la comunión santa",
    "El rito de la paz en la santa misa",
    "La misa de réquiem y el cuidado de las almas difuntas",
    "El canon romano de la misa o plegaria eucarística I",
    "Las unciones sagradas con el Santo Crisma y óleo",
    "El lavatorio de manos del sacerdote durante el ofertorio",
    "Significado litúrgico del Domingo de Ramos",
    "El ofertorio: Presentación de los dones espirituales",
    "La procesión del Corpus Christi y la adoración pública",
    "La bendición solemne con el Santísimo Sacramento",
    "La genuflexión ante el sagrario como acto de fe",
    "Simbolismo de los cirios encendidos y el cirio pascual",
    "El altar versus populum y el altar ad orientem explicados"
  ],
  apologetica: [
    "Veneración versus adoración a la Virgen María",
    "El Purgatorio en la biblia y la tradición patrística",
    "Por qué confesarse con un sacerdote y no con Dios",
    "La sucesión apostólica desde Pedro al Papa León XIV",
    "La divinidad de Jesucristo demostrada por las escrituras",
    "La veracidad histórica de la resurrección",
    "Por qué las biblias protestantes no tienen todos los libros",
    "Defensa católica de la existencia de imágenes",
    "El primado de Pedro de la roca fundacional de la Iglesia",
    "La virginidad perpetua de María Santísima en la biblia",
    "Defensa racional de la existencia de Dios",
    "La fe y la razón: Encíclica Fides et Ratio explicada",
    "Refutación histórica de la inquisición española",
    "Por qué llamamos padre al sacerdote de la doctrina",
    "La transustanciación frente a la consustanciación",
    "El milagro guadalupano: Apologética de la tilma",
    "La necesidad de la Iglesia para la salvación de las almas",
    "Por qué guardamos el domingo y no el sábado judío",
    "La tradición apostólica es fuente de doctrina",
    "Los milagros de la Iglesia sometidos a pruebas científicas",
    "Refutaciones católicas al modernismo teológico actual",
    "La santidad moral frente a la justificación por sola fe",
    "Por qué el bautismo de niños es bíblico y apostólico",
    "Defensa de los dogmas marianos",
    "La legitimidad de la veneración a las reliquias",
    "La apostolicidad de la Iglesia romana demostrada por historia",
    "El canon de las escrituras establecido por concilios",
    "Por qué Dios permite el sufrimiento si es infinitamente bueno",
    "La divinidad del Espíritu Santo en contra de las sectas",
    "El celibato consagrado como anticipación del reino celeste"
  ],
  oracion: [
    "El poder del Santo Rosario frente a las tentaciones",
    "Cómo hacer una oración de sanación interior del corazón",
    "La novena a San Judas Tadeo: Rezo místico y promesas",
    "La coronilla de la divina misericordia e instrucciones",
    "Oraciones diarias de la mañana para encomendar la jornada",
    "Oración de la noche para entregar el descanso a Dios",
    "La jaculatoria mística y el poder del nombre de Jesús",
    "El Salmo 91 y el escudo divino para protección espiritual",
    "El rezo de la Salve Regina y las glorias de la Virgen",
    "Cómo meditar la pasión de Jesús mediante el Vía Crucis",
    "La oración de San Miguel Arcángel de la liberación",
    "La novena al Espíritu Santo para pedir sus dones celestes",
    "Letanías lauretanas y su riqueza teológica mariana",
    "La oración del Ángel de la Guarda para amparo de niños",
    "La comunión de reparación de los primeros sábados",
    "El devocionario católico indispensable para todo fiel",
    "La oración de contemplación y la unión del alma con Dios",
    "El Oficio Parvo de la Santísima Virgen María",
    "La oración ante el Santísimo Sacramento de altar",
    "La piadosa devoción a las Benditas Almas del Purgatorio",
    "El Rosario de las Lágrimas de María Santísima",
    "La coronilla de las siete virtudes contra los vicios",
    "El Santo Viacrucis: Estación por estación meditadas",
    "La novena a la Virgen de Guadalupe paso a paso",
    "El rezo del Te Deum de acción de gracias solemne",
    "La oración de sanación corporal en el nombre de Cristo",
    "Jaculatorias para rezar a lo largo del día laborable",
    "El rosario de la preciosísima sangre de Jesús",
    "La devoción al Sagrado Corazón de Jesús y promesas",
    "El Angelus dominical: Oración mística de la Encarnación"
  ],
  biblia: [
    "Cómo empezar a leer la biblia católica con fruto",
    "La inspiración divina y la inerrancia de las escrituras",
    "Exégesis católica del sermón de la montaña",
    "Los cuatro evangelios de Mateo Marcos Lucas y Juan",
    "Significado espiritual de las parábolas de Jesucristo",
    "El misterio de los libros deuterocanónicos en la Vulgata",
    "La profecía del siervo sufriente en Isaías explicada",
    "El evangelio de san Juan y el Verbo eterno de Dios",
    "La epístola a los romanos de san Pablo y la fe cristiana",
    "La concordancia entre el Antiguo y el Nuevo Testamento",
    "La exégesis de los milagros bíblicos de nuestro Señor",
    "El Salmo 23 y el amparo del Buen Pastor",
    "Las profecías mesiánicas del Antiguo Testamento cumplidas",
    "El Libro del Apocalipsis: Victoria final del Cordero",
    "Los hechos de los apóstoles y la primera Iglesia",
    "El Pentateuco en las escrituras: Ley divinamente inspirada",
    "El cántico de los cánticos y el amor místico esponsal",
    "Por qué la biblia de hoy requiere interpretación eclesiástica",
    "La exégesis y hermenéutica bíblica frente al literalismo",
    "Las epístolas católicas de San Pedro y San Juan explicadas",
    "Los profetas mayores y menores en el contexto de la salvación",
    "El salterio de David: Oración divina inspirada",
    "La parábola del hijo pródigo: Misericordia y arrepentimiento",
    "La parábola del sembrador: El estado fértil del corazón",
    "La anunciación a María Santísima en el evangelio de San Lucas",
    "El misterio de Melquisedec en la epístola a los hebreos",
    "El sermón del pan de vida en san Juan capítulo seis",
    "Los libros de la biblia católica: Lista e introducción",
    "La exégesis del relato de la creación en el Génesis",
    "El mandamiento del amor fraterno en las escrituras santas"
  ],
  familia: [
    "El matrimonio católico conforme a la Iglesia de Cristo",
    "Educación de los hijos en la fe dentro del hogar cristiano",
    "La oración por la unión familiar y la concordia diaria",
    "Paternidad responsable y la encíclica Humanae Vitae",
    "El papel primordial del padre de familia cristiano",
    "La vocación protectora de la madre conforme a María",
    "El rezo diario del Rosario en la familia como escudo",
    "El matrimonio como sacramento de salvación matrimonial",
    "Cómo superar crisis matrimoniales con ayuda de la fe",
    "La sagrada familia de Nazaret como modelo de virtudes",
    "La castidad en el noviazgo católico: Guía de santidad",
    "La defensa de la vida humana desde el seno materno",
    "La comunión de los esposos y la complementariedad mística",
    "El perdón recíproco en el hogar cristiano",
    "La doctrina social de la Iglesia aplicada a la familia",
    "La transmisión de los valores cristianos en la sociedad",
    "La bendición de la mesa en familia: Oración y gratitud",
    "El peligro del relativismo moral en la educación de hijos",
    "La preparación espiritual para el santo matrimonio",
    "La fidelidad conyugal ante los ojos de la Iglesia",
    "La fecundidad matrimonial como don sagrado de Dios",
    "Cómo rezar con los hijos pequeños antes de acostarse",
    "La Iglesia doméstica: El hogar cristiano consagrado",
    "El respeto filial según el cuarto mandamiento de Dios",
    "La eutanasia familiar frente a los paliativos cristianos",
    "La pastoral familiar y el acompañamiento parroquial",
    "El sacramento de la confesión para restaurar la paz",
    "El cuidado caritativo de los abuelos en el seno familiar",
    "La adopción como reflejo de la paternidad divina de Dios",
    "El matrimonio indiviso y el misterio del amor divino"
  ],
  magisterio: [
    "Encíclicas papales fundamentales sobre fe y moral de la Iglesia",
    "La Rerum Novarum de León XIII y la doctrina social",
    "El Concilio Vaticano II: Sus cuatro constituciones dogmáticas",
    "El Concilio de Trento y la contrarreforma de la Iglesia",
    "El Catecismo de la Iglesia Católica y la fe de hoy",
    "El Papa León XIV y su encíclica Magnifica Humanitas",
    "La primacía del papa como sucesor directo de San Pedro",
    "La colegialidad de los obispos en comunión con Roma",
    "Las encíclicas marianas de los sumos pontífices",
    "El magisterio ordinario frente al extraordinario",
    "El depósito de la fe and el magisterio custodio",
    "La bula unam sanctam y la soberanía espiritual",
    "El Código de Derecho Canónico: Guía jurídica",
    "La encíclica Casti Connubii y la santidad del matrimonio",
    "La encíclica Providentissimus Deus de las escrituras",
    "El concilio vaticano I y el primado romano",
    "La historia de los concilios ecuménicos de la Iglesia",
    "El sínodo de los obispos como instrumento de comunión",
    "La Iglesia frente a los errores doctrinales modernos",
    "El magisterio de los primeros papas de la Iglesia",
    "La defensa de la liturgia tradicional por el magisterio",
    "La encíclica Pascendi de San Pío X y el modernismo",
    "El concilio de Nicea y la formulación del dogma",
    "La declaración dominus iesus y la salvación de almas",
    "El catecismo mayor de San Pío X: Resumen de fe",
    "El papa León XIV y la encíclica sobre el transhumanismo",
    "El ministerio petrino como servicio de unidad universal",
    "Los concilios de Constantinopla y Calcedonia dogmáticos",
    "La obediencia moral al magisterio del sumo pontífice",
    "La infalibilidad ex cathedra explicada brevemente"
  ],
  moral: [
    "El aborto en la doctrina católica y el catecismo",
    "La eutanasia y el valor del sufrimiento redentor de Cristo",
    "Los peligros morales del transhumanismo y ética de la IA",
    "La homosexualidad y la pastoral de acogida y castidad",
    "La mentira, el falso testimonio y el octavo mandamiento",
    "La pureza de intención, la modestia y la templanza mística",
    "El pecado venial frente al pecado mortal o grave",
    "El examen de conciencia y los vicios capitales",
    "La caridad fraterna como máxima moral cristiana",
    "La anticoncepción y la santidad de la vida conyugal",
    "El suicidio según el catecismo y la llamada evangélica",
    "La moral económica, la justicia social y el trabajo",
    "El deber de la restitución en la vida ordinaria",
    "La legítima defensa ante la teología moral de la Iglesia",
    "La pena de muerte y el magisterio contemporáneo",
    "La embriaguez, los excesos corporales y la sobriedad",
    "La templanza frente a la pornografía y la lujuria mundana",
    "La moral sexual católica conforme al creador divino",
    "Los desafíos bioéticos modernos ante la ley divina",
    "El peligro de las supersticiones y la santería mística",
    "La idolatría del dinero en la sociedad consumista",
    "La paciencia y el autocontrol frente a la ira ciega",
    "El orgullo como raíz oculta de todo pecado humano",
    "La pereza espiritual o acidia en el creyente de hoy",
    "La envidia moral frente al bienestar fraterno",
    "La gula corporal y el sentido fecundo del ayuno",
    "La avaricia material versus el desapego evangélico",
    "La soberbia teológica ante el magisterio pontificio",
    "El escándalo como pecado contra la caridad del prójimo",
    "La conciencia moral errónea y la debida formación"
  ]
};

function seedBlogCatalog300(catalog) {
  catalog.posts = catalog.posts || [];
  const existingSlugs = new Set(catalog.posts.map(p => p.slug));
  let staggeredTime = new Date('2026-06-19T10:00:00Z').getTime();

  for (const [category, titles] of Object.entries(CATEGORY_TITLES)) {
    for (const title of titles) {
      const slug = slugify(title);
      if (existingSlugs.has(slug)) continue;

      staggeredTime -= (8 * 60 * 60 * 1000); // retroceder 8 horas para dar dinamismo cronológico
      const dateStr = new Date(staggeredTime).toISOString();
      const keywordsList = `catolico, fe, doctrina, catecismo, ${category}, ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')}`;
      const shortDesc = `Explicación completa, doctrinal y teológica exhaustiva sobre: ${title}. Analizado rigurosamente según el magisterio apostólico y las sagradas escrituras.`;

      const post = {
        slug: slug,
        titulo: title,
        descripcion: shortDesc,
        extracto: `Exploración y estudio guiado de fe sobre ${title}, fundamentado firmemente en las Sagradas Escrituras y el Catecismo de la Iglesia Católica.`,
        keywords: keywordsList,
        categoria: category,
        contenidoMd: `# ${title}\n\nEste profundo y fecundo estudio doctrinal nos adentra en la verdad sagrada de nuestra fe. El Catecismo de la Iglesia Católica y la herencia milenaria del Magisterio nos ofrecen la guía segura para comprender el designio del Creador.\n\n## Fundamento Doctrinal y Teológico\n\nComo indica la rica tradición apostólica, la Iglesia custodia y proclama con fidelidad el depósito divino. El rezo constante, la correspondencia del alma y el estudio guiado de los dogmas de fe configuran nuestra razón para marchar en santidad cristiana.\n\nEl misterio de este tema se entrelaza con el llamado universal a la santidad que el Papa León XIV custodia con celo paternal desde la Cátedra de San Pedro. Las Sagradas Escrituras iluminan con claridad cada aspecto aquí examinado, llamándonos a una conversión sincera del intelecto.\n\n### Relación con el Catecismo de la Iglesia Católica\n\nNuestra fe no es un sentimiento sentimental; es un asentimiento humilde del intelecto a la Verdad revelada. De este modo, los fieles están llamados a profundizar en las Sagradas Escrituras y recurrir a los sacramentores divinos para fortificar el espíritu ante las acechanzas del moderno relativismo secular.\n\n[infografia:la-liturgia-visible]\n\nQue Dios en Su infinita Providencia fortalezca nuestro celo misionero, por la intercesión de la Santísima Virgen María Santísima y San José patrono de la barca de Pedro. Amén.`,
        fechaCreacion: dateStr,
        publicado: true
      };

      catalog.posts.push(post);
      existingSlugs.add(slug);
    }
  }

  catalog.total = catalog.posts.length;
  saveBlog(catalog);
  return catalog;
}

function loadBlog() {
  let catalog;
  try {
    const d = JSON.parse(fs.readFileSync(BLOG_PATH, 'utf-8'));
    if (d && d.posts) catalog = d;
  } catch(e) {}
  if (!catalog) {
    try {
      const d = JSON.parse(fs.readFileSync(BLOG_BACKUP, 'utf-8'));
      if (d && d.posts) catalog = d;
    } catch(e) {}
  }
  if (!catalog) {
    catalog = { version: '1.0', total: 0, posts: [] };
  }
  if (!catalog.posts || catalog.posts.length < 1000) {
    try {
      console.log('[Blog Bulk] Catálogo incompleto; regenerando lote editorial de 1000 artículos...');
      const bulk = require('./scripts/generate-bulk-content');
      catalog = bulk.generateBlogCatalog();
      saveBlog(catalog);
    } catch (bulkErr) {
      console.error('[Blog Bulk] No se pudo regenerar lote masivo:', bulkErr.message);
      if (!catalog.posts || catalog.posts.length < 300) {
        catalog = seedBlogCatalog300(catalog);
      }
    }
  }
  return catalog;
}

function saveBlog(c, itemToSync = null) {
  const nuevoTotal = (c && c.posts) ? c.posts.length : 0;
  if (nuevoTotal === 0) {
    try {
      const existente = JSON.parse(fs.readFileSync(BLOG_PATH, 'utf-8'));
      if (existente && existente.posts && existente.posts.length > 0) {
        console.error('[Blog save] BLOQUEADO: intento de guardar catálogo de blog vacío sobre datos existentes.');
        return false;
      }
    } catch(e) {}
  }
  const json = JSON.stringify(c, null, 2);
  try { fs.writeFileSync(BLOG_PATH, json); } catch(e) { console.error('[Blog save]', e.message); }
  try { fs.writeFileSync(BLOG_BACKUP, json); } catch(e) {}

  if (itemToSync) {
    try {
      const firebaseSync = require('./firebase-module');
      firebaseSync.syncUploadPost(itemToSync).catch(err => {
        console.error('[Firebase Sync] Error al sincronizar post:', err.message);
      });
    } catch(e) {}
  }
  return true;
}

// Generar slug amigable desde título
function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Enrichment con IA — genera título SEO, descripción, keywords desde contenido
async function enrichBlogWithAI(title, contentMd, openai) {
  try {
    if (!openai) throw new Error('Client IA no configurado');
    const preview = (contentMd || '').slice(0, 2500);
    const promptContent = `Genera metadata SEO para este artículo de blog católico.

TÍTULO ORIGINAL: "${title}"

PRIMERAS PALABRAS DEL ARTÍCULO:
${preview}

Responde SOLO JSON válido en español (sin markdown, sin backticks):
{
  "titulo": "Título SEO optimizado (50-65 chars, descriptivo, atractivo)",
  "descripcion": "Meta descripción 140-160 chars que invita a leer",
  "keywords": "6-8 keywords católicas relevantes separadas por comas",
  "altText": "Texto alt SEO para la imagen destacada",
  "extracto": "Extracto / lead del artículo en 30-50 palabras (para preview en lista de blog)",
  "categoria": "una sola de: catequesis, doctrina, espiritualidad, santos, liturgia, magisterio, familia, oracion, biblia, apologetica"
}`;

    let text = '';
    
    if (openai.models && typeof openai.models.generateContent === 'function') {
      // Gemini GoogleGenAI
      const r = await openai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptContent,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      });
      text = r.text || '';
    } else {
      // Legacy OpenAI compat
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{
          role: 'system',
          content: 'Eres experto en SEO católico. Generas metadata optimizada para artículos de blog católicos en español, basándote en el Magisterio.'
        }, {
          role: 'user',
          content: promptContent
        }]
      });
      text = r.choices[0].message.content.trim();
    }
    text = text.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    const parsed = JSON.parse(text);
    return {
      titulo: parsed.titulo || title,
      descripcion: parsed.descripcion || '',
      keywords: parsed.keywords || '',
      altText: parsed.altText || parsed.titulo || title,
      extracto: parsed.extracto || '',
      categoria: parsed.categoria || 'catequesis'
    };
  } catch(e) {
    console.error('[Blog AI] Error:', e.message);
    return {
      titulo: title,
      descripcion: '',
      keywords: 'católico, fe, blog',
      altText: title,
      extracto: '',
      categoria: 'catequesis'
    };
  }
}

// Parser Markdown → HTML (simple pero suficiente)
function parseMarkdown(md) {
  if (!md) return '';
  // Si parece contener HTML crudo estructurado de ChatGPT/Gemini, retornarlo directo para no romper tablas o estructuras complejas
  const lower = md.toLowerCase();
  if (lower.includes('<table') || lower.includes('<div') || lower.includes('<p') || lower.includes('</ul>') || lower.includes('</ol>') || lower.includes('<article') || lower.includes('<section') || lower.includes('<h1') || lower.includes('<h2') || lower.includes('<h3') || lower.includes('<h4') || lower.includes('<span') || lower.includes('<iframe') || lower.includes('<style')) {
    return md;
  }
  let html = md;

  // Code blocks (proteger primero)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push(`<pre><code class="lang-${lang}">${code.replace(/</g, '&lt;')}</code></pre>`);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold/italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" style="max-width:100%;border-radius:10px;margin:14px 0">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/(<\/blockquote>)\n(<blockquote>)/g, '\n');

  // Lists
  html = html.replace(/^(\s*)[-*] (.+)$/gm, '$1<li>$2</li>');
  html = html.replace(/^(\s*)\d+\. (.+)$/gm, '$1<li class="ol">$2</li>');
  // Wrap consecutive <li>
  html = html.replace(/(<li>.+<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');
  html = html.replace(/(<li class="ol">.+<\/li>\n?)+/g, m => '<ol>' + m.replace(/class="ol"/g, '') + '</ol>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Paragraphs (líneas no vacías que no son tags)
  const blocks = html.split(/\n\n+/);
  html = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<(h[1-6]|ul|ol|blockquote|hr|pre|img|div|p|figure)/.test(b)) return b;
    if (b.startsWith('\x00CODE')) return b;
    // No envolver shortcodes en <p> (sino se genera HTML inválido al reemplazar por <figure>)
    if (/^\[(infografia|video|podcast):[\w-]+\]$/.test(b)) return b;
    return '<p>' + b + '</p>';
  }).join('\n\n');

  // Restaurar code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, (m, i) => codeBlocks[parseInt(i)]);

  return html;
}

// Renderiza shortcodes [infografia:slug], [video:slug], [podcast:slug]
function renderShortcodes(html, opts = {}) {
  const { getInfografia, getVideo, getPodcast } = opts;

  // [infografia:slug]
  html = html.replace(/\[infografia:([\w-]+)\]/g, (m, slug) => {
    const inf = getInfografia && getInfografia(slug);
    if (!inf) return `<div class="shortcode-error" style="padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;font-size:13px">⚠️ Infografía "${slug}" no encontrada</div>`;
    const img = inf.imagenes?.[0]?.url || '';
    return `<figure class="embed-infografia" style="margin:24px 0;padding:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff">
      <a href="/infografias/${inf.slug}" style="text-decoration:none;color:inherit;display:block">
        ${img ? `<img src="${img}" alt="${inf.altText || inf.titulo || ''}" style="width:100%;display:block">` : ''}
        <figcaption style="padding:14px 18px;background:var(--cream-2)">
          <div style="font-family:var(--font-display);font-weight:600;font-size:16px;color:var(--espresso)">${inf.titulo || inf.tema}</div>
          ${inf.descripcion ? `<div style="font-size:13px;color:var(--ink-2);margin-top:4px">${inf.descripcion.slice(0, 140)}</div>` : ''}
          <div style="font-size:12px;color:var(--gold-deep);margin-top:6px;font-weight:600">Ver infografía completa →</div>
        </figcaption>
      </a>
    </figure>`;
  });

  // [video:slug]
  html = html.replace(/\[video:([\w-]+)\]/g, (m, slug) => {
    const v = getVideo && getVideo(slug);
    if (!v) return `<div class="shortcode-error" style="padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;font-size:13px">⚠️ Video "${slug}" no encontrado</div>`;
    return `<figure class="embed-video" style="margin:24px 0">
      <div style="aspect-ratio:16/9;border-radius:14px;overflow:hidden;box-shadow:var(--shadow-md);background:#000">
        <iframe src="https://www.youtube.com/embed/${v.youtubeId}?rel=0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" style="width:100%;height:100%;border:0;display:block"></iframe>
      </div>
      <figcaption style="font-size:13px;color:var(--ink-2);margin-top:8px;text-align:center;font-style:italic">${v.titulo}</figcaption>
    </figure>`;
  });

  // [podcast:slug]
  html = html.replace(/\[podcast:([\w-]+)\]/g, (m, slug) => {
    const p = getPodcast && getPodcast(slug);
    if (!p) return `<div class="shortcode-error" style="padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;font-size:13px">⚠️ Podcast "${slug}" no encontrado</div>`;
    return `<figure class="embed-podcast" style="margin:24px 0">
      <div style="border-radius:14px;overflow:hidden;box-shadow:var(--shadow-md)">
        ${p.embedHtml || `<iframe src="${p.embedUrl}" width="100%" height="232" frameborder="0" allowtransparency="true" allow="encrypted-media" style="border-radius:12px;border:0;display:block"></iframe>`}
      </div>
      <figcaption style="font-size:13px;color:var(--ink-2);margin-top:8px;text-align:center;font-style:italic">${p.titulo}</figcaption>
    </figure>`;
  });

  return html;
}

function getPosts({ categoria = null, q = null, page = 1, limit = 12 } = {}) {
  const catalog = loadBlog();
  let items = (catalog.posts || []).filter(p => p.publicado !== false);
  if (categoria) items = items.filter(p => p.categoria === categoria);
  if (q) {
    const ql = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    items = items.filter(p => {
      const text = `${p.titulo||''} ${p.descripcion||''} ${p.keywords||''} ${p.categoria||''} ${p.contenidoMd||''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return text.includes(ql);
    });
  }
  // Ordenar por fecha desc
  items.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  const total = items.length;
  const start = (page - 1) * limit;
  return { total, page, limit, items: items.slice(start, start + limit) };
}

function getPostBySlug(slug) {
  const catalog = loadBlog();
  return (catalog.posts || []).find(p => p.slug === slug);
}

function deletePost(slug) {
  const catalog = loadBlog();
  const before = (catalog.posts || []).length;
  catalog.posts = (catalog.posts || []).filter(p => p.slug !== slug);
  catalog.total = catalog.posts.length;
  saveBlog(catalog);

  try {
    const firebaseSync = require('./firebase-module');
    firebaseSync.syncDeletePost(slug).catch(err => {
      console.error('[Firebase Sync] Error al eliminar post de Firestore:', err.message);
    });
  } catch(e) {}

  return before !== catalog.posts.length;
}

function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function upsertPost(post) {
  const catalog = loadBlog();
  catalog.posts = catalog.posts || [];
  const idx = catalog.posts.findIndex(p => p.slug === post.slug);
  if (idx >= 0) {
    catalog.posts[idx] = { ...catalog.posts[idx], ...post, fechaModificacion: new Date().toISOString(), customizado: true };
  } else {
    post.fechaCreacion = post.fechaCreacion || new Date().toISOString();
    post.customizado = true;
    catalog.posts.unshift(post);
  }
  catalog.total = catalog.posts.length;
  const savedPost = idx >= 0 ? catalog.posts[idx] : catalog.posts[0];
  saveBlog(catalog, savedPost);
  return savedPost;
}

// ── SISTEMA SEO AUTÓNOMO DETECTOR Y GENERADOR DE CONTENIDO ──
async function evaluarYCrearArticuloSEO(query, aiInstance) {
  if (!aiInstance) {
    console.log('[SEO-Auto] No hay rastro de la IA.');
    return null;
  }
  
  const qClean = (query || '').trim();
  if (qClean.length < 8) {
    console.log('[SEO-Auto] Consulta demasiado corta para ser un artículo de valor.');
    return null;
  }

  // Descartar si es off-topic o conversacional simple
  const conversacionales = ['hola', 'buenos dias', 'buenas tardes', 'gracias', 'adios', 'como estas', 'quien eres', 'ayuda', 'ok', 'entendido'];
  const inferiorQuery = qClean.toLowerCase();
  for (const c of conversacionales) {
    if (inferiorQuery.startsWith(c) && inferiorQuery.length < 25) {
      console.log('[SEO-Auto] Consulta puramente conversacional descartada.');
      return null;
    }
  }

  const catalog = loadBlog();
  const posts = catalog.posts || [];
  
  const targetSlug = slugify(qClean);
  const exactPost = posts.find(p => p.slug === targetSlug);
  if (exactPost) {
    console.log('[SEO-Auto] Encontrado post exacto por slug:', targetSlug);
    return exactPost;
  }

  // Deduplicación inteligente por IA (Preguntar si ya está cubierto semánticamente)
  if (posts.length > 0) {
    try {
      const titulosYSlugs = posts.slice(0, 35).map(p => `- "${p.titulo}" (slug: ${p.slug})`).join('\n');
      const deduplicationPrompt = `Actúa como un validador de taxonomía doctrinal católico para CatólicosGPT.
Queremos saber si la consulta del usuario se refiere y responde semánticamente a los mismos temas que alguno de nuestros artículos existentes del blog.

CONSULTA DEL USUARIO: "${query}"

LISTA DE ARTÍCULOS EXISTENTES:
${titulosYSlugs}

Por favor, analiza si la consulta ya está totalmente cubierta por alguno de los artículos existentes (por ejemplo, si preguntan "En qué consiste el sacramento de la confirmación" y ya hay un artículo de "El Sacramento de la Confirmación").
Responde estrictamente "SI: slug-del-articulo-existente" (por ejemplo: "SI: sacramento-confirmacion-sello-espiritu").
De lo contrario, responde estrictamente "NO".
Tu única respuesta debe ser "SI: slug" o "NO", sin rodeos ni texto extra.`;

      const checkResponse = await aiInstance.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: deduplicationPrompt
      });

      const checkText = (checkResponse.text || '').trim();
      console.log('[SEO-Auto] Deduplicador Gemini respondió:', checkText);
      if (checkText.toUpperCase().startsWith('SI:')) {
        const parts = checkText.split(':');
        if (parts[1]) {
          const matchedSlug = parts[1].trim();
          const matchedPost = posts.find(p => p.slug === matchedSlug);
          if (matchedPost) {
            console.log('[SEO-Auto] Redirección semántica a post existente:', matchedSlug);
            return matchedPost;
          }
        }
      }
    } catch (e) {
      console.log('[SEO-Auto Info] Error en deduplicación por IA, procediendo por heurística local:', e.message);
    }
  }

  // Heurística local de keywords si falló la IA o no dio positivo
  const stopWords = new Set(['que', 'es', 'la', 'el', 'un', 'una', 'en', 'de', 'para', 'lo', 'los', 'las', 'por', 'significado', 'significa', 'al', 'con', 'del']);
  const wordsNorm = qClean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (wordsNorm.length > 0) {
    for (const p of posts) {
      const pTitleNorm = (p.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
      let overlap = 0;
      for (const w of wordsNorm) {
        if (pTitleNorm.includes(w)) overlap++;
      }
      if (overlap / wordsNorm.length >= 0.8) {
        console.log('[SEO-Auto] Heurística local detectó solapamiento alto, reusando:', p.slug);
        return p;
      }
    }
  }

  // 2. Generación del nuevo artículo indexable para enriquecer la biblioteca doctrinal
  try {
    console.log(`[SEO-Auto] Generando nuevo artículo indexable para la biblioteca: "${query}"...`);
    const prompt = `Actúa como un teólogo católico y estratega de contenido SEO principal de CatólicosGPT, la enciclopedia y asistente católica #1 en español.
Debes crear un artículo doctrinal o formativo de altísima calidad, profundo, de oratoria hermosa y profunda en español de la Iglesia Católica, de al menos 800-1200 palabras para responder a la consulta: "${query}".
El artículo debe basarse fielmente en el Catecismo de la Iglesia Católica (CIC) y las Sagradas Escrituras, y ser reverente con el Papa León XIV (Robert Francis Prevost).

Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin bloques markdown ni texto adicional:
{
  "titulo": "Título de fe completo, hermoso e inspirador, p. ej., 'El Sacramento del Bautismo: Puerta y Fundamento de la Gracia'",
  "seoTitle": "Título SEO ultra-optimizado de menos de 65 caracteres",
  "metaDescription": "Meta Description irresistible de menos de 155 caracteres destacando que somos la biblioteca católica de mayor fidelidad",
  "extracto": "Un párrafo de resumen atrapante de 30 a 50 palabras",
  "keywords": "fielmente separadas por comas, palabras clave relevantes como catecismo, doctrina, biblia, etc",
  "categoria": "Una sola estrictamente de: sacramentos, eucaristia, dogmas, biblia, oracion, santos, virgen-maria, sacerdotes, moral, liturgia, apologetica",
  "contenidoMd": "Contenido teológicamente impecable en formato Markdown con encabezados (##), listas con viñetas, citas completas del Catecismo y exégesis bíblica de gran renombre. Incluye también enlaces internos simulados que enlacen a otros recursos de CatólicosGPT, p. ej. referenciando a '/blog/sacramentos/que-es-la-confirmacion' si viene al caso.",
  "faqs": [
    { "q": "Pregunta frecuente práctica 1 sobre el tema", "a": "Respuesta doctrinalmente perfecta..." },
    { "q": "Pregunta frecuente práctica 2 sobre el tema", "a": "Respuesta doctrinalmente perfecta..." },
    { "q": "Pregunta frecuente práctica 3 sobre el tema", "a": "Respuesta doctrinalmente perfecta..." }
  ]
}`;

    const generateResponse = await aiInstance.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    let text = (generateResponse.text || '').trim();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Auto-recuperar si hay caracteres extra antes o después del bracket
    const firstBracket = text.indexOf('{');
    const lastBracket = text.lastIndexOf('}');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      text = text.slice(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(text);
    
    if (!parsed.titulo || !parsed.contenidoMd || !parsed.categoria) {
      throw new Error('Faltan campos obligatorios en el JSON generado por IA');
    }

    const cleanSlug = slugify(parsed.titulo);
    const resolvedCat = slugify(parsed.categoria);

    const newPost = {
      slug: cleanSlug,
      titulo: parsed.titulo,
      seoTitle: parsed.seoTitle || `${parsed.titulo} — CatólicosGPT`,
      descripcion: parsed.metaDescription || parsed.extracto || '',
      extracto: parsed.extracto || '',
      keywords: parsed.keywords || 'catecismo, fe, doctrina',
      categoria: resolvedCat,
      contenidoMd: parsed.contenidoMd,
      faqs: parsed.faqs || [],
      fechaCreacion: new Date().toISOString(),
      publicado: true
    };

    const saved = upsertPost(newPost);
    console.log('[SEO-Auto] ¡NUEVO ARTÍCULO CREADO Y GUARDADO EXITOSAMENTE! Slug:', cleanSlug);
    return saved;

  } catch (error) {
    console.log('[SEO-Auto Info] Error en generación automática de artículo:', error.message);
    return null;
  }
}

module.exports = {
  loadBlog, saveBlog, slugify, enrichBlogWithAI,
  parseMarkdown, renderShortcodes, escapeHtml, upsertPost,
  getPosts, getPostBySlug, deletePost, evaluarYCrearArticuloSEO
};
