'use strict';
// ════════════════════════════════════════════════════════════════════════════
// DETECTAR CONTENIDO DE PLANTILLA POR SU PROPIO TEXTO
// ════════════════════════════════════════════════════════════════════════════
// La retirada anterior reconocía los artículos de plantilla por un campo suyo,
// `fuente`. Funcionaba con el lote de mil, que sí lo trae. Pero había un
// segundo sembrador dentro del blog que escribía 300 artículos SIN ese campo:
// para la retirada eran invisibles, y ahí siguen. Los 300 comparten un único
// cuerpo, palabra por palabra; lo único distinto es el título.
//
// Un campo se puede olvidar. El texto no: si un párrafo largo aparece igual en
// decenas de artículos, eso es contenido a escala, venga del sembrador que
// venga. Por eso esto mira el texto y no la etiqueta, y así también reconoce
// al lote que alguien añada mañana.
//
// El umbral es deliberadamente alto (un párrafo largo repetido en 5 artículos
// distintos, cubriendo la mitad del texto) porque el error caro es el falso
// positivo: retirar un artículo de verdad. Dos artículos sobre el mismo tema
// se parecen; no comparten párrafos enteros carácter a carácter.

// Un párrafo corto se repite por motivos legítimos -un encabezado, una jaculatoria,
// una cita del Catecismo-. Sólo cuentan los largos, donde la coincidencia literal
// ya no es casualidad.
const MINIMO_PARRAFO = 80;
// En cuántos artículos distintos ha de aparecer un párrafo para considerarlo
// plantilla y no coincidencia.
const ARTICULOS_PARA_SER_PLANTILLA = 5;
// Qué parte del artículo ha de estar hecha de esos párrafos.
const PROPORCION_PLANTILLA = 0.5;

const FUENTE_BULK = 'CatolicosGPT bulk editorial local';

// Se compara el texto desnudo: sin acentos, ni mayúsculas, ni marcas de
// markdown. Dos plantillas idénticas que difieran en una tilde son la misma.
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[#*_`>\[\]()|~]/g, ' ')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// El título es lo ÚNICO que cambia entre los 300, así que entra en el cuerpo
// disfrazado (el H1, y de nuevo dentro de las frases). Si no se quita, cada
// párrafo parece distinto y la plantilla se vuelve indetectable.
function parrafos(post) {
  const cuerpo = String(post && post.contenidoMd || '');
  const titulo = normalizar(post && post.titulo);
  return cuerpo
    .split(/\n\s*\n/)
    .map(p => {
      let t = normalizar(p);
      if (titulo && titulo.length > 8) t = t.split(titulo).join(' ').replace(/\s+/g, ' ').trim();
      return t;
    })
    .filter(p => p.length >= MINIMO_PARRAFO);
}

// Devuelve el conjunto de slugs que son contenido de plantilla. Se decide
// mirando el catálogo entero a la vez, porque "repetido" es una propiedad del
// conjunto: un artículo aislado nunca se puede juzgar.
function detectarPlantilla(posts) {
  const lista = Array.isArray(posts) ? posts : [];
  const porParrafo = new Map();
  const deCadaPost = new Map();

  for (const post of lista) {
    const clave = post && (post.slug || post.id);
    if (!clave) continue;
    const ps = parrafos(post);
    deCadaPost.set(clave, ps);
    // Un artículo que repite un párrafo consigo mismo no cuenta dos veces:
    // lo que se mide es en cuántos ARTÍCULOS aparece.
    for (const p of new Set(ps)) {
      if (!porParrafo.has(p)) porParrafo.set(p, 0);
      porParrafo.set(p, porParrafo.get(p) + 1);
    }
  }

  const plantilla = new Set();
  for (const post of lista) {
    const clave = post && (post.slug || post.id);
    if (!clave) continue;
    if (String(post.fuente || '').trim() === FUENTE_BULK) { plantilla.add(clave); continue; }
    // Un artículo con fuentes citadas pasó por Magisterium: alguien preguntó y
    // algo respondió con referencias concretas. El contenido de plantilla no
    // tiene de dónde sacarlas, así que esto no es una excepción que abrir sino
    // una señal, y evita que un fallo aquí se lleve por delante lo que sí vale.
    if (Array.isArray(post.fuentes) && post.fuentes.length > 0) continue;
    const ps = deCadaPost.get(clave) || [];
    if (!ps.length) continue;
    let total = 0, compartido = 0;
    for (const p of ps) {
      total += p.length;
      if ((porParrafo.get(p) || 0) >= ARTICULOS_PARA_SER_PLANTILLA) compartido += p.length;
    }
    if (total > 0 && compartido / total >= PROPORCION_PLANTILLA) plantilla.add(clave);
  }

  // Aquí llegué a poner un tope: si esto señalaba casi el catálogo entero, no
  // retiraba nada por si acaso. Era una mala idea, porque ese "casi entero" es
  // exactamente el caso real -el blog ERA plantilla al completo-, y el tope
  // habría impedido la única limpieza que hacía falta. Lo que protege de un
  // fallo aquí no es un porcentaje: es que un artículo con fuentes citadas
  // nunca se toca, y que la coincidencia exigida es literal y párrafo a párrafo.
  return plantilla;
}

module.exports = {
  detectarPlantilla,
  normalizar,
  parrafos,
  FUENTE_BULK,
  MINIMO_PARRAFO,
  ARTICULOS_PARA_SER_PLANTILLA,
  PROPORCION_PLANTILLA
};
