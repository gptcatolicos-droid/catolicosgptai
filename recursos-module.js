// ════════════════════════════════════════════════════════════════
// RECURSOS MODULE — Cargar recursos locales (Catecismo, Biblia, Santos...)
// Búsqueda inteligente semántica y por expresiones regulares
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

function leerDataset(nombre) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, nombre), 'utf8'));
  } catch(e) {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', nombre), 'utf8'));
    } catch(e2) {
      console.warn(`[Recursos] No se pudo leer el dataset ${nombre}:`, e2.message);
      return null;
    }
  }
}

// Cargar todos los datasets para la búsqueda local estructurada al iniciar el servidor
const DATASETS = {
  catecismo: leerDataset('catecismo.json'),
  biblia: leerDataset('biblia.json'),
  santos: leerDataset('santos.json'),
  docVaticano: leerDataset('documentos_vaticano.json'),
  oraciones: leerDataset('oraciones.json'),
  novenas: leerDataset('novenas.json'),
  moralYEscatologia: leerDataset('moral_escatologia.json'),
  historiaIglesia: leerDataset('historia_iglesia.json'),
  faq: leerDataset('faq_catolico.json'),
  leonXIV: leerDataset('papa_leon_xiv.json'),
  enciclica: leerDataset('enciclica_magnifica_humanitas.json'),
  blog: leerDataset('blog-catalog.json')
};

// ── Búsqueda Local Estructurada ──
function consultarRecursosLocales(query) {
  const norm = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim();
  const qClean = norm(query);
  const qExact = (query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const resultados = [];
  const yaAgregados = new Set(); // Evitar duplicados por título

  const agregarSiNoDuplicado = (res) => {
    if (!yaAgregados.has(res.titulo)) {
      yaAgregados.add(res.titulo);
      resultados.push(res);
    }
  };

  // 1. Oraciones
  const oraciones = DATASETS.oraciones;
  if (oraciones && oraciones.oraciones_principales) {
    const encontradas = oraciones.oraciones_principales.filter(o => 
      o.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
      o.texto_es.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)
    );
    encontradas.forEach(o => {
      agregarSiNoDuplicado({
        tipo: 'oracion',
        titulo: `Oración: ${o.nombre}`,
        contenido: o.texto_es,
        metadata: { tipo_oracion: o.tipo, origen: o.origen, cuando: o.cuando_rezar }
      });
    });
  }

  // 2. Novenas
  const novenas = DATASETS.novenas;
  if (novenas && novenas.novenas) {
    novenas.novenas.forEach(n => {
      if (n.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
        agregarSiNoDuplicado({
          tipo: 'novena',
          titulo: n.nombre,
          contenido: `Oración preparatoria: ${n.oracion_preparatoria}\n\nTiene ${n.dias.length} días de meditación.`,
          metadata: { fechas: n.fechas, tambien_cuando: n.tambien_cuando }
        });
      }
    });
  }

  // 3. Santos (Santoral)
  const santos = DATASETS.santos;
  if (santos && santos.santos_por_mes) {
    Object.entries(santos.santos_por_mes).forEach(([mes, lista]) => {
      lista.forEach(s => {
        if (s.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
            s.descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'santoral',
            titulo: `${s.nombre} (${s.tipo})`,
            contenido: `${s.descripcion}\nMes: ${mes}, Día: ${s.dia}`,
            metadata: { dia: s.dia, mes, tipo: s.tipo }
          });
        }
      });
    });
  }

  // 4. León XIV y su encíclica
  const leonXIV = DATASETS.leonXIV;
  if (leonXIV) {
    if (leonXIV.preguntas_frecuentes) {
      leonXIV.preguntas_frecuentes.forEach(pf => {
        if (pf.pregunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
            pf.respuesta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'papa_leon_xiv',
            titulo: pf.pregunta,
            contenido: pf.respuesta,
            metadata: { papa: 'León XIV' }
          });
        }
      });
    }

    const biografiaStr = JSON.stringify(leonXIV.biografia);
    if (qExact.includes('leon xiv') || qExact.includes('león xiv') || qExact.includes('prevost') || qExact.includes('nuevo papa') || biografiaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
      agregarSiNoDuplicado({
        tipo: 'papa_leon_xiv',
        titulo: `Papa León XIV (Robert Francis Prevost)`,
        contenido: `Elegido el ${leonXIV.elegido}. Origen: ${leonXIV.origen}. Lema episcopal: "${leonXIV.lema_episcopal}" (${leonXIV.lema_significado}).\n` +
                   `Biografía básica: ${leonXIV.biografia.mision_peru} ${leonXIV.biografia.vaticano} ${leonXIV.biografia.conclave}\n` +
                   `Temas prioritarios: ${leonXIV.temas_prioritarios.join(', ')}`,
        metadata: { orden: leonXIV.orden_religiosa, lema: leonXIV.lema_episcopal }
      });
    }
  }

  const enciclica = DATASETS.enciclica;
  if (enciclica) {
    const enciclicaStr = JSON.stringify(enciclica);
    if (qExact.includes('magnifica') || qExact.includes('humanitas') || qExact.includes('inteligencia artificial') || qExact.includes('ia') || qExact.includes('babel') || enciclicaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
      const conceptosMatch = [];
      Object.entries(enciclica.conceptos_clave).forEach(([clave, desc]) => {
        if (clave.includes(qExact) || desc.toLowerCase().includes(qExact) || qExact.includes('ia') || qExact.includes('algoritmo') || qExact.includes('digital')) {
          conceptosMatch.push(`**${clave.toUpperCase().replace(/_/g, ' ')}**: ${desc}`);
        }
      });

      const citasMatch = enciclica.citas_destacadas.filter(c => c.texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact));

      agregarSiNoDuplicado({
        tipo: 'enciclica_magnifica_humanitas',
        titulo: `Encíclica Magnifica Humanitas (Papa León XIV, 2026)`,
        contenido: `Tema principal: ${enciclica.tema}.\n` +
                   `Resumen ejecutivo: ${enciclica.resumen_ejecutivo}\n` +
                   (conceptosMatch.length > 0 ? `\nConceptos clave encontrados:\n${conceptosMatch.join('\n')}` : '') +
                   (citasMatch.length > 0 ? `\n\nCita destacada: "${citasMatch[0].texto}" (${citasMatch[0].fuente})` : ''),
        metadata: { papa: 'León XIV', fecha: enciclica.fecha }
      });
    }
  }

  // 5. Moral y Escatología
  const moralY = DATASETS.moralYEscatologia;
  if (moralY) {
    if (moralY.moral_sexual_y_vida) {
      Object.entries(moralY.moral_sexual_y_vida).forEach(([tema, info]) => {
        const infoStr = JSON.stringify(info).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (tema.toLowerCase().includes(qExact) || infoStr.includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'moral_de_vida',
            titulo: `Doctrina Moral sobre: ${tema.toUpperCase().replace(/_/g, ' ')}`,
            contenido: `Posición oficial de la Iglesia: ${info.posicion_oficial || info.posicion || info.indisolubilidad || info.persona}\n` +
                       `Fundamento/Razón: ${info.fundamento || info.razon || info.tendencia || ''}\n` +
                       `Documentos citados: ${(info.documentos || []).join(', ') || ''}`,
            metadata: { tema }
          });
        }
      });
    }

    if (moralY.escatologia_completa) {
      Object.entries(moralY.escatologia_completa).forEach(([tema, info]) => {
        const infoStr = typeof info === 'string' ? info : JSON.stringify(info);
        if (tema.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
            infoStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'escatologia',
            titulo: `Escatología (Novísimos): ${tema.toUpperCase()}`,
            contenido: typeof info === 'string' ? info : (info.que_es ? `${info.que_es}\nFundamento: ${info.fundamento || ''}\nNota: ${info.nota || info.cuerpo || ''}` : JSON.stringify(info)),
            metadata: { tema }
          });
        }
      });
    }
  }

  // 6. Historia de la Iglesia
  const hist = DATASETS.historiaIglesia;
  if (hist && hist.periodos) {
    hist.periodos.forEach(p => {
      p.eventos.forEach(ev => {
        if (ev.evento.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
            ev.descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'historia_iglesia',
            titulo: `Historia: ${ev.evento} (Año ${ev.año})`,
            contenido: ev.descripcion,
            metadata: { periodo: p.periodo, año: ev.año }
          });
        }
      });
    });
  }

  // 7. FAQ de CatólicosGPT
  const faq = DATASETS.faq;
  if (faq && faq.categorias) {
    Object.entries(faq.categorias).forEach(([cat, list]) => {
      list.forEach(item => {
        if (item.q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact) ||
            item.a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qExact)) {
          agregarSiNoDuplicado({
            tipo: 'faq',
            titulo: item.q,
            contenido: item.a,
            metadata: { categoria: cat, fuente: item.fuente }
          });
        }
      });
    });
  }

  // ════════════ FALLBACK: BÚSQUEDA ROBUSTA MÁS AMPLIA (CON PALABRAS CLAVE) ════════════
  // Robustecemos con palabras significativas si los resultados son escasos
  if (resultados.length < 3) {
    const stopwords = new Set([
      'la', 'lo', 'las', 'los', 'el', 'un', 'una', 'unos', 'unas', 
      'sobre', 'para', 'como', 'con', 'del', 'de', 'en', 'por', 
      'que', 'y', 'o', 'tu', 'tus', 'su', 'sus', 'mi', 'mis', 
      'guia', 'charla', 'prepare', 'prepara', 'preapra', 'dame', 'un', 'una',
      'explicacion', 'acerca', 'diferencia', 'puedes', 'crear', 'hacer', 'escribir', 'redactar'
    ]);

    const palabrasQuery = qClean.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));

    if (palabrasQuery.length > 0) {
      const candidates = [];

      const calcularCoincidencia = (titulo, keywords, contenido) => {
        const textVal = norm((titulo || '') + ' ' + (keywords || '') + ' ' + (contenido || ''));
        let matchCount = 0;
        for (const palabra of palabrasQuery) {
          if (textVal.includes(palabra)) {
            matchCount += 1.0;
            if (norm(titulo).includes(palabra)) {
              matchCount += 1.5; // Mayor peso si está en el título
            }
          }
        }
        return matchCount / palabrasQuery.length;
      };

      // Evaluar del blog catalog
      const blog = DATASETS.blog;
      if (blog && blog.posts) {
        blog.posts.forEach(p => {
          if (!p.publicado) return;
          const score = calcularCoincidencia(p.titulo, p.keywords, p.contenidoMd || p.descripcion);
          if (score > 0.25) {
            candidates.push({
              score,
              tipo: 'blog_post',
              titulo: p.titulo,
              contenido: p.contenidoMd || p.descripcion || p.extracto,
              metadata: { slug: p.slug, categoria: p.categoria }
            });
          }
        });
      }

      // Evaluar moral
      if (moralY) {
        if (moralY.moral_sexual_y_vida) {
          Object.entries(moralY.moral_sexual_y_vida).forEach(([tema, info]) => {
            const score = calcularCoincidencia(tema, '', JSON.stringify(info));
            if (score > 0.25) {
              candidates.push({
                score,
                tipo: 'moral_de_vida',
                titulo: `Doctrina Moral sobre: ${tema.toUpperCase().replace(/_/g, ' ')}`,
                contenido: `Posición oficial de la Iglesia: ${info.posicion_oficial || info.posicion || info.indisolubilidad || info.persona}\n` +
                           `Fundamento/Razón: ${info.fundamento || info.razon || info.tendencia || ''}\n` +
                           `Documentos citados: ${(info.documentos || []).join(', ') || ''}`,
                metadata: { tema }
              });
            }
          });
        }
        if (moralY.escatologia_completa) {
          Object.entries(moralY.escatologia_completa).forEach(([tema, info]) => {
            const score = calcularCoincidencia(tema, '', typeof info === 'string' ? info : JSON.stringify(info));
            if (score > 0.25) {
              candidates.push({
                score,
                tipo: 'escatologia',
                titulo: `Escatología (Novísimos): ${tema.toUpperCase()}`,
                contenido: typeof info === 'string' ? info : (info.que_es ? `${info.que_es}\nFundamento: ${info.fundamento || ''}` : JSON.stringify(info)),
                metadata: { tema }
              });
            }
          });
        }
      }

      // Evaluar faq
      if (faq && faq.categorias) {
        Object.entries(faq.categorias).forEach(([cat, list]) => {
          list.forEach(item => {
            const score = calcularCoincidencia(item.q, '', item.a);
            if (score > 0.25) {
              candidates.push({
                score,
                tipo: 'faq',
                titulo: item.q,
                contenido: item.a,
                metadata: { categoria: cat, fuente: item.fuente }
              });
            }
          });
        });
      }

      // Evaluar/revisar oraciones
      if (oraciones && oraciones.oraciones_principales) {
        oraciones.oraciones_principales.forEach(o => {
          const score = calcularCoincidencia(o.nombre, '', o.texto_es);
          if (score > 0.25) {
            candidates.push({
              score,
              tipo: 'oracion',
              titulo: `Oración: ${o.nombre}`,
              contenido: o.texto_es,
              metadata: { tipo_oracion: o.tipo, origen: o.origen }
            });
          }
        });
      }

      // Ordenar candidatos por score y agregar los mejores que no estén duplicados
      candidates.sort((a, b) => b.score - a.score);
      candidates.forEach(c => {
        if (resultados.length < 8) {
          agregarSiNoDuplicado({
            tipo: c.tipo,
            titulo: c.titulo,
            contenido: c.contenido,
            metadata: c.metadata
          });
        }
      });
    }
  }

  return resultados;
}

module.exports = { leerDataset, consultarRecursosLocales, DATASETS };
