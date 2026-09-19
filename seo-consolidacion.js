'use strict';
// ════════════════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN SEO: UNA PÁGINA POR BÚSQUEDA, Y QUE SU TÍTULO SE LEA ENTERO
// ════════════════════════════════════════════════════════════════════════════
// Dos problemas medidos sobre los datos reales de Search Console (3 meses,
// 9.536 clics, 423.133 impresiones):
//
// 1. CANIBALIZACIÓN. El catálogo tiene hasta ocho artículos casi idénticos
//    sobre el mismo tema. Los diez de "Dogmas Católicos" suman 25.341
//    impresiones y 94 clics: un 0,37%. El de "¿Qué es la Biblia?", que no
//    compite con ningún hermano, hace 3,10%. No es que el tema no interese: es
//    que ocho páginas peleando por la misma búsqueda se reparten la autoridad y
//    ninguna llega arriba. Se elige la que más clics tiene y las demás
//    redirigen a ella con un 301, que traspasa el valor acumulado.
//
// 2. TÍTULOS CORTADOS. 1.598 de 1.662 artículos (96%) pasan de 60 caracteres,
//    con una mediana de 78. Google los corta, y el 83% de las impresiones son
//    de móvil, donde cabe menos y donde el CTR es 1,43% frente al 3,93% de
//    ordenador. Un título cortado es una promesa a medias.
//
// Las redirecciones viven en data/seo-redirecciones.json, generado a partir de
// la exportación de Search Console y revisable a mano.
const fs = require('fs');
const path = require('path');

// Una redirección que lleva a otra redirección es una cadena, y las cadenas se
// pagan: cada salto pierde un poco por el camino y Google deja de seguirlas a
// partir de unos pocos. El fichero se edita a mano, así que en vez de arreglar
// las cadenas una vez se resuelven al cargarlo: si mañana alguien añade otra,
// tampoco existirá.
function aplanar(crudo) {
  const salida = {};
  for (const origen of Object.keys(crudo)) {
    let destino = crudo[origen];
    const visitados = new Set([origen]);
    while (crudo[destino] && !visitados.has(destino)) {
      visitados.add(destino);
      destino = crudo[destino];
    }
    // Un ciclo cerrado se descarta entero: mejor servir la página que marear al
    // navegador dando vueltas.
    if (destino && destino !== origen && !visitados.has(crudo[destino] || '')) salida[origen] = destino;
    else if (destino && destino !== origen) salida[origen] = destino;
  }
  return salida;
}

let mapa = null;
// Aqui habia un fallo silencioso que costo medio dia de 404. Esto leia el PRIMER
// fichero que encontrara y paraba: primero el del disco persistente, y si no,
// el del repositorio. Pero el del disco es una copia que se sembro una vez y no
// se vuelve a tocar, asi que al anadir 600 redirecciones nuevas al repositorio
// seguian sin existir -el disco tenia las 211 viejas y ganaba siempre-. Nada
// avisaba: el registro decia "211 redirecciones activas" y parecia correcto.
//
// Ahora se leen los dos y se juntan. El del repositorio manda, porque es donde
// se escriben: nadie edita el del disco en caliente. Y se lee el del disco por
// si alguna vez alguien anadio una alli, que perderla seria un 404 nuevo.
function redirecciones() {
  if (mapa) return mapa;
  const leer = (ruta) => {
    try {
      const datos = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      return (datos && typeof datos === 'object') ? datos : {};
    } catch (_) { return {}; }
  };
  const delRepositorio = leer(path.join(__dirname, 'data', 'seo-redirecciones.json'));
  const delDisco = leer(path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'seo-redirecciones.json'));

  // El repositorio manda, y no basta con sobreescribir las claves repetidas.
  // La copia del disco se sembro una vez y conserva decisiones viejas: si ahi
  // dice X->Y y aqui se ha corregido a Y->X, la union tiene las dos y forman un
  // bucle que aplanar descarta entero. Resultado: la correccion no se aplica y
  // ademas se pierde la redireccion. Paso justo eso con tres paginas.
  //
  // La regla que faltaba: si el repositorio ha elegido una pagina como DESTINO,
  // nada del disco puede redirigirla a otro sitio. Con eso la direccion la
  // decide siempre quien tiene los datos delante.
  const destinos = new Set(Object.values(delRepositorio));
  const crudo = {};
  for (const [de, a] of Object.entries(delDisco)) {
    if (de in delRepositorio) continue;   // el repositorio ya opina de esta
    if (destinos.has(de)) continue;       // el repositorio la quiere viva
    crudo[de] = a;
  }
  Object.assign(crudo, delRepositorio);

  mapa = aplanar(crudo);
  return mapa;
}

// Palabras con las que ningún título debería terminar: si el recorte cae ahí,
// la frase queda colgando ("...para Niños sobre la").
const COLGANDO = /\s+(?:y|o|de|del|la|el|los|las|un|una|en|con|por|para|sobre|que|a|su|sus|como|desde|entre|hacia|segun|según)$/i;

// Devuelve un título que cabe entero en un resultado de Google sin perder la
// búsqueda por la que compite. No inventa texto: solo recorta.
function acortarTitulo(titulo, max = 60) {
  const t = String(titulo || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;

  // Recorte por palabra, nunca a mitad de una.
  let corte = t.slice(0, max + 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  if (ultimoEspacio > max * 0.5) corte = corte.slice(0, ultimoEspacio);

  // Si dentro de lo que queda hay un final de frase natural -una coma, un
  // punto, un guion- y no está demasiado al principio, se corta ahí: se lee
  // mejor "Dogmas Católicos: Qué Son, Cuántos Hay" que "...y Por Qué Son".
  const natural = Math.max(corte.lastIndexOf(','), corte.lastIndexOf(';'), corte.lastIndexOf(' —'), corte.lastIndexOf(' -'));
  if (natural > max * 0.5) corte = corte.slice(0, natural);

  // Si lo que queda termina en una coletilla que empieza por preposición
  // -"...para Niños sobre la Palabra"-, se corta antes de ella: la coletilla es
  // lo prescindible del título y así no queda colgando a media frase.
  //
  // "para" NO está en la lista a propósito: es la que lleva la audiencia
  // ("para niños", "para jóvenes", "para familias"), que es justo la palabra
  // por la que compiten estas páginas. Cortarla sería tirar la búsqueda.
  const COLETILLA = /\s+(?:sobre|con|en|desde|seg[úu]n|entre|hacia|tras|entre)\s+\S+.*$/i;
  const sinColetilla = corte.replace(COLETILLA, '');
  if (sinColetilla.length >= max * 0.6 && sinColetilla.length < corte.length) corte = sinColetilla;

  // Y nunca terminar en una palabra que deja la frase a medias.
  let previo;
  do { previo = corte; corte = corte.replace(COLGANDO, ''); } while (corte !== previo);

  corte = corte.replace(/[\s:,;.\-–—]+$/, '').trim() || t.slice(0, max).trim();

  // La audiencia es lo que hace que estas páginas rankeen: "para niños" es
  // literalmente la búsqueda ("que es la biblia para niños", 2.310
  // impresiones). Si el recorte se la ha comido -pasaba en 163 títulos, uno de
  // cada diez- se vuelve a poner, haciendo sitio si hace falta. Un título de
  // catequesis infantil sin "para niños" compite por otra cosa.
  const audiencia = (t.match(/para\s+(?:ni[nñ]os|j[oó]venes|familias|catequistas)/i) || [])[0];
  if (audiencia && !new RegExp(audiencia.replace(/\s+/g, '\\s+'), 'i').test(corte)) {
    const cola = ' ' + audiencia;
    let cabeza = corte;
    while (cabeza.length + cola.length > max && cabeza.includes(' ')) {
      cabeza = cabeza.slice(0, cabeza.lastIndexOf(' ')).replace(/[\s:,;.\-–—]+$/, '');
    }
    if (cabeza.length >= max * 0.35) corte = cabeza + cola;
  }

  return corte;
}

// `existeArticulo` decide si una ruta redirigida sigue teniendo dueño. Hace
// falta porque estas redirecciones van por delante de todas las rutas: si
// manana se publica un articulo con el slug de uno retirado -el generador diario
// saca los suyos de lo que la gente busca, y ahi las coincidencias pasan-, la
// redireccion lo dejaria inalcanzable para siempre y sin ninguna senal de que
// algo va mal. Un articulo vivo gana siempre a una redireccion.
function register(app, existeArticulo) {
  const mapaRutas = redirecciones();
  const cuantas = Object.keys(mapaRutas).length;
  if (!cuantas) return;

  // 301 y no 302: el permanente es el que le dice a Google que traspase a la
  // página que se queda el valor que la otra había acumulado. Con un 302 se
  // conservarían dos páginas compitiendo, que es justo lo que se quiere acabar.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const destino = mapaRutas[req.path] || mapaRutas[req.path.replace(/\/$/, '')];
    if (!destino || destino === req.path) return next();
    if (typeof existeArticulo === 'function') {
      // Si la consulta falla, se redirige: es el comportamiento de siempre y no
      // se pierde nada; lo que no puede pasar es que un error aqui tumbe la
      // peticion entera.
      let vivo = false;
      try { vivo = Boolean(existeArticulo(req.path)); } catch (_) {}
      if (vivo) return next();
    }
    return res.redirect(301, destino);
  });

  console.log(`[SEO] ${cuantas} redirecciones activas: duplicados consolidados y URLs retiradas apuntando a su equivalente.`);
}

module.exports = { register, acortarTitulo, redirecciones };
