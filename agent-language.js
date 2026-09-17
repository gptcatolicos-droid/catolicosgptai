'use strict';
// El corpus de Magisterium es multilingüe: buena parte de las Actas, encíclicas
// y biografías está en latín, francés, italiano o inglés. Sacarlas tal cual en
// las tarjetas de fuentes ponía párrafos enteros en un idioma que quien
// pregunta no lee.
//
// Aquí se identifica el idioma de cada documento con un contador de palabras
// función, sin llamar a ningún servicio ni añadir dependencias: el texto
// litúrgico y magisterial es lo bastante formulario como para que esto acierte
// con una o dos frases.

// Palabras muy frecuentes y propias de cada idioma. Se evitan las que se
// comparten entre lenguas romances (de, a, in, non…), que no distinguen nada.
const MARKERS = {
  es: ['que', 'los', 'las', 'del', 'por', 'con', 'para', 'como', 'pero', 'esta', 'este', 'son', 'una', 'sus', 'más', 'también', 'porque', 'cuando', 'desde', 'hacia', 'según', 'iglesia', 'dios', 'señor', 'nuestro', 'vida', 'fe'],
  la: ['atque', 'enim', 'quae', 'quod', 'quibus', 'autem', 'etiam', 'cum', 'sed', 'ita', 'ut', 'nam', 'vero', 'sicut', 'ipse', 'ipsa', 'ipsum', 'eius', 'eorum', 'esse', 'esset', 'sunt', 'est', 'erat', 'erant', 'fuit', 'qui', 'quam', 'quem', 'quos', 'cuius', 'deus', 'dominus', 'ecclesiae', 'omnes', 'omnia', 'omnibus', 'tamen', 'igitur', 'praesertim', 'sibi', 'suis', 'haec', 'hoc', 'quidem', 'quoque', 'itaque', 'ergo', 'neque', 'nec', 'tamquam', 'deinde', 'unde', 'aetate'],
  fr: ['les', 'des', 'une', 'est', 'dans', 'pour', 'qui', 'que', 'pas', 'plus', 'avec', 'sur', 'nous', 'vous', 'mais', 'tout', 'cette', 'sont', 'être', 'était', 'cœur', 'dieu', 'seigneur', 'même', 'ainsi', 'très'],
  en: ['the', 'and', 'that', 'with', 'this', 'from', 'have', 'which', 'they', 'their', 'been', 'were', 'would', 'about', 'there', 'church', 'god', 'lord', 'faith', 'should', 'these', 'other'],
  it: ['che', 'del', 'della', 'delle', 'nella', 'per', 'con', 'una', 'gli', 'sono', 'anche', 'come', 'più', 'questo', 'questa', 'essere', 'chiesa', 'dio', 'signore', 'nostro', 'perché'],
  pt: ['que', 'não', 'uma', 'com', 'para', 'como', 'mais', 'são', 'pelo', 'pela', 'seus', 'suas', 'igreja', 'deus', 'senhor', 'nosso', 'também', 'porque', 'então'],
  de: ['und', 'der', 'die', 'das', 'den', 'dem', 'des', 'nicht', 'auch', 'ist', 'sind', 'mit', 'für', 'auf', 'einer', 'eine', 'kirche', 'gott', 'herr', 'wird']
};

const NAMES = { es: 'español', la: 'latín', fr: 'francés', en: 'inglés', it: 'italiano', pt: 'portugués', de: 'alemán' };

// Marcas ortográficas exclusivas: valen por varias palabras función porque una
// sola aparición ya descarta a las demás lenguas.
const SIGNATURES = [
  [/[ñ¿¡]/, 'es', 4],
  [/œ|ç|[àâêîôûë]/, 'fr', 3],
  [/[ß]|ä|ö|ü/, 'de', 4],
  [/ã|õ|ç/, 'pt', 2],
  [/æ|œ/, 'la', 1]
];

function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-záéíóúüñàâäèéêëîïôöùûüçãõœæß]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

// Devuelve el código del idioma dominante, o '' cuando el texto es demasiado
// corto o ambiguo para afirmarlo. Preferimos no decir nada antes que etiquetar
// mal un documento.
function detect(text) {
  const tokens = words(text);
  if (tokens.length < 6) return '';
  const counts = {};
  for (const code of Object.keys(MARKERS)) counts[code] = 0;
  const sets = {};
  for (const [code, list] of Object.entries(MARKERS)) sets[code] = new Set(list);
  for (const token of tokens) {
    for (const code of Object.keys(sets)) if (sets[code].has(token)) counts[code]++;
  }
  for (const [pattern, code, weight] of SIGNATURES) if (pattern.test(text)) counts[code] += weight;
  // Morfología latina: el enclítico -que y las desinencias -orum/-arum/-ibus no
  // existen en las lenguas romances modernas, así que una sola aparición ya
  // vale tanto como varias palabras función. Sin esto, una cita latina de una
  // sola frase se quedaba sin identificar.
  for (const token of tokens) {
    if (token.length > 5 && (/(?:orum|arum|ibus)$/.test(token) || /que$/.test(token))) counts.la++;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  // Sin una ventaja clara sobre el segundo candidato no se afirma nada.
  if (bestScore < 2 || bestScore === secondScore) return '';
  return best;
}

function name(code) {
  return NAMES[code] || '';
}

function isSpanish(text) {
  return detect(text) === 'es';
}

module.exports = { detect, name, isSpanish, NAMES };
