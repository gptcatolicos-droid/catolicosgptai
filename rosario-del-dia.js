'use strict';
// ════════════════════════════════════════════════════════════════════════════
// EL SANTO ROSARIO DE HOY
// ════════════════════════════════════════════════════════════════════════════
// "santo rosario de hoy" es la búsqueda con más impresiones del sitio: 3.593 en
// tres meses, con 26 clics. Ese 0,7% no es un problema de posición sino de
// promesa incumplida: la página existía y servía el mismo texto de relleno que
// todas las demás -"El misterio de X pertenece a la profunda herencia
// divina..."-, sin un solo misterio y sin una sola oración. La gente entraba,
// no encontraba el rosario y se iba.
//
// Aquí no hace falta ninguna API. Los misterios de cada día no se consultan: se
// saben. Están fijados por la Iglesia y rotan por día de la semana desde la
// carta Rosarium Virginis Mariae de Juan Pablo II (2002), que añadió los
// luminosos. Calcularlo es exacto siempre; preguntárselo a un modelo sería
// arriesgarse a equivocar el rosario de alguien que está rezando.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const MISTERIOS = {
  gozosos: {
    nombre: 'Misterios Gozosos',
    dias: 'lunes y sábado',
    misterios: [
      { titulo: 'La Encarnación del Hijo de Dios', cita: 'Lucas 1, 26-38', meditacion: 'El ángel anuncia a María que será madre del Salvador, y ella responde que sí. Todo empieza en ese sí.' },
      { titulo: 'La Visitación de María a su prima Isabel', cita: 'Lucas 1, 39-56', meditacion: 'María sale deprisa a servir a quien la necesita. Llevar a Cristo dentro se nota en lo que uno hace por los demás.' },
      { titulo: 'El Nacimiento de Jesús en Belén', cita: 'Lucas 2, 1-20', meditacion: 'Dios entra en el mundo en un establo. Elige lo pequeño y lo pobre para mostrarse.' },
      { titulo: 'La Presentación del Niño Jesús en el Templo', cita: 'Lucas 2, 22-38', meditacion: 'José y María ofrecen a su Hijo a Dios. También lo que más queremos se pone en sus manos.' },
      { titulo: 'El Niño Jesús perdido y hallado en el Templo', cita: 'Lucas 2, 41-52', meditacion: 'Tres días buscándolo, y estaba en la casa de su Padre. A veces no se ha perdido: está donde no miramos.' }
    ]
  },
  luminosos: {
    nombre: 'Misterios Luminosos',
    dias: 'jueves',
    misterios: [
      { titulo: 'El Bautismo de Jesús en el Jordán', cita: 'Mateo 3, 13-17', meditacion: 'El Padre lo llama Hijo amado. En el bautismo, Dios dice de cada uno de nosotros algo parecido.' },
      { titulo: 'La autorrevelación de Jesús en las bodas de Caná', cita: 'Juan 2, 1-12', meditacion: 'María se da cuenta de lo que falta y lo dice. "Haced lo que él os diga" sigue siendo el mejor consejo.' },
      { titulo: 'El anuncio del Reino de Dios y la invitación a la conversión', cita: 'Marcos 1, 14-15', meditacion: 'El Reino está cerca. No es una amenaza: es una puerta abierta que pide entrar.' },
      { titulo: 'La Transfiguración del Señor', cita: 'Lucas 9, 28-36', meditacion: 'Por un momento se ve quién es de verdad. Esa luz sostiene después, cuando llega lo oscuro.' },
      { titulo: 'La institución de la Eucaristía', cita: 'Lucas 22, 14-20', meditacion: 'La víspera de morir se queda como pan. No se despide: se queda.' }
    ]
  },
  dolorosos: {
    nombre: 'Misterios Dolorosos',
    dias: 'martes y viernes',
    misterios: [
      { titulo: 'La oración de Jesús en el Huerto', cita: 'Lucas 22, 39-46', meditacion: 'Tiene miedo y lo dice. Y aun así: "no se haga mi voluntad, sino la tuya".' },
      { titulo: 'La flagelación del Señor', cita: 'Juan 19, 1', meditacion: 'Carga en su cuerpo lo que nosotros hicimos. Nadie le obligó.' },
      { titulo: 'La coronación de espinas', cita: 'Mateo 27, 27-31', meditacion: 'Se burlan de él llamándole rey. Y lo era, aunque de otro modo.' },
      { titulo: 'Jesús con la cruz a cuestas camino del Calvario', cita: 'Juan 19, 16-17', meditacion: 'Cae y se levanta. El camino se hace así, no de otra manera.' },
      { titulo: 'La Crucifixión y Muerte de Jesús', cita: 'Juan 19, 18-30', meditacion: 'Desde la cruz nos entrega a su Madre. "Todo está cumplido".' }
    ]
  },
  gloriosos: {
    nombre: 'Misterios Gloriosos',
    dias: 'miércoles y domingo',
    misterios: [
      { titulo: 'La Resurrección del Señor', cita: 'Mateo 28, 1-10', meditacion: 'La tumba está vacía. Lo último no fue la muerte.' },
      { titulo: 'La Ascensión del Señor a los cielos', cita: 'Hechos 1, 6-11', meditacion: 'Se va, pero no nos deja solos: nos deja una misión y su Espíritu.' },
      { titulo: 'La Venida del Espíritu Santo sobre los Apóstoles', cita: 'Hechos 2, 1-13', meditacion: 'Los que estaban encerrados por miedo salen a hablar. Eso hace el Espíritu.' },
      { titulo: 'La Asunción de María a los Cielos', cita: 'Apocalipsis 12, 1', meditacion: 'La primera en llegar del todo adonde vamos todos.' },
      { titulo: 'La Coronación de María como Reina del Cielo y de la Tierra', cita: 'Lucas 1, 46-55', meditacion: 'Dios enaltece a los humildes. En ella se cumplió su propio cántico.' }
    ]
  }
};

// Lunes gozosos, martes dolorosos, miércoles gloriosos, jueves luminosos,
// viernes dolorosos, sábado gozosos, domingo gloriosos. El orden lo fijó
// Rosarium Virginis Mariae; no es una costumbre local.
const POR_DIA = ['gloriosos', 'gozosos', 'dolorosos', 'gloriosos', 'luminosos', 'dolorosos', 'gozosos'];
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// La misma zona horaria que usa el resto del sitio para "hoy": el rosario de
// hoy en Bogotá no puede cambiar a las siete de la tarde porque en Londres ya
// sea mañana.
function hoyEnBogota(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(ahora);
  const valor = tipo => (partes.find(p => p.type === tipo) || {}).value;
  const fecha = `${valor('year')}-${valor('month')}-${valor('day')}`;
  // El día de la semana se saca de la fecha ya convertida, no del reloj local.
  const indice = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return { fecha, indice, nombre: NOMBRE_DIA[indice] };
}

function misteriosDeHoy(ahora = new Date()) {
  const dia = hoyEnBogota(ahora);
  const clave = POR_DIA[dia.indice];
  return { clave, dia, ...MISTERIOS[clave] };
}

// Las oraciones salen del dataset del sitio, no de aquí: si alguien corrige el
// texto del Padrenuestro, se corrige en un sitio y vale para todo.
let oracionesCache = null;
function oraciones() {
  if (oracionesCache) return oracionesCache;
  const mapa = {};
  for (const ruta of [path.join(DATA_DIR, 'oraciones.json'), path.join(__dirname, 'data', 'oraciones.json')]) {
    try {
      const datos = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      for (const o of datos.oraciones_principales || []) {
        if (o && o.nombre && o.texto_es) mapa[o.nombre] = String(o.texto_es).trim();
      }
      if (Object.keys(mapa).length) break;
    } catch (_) {}
  }
  oracionesCache = mapa;
  return mapa;
}

function oracion(nombre, respaldo = '') {
  return oraciones()[nombre] || respaldo;
}

module.exports = { MISTERIOS, POR_DIA, hoyEnBogota, misteriosDeHoy, oracion, oraciones };

// ── La página ───────────────────────────────────────────────────────────────
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function escapar(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parrafos(texto) {
  return String(texto || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
    .map(b => `<p>${escapar(b).replace(/\n/g, '<br>')}</p>`).join('');
}

function fechaLarga(fecha) {
  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

const ORACION_FATIMA = 'Oh Jesús mío, perdona nuestros pecados, líbranos del fuego del infierno, lleva al cielo a todas las almas y socorre especialmente a las más necesitadas de tu misericordia.';

function renderHtml(ahora = new Date()) {
  const hoy = misteriosDeHoy(ahora);
  const diaCapital = hoy.dia.nombre.charAt(0).toUpperCase() + hoy.dia.nombre.slice(1);

  const padreNuestro = oracion('Padre Nuestro');
  const aveMaria = oracion('Ave María');
  const gloria = oracion('Gloria al Padre (Doxología)');
  const credo = oracion('Credo Apostólico');
  const salve = oracion('Salve Regina');

  const misteriosHtml = hoy.misterios.map((m, i) => `
    <article class="bg-white border border-[#E6DFD4] rounded-2xl p-5 flex flex-col gap-2.5">
      <div class="flex items-center gap-2.5">
        <span class="bg-maroon text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm shrink-0">${i + 1}</span>
        <h3 class="font-display font-bold text-espresso text-lg leading-snug m-0">${escapar(m.titulo)}</h3>
      </div>
      <p class="text-[11px] font-bold uppercase tracking-wider text-gold m-0">${escapar(m.cita)}</p>
      <p class="text-ink2 text-sm leading-relaxed m-0">${escapar(m.meditacion)}</p>
      <p class="text-xs text-ink2 border-t border-[#E6DFD4] pt-2.5 m-0">
        Se reza <strong>un Padrenuestro</strong>, <strong>diez Avemarías</strong>, <strong>un Gloria</strong> y la jaculatoria de Fátima.
      </p>
    </article>`).join('');

  const rotacionHtml = Object.entries(MISTERIOS).map(([clave, grupo]) => `
    <tr${clave === hoy.clave ? ' class="bg-[#FFFCF4] font-bold"' : ''}>
      <td class="border border-[#E6DFD4] p-2.5 text-sm">${escapar(grupo.dias.charAt(0).toUpperCase() + grupo.dias.slice(1))}</td>
      <td class="border border-[#E6DFD4] p-2.5 text-sm">${escapar(grupo.nombre)}${clave === hoy.clave ? ' — hoy' : ''}</td>
    </tr>`).join('');

  const oracionBloque = (titulo, texto) => texto ? `
    <div class="bg-white border border-[#E6DFD4] rounded-xl p-4">
      <h3 class="font-display font-bold text-maroon text-base mt-0 mb-2">${escapar(titulo)}</h3>
      <div class="text-ink2 text-sm leading-relaxed">${parrafos(texto)}</div>
    </div>` : '';

  const preguntas = [
    { pregunta: `¿Qué misterios del Rosario se rezan hoy ${hoy.dia.nombre}?`, respuesta: `Hoy ${hoy.dia.nombre} se rezan los ${hoy.nombre}. Se rezan ${hoy.dias}.` },
    { pregunta: '¿Cuánto tiempo se tarda en rezar el Rosario?', respuesta: 'Entre quince y veinte minutos rezándolo con calma. No hay prisa: vale más rezar un misterio despacio que los cinco corriendo.' },
    { pregunta: '¿Se puede rezar el Rosario solo?', respuesta: 'Sí. Se puede rezar solo, en familia o en comunidad. La Iglesia recomienda especialmente rezarlo en familia.' },
    { pregunta: '¿Por qué hay misterios luminosos si antes eran quince?', respuesta: 'San Juan Pablo II los propuso en 2002 en la carta Rosarium Virginis Mariae, para contemplar también la vida pública de Jesús. Desde entonces son veinte misterios en cuatro grupos.' }
  ];

  const faqHtml = preguntas.map(p => `
    <details class="bg-white border border-[#E6DFD4] rounded-xl p-4">
      <summary class="font-bold text-espresso text-sm cursor-pointer">${escapar(p.pregunta)}</summary>
      <p class="text-ink2 text-sm leading-relaxed mt-2.5 mb-0">${escapar(p.respuesta)}</p>
    </details>`).join('');

  const esquema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        name: `Cómo rezar el Santo Rosario de hoy: ${hoy.nombre}`,
        description: `Los ${hoy.nombre} se rezan ${hoy.dias}. Guía completa con los cinco misterios y todas las oraciones.`,
        totalTime: 'PT20M',
        step: hoy.misterios.map((m, i) => ({
          '@type': 'HowToStep', position: i + 1, name: m.titulo, text: `${m.meditacion} (${m.cita})`
        }))
      },
      {
        '@type': 'FAQPage',
        mainEntity: preguntas.map(p => ({
          '@type': 'Question', name: p.pregunta,
          acceptedAnswer: { '@type': 'Answer', text: p.respuesta }
        }))
      }
    ]
  };

  const html = `
  <div class="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-7">
    <header class="flex flex-col gap-2.5">
      <p class="text-[11px] font-bold uppercase tracking-widest text-gold m-0">${escapar(diaCapital)}, ${escapar(fechaLarga(hoy.dia.fecha))}</p>
      <h1 class="font-display font-bold text-espresso text-3xl leading-tight m-0">Santo Rosario de hoy: ${escapar(hoy.nombre)}</h1>
      <p class="text-ink2 text-base leading-relaxed m-0">
        Hoy <strong>${escapar(hoy.dia.nombre)}</strong> se rezan los <strong>${escapar(hoy.nombre)}</strong>.
        Aquí tienes los cinco misterios de hoy con su cita bíblica y todas las oraciones completas, para rezarlo entero sin buscar en otra parte.
      </p>
    </header>

    <section class="flex flex-col gap-3">
      <h2 class="font-display font-bold text-maroon text-xl m-0">Los cinco misterios de hoy</h2>
      ${misteriosHtml}
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display font-bold text-maroon text-xl m-0">Cómo se reza el Rosario, paso a paso</h2>
      <ol class="text-ink2 text-sm leading-relaxed flex flex-col gap-1.5 pl-5">
        <li>Se hace la señal de la cruz y se reza el Credo.</li>
        <li>Un Padrenuestro, tres Avemarías (por la fe, la esperanza y la caridad) y un Gloria.</li>
        <li>Se enuncia el primer misterio y se medita un momento en silencio.</li>
        <li>Un Padrenuestro, diez Avemarías, un Gloria y la jaculatoria de Fátima.</li>
        <li>Se repite con los cinco misterios.</li>
        <li>Se termina con la Salve y la señal de la cruz.</li>
      </ol>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display font-bold text-maroon text-xl m-0">Las oraciones del Rosario</h2>
      <div class="flex flex-col gap-3">
        ${oracionBloque('Credo', credo)}
        ${oracionBloque('Padrenuestro', padreNuestro)}
        ${oracionBloque('Avemaría', aveMaria)}
        ${oracionBloque('Gloria', gloria)}
        ${oracionBloque('Jaculatoria de Fátima', ORACION_FATIMA)}
        ${oracionBloque('Salve', salve)}
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display font-bold text-maroon text-xl m-0">Qué misterios se rezan cada día</h2>
      <table class="w-full border-collapse">
        <thead><tr class="bg-cream">
          <th class="border border-[#E6DFD4] p-2.5 text-left text-xs uppercase tracking-wider">Días</th>
          <th class="border border-[#E6DFD4] p-2.5 text-left text-xs uppercase tracking-wider">Misterios</th>
        </tr></thead>
        <tbody>${rotacionHtml}</tbody>
      </table>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-display font-bold text-maroon text-xl m-0">Preguntas frecuentes sobre el Rosario</h2>
      ${faqHtml}
    </section>

    <script type="application/ld+json">${JSON.stringify(esquema)}</script>
  </div>`;

  return {
    html,
    seoTitle: `Santo Rosario de hoy ${hoy.dia.nombre}: ${hoy.nombre}`.slice(0, 60),
    metaDescription: `Santo Rosario de hoy ${hoy.dia.nombre}: se rezan los ${hoy.nombre}. Los cinco misterios con su cita bíblica y todas las oraciones completas.`.slice(0, 158),
    keywords: `santo rosario de hoy, rosario de hoy, misterios de hoy, ${hoy.nombre.toLowerCase()}, como rezar el rosario, rosario completo, misterios del rosario`
  };
}

module.exports.renderHtml = renderHtml;
module.exports.fechaLarga = fechaLarga;
