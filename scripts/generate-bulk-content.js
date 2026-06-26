const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const blogPath = path.join(dataDir, 'blog-catalog.json');
const santoralPath = path.join(dataDir, 'santoral-db.json');
const santosBasePath = path.join(dataDir, 'santos.json');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 92);
}

function uniqueSlug(base, used) {
  let slug = slugify(base) || 'contenido-catolico';
  const original = slug;
  let n = 2;
  while (used.has(slug)) {
    slug = `${original}-${n++}`;
  }
  used.add(slug);
  return slug;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const categories = [
  'oraciones', 'novenas', 'virgen-maria', 'apariciones-marianas', 'milagros',
  'milagros-de-santos', 'catequesis', 'catequesis-para-ninos', 'sacramentos',
  'biblia', 'familia', 'adviento', 'cuaresma', 'semana-santa', 'eucaristia',
  'confesion', 'rosario', 'doctrina', 'apologetica', 'liturgia',
  'espiritualidad', 'santos', 'jovenes', 'matrimonio', 'vida-cristiana'
];

const topicGroups = {
  oraciones: [
    'oracion de la manana', 'oracion de la noche', 'oracion al Espiritu Santo',
    'oracion por los hijos', 'oracion por la familia', 'oracion para momentos dificiles',
    'oracion de sanacion interior', 'oracion por los enfermos', 'oracion antes de dormir',
    'oracion para pedir sabiduria', 'oracion por el trabajo', 'oracion de accion de gracias',
    'oracion contra el miedo', 'oracion por la paz del hogar', 'oracion para antes de estudiar',
    'oracion por los difuntos', 'oracion por el matrimonio', 'oracion para pedir fe',
    'oracion a san Jose', 'oracion a san Miguel Arcangel'
  ],
  novenas: [
    'novena a la Virgen de Guadalupe', 'novena a san Jose', 'novena al Sagrado Corazon',
    'novena a la Divina Misericordia', 'novena de Navidad', 'novena al Espiritu Santo',
    'novena a santa Rita', 'novena a san Judas Tadeo', 'novena a san Antonio de Padua',
    'novena a la Virgen del Carmen', 'novena a la Virgen de Fatima',
    'novena a Nuestra Senora de Lourdes', 'novena para pedir trabajo',
    'novena por los enfermos', 'novena por la familia', 'novena por los matrimonios',
    'novena por los hijos', 'novena a san Francisco de Asis', 'novena a santa Teresita',
    'novena a san Peregrino'
  ],
  'virgen-maria': [
    'la Virgen Maria en la Biblia', 'el Magnificat explicado', 'Maria Madre de Dios',
    'la Inmaculada Concepcion', 'la Asuncion de la Virgen', 'el Rosario explicado',
    'los dolores de la Virgen Maria', 'Maria modelo de discipula', 'devocion al Inmaculado Corazon',
    'Maria en el Catecismo', 'consagracion a la Virgen Maria', 'letanias lauretanas explicadas'
  ],
  'apariciones-marianas': [
    'Nuestra Senora de Guadalupe', 'Nuestra Senora de Fatima', 'Nuestra Senora de Lourdes',
    'Nuestra Senora del Carmen', 'Nuestra Senora de La Salette', 'Nuestra Senora de Akita',
    'Virgen de la Medalla Milagrosa', 'Nuestra Senora de Chiquinquira', 'Nuestra Senora de Coromoto',
    'Nuestra Senora de Aparecida', 'Virgen de Lujan', 'Virgen de la Altagracia'
  ],
  milagros: [
    'milagros eucaristicos', 'milagro de Lanciano', 'milagros de sanacion',
    'milagros de conversion', 'milagros en la Biblia', 'como entender un milagro',
    'diferencia entre milagro y supersticion', 'milagros aprobados por la Iglesia',
    'milagros y fe cristiana', 'milagros de la Virgen Maria'
  ],
  'milagros-de-santos': [
    'milagros de san Antonio de Padua', 'milagros de san Padre Pio', 'milagros de santa Rita',
    'milagros de san Juan Pablo II', 'milagros de santa Teresita', 'milagros de san Charbel',
    'milagros de san Jose', 'milagros de san Francisco de Asis', 'milagros de san Martin de Porres',
    'milagros de santa Faustina'
  ],
  catequesis: [
    'que es la fe catolica', 'los diez mandamientos explicados', 'las bienaventuranzas',
    'el Credo explicado', 'la gracia santificante', 'pecado mortal y venial',
    'virtudes teologales', 'virtudes cardinales', 'obras de misericordia',
    'la comunion de los santos', 'el juicio particular', 'el cielo el purgatorio y el infierno'
  ],
  'catequesis-para-ninos': [
    'Dios Padre explicado para ninos', 'Jesus amigo de los ninos', 'la misa explicada para ninos',
    'el Rosario para ninos', 'los mandamientos para ninos', 'la primera comunion',
    'la confesion para ninos', 'oraciones basicas para ninos', 'los santos para ninos',
    'la Virgen Maria para ninos', 'el angel de la guarda', 'la Biblia para ninos'
  ],
  sacramentos: [
    'Bautismo', 'Confirmacion', 'Eucaristia', 'Confesion', 'Uncion de los enfermos',
    'Matrimonio', 'Orden sacerdotal', 'sacramentos de iniciacion', 'sacramentos de curacion',
    'sacramentos al servicio de la comunion'
  ],
  biblia: [
    'como leer la Biblia', 'Evangelio de Juan', 'Salmo 23', 'Salmo 91',
    'parabolas de Jesus', 'sermon de la montana', 'las bodas de Cana',
    'la multiplicacion de los panes', 'el buen samaritano', 'el hijo prodigo',
    'la pasion de Cristo', 'resurreccion de Jesus'
  ],
  familia: [
    'familia catolica', 'oracion familiar', 'educar hijos en la fe', 'matrimonio catolico',
    'perdon en la familia', 'familia y Eucaristia', 'bendicion de los hijos',
    'crisis familiar y fe', 'consagracion del hogar', 'catequesis en casa'
  ],
  adviento: ['Adviento explicado', 'corona de Adviento', 'novena de Navidad', 'preparacion espiritual para Navidad', 'lecturas de Adviento'],
  cuaresma: ['Cuaresma explicada', 'ayuno oracion y limosna', 'via crucis', 'conversion cuaresmal', 'confesion en Cuaresma'],
  'semana-santa': ['Domingo de Ramos', 'Jueves Santo', 'Viernes Santo', 'Vigilia Pascual', 'Pascua de Resurreccion'],
  eucaristia: ['adoracion eucaristica', 'presencia real de Jesus', 'comunion espiritual', 'santa misa', 'Corpus Christi'],
  confesion: ['examen de conciencia', 'como confesarse bien', 'acto de contricion', 'pecado y misericordia', 'direccion espiritual'],
  rosario: ['misterios gozosos', 'misterios luminosos', 'misterios dolorosos', 'misterios gloriosos', 'como rezar el Rosario'],
  doctrina: ['Iglesia una santa catolica y apostolica', 'Tradicion y Escritura', 'Magisterio de la Iglesia', 'Catecismo de la Iglesia Catolica', 'doctrina social de la Iglesia'],
  apologetica: ['por que los catolicos veneran imagenes', 'por que confesarse con un sacerdote', 'la intercesion de los santos', 'el Papa y la sucesion apostolica', 'Maria y los catolicos'],
  liturgia: ['partes de la misa', 'ano liturgico', 'colores liturgicos', 'liturgia de las horas', 'domingo dia del Senor'],
  espiritualidad: ['discernimiento espiritual', 'vida de oracion', 'silencio interior', 'lectio divina', 'santidad cotidiana'],
  santos: ['vida de los santos', 'santos jovenes', 'santos doctores de la Iglesia', 'martires de la Iglesia', 'santas madres y esposas'],
  jovenes: ['jovenes catolicos', 'vocacion cristiana', 'castidad y amor verdadero', 'amistad cristiana', 'redes sociales y fe'],
  matrimonio: ['preparacion al matrimonio', 'amor conyugal', 'apertura a la vida', 'perdon matrimonial', 'oracion de esposos'],
  'vida-cristiana': ['examen diario', 'regla de vida cristiana', 'mision del laico', 'trabajo santificado', 'caridad concreta']
};

const modifiers = [
  'guia completa', 'preguntas frecuentes', 'para principiantes', 'para familias',
  'para catequistas', 'explicado paso a paso', 'fundamento biblico y catequetico',
  'errores comunes', 'devocion y practica diaria', 'guia para parroquias'
];

function titleCase(text) {
  return String(text)
    .split(' ')
    .map(w => w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bLa\b/g, 'la')
    .replace(/\bEl\b/g, 'el')
    .replace(/\bY\b/g, 'y');
}

function makeExcerpt(title, category) {
  return `${title}: guia catolica con explicacion doctrinal, preguntas y respuestas, tabla resumen y orientaciones practicas para vivir la fe.`;
}

function makeKeywords(topic, category, title) {
  const parts = [
    topic, title, category.replace(/-/g, ' '), 'catolico', 'catolicosgpt',
    'catequesis catolica', 'formacion catolica', 'oracion catolica',
    'doctrina catolica', 'guia catolica'
  ];
  return [...new Set(parts.map(p => String(p).toLowerCase()))].join(', ');
}

function makeBlogContent({ title, topic, category, index }) {
  const cleanCategory = category.replace(/-/g, ' ');
  const pastoralFocus = index % 3 === 0 ? 'familias y catequistas' : index % 3 === 1 ? 'jovenes y adultos que inician un camino de fe' : 'comunidades parroquiales y agentes pastorales';
  const tableRows = [
    ['Tema central', topic],
    ['Objetivo catequetico', `Comprender ${topic} desde la fe catolica y aplicarlo a la vida diaria.`],
    ['Base doctrinal', 'Sagrada Escritura, Catecismo de la Iglesia Catolica y tradicion viva de la Iglesia.'],
    ['Practica recomendada', 'Oracion, lectura meditada, participacion sacramental y obras de caridad.'],
    ['Fruto espiritual', 'Conversion, confianza en Dios, vida sacramental y crecimiento en santidad.']
  ];

  const base = `# ${title}

## Introduccion

${title} es una guia de formacion catolica pensada para ${pastoralFocus}. No busca reemplazar la catequesis parroquial ni el acompanamiento de un sacerdote, sino ofrecer una ruta clara para comprender, rezar y vivir este tema dentro de la fe de la Iglesia.

En muchas busquedas actuales los fieles desean respuestas rapidas sobre ${topic}, pero la vida cristiana necesita algo mas que definiciones breves. Necesita una vision organica: que ensena la Iglesia, como se conecta con la Biblia, que lugar ocupa en la liturgia, que errores conviene evitar y como llevarlo a la vida concreta.

Esta guia presenta el tema desde una perspectiva catequetica, con lenguaje sencillo, pero con profundidad suficiente para servir en una reunion de formacion, una clase de catequesis, una preparacion sacramental o una lectura personal de crecimiento espiritual.

## Fundamento biblico y doctrinal

La fe catolica siempre une Palabra de Dios, Tradicion viva y Magisterio. Por eso, al estudiar ${topic}, no basta preguntar que siento o que opinion circula en internet. Conviene preguntar que ha recibido, custodiado y transmitido la Iglesia.

El Catecismo de la Iglesia Catolica recuerda constantemente que la vida cristiana nace del encuentro con Jesucristo, se alimenta en los sacramentos y madura en la caridad. Toda devocion, novena, explicacion biblica o practica espiritual debe conducir a Cristo y a una comunion mas plena con su Iglesia.

Cuando este tema se vive rectamente, ayuda al creyente a ordenar la mente, purificar el corazon y fortalecer la voluntad. Cuando se vive de modo superficial, puede convertirse en costumbre vacia, curiosidad religiosa o busqueda de soluciones magicas. La catequesis sana evita esos extremos.

## Guia catequetica paso a paso

### 1. Comprender antes de practicar

El primer paso es comprender que ${topic} no es un elemento aislado. Forma parte de una vida cristiana completa: escucha de la Palabra, oracion, sacramentos, vida moral, comunidad y mision. La Iglesia no propone practicas para acumular ritos, sino para formar discipulos.

### 2. Leerlo desde Cristo

Todo en la fe catolica se entiende a la luz de Jesucristo. Si una devocion, una oracion o una explicacion doctrinal no conduce a amar mas al Senor, necesita ser corregida. Cristo es el centro de la catequesis, de la liturgia y de la vida espiritual.

### 3. Unir doctrina y vida

La doctrina no es teoria fria. Es luz para vivir. Por eso, ${topic} debe ayudar a tomar decisiones concretas: reconciliarse, perdonar, rezar mejor, educar con paciencia, participar en la misa, servir a los pobres y dar testimonio publico de la fe.

### 4. Evitar reducciones

Un error frecuente es reducir la fe a sentimiento, miedo, costumbre familiar o interes por milagros. La Iglesia reconoce signos extraordinarios, pero insiste en la conversion ordinaria: humildad, obediencia, caridad, pureza de intencion y perseverancia.

## Tabla resumen

| Aspecto | Explicacion catequetica |
|---|---|
${tableRows.map(([a, b]) => `| ${a} | ${b} |`).join('\n')}

## Preguntas y respuestas

### ¿Por que este tema es importante para un catolico?

Porque ayuda a ordenar la fe y a vivirla con inteligencia espiritual. Un catolico no esta llamado a repetir palabras sin comprenderlas, sino a dejar que la verdad de Cristo ilumine toda su existencia.

### ¿Tiene fundamento en la Biblia?

Si. Aunque no siempre aparezca con la misma expresion moderna, sus raices estan en la revelacion biblica: la alianza de Dios con su pueblo, la vida de Cristo, la accion del Espiritu Santo y la mision de la Iglesia.

### ¿Que dice la Iglesia?

La Iglesia ensena que toda practica autentica debe estar unida a la fe, la esperanza y la caridad. Tambien recuerda que la vida sacramental, especialmente la Eucaristia y la Confesion, es el centro de la conversion cristiana.

### ¿Como explicarlo a ninos o jovenes?

Conviene usar ejemplos concretos, relatos de santos, signos visibles y preguntas simples. La clave es mostrar que Dios no es una idea lejana, sino un Padre que llama, acompana y transforma la vida.

### ¿Como vivirlo en familia?

La familia puede reservar un momento semanal para leer una breve explicacion, rezar juntos, hacer una obra de caridad y conversar sobre una decision concreta que acerque el hogar a Cristo.

### ¿Que errores se deben evitar?

Hay que evitar supersticion, promesas vacias, miedo religioso, discusiones sin caridad y uso de la fe como instrumento de orgullo. La verdadera catequesis produce humildad y servicio.

## Aplicacion pastoral

Para una parroquia, este contenido puede convertirse en una ficha de catequesis. Se puede iniciar con una oracion, leer la introduccion, dialogar las preguntas, revisar la tabla y terminar con un compromiso semanal. En el hogar, puede usarse como lectura espiritual compartida.

Tambien es util para preparar publicaciones, videos, infografias o encuentros de pequenos grupos. La estructura permite adaptar el lenguaje a ninos, jovenes, matrimonios o adultos mayores sin perder el nucleo doctrinal.

## Compromiso espiritual

Durante esta semana, elige una accion concreta relacionada con ${topic}: rezar con mas atencion, pedir perdon, visitar el Santisimo, leer un pasaje biblico, participar en la misa dominical o realizar una obra de misericordia. La fe crece cuando se practica con perseverancia.

## Oracion final

Senor Jesus, Maestro y Salvador, ilumina mi inteligencia para comprender la verdad de tu Iglesia y mueve mi corazon para vivirla con amor. Que este aprendizaje no quede en ideas, sino que se transforme en conversion, servicio y vida sacramental. Maria Santisima, Madre de la Iglesia, acompaname en el camino de la fe. Amen.

## Recursos sugeridos

- Leer un pasaje del Evangelio relacionado con el tema.
- Revisar el Catecismo de la Iglesia Catolica en sus secciones doctrinales y sacramentales.
- Consultar al parroco o catequista ante dudas particulares.
- Complementar esta guia con una infografia, video o podcast en CatolicosGPT.
`;

  const targetLength = 7800 + (index % 9) * 80;
  if (base.length >= targetLength) return base;
  const additions = [];
  while ((base + additions.join('\n\n')).length < targetLength) {
    additions.push(`### Profundizacion pastoral ${additions.length + 1}

En la practica cotidiana, ${topic} se vuelve fecundo cuando se integra con una conciencia bien formada. Esto significa examinar las motivaciones, buscar la gracia de Dios y aceptar que la santidad normalmente crece por pasos pequenos. La Iglesia acompana ese proceso con la predicacion, los sacramentos y el ejemplo de los santos. Ningun fiel esta solo en este camino: pertenece a un Cuerpo, recibe una Tradicion y camina hacia la plenitud de la comunion con Dios.`);
  }
  return base + '\n\n' + additions.join('\n\n');
}

function generateBlogCatalog() {
  const existing = readJson(blogPath, { version: '5.0', total: 0, categorias: [], posts: [] });
  const used = new Set((existing.posts || []).map(p => p.slug));
  const posts = [];
  const allTopics = [];
  for (const category of categories) {
    for (const topic of (topicGroups[category] || [])) {
      for (const mod of modifiers) {
        allTopics.push({ category, topic, modifier: mod });
      }
    }
  }

  let i = 0;
  while (posts.length < 1000) {
    const source = allTopics[i % allTopics.length];
    const cycle = Math.floor(i / allTopics.length);
    const title = titleCase(`${source.topic}: ${source.modifier}${cycle ? ` ${cycle + 1}` : ''}`);
    const slug = uniqueSlug(title, used);
    const keywords = makeKeywords(source.topic, source.category, title);
    const contenidoMd = makeBlogContent({
      title,
      topic: source.topic,
      category: source.category,
      index: posts.length
    });
    const fecha = new Date(Date.UTC(2026, 5, 26, 8, 0, 0 + posts.length)).toISOString();

    posts.push({
      id: `blog-${String(posts.length + 1).padStart(4, '0')}`,
      slug,
      titulo: title,
      categoria: source.category,
      imagenPortada: '',
      contenidoMd,
      descripcion: makeExcerpt(title, source.category).slice(0, 158),
      keywords,
      altText: `${title} - guia catequetica CatolicosGPT`,
      extracto: makeExcerpt(title, source.category),
      faqs: [
        { q: `¿Que aprenderas sobre ${source.topic}?`, a: `Aprenderas su sentido catolico, su fundamento doctrinal y formas concretas de vivirlo en familia, parroquia y oracion personal.` },
        { q: '¿Sirve para catequesis parroquial?', a: 'Si. La guia esta pensada para lectura, dialogo, preguntas y compromiso pastoral.' },
        { q: '¿Puedo agregar imagenes o videos?', a: 'Si. Desde el admin puedes insertar imagenes de Cloudinary y shortcodes de videos, podcasts o infografias.' }
      ],
      publicado: true,
      fechaCreacion: fecha,
      fechaModificacion: fecha,
      fuente: 'CatolicosGPT bulk editorial local'
    });
    i++;
  }

  const catalog = {
    version: '5.0',
    total: posts.length,
    categorias: categories,
    posts
  };
  writeJson(blogPath, catalog);
  return catalog;
}

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const monthKeys = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const fallbackSaints = [
  'Santos y beatos conmemorados', 'Martires de la Iglesia primitiva', 'Confesores de la fe',
  'Virgenes consagradas y testigos de pureza', 'Pastores santos y doctores de la Iglesia',
  'Misioneros del Evangelio', 'Monjes y monjas de vida contemplativa', 'Laicos santos y familias cristianas',
  'Defensores de la Eucaristia', 'Testigos de la caridad cristiana'
];

function makeSaintBio({ name, day, month, type, description, idx }) {
  const isCollective = name.startsWith('Santos y beatos') || name.startsWith('Martires') || name.startsWith('Confesores') || name.startsWith('Virgenes') || name.startsWith('Pastores') || name.startsWith('Misioneros') || name.startsWith('Monjes') || name.startsWith('Laicos') || name.startsWith('Defensores') || name.startsWith('Testigos');
  const devotionalName = isCollective ? `la memoria de ${name.toLowerCase()}` : name;
  return `# ${name}

## Vida y obra

${name} se celebra el ${day} de ${month} dentro del camino espiritual de la Iglesia. ${description || 'Esta memoria invita a contemplar la fidelidad de Dios en sus santos, hombres y mujeres que respondieron a la gracia con una vida de fe, esperanza y caridad.'}

La santidad nunca nace de una simple admiracion humana. Nace de la gracia de Cristo acogida con libertad. Por eso, al mirar ${devotionalName}, la Iglesia no propone un recuerdo nostalgico, sino una escuela viva de discipulado. Cada santo muestra que el Evangelio puede encarnarse en una epoca, una cultura, una familia, una vocacion y una mision concreta.

Su vida recuerda que la fe catolica no se reduce a ideas. La fe se vuelve historia cuando una persona ora, perdona, sirve, se sacrifica, permanece fiel en la prueba y ama a Cristo por encima de todo. En esa respuesta cotidiana aparece la belleza de la Iglesia.

## Milagros, devocion y legado espiritual

La tradicion cristiana mira a los santos como intercesores, no como sustitutos de Cristo. Toda devocion autentica conduce al Senor, fortalece la vida sacramental y despierta caridad. Cuando se habla de milagros o favores atribuidos a la intercesion de los santos, la Iglesia invita a discernir con prudencia, gratitud y obediencia.

La devocion a ${devotionalName} puede vivirse con una oracion sencilla, una lectura espiritual, una obra de misericordia o una visita al Santisimo. Lo importante no es acumular practicas, sino dejar que su testimonio pregunte: ¿que parte de mi vida necesita convertirse?, ¿donde debo amar mejor?, ¿como puedo servir con mas humildad?

## Tabla resumen

| Aspecto | Detalle |
|---|---|
| Celebracion | ${day} de ${month} |
| Tipo liturgico | ${type} |
| Virtudes principales | Fe, esperanza, caridad, perseverancia y humildad |
| Devocion recomendada | Oracion, lectura de su vida y obra de misericordia |
| Ensenanza pastoral | La santidad es posible en la vida ordinaria |
| Fruto espiritual | Conversion, confianza en Dios y servicio al projimo |

## Preguntas frecuentes

### ¿Por que la Iglesia recuerda a los santos?

Porque en ellos contempla la obra de Cristo. Los santos muestran que el Evangelio no es teoria, sino vida transformada por la gracia.

### ¿Se debe adorar a los santos?

No. La adoracion pertenece solo a Dios. A los santos se les venera como amigos de Dios e intercesores, siempre en relacion con Cristo.

### ¿Como puede inspirarme hoy?

Puede inspirarte a vivir con fidelidad tu vocacion concreta: familia, trabajo, estudio, servicio parroquial, oracion y caridad diaria.

## Frases para meditar

- "La santidad comienza cuando Dios ocupa el centro del corazon."
- "Quien ama a Cristo aprende a servir sin buscar aplauso."
- "La vida ordinaria puede convertirse en altar de ofrecimiento."
- "La Iglesia florece cuando sus hijos viven el Evangelio con alegria."

## Oracion

Senor Jesus, que has hecho brillar tu gracia en ${devotionalName}, concede a tu Iglesia crecer en santidad, humildad y caridad. Que su testimonio nos impulse a amar la Eucaristia, vivir la reconciliacion, servir a los necesitados y caminar con esperanza hacia la vida eterna. Amen.`;
}

function generateSantoral() {
  const base = readJson(santosBasePath, { santos_por_mes: {} });
  const santos = [];
  const used = new Set();
  let idx = 0;

  for (let m = 0; m < 12; m++) {
    const month = monthNames[m];
    const monthKey = monthKeys[m];
    const sourceList = base.santos_por_mes?.[monthKey] || [];
    const byDay = new Map(sourceList.map(s => [Number(s.dia), s]));
    for (let day = 1; day <= daysInMonth[m]; day++) {
      const source = byDay.get(day);
      const fallbackTitle = `${fallbackSaints[idx % fallbackSaints.length]} del ${day} de ${month}`;
      const name = source?.nombre || fallbackTitle;
      const type = source?.tipo || 'Memoria devocional editable';
      const description = source?.descripcion || `Conmemoracion pastoral editable para el ${day} de ${month}, abierta a completar con el santo local, fiesta particular o devocion especial de la comunidad.`;
      const slug = uniqueSlug(name, used);
      const bio = makeSaintBio({ name, day, month, type, description, idx });
      const fecha = new Date(Date.UTC(2026, 5, 26, 9, 0, idx)).toISOString();

      santos.push({
        slug,
        dia: day,
        mes: month,
        mes_index: String(m + 1).padStart(2, '0'),
        nombre: name,
        tipo: type,
        lema: idx % 5 === 0 ? 'La santidad es posible en la vida ordinaria.' : idx % 5 === 1 ? 'Cristo basta para quien lo ama de verdad.' : idx % 5 === 2 ? 'Servir a Dios es reinar con humildad.' : idx % 5 === 3 ? 'La gracia transforma la historia.' : 'Todo por Jesus, con Maria y en la Iglesia.',
        biografia: bio,
        aspectos_tabla: {
          'Festividad': `${day} de ${month}`,
          'Tipo litúrgico': type,
          'Virtudes principales': 'Fe, esperanza, caridad, humildad y perseverancia',
          'Devoción': `Oracion e imitacion espiritual de ${name}`,
          'Milagros y favores': 'Discernir siempre con prudencia eclesial; registrar aqui favores aprobados o testimonios locales.',
          'Aplicación pastoral': 'Lectura espiritual, catequesis, obra de misericordia y participacion sacramental.'
        },
        foto_url: '',
        infografia_url: '',
        seo_titulo: `${name}: vida, obra y devocion | CatolicosGPT`.slice(0, 78),
        seo_descripcion: `Conoce la vida, obra, devocion y legado espiritual de ${name}, celebrado el ${day} de ${month}, con tabla resumen y oracion.`.slice(0, 158),
        seo_keywords: `${name.toLowerCase()}, santo del dia, santoral catolico, ${day} de ${month.toLowerCase()}, vida de santos, catolicosgpt`,
        esSantoDelDia: false,
        creado_por_admin: false,
        fechaCreacion: fecha,
        fechaModificacion: fecha,
        fuente: source ? 'Calendario base CatolicosGPT enriquecido localmente' : 'Conmemoracion editable generada localmente'
      });
      idx++;
    }
  }

  writeJson(santoralPath, { santos });
  return { santos };
}

const blogCatalog = generateBlogCatalog();
const santoralCatalog = generateSantoral();
console.log(JSON.stringify({
  posts: blogCatalog.posts.length,
  santos: santoralCatalog.santos.length,
  blogPath,
  santoralPath
}, null, 2));
