/**
 * handRanker — Evaluador de manos de póker CORRECTO y verificable.
 *
 * Reglas duras (ver test/handRanker.test.js):
 *  - Menor número = MEJOR mano. Se usa `<` para comparar.
 *  - Los kickers se comparan DENTRO de cada categoría, de mayor a menor.
 *  - La rueda (A-2-3-4-5) vale 5 alto, NUNCA Broadway.
 *  - Funciona con 5, 6 y 7 cartas.
 *
 * API:
 *   rankCards(cards)  -> entero comparable (menor = mejor)
 *   rank(board, hole) -> entero comparable
 *   describe(value)   -> nombre en español de la categoría
 *
 * Carta: { rank: number 2..14, suit: 's'|'h'|'d'|'c' }
 */

const SUITS = ['s', 'h', 'd', 'c'];
const RANK_CHARS = '23456789TJQKA';

// Categorías: menor = mejor
const CAT = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8
};

const CAT_NAMES = {
  0: 'carta alta',
  1: 'par',
  2: 'dos pares',
  3: 'trío',
  4: 'escalera',
  5: 'color',
  6: 'full house',
  7: 'cuatro iguales',
  8: 'escalera de color'
};

/**
 * Empaqueta categoría + kickers en un entero. MENOR = MEJOR.
 *
 * Se invierte TODO (categoría y cada kicker), porque el orden de poker es
 * "gana el rango más alto" pero el orden numérico interno es al revés:
 *   - categoría: la 8 (escalera de color) es la mejor, así que 9 - cat.
 *   - kickers: un kicker más alto es MEJOR, así que 15 - kicker. Sin esto,
 *     "QQ kicker 3" salía PEOR que "QQ kicker 2" (el bug 2 del motor viejo).
 *
 * Regla de oro: par de ases < par de reyes, porque mismo kicker y mejor par.
 */
function pack(cat, kickers) {
  const inv = 9 - cat; // 8 -> 1 (mejor), 0 -> 9 (peor)
  let v = inv * 0x100000; // 20 bits de categoría
  for (let i = 0; i < 5; i++) {
    const k = kickers[i] || 0;
    v += (15 - k) * Math.pow(16, 4 - i); // 4 bits por kicker, invertido
  }
  return v;
}

/** Normaliza y valida una carta. Lanza si está duplicada o es inválida. */
function normalizeCard(c, ctx) {
  if (!c || typeof c !== 'object') {
    throw new Error(`handRanker: carta inválida en ${ctx}: ${JSON.stringify(c)}`);
  }
  if (typeof c.rank !== 'number' || c.rank < 2 || c.rank > 14 || !Number.isInteger(c.rank)) {
    throw new Error(`handRanker: rank inválido en ${ctx} (esperado 2..14, recibido ${c.rank})`);
  }
  if (!SUITS.includes(c.suit)) {
    throw new Error(`handRanker: palo inválido en ${ctx} (esperado s|h|d|c, recibido "${c.suit}")`);
  }
  return { rank: c.rank, suit: c.suit };
}

/** Convierte "Ah" / "Td" a {rank, suit}. */
function card(str, ctx = 'entrada') {
  if (typeof str !== 'string' || str.length !== 2) {
    throw new Error(`handRanker: carta "${str}" mal formada en ${ctx} (se espera 2 chars, ej. "Ah")`);
  }
  const r = str[0].toUpperCase();
  const s = str[1].toLowerCase();
  if (!RANK_CHARS.includes(r)) {
    throw new Error(`handRanker: rank inválido en ${ctx} ("${str}") — se esperaba 2-9, T, J, Q, K o A`);
  }
  if (!SUITS.includes(s)) {
    throw new Error(`handRanker: palo inválido en ${ctx} ("${str}") — se esperaba s, h, d o c`);
  }
  return { rank: RANK_CHARS.indexOf(r) + 2, suit: s };
}

/** Parsea "AhKh" o "Ah Kh" -> [ {rank,suit}, {rank,suit} ] */
function fromString(str, ctx = 'fromString') {
  if (typeof str !== 'string') {
    throw new Error(`handRanker: ${ctx} necesita un string tipo "AhKh", recibido ${typeof str}`);
  }
  const clean = str.replace(/[\s,|-]/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error(`handRanker: "${str}" en ${ctx} tiene longitud impar, se esperan cartas de 2 caracteres`);
  }
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(card(clean.slice(i, i + 2), ctx));
  return out;
}

/** Convierte una lista de strings a cartas. */
function toCards(list, ctx) {
  if (!Array.isArray(list)) {
    throw new Error(`handRanker: ${ctx} debe ser un array de cartas, recibido ${typeof list}`);
  }
  return list.map(x => (typeof x === 'string' ? card(x, ctx) : normalizeCard(x, ctx)));
}

function cardKey(c) {
  return `${c.rank}${c.suit}`;
}

/**
 * Detecta escalera en un set de ranks únicos (descendente). Devuelve el 5 alto o 0.
 * Primero las escaleras normales (más alta gana) y después la rueda.
 */
function straightHigh(uniqueDesc) {
  if (uniqueDesc.length < 5) return 0;

  // 1) Escaleras normales, de la más alta a la más baja. Deben ganarle a la
  //    rueda: A-K-Q-J-T vale 14, no 5.
  for (let i = 0; i + 4 < uniqueDesc.length; i++) {
    if (uniqueDesc[i] - uniqueDesc[i + 4] === 4) {
      return uniqueDesc[i];
    }
  }

  // 2) Rueda: si están A,5,4,3,2 vale 5 alto. Se busca por CONJUNTO y no
  //    entre los 5 ranks más altos: con cartas extra (p.ej. Q,T) por encima la
  //    rueda igual existe. Ej: 3,T,A,2,Q,4,5 tiene rueda.
  const set = new Set(uniqueDesc);
  if (set.has(14) && set.has(5) && set.has(4) && set.has(3) && set.has(2)) {
    return 5;
  }
  return 0;
}

/** Evalúa el MEJOR 5 de un conjunto de 5, 6 o 7 cartas. */
function rankCards(cards) {
  const cs = toCards(cards, 'rankCards');
  if (cs.length < 5 || cs.length > 7) {
    throw new Error(`handRanker: se necesitan entre 5 y 7 cartas, recibido ${cs.length}`);
  }
  const seen = new Set();
  for (const c of cs) {
    const k = cardKey(c);
    if (seen.has(k)) {
      throw new Error(`handRanker: carta duplicada ${k} — una mano no puede repetir carta`);
    }
    seen.add(k);
  }

  // 1) Flush: ¿5+ del mismo palo?
  const bySuit = { s: [], h: [], d: [], c: [] };
  for (const c of cs) bySuit[c.suit].push(c.rank);

  let flushRanks = null;
  for (const s of SUITS) {
    if (bySuit[s].length >= 5) {
      flushRanks = bySuit[s].slice().sort((a, b) => b - a);
      break; // solo puede haber un palo con 5+
    }
  }

  // 2) Escalera sobre los 7 ranks
  const uniqueDesc = [...new Set(cs.map(c => c.rank))].sort((a, b) => b - a);
  const str = straightHigh(uniqueDesc);

  // 3) Flush de escalera
  if (flushRanks) {
    const flushUniqueDesc = [...new Set(flushRanks)].sort((a, b) => b - a);
    const flushStr = straightHigh(flushUniqueDesc);
    if (flushStr > 0) {
      return pack(CAT.STRAIGHT_FLUSH, [flushStr]);
    }
  }

  // 4) Conteos por rank
  const counts = new Map();
  for (const c of cs) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  const groups = [...counts.entries()]
    .map(([rank, n]) => ({ rank, n }))
    .sort((a, b) => (b.n - a.n) || (b.rank - a.rank)); // más cartas primero, rank alto primero

  const quads = groups.find(g => g.n === 4);
  const trips = groups.filter(g => g.n === 3);
  const pairs = groups.filter(g => g.n === 2);

  if (quads) {
    // Kicker = rank MÁS ALTO restante (no el primero de `groups`, que viene
    // ordenado por nº de cartas: un par suelto puede preceder a un as suelto).
    const otros = groups.filter(g => g.rank !== quads.rank).map(g => g.rank);
    const kicker = otros.length ? Math.max(...otros) : 0;
    return pack(CAT.QUADS, [quads.rank, kicker]);
  }

  if (trips.length > 0) {
    // Full house: el trío más alto es el "trío"; el segundo trío sirve de par si es más alto
    // que cualquier par suelto.
    const t = trips[0];
    const otherTrip = trips[1];
    let pairRank;
    if (otherTrip) {
      pairRank = otherTrip.rank;
    } else {
      pairRank = pairs.length > 0 ? pairs[0].rank : 0;
    }
    if (pairRank > 0) {
      return pack(CAT.FULL_HOUSE, [t.rank, pairRank]);
    }
  }

  if (flushRanks) {
    return pack(CAT.FLUSH, flushRanks.slice(0, 5));
  }

  if (str > 0) {
    return pack(CAT.STRAIGHT, [str]);
  }

  if (trips.length > 0) {
    const t = trips[0];
    const kickers = groups
      .filter(g => g.rank !== t.rank)
      .map(g => g.rank)
      .sort((a, b) => b - a)
      .slice(0, 2);
    return pack(CAT.TRIPS, [t.rank, ...kickers]);
  }

  // >= 2 y no === 2: con TRES pares (p.ej. QQ-44-22 sobre un board) hay que
  // quedarse con los dos más altos y NO caer a "carta alta".
  if (pairs.length >= 2) {
    const [p1, p2] = pairs; // ya vienen ordenadas de mayor a menor
    // Kicker = rank MÁS ALTO que no sea ninguno de los dos pares. Con tres
    // pares (AA-JJ-77) y un T suelto, el kicker es T, no 7: `groups` viene
    // ordenado por (n, rank), así que un par suelto precede a una carta alta.
    const otros = groups
      .filter(g => g.rank !== p1.rank && g.rank !== p2.rank)
      .map(g => g.rank);
    const kicker = otros.length ? Math.max(...otros) : 0;
    return pack(CAT.TWO_PAIR, [p1.rank, p2.rank, kicker]);
  }

  if (pairs.length === 1) {
    const p = pairs[0];
    const kickers = groups
      .filter(g => g.rank !== p.rank)
      .map(g => g.rank)
      .sort((a, b) => b - a)
      .slice(0, 3);
    return pack(CAT.PAIR, [p.rank, ...kickers]);
  }

  return pack(CAT.HIGH_CARD, uniqueDesc.slice(0, 5));
}

/** rank(board, hole) -> entero comparable (menor = mejor). */
function rank(board, hole) {
  const b = toCards(board || [], 'board');
  const h = toCards(hole, 'hole');
  if (h.length !== 2) {
    throw new Error(`handRanker: la mano propia deben ser exactamente 2 cartas, recibido ${h.length}`);
  }
  return rankCards([...b, ...h]);
}

/** Compara dos manos (formato {board, hole}) -> {winner, margin} */
function compare(a, b) {
  const ra = rank(a.board, a.hole);
  const rb = rank(b.board, b.hole);
  return { hero: ra, villain: rb, winner: ra < rb ? 'hero' : (rb < ra ? 'villain' : 'tie') };
}

/** Categoría ORIGINAL de poker (0=carta alta ... 8=escalera de color). */
function categoryOf(value) {
  return 9 - Math.floor(value / 0x100000);
}

function describe(value) {
  return CAT_NAMES[categoryOf(value)] || 'desconocida';
}

module.exports = {
  rank,
  rankCards,
  compare,
  describe,
  categoryOf,
  card,
  fromString,
  toCards,
  CAT,
  CAT_NAMES,
  SUITS
};
