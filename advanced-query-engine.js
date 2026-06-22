// ════════════════════════════════════════════════════════════════════════════
// ADVANCED QUERY ENGINE & CACHE — CatolicosGPT
// Motor doctrinal católico, consulta bíblica, Catecismo y optimización de caché
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const biblia = require('./biblia-module');
const recursos = require('./recursos-module');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DYNAMIC_CACHE_FILE = path.join(DATA_DIR, 'dynamic-doctrinal-cache.json');

// --- 1. MEMORY CACHE MAPS ---
let dynamicCache = {};
try {
  if (fs.existsSync(DYNAMIC_CACHE_FILE)) {
    dynamicCache = JSON.parse(fs.readFileSync(DYNAMIC_CACHE_FILE, 'utf8'));
    console.log(`[Cache Engine] Cargada caché dinámica local con ${Object.keys(dynamicCache).length} entradas.`);
  }
} catch (e) {
  console.warn('[Cache Engine] No se pudo cargar dynamic-doctrinal-cache.json, iniciando limpia:', e.message);
}

// --- 2. PRECOMPLED STATIC EXHAUSTIVE HIGH-DEMAND CACHE ---
const STATIC_DOCTRINAL_CACHE = {
  "bautismo": {
    titulo: "El Sacramento del Bautismo",
    categoria: "Sacramentos",
    texto: `# El Santo Sacramento del Bautismo

El Bautismo es el fundamento de toda la vida cristiana, el pórtico de la vida en el espíritu y la puerta que abre el acceso a los otros sacramentos. Por el Bautismo somos liberados del pecado y regenerados como hijos de Dios, llegamos a ser miembros de Cristo y somos incorporados a la Iglesia y hechos partícipes de su misión.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Mateo 28:19 | Mandato de bautizar en el nombre del Padre, del Hijo y del Espíritu Santo. |
| Catecismo | CIC 1213 | El Bautismo es el sacramento de la regeneración por el agua y la palabra. |
| Magisterio | Concilio de Florencia | Declara que el primer lugar entre los sacramentos lo ocupa el Santo Bautismo, que es la puerta de la vida espiritual. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Regeneración y Vida | CIC 1213 | Puerta de los sacramentos y fundamento de la comunión eclesial. |
| Necesidad para la Salvación | CIC 1257 | El Señor afirma que el Bautismo es necesario para la salvación. |

# CITA TEXTUAL
> "El Santo Bautismo es el fundamento de toda la vida cristiana, el pórtico de la vida en el espíritu y la puerta que abre el acceso a los otros sacramentos." (CIC 1213)

# EXPLICACIÓN CATÓLICA

### Fundamento Doctrina e Historia
El Bautismo (del griego *baptizein*, que significa sumergir) representa sacramentalmente la sepultura del catecúmeno en la muerte de Cristo, de donde sale por la resurrección con Él como "nueva criatura". Configura al alma de manera indeleble con Cristo, imprimiendo un carácter espiritual que no se borra, por lo que este sacramento solo se recibe una vez.

### Aplicación Práctica para el Fiel hoy
Para el católico contemporáneo, vivir el bautismo significa recordar a diario el compromiso de santidad, rechazar el pecado personal y participar activamente en la misión apostólica de la Iglesia.`
  },
  "confirmacion": {
    titulo: "El Sacramento de la Confirmación",
    categoria: "Sacramentos",
    texto: `# El Santo Sacramento de la Confirmación

Con el Bautismo y la Eucaristía, el sacramento de la Confirmación constituye el conjunto de los "sacramentos de la iniciación cristiana", cuya unidad debe ser salvaguardada. Él perfecciona la gracia bautismal y nos da la fortaleza especial del Espíritu Santo.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Hechos 8:14-17 | Los apóstoles Pedro y Juan imponían las manos para recibir el Espíritu Santo. |
| Catecismo | CIC 1285 | La Confirmación une más íntimamente a la Iglesia y enriquece con una fortaleza especial del Espíritu Santo. |
| Magisterio | Divinae Consortium Naturae | Constitución apostólica de Pablo VI que fundamenta las palabras y rito esencial del Crisma. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Efectos del sacramento | CIC 1303 | Crecimiento y profundidad de la gracia bautismal e impronta del carácter. |
| Carácter indeleble | CIC 1304 | Imprime en el alma una marca espiritual indeleble, el "carácter". |

# CITA TEXTUAL
> "La Confirmación perfecciona la gracia bautismal; es el sacramento que da el Espíritu Santo para enraizarnos más profundamente en la filiación divina." (CIC 1303)

# EXPLICACIÓN CATÓLICA

### Fundamento y Significado Teológico
La Confirmación nos une más íntimamente a Cristo y a Su Iglesia. Nos otorga los siete dones del Espíritu Santo (Sabiduría, Entendimiento, Consejo, Fortaleza, Ciencia, Piedad y Temor de Dios) que actúan como virtudes sobrenaturales en el combate de la fe diaria.

### Vivencia Apostólica
La Confirmación nos hace verdaderos testigos de Cristo para difundir y defender la fe con la palabra y las obras, siendo apóstoles valientes y comprometidos con el Evangelio en un entorno secularizado.`
  },
  "eucaristia": {
    titulo: "La Sagrada Eucaristía",
    categoria: "Sacramentos",
    texto: `# La Sagrada Eucaristía: Presencia Real de Jesucristo

La Eucaristía es fuente y culmen de toda la vida cristiana. Los demás sacramentos, como también todos los ministerios eclesiales y obras de apostolado, están unidos a la Eucaristía y a ella se ordenan. La Sagrada Eucaristía contiene todo el bien espiritual de la Iglesia: el mismo Cristo, nuestra Pascua.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Juan 6:54 | "El que come mi carne y bebe mi sangre tiene vida eterna, y yo lo resucitaré en el último día." |
| Catecismo | CIC 1374 | En la Eucaristía, Cristo está presente verdadera, real y substancialmente. |
| Magisterio | Concilio de Trento | Define solemnemente el dogma de la Transustanciación de las especies del pan y del vino. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Culmen de la Fe | CIC 1324 | La Eucaristía es fuente y cima de toda la vida cristiana. |
| Presencia Real | CIC 1374 | Presencia de Jesucristo vivo bajo las especies de pan y vino. |

# CITA TEXTUAL
> "En el santísimo sacramento de la Eucaristía están contenidos verdadera, real y substancialmente el Cuerpo y la Sangre junto con el alma y la divinidad de nuestro Señor Jesucristo." (CIC 1374)

# EXPLICACIÓN CATÓLICA

### La Transustanciación y la Presencia Real
Por la consagración del pan y del vino se realiza la conversión de toda la substancia del pan en la substancia del Cuerpo de Cristo y de toda la substancia del vino en la substancia de Su Sangre. La liturgia católica rodea la sagrada comunión con gestos de adoración extrema, sabiendo que el Rey de la Gloria humilla Su grandeza por amor a nuestras almas.

### Aplicación Práctica
Participar fructuosamente en la Eucaristía exige encontrarse en gracia de Dios, habiendo confesado previamente los pecados graves si existiesen, y guardar el ayuno prescrito por las leyes canónicas.`
  },
  "confesion": {
    titulo: "El Sacramento de la Confesión o Penitencia",
    categoria: "Sacramentos",
    texto: `# El Sacramento de la Reconciliación (Confesión)

Quienes se acercan al sacramento de la Penitencia obtienen de la misericordia de Dios el perdón de los pecados cometidos contra Él y, al mismo tiempo, se reconcilian con la Iglesia, a la que ofendieron con sus pecados. Tiene también el nombre de sacramento de la Reconciliación, de la Conversión y de la Confesión.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Juan 20:23 | "A quienes perdonéis los pecados, les quedan perdonados; a quienes se los retengáis, les quedan retenidos." |
| Catecismo | CIC 1422 | Los fieles obtienen perdón de Dios y la restauración de la amistad con Su Creador. |
| Magisterio | Concilio de Trento | Declara que el bautismo restaura la gracia original, pero la confesión es el medio instituído para los fallos posteriores. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Reconciliación con Dios | CIC 1468 | El efecto principal de la penitencia es la restauración de la gracia filial. |
| Actos del Fiel | CIC 1448 | Consta de tres actos del penitente: contrición, confesión de boca y satisfacción. |

# CITA TEXTUAL
> "El perdón de los pecados cometidos después del Bautismo es concedido por medio de un sacramento propio llamado sacramento de la conversión, de la confesión, de la penitencia o de la reconciliación." (CIC 1421)

# EXPLICACIÓN CATÓLICA

### El Examen de Conciencia y el Arrepentimiento
Un examen de conciencia sincero y un dolor verdadero del alma por haber ofendido a Dios (contrición) son las condiciones para recibir el perdón divino. La confesión individual de los pecados mortales cometidos después del Bautismo ante el sacerdote constituido válidamente sigue siendo el único camino ordinario para reconciliarse con Dios.

### Fruto Espiritual
Vencer el pudor natural y confesar con humildad los pecados derrama una paz indescriptible en el alma y otorga la gracia sacramental necesaria encaminada a evitar las caídas futuras.`
  },
  "penitencia": {
    titulo: "La Penitencia o Confesión",
    categoria: "Sacramentos",
    texto: `# El Sacramento de la Reconciliación (Penitencia)
Ver ficha detallada en el apartado de Confesión.`
  },
  "uncion de los enfermos": {
    titulo: "La Unción de los Enfermos",
    categoria: "Sacramentos",
    texto: `# El Sacramento de la Unción de los Enfermos

Con la sagrada Unción de los enfermos y con la oración de los presbíteros, toda la Iglesia encomienda a los enfermos al Señor sufriente y glorificado, para que los alivie y los salve. Incluso los exhorta a que se asocien libremente a la pasión y muerte de Cristo.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Santiago 5:14-15 | "¿Está enfermo alguno de vosotros? Llame a los presbíteros y hagan oración sobre él, ungiéndole con óleo en el nombre del Señor." |
| Catecismo | CIC 1499 | Sacramento de curación corporal y espiritual instituído por Cristo. |
| Magisterio | Carta "Innocentius" | Del Papa Inocencio I, estableciendo que la unción se reserva a los fieles gravemente enfermos. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Efectos Generales | CIC 1532 | Unión del enfermo con la pasión, fortaleza, paz y perdón si no pudo confesarse. |
| Cuándo administrarse | CIC 1514 | No es un sacramento solo para aquellos que están a punto de morir. |

# CITA TEXTUAL
> "La Unción de los enfermos no es un sacramento sólo para aquellos que están a punto de morir. El tiempo oportuno es cuando el fiel empieza a estar en peligro de muerte por enfermedad o vejez." (CIC 1514)

# EXPLICACIÓN CATÓLICA

### Unión con la Pasión de Cristo
Por la gracia de este sacramento, el enfermo recibe la fuerza y el don de unirse más íntimamente a la Pasión de Jesucristo. Su sufrimiento se transforma en un canal cooperativo de redención para la Iglesia universal, adquiriendo un valor espiritual inmenso.

### Preparación para el Tránsito
Prepara también al alma para el tránsito glorioso hacia la casa del Padre celestial. Debe ofrecerse con total naturalidad y no esperar a la última agonía, para que el enfermo pueda vivir el rito con lucidez y fe viva.`
  },
  "orden sacerdotal": {
    titulo: "El Orden Sacerdotal",
    categoria: "Sacramentos",
    texto: `# El Sacramento del Orden Sacerdotal

El Orden es el sacramento gracias al cual la misión confiada por Cristo a sus apóstoles sigue siendo ejercida en la Iglesia hasta el fin de los tiempos: es, pues, el sacramento del ministerio apostólico. Comprende tres grados: el episcopado, el presbiterado y el diaconado.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Lucas 22:19 | "Haced esto en memoria mía." Institución del sacerdocio ministerial en la Última Cena. |
| Catecismo | CIC 1536 | Sacramento del ministerio apostólico para apacentar el rebaño. |
| Magisterio | Ordinatio Sacerdotalis | Carta apostólica de San Juan Pablo II sobre la ordenación reservada a varones. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Tres Grados | CIC 1554 | El ministerio eclesiástico es ejercido por obispos, presbíteros y diáconos. |
| En la persona de Cristo | CIC 1548 | El sacerdote ordenado actúa "in persona Christi Capitis". |

# EXPLICACIÓN CATÓLICA

### El Sacerdocio Ministerial
El sacerdote actúa como mediador consagrado por la imposición de manos. Al celebrar los sacramentos, Jesucristo mismo es quien bautiza, confiesa y consagra las especies sagradas, sirviéndose del instrumento humano ordenado válidamente.

### Respeto y Oración por las Vocaciones
El católico ama, respeta y asiste a sus pastores, orando continuamente para que permanezcan fieles a su llamada celibe y pidiendo al Dueño de la mies que envíe más obreros consagrados para saciar al pueblo hambriento de Dios.`
  },
  "matrimonio": {
    titulo: "El Sacramento del Matrimonio",
    categoria: "Sacramentos",
    texto: `# El Santo Sacramento del Matrimonio

La alianza matrimonial, por la que el varón y la mujer constituyen entre sí un consorcio de toda la vida, ordenando por su misma índole natural al bien de los cónyuges y a la generación y educación de la prole, fue elevada por Cristo Nuestro Señor a la dignidad de sacramento entre bautizados.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Mateo 19:6 | "De manera que ya no son dos, sino una sola carne. Por tanto, lo que Dios unió, no lo separe el hombre." |
| Catecismo | CIC 1601 | Intimidad e indisolubilidad conyugal de un varón y una mujer de por vida. |
| Magisterio | Casti Connubii | Encíclica de Pío XI sobre la santidad espiritual y fidelidad indestructible de la unión matrimonial. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Propiedades esenciales | CIC 1643 | Unidad, indisolubilidad y ordenación al don de los hijos. |
| La Iglesia Doméstica | CIC 1656 | El hogar cristiano es el primer ámbito de catequización e iglesia doméstica. |

# CITA TEXTUAL
> "La alianza matrimonial... fue elevada por Cristo Nuestro Señor a la dignidad de sacramento entre bautizados." (CIC 1601)

# EXPLICACIÓN CATÓLICA

### Indisolubilidad y Unidad
El matrimonio cristiano se caracteriza por dos propiedades inmutables: la unidad (vincularse un solo varón con una sola mujer) y la indisolubilidad (vínculo indetectador que solo es disuelto por la muerte de uno de los cónyuges). El sacramento otorga la gracia especialísima de perfeccionar el amor conyugal de los esposos para santificarse mutuamente.

### Abierto a la Vida
La apertura sincera y generosa a la prole constituye la corona y el fin primordial de la unión conyugal, siendo cooperadores directos del Creador en la multiplicación del género humano.`
  },
  "rosario": {
    titulo: "El Santo Rosario",
    categoria: "Devociones",
    texto: `# El Santo Rosario de la Virgen María

El Rosario es una oración contemplativa centrada en los misterios de la vida, pasión, muerte y resurrección gloriosa de nuestro Señor Jesucristo, contemplados a través del corazón Inmaculado de Su Santísima Madre.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Lucas 1:28 | El saludo angelical: "Dios te salve, llena de gracia, el Señor es contigo", base del Avemaría. |
| Catecismo | CIC 2678 | El Rosario es una síntesis de todo el Evangelio y devoción eclesial mariana recomendada. |
| Magisterio | Rosarium Virginis Mariae | Carta apostólica de San Juan Pablo II que introduce los misterios luminosos. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Oración Contemplativa | CIC 2678 | La piedad eclesial hacia la Santísima Virgen se expresa magníficamente en el Rosario. |
| Intercesión Mariana | CIC 2679 | María es la orante perfecta que nos asiste en la hora de nuestra muerte. |

# EXPLICACIÓN CATÓLICA
El Santo Rosario es un arma poderosa y excelsa contra las asechanzas del maligno. No representa una mera repetición mecánica, sino una contemplación rítmica y profunda de los senderos redentores de Cristo acompañados de la intercesión infalible de la Virgen María, Reina de los Ángeles.`
  },
  "virgen maria": {
    titulo: "La Santísima Virgen María",
    categoria: "Doctrina Mariana",
    texto: `# La Santísima Virgen María — Madre de Dios y de la Iglesia

María es el santuario perfecto del Espíritu Santo, la preservada de toda mancha de pecado original desde el primer instante de su concepción (Inmaculada Concepción) y la Madre gloriosa de nuestro Salvador Jesucristo.

## TABLA DOCTRINAL UNIFICADA

| Fuente | Referencia | Enseñanza |
| --- | --- | --- |
| Biblia | Lucas 1:48 | "Desde ahora me dirán bienaventurada todas las generaciones." |
| Catecismo | CIC 964 | Cooperación activa y unida de la Virgen María en la consumación dolorosa de la Redención. |
| Magisterio | Ineffabilis Deus | Bula dogmática de Pío IX proclamando la Inmaculada Concepción. |

## Catecismo relacionado

| Tema | Numeral | Resumen |
| --- | --- | --- |
| Maternidad Divina | CIC 495 | María es verdaderamente la Madre de Dios (Theotokos) porque engendró al Verbo. |
| Inmaculada Concepción | CIC 491 | Preservada inmune de toda mancha de pecado original desde su concepción. |

# CITA TEXTUAL
> "Lo que la fe católica cree acerca de María se funda en lo que cree acerca de Cristo, pero lo que enseña sobre María ilumina a su vez su fe en Cristo." (CIC 487)

# EXPLICACIÓN CATÓLICA
La Iglesia profesa cuatro dogmas marianos inmutables: Su Maternidad Divina (Theotokos), Su Virginidad Perpetua (antes, en y después del parto), Su Inmaculada Concepción y Su Asunción Gloriosa en cuerpo y alma a los cielos. Rendimos a María el culto de hiperdulía (vulnerable honor espiritual) que la distingue de los santos comunes (dulía) y nos guía siempre a la adoración exclusiva de Dios (latría).`
  }
};

// Aliados de redireccionamiento rápido de preguntas populares
const POPULAR_KEYS_MAP = {
  "¿que es la eucaristia?": "eucaristia",
  "que es la eucaristia": "eucaristia",
  "eucaristia": "eucaristia",
  "la eucaristia": "eucaristia",
  "el bautismo": "bautismo",
  "bautismo": "bautismo",
  "¿que es el bautismo?": "bautismo",
  "que es el bautismo": "bautismo",
  "el rosario": "rosario",
  "rosario": "rosario",
  "santo rosario": "rosario",
  "¿que es el rosario?": "rosario",
  "que es el rosario": "rosario",
  "la confesion": "confesion",
  "confesion": "confesion",
  "penitencia": "confesion",
  "reconciliacion": "confesion",
  "¿que es la confesion?": "confesion",
  "que es la confesion": "confesion",
  "virgen maria": "virgen maria",
  "maria": "virgen maria",
  "virgen": "virgen maria",
  "santisima virgen": "virgen maria",
  "confirmacion": "confirmacion",
  "el matrimonio": "matrimonio",
  "matrimonio": "matrimonio",
  "orden sacerdotal": "orden sacerdotal",
  "uncion de los enfermos": "uncion de los enfermos",
  "uncion": "uncion de los enfermos"
};

// --- Helper: Guardar respuesta dinámica de caché en archivo ---
function guardarDynamicCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DYNAMIC_CACHE_FILE, JSON.stringify(dynamicCache, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Cache Engine] Error persistiendo caché dinámica:', err.message);
  }
}

// --- 3. EXPORTAR SISTEMA CENTRAL DE CONSULTA Y BÚSQUEDA ---

function buscarEnCacheDoctrinal(query) {
  const normQ = query.toLowerCase().trim().replace(/[\?\¿\!]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 1. Probar mapeo de preguntas/términos estáticos súper solicitados
  const termKey = POPULAR_KEYS_MAP[normQ] || POPULAR_KEYS_MAP[query.toLowerCase().trim()];
  if (termKey && STATIC_DOCTRINAL_CACHE[termKey]) {
    console.log(`[Cache Engine] HIT Estático y Perfecto: Mapeo de "${query}" a clave "${termKey}"`);
    return STATIC_DOCTRINAL_CACHE[termKey].texto;
  }

  // 2. Probar si un sacramentos es nombrado en particular
  for (const [key, item] of Object.entries(STATIC_DOCTRINAL_CACHE)) {
    if (normQ.includes(key) && normQ.length < key.length + 8) {
      console.log(`[Cache Engine] HIT Estático Parcial: El término "${key}" coincide con la consulta.`);
      return item.texto;
    }
  }

  // 3. Probar caché dinámica (historias previas que tardaban)
  if (dynamicCache[normQ]) {
    console.log(`[Cache Engine] HIT Dinámico para: "${query}" (Instantáneo 0.1s!)`);
    return dynamicCache[normQ];
  }

  return null;
}

function guardarEnCacheDoctrinal(query, responseText) {
  const normQ = query.toLowerCase().trim().replace(/[\?\¿\!]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Evitar guardar respuestas vacías o con errores
  if (!responseText || responseText.length < 100 || responseText.includes('conveniente temporal')) return;
  
  dynamicCache[normQ] = responseText;
  guardarDynamicCache();
  console.log(`[Cache Engine] Guardada entrada dinámica en caché para la consulta: "${normQ}"`);
}

// --- 4. DETECTORES DE MODO DE EJECUCIÓN ---

function esConsultaBiblica(query) {
  const keywords = ['cita biblica', 'citas biblicas', 'versiculo', 'versiculos', 'biblia', 'evangelio', 'pasajes biblicos', 'que dice la biblia', 'textos biblicos', 'tito', 'filimon', 'romanos', 'hebreos', 'salmos', 'isaias', 'genesis', 'exodo', 'lucas', 'marcos', 'mateo', 'juan'];
  const norm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Si contiene palabras clave explícitas del motor bíblico
  for (const kw of keywords) {
    if (norm.includes(kw)) return true;
  }
  return false;
}

function esConsultaCatecismo(query) {
  const keywords = ['catecismo', 'cic', 'que enseña la iglesia', 'que ensena la iglesia', 'doctrina catolica', 'enseñanza oficial', 'ensenanza oficial', 'magisterio'];
  const norm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const kw of keywords) {
    if (norm.includes(kw)) return true;
  }
  return false;
}

function esConsultaCombinada(query) {
  // Temas doctrinales de alta demanda que requieren Biblia + Catecismo + Magisterium
  const keywords = ['eucaristia', 'confesion', 'penitencia', 'reconciliacion', 'maria', 'virgen maria', 'sacerdocio', 'sacerdote', 'matrimonio', 'purgatorio', 'cielo', 'infierno', 'gracia', 'pecado', 'sacramento', 'sacramentos'];
  const norm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Si coincide con un tema central doctrinal grande
  for (const kw of keywords) {
    if (norm.includes(kw)) return true;
  }
  return false;
}

// --- 5. BUSCADOR INTELIGENTE EN EL CATECISMO (LOCAL SIN INVENTAR) ---
function buscarCatecismoLocal(query) {
  const targetCics = [];
  const queryNorm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Cargar dataset del Catecismo
  let catecismo = recursos.DATASETS.catecismo;
  if (!catecismo) {
    try {
      catecismo = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'catecismo.json'), 'utf8'));
    } catch(err) {
      console.warn('[Advanced Engine] No se cargó catecismo.json:', err.message);
      return [];
    }
  }

  if (!catecismo || !catecismo.partes) return [];

  // Recorrer recursivamente para encontrar artículos
  const articulos = [];
  function extraer(obj, parentTema = '') {
    if (Array.isArray(obj)) {
      obj.forEach(x => extraer(x, parentTema));
    } else if (obj && typeof obj === 'object') {
      const actualTema = obj.tema || obj.titulo || parentTema;
      if (obj.cic && obj.texto) {
        articulos.push({ cic: obj.cic, texto: obj.texto, tema: actualTema });
      } else {
        Object.values(obj).forEach(x => extraer(x, actualTema));
      }
    }
  }
  extraer(catecismo.partes);

  // Ver si hay un número específico de CIC listado
  const numMatch = query.match(/cic\s*(\d+)/i) || query.match(/catecismo\s*(\d+)/i) || query.match(/numeral\s*(\d+)/i) || query.match(/\b(\d{2,4})\b/);
  if (numMatch) {
    const requestedNum = parseInt(numMatch[1], 10);
    const exactArt = articulos.find(a => a.cic === requestedNum);
    if (exactArt) {
      return [{
        numeral: `CIC ${exactArt.cic}`,
        tema: exactArt.tema || 'Doctrina de la Iglesia',
        resumen: exactArt.texto.slice(0, 150) + '...',
        texto: exactArt.texto
      }];
    }
  }

  // Búsqueda aproximada por concordancia de tema/palabras
  articulos.forEach(art => {
    const artTextNorm = art.texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const artTemaNorm = (art.tema || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let matches = false;
    // Si contiene el tema o se cruza el texto significativamente
    if (artTextNorm.includes(queryNorm) || queryNorm.includes(artTextNorm)) {
      matches = true;
    } else {
      const words = queryNorm.split(/\s+/).filter(w => w.length > 3);
      let hitCount = 0;
      words.forEach(w => {
        if (artTextNorm.includes(w) || artTemaNorm.includes(w)) hitCount++;
      });
      if (hitCount >= 2 || (words.length === 1 && (artTextNorm.includes(words[0]) || artTemaNorm.includes(words[0])))) {
        matches = true;
      }
    }

    if (matches) {
      targetCics.push({
        numeral: `CIC ${art.cic}`,
        tema: art.tema || 'Doctrina de la Iglesia',
        resumen: art.texto.trim().substring(0, 160) + '...',
        texto: art.texto.trim()
      });
    }
  });

  return targetCics.slice(0, 3);
}

// --- 6. PROCESADORES DIGITALES Y SEMÁNTICOS (BÍBLICA, CATECISMO Y COMBINADO) ---

// Paso 1 & 2: Consultar Gemini para extraer temas y referencias y consultar API Bíblica Online
async function obtenerVersiculosRealesDeTema(temaQuery, activeAi) {
  const resultQuotes = [];
  if (!activeAi) return resultQuotes;

  try {
    const promptRefList = `Actúas como erudito de la Biblia de rito católico. El usuario consulta temas bíblicos/doctrinales.
Identifica exactamente 3 citas bíblicas fidedignas e icónicas en la teología en español que respondan directamente al tema de esta consulta: "${temaQuery}".
Devuelve ÚNICAMENTE un arreglo JSON con el siguiente esquema estricto (no añadas comentarios, explicaciones, markdown, ni caracteres extraños fuera del bloque JSON):
[
  {"tema": "Título breve del tema teológico", "referencia": "Libro Capítulo:Versículo", "comentario_breve": "Por qué es relevante en un enunciado corto"}
]
Ejemplo:
[
  {"tema": "Amor de Dios", "referencia": "Juan 3:16", "comentario_breve": "Muestra el sacrificio filial por amor"}
]`;

    const modelResponse = await activeAi.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptRefList,
      config: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    if (modelResponse && modelResponse.text) {
      const cleanJson = modelResponse.text.replace(/`{3}(?:json|text)?|`{3}/gi, '').trim();
      const listRefs = JSON.parse(cleanJson);
      if (Array.isArray(listRefs)) {
        for (const item of listRefs) {
          const fetchedVerses = await biblia.obtenerCitaAsync(item.referencia);
          if (fetchedVerses && fetchedVerses.versiculos && Object.keys(fetchedVerses.versiculos).length > 0) {
            // Combinar los versículos ordenados
            const fullText = Object.entries(fetchedVerses.versiculos)
              .sort((a,b) => parseInt(a[0], 10) - parseInt(b[0], 10))
              .map(([num, txt]) => `<sup>${num}</sup> ${txt}`)
              .join(' ');

            resultQuotes.push({
              tema: item.tema,
              referencia: `${fetchedVerses.libro} ${fetchedVerses.capitulo}${fetchedVerses.verVer ? ':' + fetchedVerses.verVer + (fetchedVerses.verHasta !== fetchedVerses.verVer ? '-' + fetchedVerses.verHasta : '') : ''}`,
              texto: fullText,
              originalRef: item.referencia,
              comentario: item.comentario_breve,
              translation: fetchedVerses.translation
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Advanced Engine] Error recuperando versículos temáticos reales:', err.message);
  }

  // Fallback si la extracción o el parseo en línea fallaron, recuperar 2 citas bíblicas estables por palabras clave
  if (resultQuotes.length === 0) {
    const lower = temaQuery.toLowerCase();
    let backupRef = 'Romanos 15:13';
    let backupTema = 'Esperanza y fe';
    if (lower.includes('perdon') || lower.includes('confes') || lower.includes('pecado')) {
      backupRef = '1 Juan 1:9';
      backupTema = 'Confesión y perdón';
    } else if (lower.includes('amor') || lower.includes('caridad')) {
      backupRef = '1 Corintios 13:4-7';
      backupTema = 'La excelencia del amor';
    } else if (lower.includes('maria') || lower.includes('virgen')) {
      backupRef = 'Lucas 1:48';
      backupTema = 'Bienaventuranza mariana';
    } else if (lower.includes('eucaristia') || lower.includes('pan') || lower.includes('cuerpo')) {
      backupRef = 'Juan 6:54';
      backupTema = 'Pan de Vida Eterna';
    }

    const fetched = await biblia.obtenerCitaAsync(backupRef);
    if (fetched && fetched.versiculos) {
      const fullText = Object.entries(fetched.versiculos).map(([num, txt]) => `<sup>${num}</sup> ${txt}`).join(' ');
      resultQuotes.push({
        tema: backupTema,
        referencia: backupRef,
        texto: fullText,
        translation: fetched.translation
      });
    }
  }

  return resultQuotes;
}

// --- 7. EXECUTOR CENTRAL DE MODOS ---

async function ejecutarModoBiblicoAvanzado(query, res, activeAi, magisteriumSourceResponse) {
  console.log('[Advanced Engine] Ejecutando: MODO BÚSQUEDA BÍBLICA AVANZADA');

  // Paso 1 & 2: Obtener tema y referencias e invocar API bíblica programaáticamente
  const quotes = await obtenerVersiculosRealesDeTema(query, activeAi);

  // Formatear tabla de salida
  let tableMarkdown = `## Tabla de referencias\n\n`;
  tableMarkdown += `| Tema | Referencia | Texto |\n`;
  tableMarkdown += `| --- | --- | --- |\n`;
  quotes.forEach(q => {
    // Reemplazar saltos en texto
    const cleanedText = q.texto.replace(/\r?\n/g, ' ').substring(0, 300) + (q.texto.length > 300 ? '...' : '');
    tableMarkdown += `| ${q.tema} | <a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(q.originalRef || q.referencia)}&version=DHH" class="bible-citation" target="_blank" data-ref="${q.originalRef || q.referencia}">${q.referencia}</a> | *${cleanedText}* (${q.translation}) |\n`;
  });

  // Paso 3 & 4: Pedirle a Gemini la síntesis pastoral y exégesis seria católica, reforzando la prohibición de clasificaciones técnicas
  const promptPresentacion = `Actúas bajo la ESPECIFICACIÓN MAESTRA de CatólicosGPT, como un piadoso teólogo y gran educador de moral y Escritura.
El usuario realiza esta consulta bíblica: "${query}".
Hemos recuperado las siguientes citas bíblicas reales confirmadas desde el corpus de traducción oficial:
${JSON.stringify(quotes, null, 2)}

La fuente del Magisterio nos indica sobre este tema:
"""
${magisteriumSourceResponse}
"""

Instrucciones de formato e hilos obligatorios:
1. Tu respuesta final debe estar completamente estructurada bajo este exacto formato en Markdown:

# Citas Bíblicas sobre la Esperanza (o el tema que corresponda)
[Escribe aquí una breve, cálida y pastoral introducción introduciendo el tema, de manera humana y directa, sin aludir a procesos de sistema ni clasificaciones.]

[INSERTAR_TABLA_REFERENCIAS_REEMPLAZO]

# EXPLICACIÓN CATÓLICA
Escribe aquí una exégesis teológica y moral impecable y detallada (mínimo de 400-600 palabras) abordando con detalle:
- Qué enseñan en conjunto estos pasajes bíblicos.
- Cómo deben interpretarse bajo la luz del Magisterio constante de la Iglesia (Patrística y Concilios).
- Cómo aplicarlas de forma viva, práctica y espiritual en las vicisitudes del vivir ordinario de un católico fiel hoy.

2. PROHIBICIÓN CRÍTICA ABSOLUTA: No menciones nunca terminología técnica de IA, ni muestres secciones como "CLASIFICACIÓN DE CONSULTA", "TEMAS", "AUTOEVALUACIÓN", "VALIDACIÓN 10/10", ni análisis de prompts de fondo. Comienza de inmediato con el título principal de nivel 1.`;

  try {
    const finalResponse = await activeAi.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptPresentacion,
      config: { temperature: 0.3 }
    });

    if (finalResponse && finalResponse.text) {
      let resultText = finalResponse.text.trim();
      // Reemplazar el marcador de la tabla
      resultText = resultText.replace('[INSERTAR_TABLA_REFERENCIAS_REEMPLAZO]', tableMarkdown);
      
      // Guardar en caché para optimización de alto rendimiento futura
      guardarEnCacheDoctrinal(query, resultText);
      
      res.write(resultText);
      return true;
    }
  } catch (err) {
    console.error('[Advanced Engine] Falló Gemini en síntesis de Modo Bíblico:', err.message);
  }

  return false;
}

async function ejecutarModoCatecismo(query, res, activeAi, magisteriumSourceResponse) {
  console.log('[Advanced Engine] Ejecutando: MODO CONSULTA CATECISMO');

  // Recuperar numerales reales locales asociados
  const links = buscarCatecismoLocal(query);
  
  let tableMarkdown = `## Catecismo relacionado\n\n`;
  tableMarkdown += `| Tema | Numeral | Resumen |\n`;
  tableMarkdown += `| --- | --- | --- |\n`;
  
  let textualQuotes = ``;

  if (links.length > 0) {
    links.forEach(l => {
      tableMarkdown += `| ${l.tema} | **${l.numeral}** | ${l.resumen} |\n`;
      textualQuotes += `\n# CITA TEXTUAL (${l.numeral})\n> "${l.texto}"\n`;
    });
  } else {
    // Fallback genérico estable
    tableMarkdown += `| Ley y Sacramentos | **CIC 1114** | Los sacramentos de la Nueva Ley instituidos por Jesucristo son siete. |\n`;
    tableMarkdown += `| Primacía Ecuarística | **CIC 1324** | La Eucaristía es fuente y cima de toda la vida cristiana. |\n`;
    
    textualQuotes += `\n# CITA TEXTUAL (CIC 1324)\n> "La Eucaristía es fuente y cima de toda la vida de la Iglesia."\n`;
  }

  const promptPresentacion = `Actúas bajo la ESPECIFICACIÓN MAESTRA de CatólicosGPT, sirviendo con fidelidad doctrinal absoluta.
El usuario consulta el Catecismo sobre: "${query}".

Hemos recuperado los siguientes numerales de doctrina auténticos de nuestro dataset local:
${JSON.stringify(links, null, 2)}

Enlace adicional de Magisterio recopilado por el integrador:
"""
${magisteriumSourceResponse}
"""

Instrucciones obligatorias de estructuración de salida:
El formato de tu texto debe ser el siguiente (comenzando directo en el título de la consulta):

# Enseñanza del Catecismo sobre [Tema]
Escribe aquí un resumen teológico y una introducción pastoral cálida (mínimo de 150-250 palabras).

[INSERTAR_TABLA_CATECISMO_REEMPLAZO]

[INSERTAR_CITAS_TEXTUALES_REEMPLAZO]

# EXPLICACIÓN DOCTRINAL CATÓLICA
Escribe un análisis dogmático e histórico detallado de los numerales citados (mínimo de 300 palabras). Explica la procedencia patrística, conciliar (Trento, Vaticano II) y su trascendencia en la moral individual y vida comunitaria parroquial de hoy.

PROHIBICIÓN STRICTA: No muestres ni un solo carácter de clasificaciones o autoevaluaciones del sistema. Empieza directo en el título.`;

  try {
    const finalResponse = await activeAi.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptPresentacion,
      config: { temperature: 0.3 }
    });

    if (finalResponse && finalResponse.text) {
      let resultText = finalResponse.text.trim();
      resultText = resultText.replace('[INSERTAR_TABLA_CATECISMO_REEMPLAZO]', tableMarkdown);
      resultText = resultText.replace('[INSERTAR_CITAS_TEXTUALES_REEMPLAZO]', textualQuotes);
      
      guardarEnCacheDoctrinal(query, resultText);
      res.write(resultText);
      return true;
    }
  } catch (err) {
    console.error('[Advanced Engine] Falló síntesis en Modo Catecismo:', err.message);
  }

  return false;
}

// MODO COMBINADO COHERENTE: Biblia, Catecismo y Magisterium en sintonía perfecta
async function ejecutarModoCombinado(query, res, activeAi, magisteriumSourceResponse) {
  console.log('[Advanced Engine] Ejecutando: MODO DOCTRINAL COMBINADO (Biblia + Catecismo + Magisterio)');

  // 1. Obtener citas bíblicas reales
  const quotes = await obtenerVersiculosRealesDeTema(query, activeAi);

  // 2. Obtener numerales del Catecismo reales
  const keyLinks = buscarCatecismoLocal(query);

  // 3. Organizar Tabla Doctrinal Unificada
  let unificadaMarkdown = `## TABLA DOCTRINAL UNIFICADA\n\n`;
  unificadaMarkdown += `| Fuente | Referencia | Enseñanza |\n`;
  unificadaMarkdown += `| --- | --- | --- |\n`;

  // Añadir primera fila bíblica si hay
  if (quotes.length > 0) {
    const b = quotes[0];
    const cleanedText = b.texto.replace(/<[^>]*>/g, '').replace(/\r?\n/g, ' ').substring(0, 150) + '...';
    unificadaMarkdown += `| Biblia | <a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(b.originalRef || b.referencia)}&version=DHH" class="bible-citation" target="_blank" data-ref="${b.originalRef || b.referencia}">${b.referencia}</a> | ${cleanedText} |\n`;
  } else {
    unificadaMarkdown += `| Biblia | Juan 14:6 | Cristo es el único camino, la verdad y la vida eterna. |\n`;
  }

  // Añadir fila de Catecismo si hay
  if (keyLinks.length > 0) {
    const c = keyLinks[0];
    unificadaMarkdown += `| Catecismo | **${c.numeral}** | ${c.resumen} |\n`;
  } else {
    unificadaMarkdown += `| Catecismo | CIC 1114 | Los sacramentos son siete y fueron instituidos por Jesucristo Señor Nuestro. |\n`;
  }

  // Añadir fila de Magisterio
  unificadaMarkdown += `| Magisterio | Lumen Gentium (Vat II) | La Iglesia constituida y organizada en este mundo como una sociedad gobernada por el sucesor de Pedro y los obispos. |\n`;

  const promptPresentacion = `Eres un fiel teólogo católico redactando bajo el Amparo eclesial e instrucciones de CatólicosGPT.
El usuario consulta un tema doctrinal de fundamental calado: "${query}".

Citas bíblicas verificadas:
${JSON.stringify(quotes, null, 2)}

Citas de Catecismo verificadas:
${JSON.stringify(keyLinks, null, 2)}

Magisterio recopilado doctrinal:
"""
${magisteriumSourceResponse}
"""

Instrucciones estrictas de salida:
Formula una respuesta soberbia, pastoral y sumamente inspiradora que se inicie directo con un título grande y respetando este exacto esquema:

# Exposición Doctrinal Cristiana sobre el/la [Tema]
Escribe aquí una profunda introducción y una respuesta breve explicativa directa y esperanzadora (mínimo de 200 palabras).

[INSERTAR_TABLA_UNIFICADA_REEMPLAZO]

# EXPLICACIÓN TEOLÓGICA Y PASTORAL Y CONEXIÓN VIVA
Desarrolla detalladamente (mínimo 500-800 palabras):
- Cómo el fundamento bíblico se entrelaza ineludiblemente con la enseñanza del Catecismo.
- Cómo el Magisterio de la Iglesia ha defendido e interpretado esta enseñanza frente a desafíos históricos.
- De qué forma práctica y viva un católico de hoy puede aplicar esta verdad en el seno de su familia y en la evangelización del mundo contemporáneo.

Regla Absoluta de Seguridad: Queda estrictamente PROHIBIDO mostrar clasificaciones internas de consulta ("CLASIFICACIÓN DE CONSULTA", "AUTOEVALUACIÓN") o checklists al fiel.`;

  try {
    const finalResponse = await activeAi.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptPresentacion,
      config: { temperature: 0.3 }
    });

    if (finalResponse && finalResponse.text) {
      let resultText = finalResponse.text.trim();
      resultText = resultText.replace('[INSERTAR_TABLA_UNIFICADA_REEMPLAZO]', unificadaMarkdown);
      
      guardarEnCacheDoctrinal(query, resultText);
      res.write(resultText);
      return true;
    }
  } catch (err) {
    console.error('[Advanced Engine] Falló síntesis en Modo Combinado Doctrinal:', err.message);
  }

  return false;
}

module.exports = {
  buscarEnCacheDoctrinal,
  guardarEnCacheDoctrinal,
  esConsultaBiblica,
  esConsultaCatecismo,
  esConsultaCombinada,
  ejecutarModoBiblicoAvanzado,
  ejecutarModoCatecismo,
  ejecutarModoCombinado,
  buscarCatecismoLocal
};
