'use strict';
// Siembra del disco persistente.
//
// Un disco recién creado en Render está VACÍO. Si DATA_DIR apunta a él sin más,
// el sitio arranca sin usuarios, sin catálogos y sin nada: exactamente el mismo
// síntoma que queríamos curar, solo que permanente, porque ya no habría un
// despliegue posterior que volviera a traer los ficheros del repositorio.
//
// Por eso, en cada arranque, cada fichero de datos que NO exista todavía en
// DATA_DIR se copia desde la copia del repositorio. Lo que ya existe en el
// disco no se toca jamás: el disco manda, el repositorio solo siembra lo que
// falta. Así el primer arranque queda poblado y los siguientes respetan todo lo
// que el administrador haya creado o editado.
const fs = require('fs');
const path = require('path');

const REPO_DATA = path.join(__dirname, 'data');

function seedDataDir(destino = process.env.DATA_DIR) {
  // Cada salida temprana deja rastro. Sin esto, un DATA_DIR mal escrito o un
  // disco que no se puede montar se veian igual que un arranque correcto: en
  // silencio, y el sitio aparecia vacio sin que los registros dijeran por que.
  const fin = (resultado) => {
    console.log(`[Disco] No se sembro nada: ${resultado.motivo}.`);
    return resultado;
  };
  const target = String(destino || '').trim();
  // Sin DATA_DIR el sitio ya usa la carpeta del repositorio: no hay nada que
  // sembrar y copiar sobre sí mismo sería un error.
  if (!target) return fin({ sembrados: [], motivo: 'sin DATA_DIR' });
  const resuelto = path.resolve(target);
  if (resuelto === path.resolve(REPO_DATA)) return fin({ sembrados: [], motivo: 'DATA_DIR es la carpeta del repositorio' });

  try { fs.mkdirSync(resuelto, { recursive: true }); }
  catch (err) { return fin({ sembrados: [], motivo: `no se pudo crear ${resuelto}: ${err.message}` }); }

  let origen;
  try { origen = fs.readdirSync(REPO_DATA); }
  catch { return fin({ sembrados: [], motivo: 'el repositorio no trae carpeta data' }); }

  const sembrados = [];
  for (const nombre of origen) {
    if (!nombre.endsWith('.json')) continue;
    const desde = path.join(REPO_DATA, nombre);
    const hacia = path.join(resuelto, nombre);
    // La regla entera cabe en esta línea: si ya está en el disco, no se toca.
    if (fs.existsSync(hacia)) continue;
    try {
      if (!fs.statSync(desde).isFile()) continue;
      fs.copyFileSync(desde, hacia);
      sembrados.push(nombre);
    } catch (err) {
      console.warn(`[Disco] No se pudo sembrar ${nombre}: ${err.message}`);
    }
  }

  if (sembrados.length) console.log(`[Disco] Disco persistente sembrado con ${sembrados.length} ficheros: ${sembrados.join(', ')}`);
  else console.log(`[Disco] Disco persistente ya poblado en ${resuelto}; no se copió nada.`);
  return { sembrados, destino: resuelto };
}

module.exports = { seedDataDir };
