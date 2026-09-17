'use strict';
// ════════════════════════════════════════════════════════════════════════════
// QUÉ LE PREGUNTA LA GENTE AL CHAT
// ════════════════════════════════════════════════════════════════════════════
// Hasta ahora esto no se guardaba en ninguna parte. Miles de consultas pasaban
// por el sitio cada semana y nadie podía saber cuáles eran, ni para responder
// mejor ni para decidir sobre qué escribir. Search Console dice qué busca la
// gente en Google; esto dice qué pregunta una vez dentro, que no es lo mismo y
// suele ser más útil.
//
// Sobre lo que NO se guarda: las consultas de un chat católico pueden traer
// cosas íntimas -una enfermedad, un duelo, un pecado concreto-. Antes de
// guardar nada se quitan correos, teléfonos y cifras largas, y no se guarda
// quién preguntó: ni usuario, ni IP, ni sesión. Lo que queda es el tema y
// cuántas veces se preguntó, que es justamente lo que sirve para decidir.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RUTA = path.join(DATA_DIR, 'consultas-chat.json');
const MAX_DISTINTAS = Number(process.env.CONSULTAS_MAX_DISTINTAS) || 5000;

function limpiar(texto) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .trim()
    // Correos y teléfonos fuera antes de nada.
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, ' ')
    // Cifras largas: cédulas, tarjetas, lo que sea. Las citas bíblicas
    // (3,16) tienen pocos dígitos seguidos y sobreviven.
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

// Para agrupar "¿Qué es la Eucaristía?" con "que es la eucaristia" hace falta
// una forma canónica: sin tildes, sin signos y en minúscula. Se guarda además
// el texto tal como se escribió la primera vez, que se lee mejor en un informe.
function canonica(texto) {
  return limpiar(texto)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function leer() {
  try {
    const datos = JSON.parse(fs.readFileSync(RUTA, 'utf-8'));
    return datos && typeof datos === 'object' ? datos : { consultas: {}, total: 0 };
  } catch (_) {
    return { consultas: {}, total: 0 };
  }
}

function guardar(datos) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RUTA, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Consultas] No se pudo guardar:', err.message);
  }
}

function registrar(textoCrudo) {
  const clave = canonica(textoCrudo);
  // Menos de tres palabras casi nunca es una pregunta: es un saludo, una
  // prueba o un dedazo. No ensucia el informe.
  if (!clave || clave.split(' ').length < 3) return null;

  const datos = leer();
  const antes = datos.consultas[clave];
  datos.consultas[clave] = {
    texto: antes ? antes.texto : limpiar(textoCrudo),
    veces: (antes ? antes.veces : 0) + 1,
    primera: antes ? antes.primera : new Date().toISOString(),
    ultima: new Date().toISOString()
  };
  datos.total = (datos.total || 0) + 1;

  // Un tope para que el fichero no crezca sin fin. Se descartan las que solo
  // se preguntaron una vez y hace más de un mes: la cola larga no decide nada.
  const distintas = Object.keys(datos.consultas);
  if (distintas.length > MAX_DISTINTAS) {
    const limite = Date.now() - 30 * 24 * 3600 * 1000;
    for (const k of distintas) {
      const c = datos.consultas[k];
      if (c.veces <= 1 && new Date(c.ultima).getTime() < limite) delete datos.consultas[k];
    }
  }

  guardar(datos);
  return clave;
}

function top(cuantas = 100) {
  const datos = leer();
  return Object.entries(datos.consultas)
    .map(([clave, c]) => ({ clave, texto: c.texto, veces: c.veces, ultima: c.ultima }))
    .sort((a, b) => b.veces - a.veces || String(b.ultima).localeCompare(String(a.ultima)))
    .slice(0, cuantas);
}

function resumen() {
  const datos = leer();
  const distintas = Object.keys(datos.consultas).length;
  return { total: datos.total || 0, distintas };
}

function register(app, { getAuthedUser, isStrictAdminUser } = {}) {
  // Un middleware por delante de las dos rutas de chat que existen: la del
  // agente y la antigua. Así se registra una sola vez y sin tocar ninguna.
  app.use(['/api/chat', '/api/agent'], (req, res, next) => {
    if (req.method === 'POST') {
      try { registrar(req.body && (req.body.query || req.body.mensaje || req.body.pregunta)); }
      catch (err) { console.warn('[Consultas] No se pudo registrar:', err.message); }
    }
    next();
  });

  if (getAuthedUser && isStrictAdminUser) {
    app.get('/api/admin/consultas', (req, res) => {
      if (!isStrictAdminUser(getAuthedUser(req))) return res.status(403).json({ error: 'No autorizado' });
      res.set('Cache-Control', 'no-store').json({ ...resumen(), consultas: top(Number(req.query.limite) || 200) });
    });
  }
}

module.exports = { register, registrar, top, resumen, limpiar, canonica, RUTA };
