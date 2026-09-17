'use strict';
// ════════════════════════════════════════════════════════════════════════════
// BANCO DE CONSULTAS: QUÉ SE ESCRIBE Y POR QUÉ
// ════════════════════════════════════════════════════════════════════════════
// Hasta ahora los artículos se generaban cruzando temas con enfoques, que es
// una forma elegante de escribir sobre lo que a nosotros nos parece importante.
// Search Console dice otra cosa: la gente que llega a este sitio busca sobre
// todo CATEQUESIS PARA NIÑOS, y ahí hay miles de impresiones ya ganadas.
//
//   que es la biblia para niños .......... 2.310 impresiones
//   que es la eucaristía para niños ...... 2.555 impresiones
//   la virgen maría para niños ............. 378 impresiones
//   santo rosario de hoy ................. 3.593 impresiones
//   ia catolica .......................... 1.003 impresiones
//
// Así que cada artículo responde a UNA consulta real, escrita como la escribe
// la gente. El título, el slug y la meta descripción se construyen alrededor de
// esa consulta, no al revés.
//
// Lo que NO está aquí a propósito:
//   - "santo rosario de hoy", "evangelio de hoy" y demás intención diaria: eso
//     lo sirven las páginas pilar, que se actualizan solas. Un artículo de blog
//     sobre "el rosario de hoy" competiría contra nuestra propia página.
//   - "ia catolica", "catolicos gpt": son consultas de marca. Las responde la
//     portada, no el blog.

// grupo: para no publicar cinco artículos del mismo racimo el mismo día.
const CONSULTAS = [
  // ── Catequesis infantil: el patrón que ya funciona ──────────────────────
  { consulta: 'qué es la Biblia para niños',                      audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'qué es la Eucaristía para niños',                  audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'qué es la Misa para niños',                        audiencia: 'niños', grupo: 'liturgia-ninos' },
  { consulta: 'qué es el Bautismo para niños',                    audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'qué es la Confirmación para niños',                audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'qué es la Confesión para niños',                   audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'qué es la Primera Comunión para niños',            audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'los siete sacramentos explicados para niños',      audiencia: 'niños', grupo: 'sacramentos-ninos' },
  { consulta: 'quién es Jesús para niños',                        audiencia: 'niños', grupo: 'jesus-ninos' },
  { consulta: 'quién es la Virgen María para niños',              audiencia: 'niños', grupo: 'maria-ninos' },
  { consulta: 'quién es el Espíritu Santo para niños',            audiencia: 'niños', grupo: 'trinidad-ninos' },
  { consulta: 'qué es la Santísima Trinidad para niños',          audiencia: 'niños', grupo: 'trinidad-ninos' },
  { consulta: 'los diez mandamientos explicados para niños',      audiencia: 'niños', grupo: 'moral-ninos' },
  { consulta: 'el Padrenuestro explicado para niños',             audiencia: 'niños', grupo: 'oraciones-ninos' },
  { consulta: 'el Ave María explicada para niños',                audiencia: 'niños', grupo: 'oraciones-ninos' },
  { consulta: 'el Credo explicado para niños',                    audiencia: 'niños', grupo: 'oraciones-ninos' },
  { consulta: 'cómo se reza el Rosario para niños',               audiencia: 'niños', grupo: 'rosario-ninos' },
  { consulta: 'qué es el pecado para niños',                      audiencia: 'niños', grupo: 'moral-ninos' },
  { consulta: 'qué es la gracia de Dios para niños',              audiencia: 'niños', grupo: 'doctrina-ninos' },
  { consulta: 'qué es la Iglesia católica para niños',            audiencia: 'niños', grupo: 'doctrina-ninos' },
  { consulta: 'quiénes son los ángeles para niños',               audiencia: 'niños', grupo: 'doctrina-ninos' },
  { consulta: 'qué es el cielo para niños',                       audiencia: 'niños', grupo: 'doctrina-ninos' },
  { consulta: 'qué es la Cuaresma para niños',                    audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'qué es la Semana Santa para niños',                audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'qué es la Pascua para niños',                      audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'qué es el Adviento para niños',                    audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'qué es el Pentecostés para niños',                 audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'qué es el Corpus Christi para niños',              audiencia: 'niños', grupo: 'tiempos-ninos' },
  { consulta: 'la creación del mundo explicada para niños',       audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'el arca de Noé explicada para niños',              audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'Moisés y el paso del Mar Rojo para niños',         audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'David y Goliat explicado para niños',              audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'el nacimiento de Jesús explicado para niños',      audiencia: 'niños', grupo: 'jesus-ninos' },
  { consulta: 'los milagros de Jesús para niños',                 audiencia: 'niños', grupo: 'jesus-ninos' },
  { consulta: 'las parábolas de Jesús para niños',                audiencia: 'niños', grupo: 'jesus-ninos' },
  { consulta: 'la Resurrección de Jesús explicada para niños',    audiencia: 'niños', grupo: 'jesus-ninos' },
  { consulta: 'quiénes fueron los doce apóstoles para niños',     audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'qué es el Evangelio para niños',                   audiencia: 'niños', grupo: 'biblia-ninos' },
  { consulta: 'qué es rezar y cómo se reza, para niños',          audiencia: 'niños', grupo: 'oraciones-ninos' },
  { consulta: 'qué es un santo para niños',                       audiencia: 'niños', grupo: 'santos-ninos' },

  // ── Catequesis para jóvenes ────────────────────────────────────────────
  { consulta: 'cómo saber cuál es mi vocación siendo joven',      audiencia: 'jovenes', grupo: 'vocacion-jovenes' },
  { consulta: 'por qué ir a Misa los domingos siendo joven',      audiencia: 'jovenes', grupo: 'liturgia-jovenes' },
  { consulta: 'cómo confesarse por primera vez siendo joven',     audiencia: 'jovenes', grupo: 'sacramentos-jovenes' },
  { consulta: 'qué dice la Iglesia sobre el noviazgo',            audiencia: 'jovenes', grupo: 'noviazgo-jovenes' },
  { consulta: 'cómo rezar cuando no sientes nada',                audiencia: 'jovenes', grupo: 'oracion-jovenes' },
  { consulta: 'qué hacer si dudo de mi fe',                       audiencia: 'jovenes', grupo: 'fe-jovenes' },
  { consulta: 'cómo leer la Biblia por primera vez',              audiencia: 'jovenes', grupo: 'biblia-jovenes' },
  { consulta: 'qué es la castidad según la Iglesia',              audiencia: 'jovenes', grupo: 'moral-jovenes' },
  { consulta: 'cómo prepararse para la Confirmación',             audiencia: 'jovenes', grupo: 'sacramentos-jovenes' },
  { consulta: 'qué significa ser católico hoy',                   audiencia: 'jovenes', grupo: 'fe-jovenes' },
  { consulta: 'cómo perdonar según el Evangelio',                 audiencia: 'jovenes', grupo: 'moral-jovenes' },
  { consulta: 'qué dice la Iglesia sobre la ansiedad y la fe',    audiencia: 'jovenes', grupo: 'fe-jovenes' },
  { consulta: 'cómo elegir un padrino de Confirmación',           audiencia: 'jovenes', grupo: 'sacramentos-jovenes' },
  { consulta: 'qué es la adoración eucarística y cómo se hace',   audiencia: 'jovenes', grupo: 'liturgia-jovenes' },
  { consulta: 'cómo hacer un examen de conciencia',               audiencia: 'jovenes', grupo: 'sacramentos-jovenes' },

  // ── Preguntas de adultos con demanda real y constante ──────────────────
  { consulta: 'qué es el purgatorio según la Iglesia católica',   audiencia: 'adultos', grupo: 'escatologia' },
  { consulta: 'por qué los católicos rezan a la Virgen María',    audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'cuáles son los siete pecados capitales',           audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'cuáles son las obras de misericordia',             audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'cuáles son los misterios del Rosario',             audiencia: 'adultos', grupo: 'rosario' },
  { consulta: 'cómo se reza el Rosario paso a paso',              audiencia: 'adultos', grupo: 'rosario' },
  { consulta: 'qué es una novena y cómo se reza',                 audiencia: 'adultos', grupo: 'oraciones' },
  { consulta: 'qué significa el Miércoles de Ceniza',             audiencia: 'adultos', grupo: 'tiempos' },
  { consulta: 'qué se puede comer en Cuaresma y qué no',          audiencia: 'adultos', grupo: 'tiempos' },
  { consulta: 'qué es el ayuno y la abstinencia en la Iglesia',   audiencia: 'adultos', grupo: 'tiempos' },
  { consulta: 'qué es la Inmaculada Concepción',                  audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'qué es la Asunción de la Virgen María',            audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'quién fue San José y qué enseña su vida',          audiencia: 'adultos', grupo: 'santos' },
  { consulta: 'qué es el Catecismo de la Iglesia Católica',       audiencia: 'adultos', grupo: 'magisterio' },
  { consulta: 'qué es un dogma de fe',                            audiencia: 'adultos', grupo: 'magisterio' },
  { consulta: 'qué es una encíclica del Papa',                    audiencia: 'adultos', grupo: 'magisterio' },
  { consulta: 'qué es la infalibilidad papal',                    audiencia: 'adultos', grupo: 'magisterio' },
  { consulta: 'qué es la transubstanciación',                     audiencia: 'adultos', grupo: 'eucaristia' },
  { consulta: 'por qué se llama Eucaristía a la Misa',            audiencia: 'adultos', grupo: 'eucaristia' },
  { consulta: 'cuáles son las partes de la Misa',                 audiencia: 'adultos', grupo: 'liturgia' },
  { consulta: 'qué es el año litúrgico y cómo se divide',         audiencia: 'adultos', grupo: 'liturgia' },
  { consulta: 'qué es la Liturgia de las Horas',                  audiencia: 'adultos', grupo: 'liturgia' },
  { consulta: 'qué es el sacramento de la unción de los enfermos',audiencia: 'adultos', grupo: 'sacramentos' },
  { consulta: 'qué es el matrimonio según la Iglesia católica',   audiencia: 'adultos', grupo: 'sacramentos' },
  { consulta: 'qué es la nulidad matrimonial',                    audiencia: 'adultos', grupo: 'sacramentos' },
  { consulta: 'qué dice la Iglesia sobre el bautismo de bebés',   audiencia: 'adultos', grupo: 'sacramentos' },
  { consulta: 'cómo elegir los padrinos de bautismo',             audiencia: 'adultos', grupo: 'sacramentos' },
  { consulta: 'qué es el pecado mortal y el pecado venial',       audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'qué es la conciencia según la Iglesia',            audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'qué son las virtudes teologales',                  audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'qué son las virtudes cardinales',                  audiencia: 'adultos', grupo: 'moral' },
  { consulta: 'qué son los dones del Espíritu Santo',             audiencia: 'adultos', grupo: 'trinidad' },
  { consulta: 'qué es la Comunión de los Santos',                 audiencia: 'adultos', grupo: 'doctrina' },
  { consulta: 'qué enseña la Iglesia sobre el cielo y el infierno',audiencia: 'adultos', grupo: 'escatologia' },
  { consulta: 'qué es el juicio final según la Iglesia',          audiencia: 'adultos', grupo: 'escatologia' },
  { consulta: 'qué es la resurrección de la carne',               audiencia: 'adultos', grupo: 'escatologia' },
  { consulta: 'qué es la doctrina social de la Iglesia',          audiencia: 'adultos', grupo: 'doctrina-social' },
  { consulta: 'qué dice la Iglesia sobre el trabajo justo',       audiencia: 'adultos', grupo: 'doctrina-social' },
  { consulta: 'qué dice la Iglesia sobre los pobres',             audiencia: 'adultos', grupo: 'doctrina-social' },
  { consulta: 'qué es el bien común según la Iglesia',            audiencia: 'adultos', grupo: 'doctrina-social' },
  { consulta: 'cómo se estructura la Biblia católica',            audiencia: 'adultos', grupo: 'biblia' },
  { consulta: 'por qué la Biblia católica tiene más libros',      audiencia: 'adultos', grupo: 'biblia' },
  { consulta: 'qué son los evangelios sinópticos',                audiencia: 'adultos', grupo: 'biblia' },
  { consulta: 'cómo leer la Biblia según la Iglesia',             audiencia: 'adultos', grupo: 'biblia' },
  { consulta: 'qué es la Tradición en la Iglesia católica',       audiencia: 'adultos', grupo: 'magisterio' },
  { consulta: 'qué son los Padres de la Iglesia',                 audiencia: 'adultos', grupo: 'historia' },
  { consulta: 'qué fue el Concilio Vaticano II',                  audiencia: 'adultos', grupo: 'historia' },
  { consulta: 'qué fue el Concilio de Trento',                    audiencia: 'adultos', grupo: 'historia' },
  { consulta: 'qué es el Jubileo en la Iglesia católica',         audiencia: 'adultos', grupo: 'historia' },
  { consulta: 'qué es una indulgencia según la Iglesia',          audiencia: 'adultos', grupo: 'doctrina' },
  { consulta: 'qué es el escapulario del Carmen',                 audiencia: 'adultos', grupo: 'devociones' },
  { consulta: 'qué es la devoción al Sagrado Corazón de Jesús',   audiencia: 'adultos', grupo: 'devociones' },
  { consulta: 'qué es la Divina Misericordia y cómo se reza',     audiencia: 'adultos', grupo: 'devociones' },
  { consulta: 'qué es el Vía Crucis y cómo se hace',              audiencia: 'adultos', grupo: 'devociones' },
  { consulta: 'qué es la Virgen de Guadalupe y su mensaje',       audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'qué pasó en las apariciones de Fátima',            audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'qué pasó en las apariciones de Lourdes',           audiencia: 'adultos', grupo: 'mariologia' },
  { consulta: 'qué es el Ángelus y a qué hora se reza',           audiencia: 'adultos', grupo: 'oraciones' },
  { consulta: 'oraciones para pedir por los enfermos',            audiencia: 'adultos', grupo: 'oraciones' },
  { consulta: 'oraciones por los difuntos según la Iglesia',      audiencia: 'adultos', grupo: 'oraciones' },
  { consulta: 'cómo bendecir la mesa antes de comer',             audiencia: 'adultos', grupo: 'oraciones' },
  { consulta: 'cómo rezar en familia todos los días',             audiencia: 'adultos', grupo: 'familia' },
  { consulta: 'cómo educar a los hijos en la fe católica',        audiencia: 'adultos', grupo: 'familia' },
  { consulta: 'qué es la Iglesia doméstica',                      audiencia: 'adultos', grupo: 'familia' },
  { consulta: 'qué dice la Iglesia sobre el duelo y la muerte',   audiencia: 'adultos', grupo: 'familia' },
  { consulta: 'qué es el discernimiento espiritual',              audiencia: 'adultos', grupo: 'espiritualidad' },
  { consulta: 'qué es la dirección espiritual',                   audiencia: 'adultos', grupo: 'espiritualidad' },
  { consulta: 'qué es la lectio divina y cómo se practica',       audiencia: 'adultos', grupo: 'espiritualidad' },
  { consulta: 'qué es el silencio interior en la oración',        audiencia: 'adultos', grupo: 'espiritualidad' },
  { consulta: 'qué diferencia hay entre católicos y protestantes',audiencia: 'adultos', grupo: 'apologetica' },
  { consulta: 'por qué los católicos tienen imágenes en la iglesia',audiencia: 'adultos', grupo: 'apologetica' },
  { consulta: 'por qué se confiesan los pecados con un sacerdote',audiencia: 'adultos', grupo: 'apologetica' },
  { consulta: 'por qué el Papa es el sucesor de Pedro',           audiencia: 'adultos', grupo: 'apologetica' },
  { consulta: 'por qué los sacerdotes no se casan',               audiencia: 'adultos', grupo: 'apologetica' },
  { consulta: 'qué responde la Iglesia a quien no cree en Dios',  audiencia: 'adultos', grupo: 'apologetica' }
];

// Cada audiencia tiene su categoría y su forma de escribir.
const PERFILES = {
  'niños':   { categoria: 'catequesis-ninos',   contentType: 'guía de catequesis para niños de 6 a 12 años' },
  'jovenes': { categoria: 'catequesis-jovenes', contentType: 'guía de catequesis para jóvenes' },
  'adultos': { categoria: null,                 contentType: 'artículo de formación católica para adultos' }
};

function perfil(audiencia) {
  return PERFILES[audiencia] || PERFILES['adultos'];
}

module.exports = { CONSULTAS, PERFILES, perfil };
