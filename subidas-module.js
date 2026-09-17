'use strict';
// ════════════════════════════════════════════════════════════════════════════
// SUBIDA DIRECTA DE IMÁGENES AL DISCO PERSISTENTE
// ════════════════════════════════════════════════════════════════════════════
// Hasta ahora la única forma de meter una imagen era pegar una URL: primero de
// Cloudinary, después de Google Drive. Desde el móvil eso es inviable — hay que
// subir la foto a otro sitio, buscar el enlace público y copiarlo a mano.
//
// Con disco persistente en Render el servidor ya puede guardar ficheros y que
// sigan ahí tras el siguiente despliegue, así que la imagen se sube y se acabó.
// Sin disco (DATA_DIR sin definir) esto sigue funcionando, pero los ficheros se
// pierden en el próximo arranque: por eso el estado lo dice en voz alta.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CARPETA = path.join(DATA_DIR, 'subidas');
const RUTA_PUBLICA = '/subidas';

// Doce megas por imagen. El navegador ya la reduce antes de enviarla, así que
// este techo solo frena lo que llegue sin pasar por ahí.
const MAX_BYTES = Number(process.env.SUBIDAS_MAX_BYTES) || 12 * 1024 * 1024;

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

function hayDiscoPersistente() {
  return Boolean(String(process.env.DATA_DIR || '').trim());
}

function asegurarCarpeta() {
  fs.mkdirSync(CARPETA, { recursive: true });
}

// El nombre que el administrador subió se conserva como pista legible, pero
// nunca se usa tal cual para el fichero: un nombre con barras o con ".." saca
// la escritura de la carpeta. Se limpia y se le antepone algo aleatorio para
// que dos fotos llamadas "IMG_0001.jpg" no se pisen.
function nombreSeguro(nombreOriginal, extension) {
  const base = String(nombreOriginal || '')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'imagen';
  return `${base}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
}

function guardarImagenBase64(dataUrl, nombreOriginal) {
  const cadena = String(dataUrl || '');
  const cabecera = cadena.match(/^data:([a-z0-9/+.-]+);base64,/i);
  if (!cabecera) throw new Error('El contenido enviado no es una imagen válida.');

  const tipo = cabecera[1].toLowerCase();
  const extension = EXTENSIONES[tipo];
  if (!extension) throw new Error(`Formato no admitido: ${tipo}. Usa JPG, PNG, WebP, GIF o AVIF.`);

  const cuerpo = cadena.slice(cabecera[0].length);
  const bytes = Buffer.from(cuerpo, 'base64');
  if (!bytes.length) throw new Error('La imagen llegó vacía.');
  if (bytes.length > MAX_BYTES) {
    throw new Error(`La imagen pesa ${(bytes.length / 1048576).toFixed(1)} MB y el máximo es ${(MAX_BYTES / 1048576).toFixed(0)} MB.`);
  }

  asegurarCarpeta();
  const nombre = nombreSeguro(nombreOriginal, extension);
  fs.writeFileSync(path.join(CARPETA, nombre), bytes);
  return { nombre, url: `${RUTA_PUBLICA}/${nombre}`, bytes: bytes.length };
}

function listarSubidas() {
  try {
    return fs.readdirSync(CARPETA)
      .filter(n => /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(n))
      .map(n => {
        let info = {};
        try { info = fs.statSync(path.join(CARPETA, n)); } catch (_) {}
        return {
          nombre: n,
          url: `${RUTA_PUBLICA}/${n}`,
          bytes: info.size || 0,
          fecha: info.mtime ? info.mtime.toISOString() : ''
        };
      })
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  } catch (_) {
    return [];
  }
}

function borrarSubida(nombre) {
  // path.basename corta cualquier intento de salirse de la carpeta.
  const limpio = path.basename(String(nombre || ''));
  if (!limpio || !/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(limpio)) return false;
  try {
    fs.unlinkSync(path.join(CARPETA, limpio));
    return true;
  } catch (_) {
    return false;
  }
}

function register(app, { getAuthedUser, isStrictAdminUser, express }) {
  const soloAdmin = (req, res, next) => {
    if (!isStrictAdminUser(getAuthedUser(req))) return res.status(403).json({ error: 'No autorizado' });
    next();
  };

  asegurarCarpeta();

  // El nombre del fichero lleva seis bytes aleatorios, así que una URL siempre
  // apunta al mismo contenido: se puede cachear un año sin miedo. Esto anula a
  // propósito el 'no-cache' general, que existe para las páginas.
  app.use(RUTA_PUBLICA, express.static(CARPETA, {
    immutable: true,
    maxAge: '365d',
    fallthrough: true,
    index: false
  }));

  app.post('/api/admin/subidas', soloAdmin, (req, res) => {
    try {
      const guardada = guardarImagenBase64(req.body && req.body.dataUrl, req.body && req.body.nombre);
      res.set('Cache-Control', 'no-store').json({ ok: true, ...guardada, persistente: hayDiscoPersistente() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/admin/subidas', soloAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      imagenes: listarSubidas(),
      persistente: hayDiscoPersistente()
    });
  });

  app.delete('/api/admin/subidas/:nombre', soloAdmin, (req, res) => {
    if (!borrarSubida(req.params.nombre)) return res.status(404).json({ error: 'No existe esa imagen.' });
    res.set('Cache-Control', 'no-store').json({ ok: true });
  });

  console.log(`[Subidas] Carpeta de imágenes en ${CARPETA}${hayDiscoPersistente() ? ' (disco persistente).' : ' (SIN disco persistente: se borrarán en el próximo despliegue).'}`);
}

module.exports = { register, guardarImagenBase64, listarSubidas, borrarSubida, nombreSeguro, CARPETA, RUTA_PUBLICA };
