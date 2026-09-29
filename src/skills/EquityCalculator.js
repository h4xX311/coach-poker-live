/**
 * EquityCalculator — Equity REAL contra un rango declarado.
 *
 * REGLAS (ver test/equity.test.js):
 *  - Preflop reparte las 5 comunitarias. AA vs KK da ~82%, NUNCA 100%.
 *  - Postflop completa el board hasta 5 cartas y compara con handRanker.
 *  - El rival se sortea SIEMPRE de la lista de manos del rango declarado.
 *    Un rango es una LISTA DE MANOS, no una bolsa de cartas sueltas.
 *  - Todo número sale con un test que lo defiende. Si algo no se puede
 *    calcular, se BLOQUEA con un throw en español (no se inventa).
 *
 * API:
 *   parseRange("TT+,AKs")     -> [{code, combos:[[c,c],...]}]
 *   calculate(hero, range, board, opts) -> {equity, wins, ties, losses, ...}
 *   calculateVsRandom(hero, board, opts)
 *   generateRange(position, action)      -> rango real por posición
 */

const HR = require('./handRanker');

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SUITS = ['s', 'h', 'd', 'c'];
const RANK_CHARS = '23456789TJQKA';

// Límite de evaluaciones para enumeración EXACTA. Por encima, Monte Carlo.
const EXACT_EVAL_LIMIT = 4_000_000;

function ckey(c) { return `${c.rank}${c.suit}`; }

function fullDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push({ rank: r, suit: s });
  return d;
}

const DECK = fullDeck();

/** RNG determinista (mulberry32) para que los tests sean reproducibles. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Combinaciones C(n,k) como array de índices. */
function* combinations(n, k) {
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  while (true) {
    yield idx;
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

class EquityCalculator {
  /**
   * Convierte una entrada a lista de cartas. Acepta "AhKh", "Ah Kh",
   * ["Ah","Kh"] o [{rank,suit},...].
   */
  _toCards(x, ctx) {
    if (x == null) return [];
    if (typeof x === 'string') return HR.fromString(x, ctx);
    if (Array.isArray(x)) {
      if (x.length === 0) return [];
      if (typeof x[0] === 'string') return HR.fromString(x.join(''), ctx);
      return HR.toCards(x, ctx);
    }
    throw new Error(`EquityCalculator: no entiendo las cartas de ${ctx} (recibido ${typeof x})`);
  }

  /**
   * Expande notación de rango a combos concretos.
   * Soporta: "TT+", "A2s+", "KQo", "AKs", "AK" (cualquiera), "77".
   * @returns {Array<{code: string, combos: Array<[card, card]>}>}
   */
  parseRange(spec) {
    if (Array.isArray(spec)) {
      // Ya viene como lista de manos -> normalizar
      return this._normalizeRangeList(spec);
    }
    if (typeof spec !== 'string' || !spec.trim()) {
      throw new Error('EquityCalculator: rango vacío o inválido. Usa algo como "TT+,AKs"');
    }
    const out = [];
    for (const raw of spec.split(',')) {
      const tok = raw.trim();
      if (!tok) continue;

      // Cartas concretas: "KsKh" -> una única combinación
      if (/^[2-9TJQKA][shdcSHDC][2-9TJQKA][shdcSHDC]$/.test(tok)) {
        out.push({ code: this._codeOf(HR.fromString(tok, 'rango')), combos: [HR.fromString(tok, 'rango')] });
        continue;
      }

      const m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([soSO]?)(\+?)$/);
      if (!m) {
        throw new Error(
          `EquityCalculator: no entiendo el token de rango "${tok}". ` +
          `Formatos válidos: "TT+", "A2s+", "KQo", "AKs", "AK", "77".`
        );
      }
      const hi = RANK_CHARS.indexOf(m[1].toUpperCase()) + 2;
      const lo = RANK_CHARS.indexOf(m[2].toUpperCase()) + 2;
      const suited = /s/i.test(m[3]);
      const offsuit = /o/i.test(m[3]);
      const plus = m[4] === '+';
      const code = `${m[1].toUpperCase()}${m[2].toUpperCase()}${m[3].toUpperCase()}${plus ? '+' : ''}`;

      if (hi === lo) {
        // Par. Sin "+" es SOLO ese par; con "+" sube hasta el as.
        const ranks = plus ? RANKS.filter(r => r >= hi) : [hi];
        const combos = [];
        for (const r of ranks) {
          for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
              combos.push([{ rank: r, suit: SUITS[i] }, { rank: r, suit: SUITS[j] }]);
            }
          }
        }
        out.push({ code, combos });
      } else {
        const top = Math.max(hi, lo);
        const bot = Math.min(hi, lo);
        const combos = [];
        // Sin sufijo ("AK") = cualquiera (suited + offsuit).
        // Con "+" el kicker va desde `bot` hasta el rango inmediatamente
        // inferior a `top` (excluido; si no "Q8s+" generaba un QQ).
        const kickers = plus ? RANKS.filter(r => r >= bot && r < top) : [bot];
        const wantSuited = !offsuit;
        const wantOffsuit = !suited;
        for (const r of kickers) {
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              if (i === j) {
                if (wantSuited) combos.push([{ rank: top, suit: SUITS[i] }, { rank: r, suit: SUITS[j] }]);
              } else if (wantOffsuit) {
                combos.push([{ rank: top, suit: SUITS[i] }, { rank: r, suit: SUITS[j] }]);
              }
            }
          }
        }
        out.push({ code, combos });
      }
    }
    if (out.length === 0) {
      throw new Error('EquityCalculator: el rango no contenía ninguna mano válida');
    }
    return out;
  }

  /**
   * Acepta varias formas de rango:
   *   - [["As","Ks"], ...]   listas de cartas
   *   - ["AsKs", ...]        manos como texto
   *   - [{code, combos}, ...] la salida de parseRange/generateRange (lo que
   *     usa workflow.js) — así el rango se puede pasar tal cual.
   */
  _normalizeRangeList(spec) {
    const out = [];
    for (const item of spec) {
      // Salida de parseRange: {code, combos:[card,card]}
      if (item && typeof item === 'object' && !Array.isArray(item) && Array.isArray(item.combos)) {
        for (const combo of item.combos) {
          out.push({ code: item.code, combos: [combo] });
        }
        continue;
      }
      let cards;
      if (typeof item === 'string') {
        cards = HR.fromString(item, 'rango');
      } else if (Array.isArray(item)) {
        cards = typeof item[0] === 'string'
          ? HR.fromString(item.join(''), 'rango')
          : HR.toCards(item, 'rango');
      } else {
        throw new Error('EquityCalculator: mano de rango con formato desconocido');
      }
      if (cards.length !== 2) {
        throw new Error('EquityCalculator: cada mano del rango debe tener 2 cartas');
      }
      out.push({ code: this._codeOf(cards), combos: [cards] });
    }
    if (out.length === 0) {
      throw new Error('EquityCalculator: el rango no contenía ninguna mano válida');
    }
    return out;
  }

  _codeOf(cards) {
    const [a, b] = cards;
    const hi = RANK_CHARS[a.rank - 2], lo = RANK_CHARS[b.rank - 2];
    const suited = a.suit === b.suit;
    const sfx = a.rank === b.rank ? '' : (suited ? 's' : 'o');
    return a.rank >= b.rank ? `${hi}${lo}${sfx}` : `${lo}${hi}${sfx}`;
  }

  /**
   * Quita del rango las manos que pisan cartas ya usadas (héroe o board).
   * @returns {{comboList: Array, total: number, bloqueadas: number}}
   */
  _legalCombos(rangeSpec, used) {
    const usedKeys = new Set(used.map(ckey));
    const parsed = this.parseRange(rangeSpec);
    const comboList = [];
    let bloqueadas = 0;
    for (const entry of parsed) {
      for (const combo of entry.combos) {
        const k0 = ckey(combo[0]), k1 = ckey(combo[1]);
        if (usedKeys.has(k0) || usedKeys.has(k1)) { bloqueadas++; continue; }
        comboList.push({ code: entry.code, cards: combo });
      }
    }
    if (comboList.length === 0) {
      throw new Error(
        'EquityCalculator: TODAS las manos del rango están bloqueadas por cartas ya ' +
        'repartidas (héroe o board). Revisar la entrada.'
      );
    }
    return { comboList, total: comboList.length, bloqueadas };
  }

  /**
   * Equity de la mano del héroe contra el rango, repartiendo el board.
   *
   * @param {string|string[]} hero  "AhKh"
   * @param {string|Array} villainRange "TT+,AKs" o lista de manos
   * @param {string|string[]} board  "" preflop, "Td9d4c" flop, "Td9d4c2h" turn
   * @param {object} opts {iterations, seed, metodo: 'auto'|'exact'|'montecarlo'}
   */
  calculate(hero, villainRange, board = [], opts = {}) {
    const heroCards = this._toCards(hero, 'héroe');
    if (heroCards.length !== 2) {
      throw new Error('EquityCalculator: se necesitan exactamente 2 cartas del héroe');
    }
    const boardCards = this._toCards(board, 'board');
    if (boardCards.length > 5) {
      throw new Error(`EquityCalculator: el board no puede tener más de 5 cartas, tiene ${boardCards.length}`);
    }
    const used = [...heroCards, ...boardCards];
    const { comboList, total, bloqueadas } = this._legalCombos(villainRange, used);

    const deck = DECK.filter(c => !used.some(u => ckey(u) === ckey(c)));
    const faltan = 5 - boardCards.length;

    // ¿Exacto o Monte Carlo?
    let metodo = opts.metodo || 'auto';
    if (metodo === 'auto') {
      let evals = 0;
      for (let k = 0; k <= faltan; k++) {
        // C(n,k) aproximado
        evals += nCk(deck.length, k);
      }
      evals *= total;
      metodo = evals <= EXACT_EVAL_LIMIT ? 'exact' : 'montecarlo';
    }
    if (metodo === 'exact' && total * nCk(deck.length, faltan) > EXACT_EVAL_LIMIT * 4) {
      throw new Error(
        `EquityCalculator: la enumeración exacta sería de ~${total * nCk(deck.length, faltan)} ` +
        `evaluaciones y supera el límite (${EXACT_EVAL_LIMIT * 4}). Usá metodo:'montecarlo'.`
      );
    }

    if (faltan === 0) {
      return this._exactFixedBoard(heroCards, comboList, boardCards, { total, bloqueadas, deck, faltan, metodo });
    }
    if (metodo === 'exact') {
      return this._exact(heroCards, comboList, boardCards, deck, faltan, { total, bloqueadas });
    }
    return this._montecarlo(heroCards, comboList, boardCards, deck, faltan, { total, bloqueadas, opts });
  }

  /** Board ya completo (5 cartas): 1 evaluación por mano del rango. */
  _exactFixedBoard(hero, comboList, board, meta) {
    const hr = HR.rank(board, hero);
    let wins = 0, ties = 0, losses = 0;
    const porMano = new Map();
    for (const c of comboList) {
      const vr = HR.rank(board, c.cards);
      let res;
      if (hr < vr) res = 1; else if (hr > vr) res = -1; else res = 0;
      if (res > 0) wins++; else if (res === 0) ties++; else losses++;
      const e = porMano.get(c.code) || { code: c.code, wins: 0, total: 0, losses: 0 };
      e.total++;
      if (res > 0) e.wins++; if (res < 0) e.losses++;
      porMano.set(c.code, e);
    }
    return this._result(hero, board, comboList, wins, ties, losses, meta, 'exact', 1, porMano);
  }

  /** Enumeración exacta de todas las completaciones del board. */
  _exact(hero, comboList, board, deck, faltan, meta) {
    let wins = 0, ties = 0, losses = 0;
    const porMano = new Map();
    const boardBase = board.slice();
    for (const c of comboList) {
      const tomados = [ckey(c.cards[0]), ckey(c.cards[1])];
      const posibles = deck.filter(d => !tomados.includes(ckey(d)));

      for (const idx of combinations(posibles.length, faltan)) {
        const full = boardBase.concat(idx.map(i => posibles[i]));
        const hr = HR.rankCards(full.concat(hero));
        const vr = HR.rankCards(full.concat(c.cards));
        let res;
        if (hr < vr) res = 1; else if (hr > vr) res = -1; else res = 0;
        if (res > 0) wins++; else if (res === 0) ties++; else losses++;
        const e = porMano.get(c.code) || { code: c.code, wins: 0, total: 0, losses: 0 };
        e.total++;
        if (res > 0) e.wins++; if (res < 0) e.losses++;
        porMano.set(c.code, e);
      }
    }
    const iter = wins + ties + losses;
    return this._result(hero, board, comboList, wins, ties, losses, meta, 'exact', iter, porMano);
  }

  /** Monte Carlo: sortea mano del rango + board. */
  _montecarlo(hero, comboList, board, deck, faltan, { total, bloqueadas, opts }) {
    const iterations = opts.iterations || 200_000;
    const seed = opts.seed != null ? opts.seed : hashSeed(JSON.stringify({
      h: hero.map(ckey), r: comboList.length, b: board.map(ckey), n: faltan, i: iterations
    }));
    const rnd = mulberry32(seed);
    const boardBase = board.slice();
    const deckIdx = deck.map((_, i) => i);

    let wins = 0, ties = 0, losses = 0;
    const porMano = new Map();

    for (let it = 0; it < iterations; it++) {
      // Primero la mano del rival, DESPUÉS el board: así el runout nunca
      // puede caerme sobre una carta suya (el ranker lo detectaría y es un bug).
      const c = comboList[Math.floor(rnd() * comboList.length)];
      const tomados = new Set([ckey(c.cards[0]), ckey(c.cards[1])]);
      const avail = deckIdx.filter(i => !tomados.has(ckey(deck[i])));

      // Fisher-Yates parcial sobre `avail` para elegir `faltan` cartas
      for (let k = 0; k < faltan; k++) {
        const j = k + Math.floor(rnd() * (avail.length - k));
        const t = avail[k]; avail[k] = avail[j]; avail[j] = t;
      }
      const runout = [];
      for (let k = 0; k < faltan; k++) runout.push(deck[avail[k]]);

      const full = boardBase.concat(runout);
      const hr = HR.rankCards(full.concat(hero));
      const vr = HR.rankCards(full.concat(c.cards));
      let res;
      if (hr < vr) res = 1; else if (hr > vr) res = -1; else res = 0;
      if (res > 0) wins++; else if (res === 0) ties++; else losses++;
      const e = porMano.get(c.code) || { code: c.code, wins: 0, total: 0, losses: 0 };
      e.total++;
      if (res > 0) e.wins++; if (res < 0) e.losses++;
      porMano.set(c.code, e);
    }
    return this._result(hero, board, comboList, wins, ties, losses, { total, bloqueadas }, 'montecarlo', iterations, porMano, seed);
  }

  _result(hero, board, comboList, wins, ties, losses, meta, metodo, iteraciones, porMano, seed) {
    const equity = ((wins + ties / 2) / iteraciones) * 100;
    // Qué mano te mata y con qué frecuencia
    const killers = [...porMano.values()]
      .map(e => ({
        mano: e.code,
        vecesQueTeMate: e.losses,
        vecesQueGanaste: e.wins,
        equityVsTu: e.total > 0 ? (((e.wins + 0) / e.total) * 100) : 0,
        frecuenciaComoMate: iteraciones > 0 ? (e.losses / iteraciones) * 100 : 0
      }))
      .filter(k => k.vecesQueTeMate > 0)
      .sort((a, b) => b.frecuenciaComoMate - a.frecuenciaComoMate)
      .slice(0, 6);

    const out = {
      tuMano: hero.map(c => `${RANK_CHARS[c.rank - 2]}${c.suit}`).join(''),
      board: board.map(c => `${RANK_CHARS[c.rank - 2]}${c.suit}`).join(''),
      equity: Math.round(equity * 100) / 100,
      wins, ties, losses,
      total: iteraciones,
      metodo,
      iteraciones,
      manosEnRango: meta.total,
      manosBloqueadas: meta.bloqueadas,
      teMatan: killers
    };
    if (seed != null) out.seed = seed;
    return out;
  }

  /** Equity contra TODAS las manos legales (no un rango declarado). */
  calculateVsRandom(hero, board = [], opts = {}) {
    const heroCards = this._toCards(hero, 'héroe');
    const boardCards = this._toCards(board, 'board');
    const used = [...heroCards, ...boardCards];
    const usedKeys = new Set(used.map(ckey));
    const comboList = [];
    for (let i = 0; i < DECK.length; i++) {
      for (let j = i + 1; j < DECK.length; j++) {
        if (usedKeys.has(ckey(DECK[i])) || usedKeys.has(ckey(DECK[j]))) continue;
        comboList.push({ code: this._codeOf([DECK[i], DECK[j]]), cards: [DECK[i], DECK[j]] });
      }
    }
    if (comboList.length === 0) {
      throw new Error('EquityCalculator: no quedan manos legales para calcular equity');
    }
    const deck = DECK.filter(c => !used.some(u => ckey(u) === ckey(c)));
    const faltan = 5 - boardCards.length;
    if (faltan === 0) {
      return this._exactFixedBoard(heroCards, comboList, boardCards, { total: comboList.length, bloqueadas: 0, deck, faltan });
    }
    if ((opts.metodo || 'auto') === 'exact' || (opts.metodo || 'auto') === 'auto') {
      // vs random el exacto preflop es gigantesco -> MC
      return this._montecarlo(heroCards, comboList, boardCards, deck, faltan, {
        total: comboList.length, bloqueadas: 0, opts
      });
    }
    return this._montecarlo(heroCards, comboList, boardCards, deck, faltan, {
      total: comboList.length, bloqueadas: 0, opts
    });
  }

  /**
   * Rango del rival por posición/acción. DELGADO a PreflopReference para no
   * duplicar la fuente de verdad. Si la posición no existe, BLOQUEA.
   */
  generateRange(position, action) {
    const PreflopReference = require('./PreflopReference');
    const ref = new PreflopReference();
    const pos = (position || '').toUpperCase();
    if (!pos) {
      throw new Error(
        'EquityCalculator: generateRange necesita una posición válida ' +
        `(UTG, HJ, CO, BTN, SB, BB). Recibido: "${position}".`
      );
    }
    const spec = ref.rangeSpecFor(pos, action);
    if (!spec) {
      throw new Error(
        `EquityCalculator: no hay rango definido para posición "${pos}" / acción "${action}". ` +
        'Sin fuente real de rango, BLOQUEADO (no se inventa).'
      );
    }
    return this.parseRange(spec);
  }
}

function nCk(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

module.exports = EquityCalculator;
module.exports.mulberry32 = mulberry32;
module.exports.nCk = nCk;
