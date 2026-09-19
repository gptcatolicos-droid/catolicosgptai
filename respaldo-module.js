'use strict';
// ════════════════════════════════════════════════════════════════════════════
// RESPALDO SIN GOOGLE
// ════════════════════════════════════════════════════════════════════════════
// Firestore hacía de copia de seguridad: el disco de Render tenía los datos y la
// nube una segunda copia. Al apagar Google esa segunda copia desaparece y el
// disco se queda solo. Un disco de 1 GB sin copia es un punto único de fallo
// para las cuentas de los suscriptores, y esa es la clase de pérdida que no se
// deshace.
//
// Esto lo sustituye con dos cosas distintas, porque protegen de cosas distintas:
//
//   1. Copias automáticas EN EL DISCO, una al día, rotando las últimas siete.
//      Protegen de lo que pasa de verdad todos los días: un borrado desde el
//      admin, una purga que se pasa de lista, un fichero que se corrompe al
//      escribirse. No protegen de que se pierda el disco.
//
//   2. Una descarga desde el admin, un clic, un fichero. Es la única copia que
//      sale de la máquina, y por eso es la que de verdad sustituye a Firestore.
//      Depende de que alguien la descargue; no hay forma de automatizar eso sin
//      contratar un sitio donde dejarla.
//
// Lo que NO entra en la copia: las imágenes subidas (data/subidas). Son megas y
// megas de binarios y meterlos convertiría la descarga en algo que nadie hace.
// Se dice en el resumen para que no se dé por copiado lo que no lo está.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CARPETA_COPIAS = path.join(DATA_DIR, 'respaldos');
const COPIAS_A_GUARDAR = 7;
const UN_DIA = 24 * 60 * 60 * 1000;

// Qué se copia. Se nombran uno a uno en vez de barrer la carpeta entera: así una
// caché temporal o un fichero de trabajo que aparezca mañana no se cuela en la
// copia, y sobre todo no se cuela en la DESCARGA, que es un fichero que va a
// acabar en el ordenador de alguien.
const FICHEROS = [
  'users.json',            // cuentas y suscripciones: lo irreemplazable
  'coupons.json',
  'blog-catalog.json',
  'infografias-catalog.json',
  'infografias-eliminadas.json',
  'recursos-pdf.json',
  'videos-catalog.json',
  'podcast-catalog.json',
  'santoral-db.json',
  'santos.json',
  'oraciones.json',
  'novenas.json',
  'seo-redirecciones.json',
  'plan-config.json'
];

function leer(nombre) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, nombre), 'utf-8')); }
  catch (_) { return null; }
}

// Cuántos registros trae cada fichero. Sirve para dos cosas: que el resumen del
// admin diga algo comprensible, y que una copia vacía se note antes de
// confiarse en ella.
function contar(contenido) {
  if (!contenido || typeof contenido !== 'object') return 0;
  if (Array.isArray(contenido)) return contenido.length;
  for (const clave of ['posts', 'infografias', 'recursos', 'videos', 'podcasts', 'santos', 'users', 'coupons', 'oraciones', 'novenas']) {
    if (Array.isArray(contenido[clave])) return contenido[clave].length;
  }
  return Object.keys(contenido).length;
}

function construir() {
  const secciones = {};
  const resumen = {};
  for (const nombre of FICHEROS) {
    const contenido = leer(nombre);
    if (contenido === null) continue;
    secciones[nombre] = contenido;
    resumen[nombre] = contar(contenido);
  }
  let imagenes = 0;
  try { imagenes = fs.readdirSync(path.join(DATA_DIR, 'subidas')).length; } catch (_) {}
  return {
    version: 1,
    sitio: 'catolicosgpt',
    fecha: new Date().toISOString(),
    resumen,
    // Se declara explícitamente lo que la copia NO trae, para que nadie lo
    // descubra el día que intente restaurar.
    noIncluido: { imagenesSubidas: imagenes },
    secciones
  };
}

function nombreDeHoy() {
  return `respaldo-${new Date().toISOString().slice(0, 10)}.json`;
}

// Escribe primero a un temporal y luego renombra. Un corte de luz a mitad de
// escritura dejaría si no una copia truncada, que es peor que no tener copia:
// parece buena hasta el día que hace falta.
function guardarEnDisco() {
  fs.mkdirSync(CARPETA_COPIAS, { recursive: true });
  const destino = path.join(CARPETA_COPIAS, nombreDeHoy());
  const temporal = `${destino}.tmp-${process.pid}`;
  const copia = construir();
  const registros = Object.values(copia.resumen).reduce((a, b) => a + b, 0);
  // Una copia sin nada dentro no se guarda: sobrescribiría la de ayer, que sí
  // servía, por una que no sirve.
  if (registros === 0) return { hecho: false, motivo: 'no había nada que copiar' };
  fs.writeFileSync(temporal, JSON.stringify(copia), 'utf-8');
  fs.renameSync(temporal, destino);
  rotar();
  return { hecho: true, fichero: path.basename(destino), registros };
}

function rotar() {
  let copias;
  try { copias = fs.readdirSync(CARPETA_COPIAS).filter(f => /^respaldo-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); }
  catch (_) { return; }
  for (const vieja of copias.slice(0, Math.max(0, copias.length - COPIAS_A_GUARDAR))) {
    try { fs.unlinkSync(path.join(CARPETA_COPIAS, vieja)); } catch (_) {}
  }
}

function listar() {
  try {
    return fs.readdirSync(CARPETA_COPIAS)
      .filter(f => /^respaldo-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort().reverse()
      .map(f => {
        const s = fs.statSync(path.join(CARPETA_COPIAS, f));
        return { fichero: f, bytes: s.size, fecha: s.mtime.toISOString() };
      });
  } catch (_) { return []; }
}

function register(app, { isStrictAdminUser, getAuthedUser } = {}) {
  const soloAdmin = (req, res, next) => {
    const usuario = typeof getAuthedUser === 'function' ? getAuthedUser(req) : null;
    if (typeof isStrictAdminUser === 'function' && isStrictAdminUser(usuario)) return next();
    return res.status(404).end();
  };

  // La descarga. Un clic, un fichero, y ya está fuera de la máquina.
  app.get('/admin/respaldo/descargar', soloAdmin, (req, res) => {
    try {
      const copia = construir();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreDeHoy()}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(JSON.stringify(copia, null, 1));
    } catch (err) {
      res.status(500).json({ error: `No se pudo preparar el respaldo: ${err.message}` });
    }
  });

  app.get('/admin/respaldo/estado', soloAdmin, (req, res) => {
    const copia = construir();
    res.set('Cache-Control', 'no-store').json({
      resumen: copia.resumen,
      noIncluido: copia.noIncluido,
      enDisco: listar(),
      discoPersistente: Boolean(String(process.env.DATA_DIR || '').trim())
    });
  });

  // Una copia nada más arrancar, y otra cada 24 h. La del arranque importa
  // porque un despliegue es justo cuando algo se puede romper.
  const programar = () => {
    try {
      const r = guardarEnDisco();
      if (r.hecho) console.log(`[Respaldo] Copia diaria guardada: ${r.fichero} (${r.registros} registros).`);
      else console.warn(`[Respaldo] Sin copia: ${r.motivo}.`);
    } catch (err) { console.error('[Respaldo] Error guardando la copia:', err.message); }
  };
  setTimeout(programar, 60 * 1000).unref?.();
  setInterval(programar, UN_DIA).unref?.();

  console.log(`[Respaldo] Copias diarias en ${CARPETA_COPIAS} (se guardan las últimas ${COPIAS_A_GUARDAR}). Descarga en /admin/respaldo/descargar.`);
}

module.exports = { register, construir, guardarEnDisco, listar, FICHEROS, CARPETA_COPIAS };
