/**
 * PreflopReference — Rangos de apertura (RFI) 6-max, explícitos y auditables.
 *
 * POR QUÉ SE REESCRIBIÓ: la versión anterior daba UTG 45.6%, HJ 50.9%,
 * CO 58.0%, BTN 62.7% (¡y CO/BTN/SB idénticos!) y BB "abría" el 66.9% de las
 * manos. Todo eso estaba inventado y era inservible.
 *
 * REGLA DORADA: un rango es una LISTA DE MANOS. Acá vive como notación
 * compacta ("22+,A2s+,KTo+") que EquityCalculator.parseRange() expande a
 * combinaciones concretas. El % de apertura NO está escrito a mano: se
 * CALCULA con el número real de combinaciones, así que es auditable.
 *
 * El % se expresa sobre las 1326 combinaciones posibles (convención de los
 * charts), no sobre las 169 clases de mano.
 */

const EC = require('./EquityCalculator');

const POSICIONES = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/**
 * Rangos RFI 6-max. Cada entrada es notación compacta.
 * Ensanchan de izquierda a derecha siguiendo la posición; la BB no abre,
 * defiende.
 */
// Rangos GTO basados en Red Chip Poker (6-max, 100bb)
const OPEN_RANGES = {
  UTG: {
    spec: '22+,A5s+,K7s+,Q9s+,J9s+,T9s,98s,87s,AJo+,KQo,QJo',
    descripcion: 'Posición temprana (6-max) — rango tight de apertura'
  },
  HJ: {
    spec: '22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,87s,76s,A9o+,KTo+,QTo,JTo',
    descripcion: 'Hijack — rango medio'
  },
  CO: {
    spec: '22+,A2s+,K2s+,Q6s+,J7s+,T7s+,97s+,86s+,76s,65s,54s,A7o+,K9o+,Q9o+,J9o+,T9o',
    descripcion: 'Cutoff — rango amplio'
  },
  BTN: {
    spec: '22+,A2s+,K2s+,Q2s+,J5s+,T5s+,95s+,85s+,75s+,64s,54s,43s,32s,A2o+,K5o+,Q8o+,J8o+,T8o+,98o,87o',
    descripcion: 'Botón — el rango de apertura más amplio'
  },
  SB: {
    spec: '22+,A2s+,K2s+,Q4s+,J7s+,T7s+,97s+,86s+,75s,64s,54s,A2o+,K7o+,Q8o+,J8o+,T8o+,98o',
    descripcion: 'Small blind — abrir (o limpear) rango medio-amplio'
  },
  BB: {
    spec: '22+,A2s+,K2s+,Q5s+,J7s+,T7s+,97s+,87s,76s,65s,54s,A2o+,K8o+,Q9o+,J9o+,T9o',
    descripcion: 'Big blind — DEFENDE, no abre. Este es su rango de call/3bet.'
  }
};

// Rangos de 3-bet basados en Red Chip Poker (6-max, 100bb)
const THREE_BET_RANGES = {
  vs_UTG: {
    raise: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', 'A9o+', 'KJo+', 'QJo'],
    call: ['22+', 'A2s+', 'K5s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A5o+', 'KTo+', 'QTo', 'JTo'],
    fold: ['22-', 'A2s-', 'K4s-', 'Q7s-', 'J7s-', 'T7s-', '96s-', '86s-', '75s-', '65s-', '54s', 'A4o-', 'K9o-', 'Q9o-', 'J9o-', 'T9o-', '98o']
  },
  vs_HJ: {
    raise: ['22+', 'A2s+', 'K7s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', 'A9o+', 'KJo+', 'QJo'],
    call: ['22+', 'A2s+', 'K5s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A5o+', 'KTo+', 'QTo', 'JTo'],
    fold: ['22-', 'A2s-', 'K6s-', 'Q8s-', 'J8s-', 'T8s-', '97s-', '87s-', '76s-', '65s-', '54s', 'A4o-', 'KTo-', 'QTo-', 'JTo-', 'T9o-', '98o']
  },
  vs_CO: {
    raise: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', 'A9o+', 'KJo+', 'QJo'],
    call: ['22+', 'A2s+', 'K5s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A5o+', 'KTo+', 'QTo', 'JTo'],
    fold: ['22-', 'A2s-', 'K8s-', 'Q8s-', 'J8s-', 'T8s-', '97s-', '87s-', '76s-', '65s-', '54s', 'A4o-', 'KTo-', 'QTo-', 'JTo-', 'T9o-', '98o']
  },
  vs_BTN: {
    raise: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', 'A9o+', 'KJo+', 'QJo'],
    call: ['22+', 'A2s+', 'K5s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A5o+', 'KTo+', 'QTo', 'JTo'],
    fold: ['22-', 'A2s-', 'K8s-', 'Q8s-', 'J8s-', 'T8s-', '97s-', '87s-', '76s-', '65s-', '54s', 'A4o-', 'KTo-', 'QTo-', 'JTo-', 'T9o-', '98o']
  },
  vs_SB: {
    raise: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', 'A9o+', 'KJo+', 'QJo'],
    call: ['22+', 'A2s+', 'K5s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A5o+', 'KTo+', 'QTo', 'JTo'],
    fold: ['22-', 'A2s-', 'K8s-', 'Q8s-', 'J8s-', 'T8s-', '97s-', '87s-', '76s-', '65s-', '54s', 'A4o-', 'KTo-', 'QTo-', 'JTo-', 'T9o-', '98o']
  }
};

/** Manos que siempre abren/suben, sin importar la posición. */
const GOLDEN_HANDS = [
  'AA', 'KK', 'QQ', 'JJ', 'TT',
  'AKs', 'AQs', 'AJs', 'ATs',
  'AKo', 'AQo', 'AJo',
  'KQs', 'KJs', 'KTs',
  'QJs', 'QTs', 'JTs'
];

/**
 * Normaliza un código de mano a forma canónica (rank alto primero).
 * OJO: el orden de ranks NO es el alfabético ("A" < "K" como strings pero
 * A(14) > K(13)), así que se compara por índice en RANK_CHARS.
 */
function canon(code) {
  const c = String(code).trim().toUpperCase();
  const m = c.match(/^([2-9TJQKA])([2-9TJQKA])([SO]?)$/);
  if (!m) return null;
  const R = '23456789TJQKA';
  const i1 = R.indexOf(m[1]);
  const i2 = R.indexOf(m[2]);
  const hi = i1 > i2 ? m[1] : m[2];
  const lo = i1 > i2 ? m[2] : m[1];
  return hi + lo + m[3].toLowerCase();
}

class PreflopReference {
  constructor() {
    this._eq = new EC();
    this._cache = new Map();
  }

  getPositions() {
    return POSICIONES.slice();
  }

  /** Notación compacta del rango de una posición. */
  rangeSpecFor(posicion, accion) {
    const pos = String(posicion || '').toUpperCase();
    const r = OPEN_RANGES[pos];
    if (!r) return null;
    // Para la acción se usa el rango de la posición; no hay fuente separada
    // por acción (no se inventa).
    return r.spec;
  }

  /** Rango de la BB: defender, no abrir. */
  isDefendPosition(posicion) {
    return String(posicion || '').toUpperCase() === 'BB';
  }

  /**
   * % REAL de apertura, calculado sobre las 1326 combinaciones.
   * @returns {{porcentaje:number, combinaciones:number, total:number, manos:number}}
   */
  openPct(posicion) {
    const pos = String(posicion || '').toUpperCase();
    if (!OPEN_RANGES[pos]) {
      throw new Error(
        `PreflopReference: posición "${posicion}" no reconocida. ` +
        `Válidas: ${POSICIONES.join(', ')}.`
      );
    }
    if (this._cache.has(pos)) return this._cache.get(pos);

    const parsed = this._eq.parseRange(OPEN_RANGES[pos].spec);
    let combos = 0;
    const clases = new Set();
    for (const e of parsed) {
      combos += e.combos.length;
      for (const c of e.combos) clases.add(this._eq._codeOf(c));
    }
    const total = 1326; // C(52,2)
    const out = {
      posicion: pos,
      combinaciones: combos,
      manos: clases.size,
      total,
      porcentaje: Math.round((combos / total) * 10000) / 100
    };
    this._cache.set(pos, out);
    return out;
  }

  /**
   * Consulta la tabla preflop para una mano y posición.
   * @param {string} handCode "97s", "AKo"
   * @param {string} posicion UTG, HJ, CO, BTN, SB, BB
   * @returns {{action:string, color:string, reason:string, position:string}}
   */
  consult(handCode, posicion) {
    const pos = String(posicion || 'BTN').toUpperCase();
    const code = canon(handCode);
    if (!code) {
      throw new Error(
        `PreflopReference: mano "${handCode}" inválida. Se espera algo como "97s", "AKo", "TT".`
      );
    }
    if (!OPEN_RANGES[pos]) {
      return {
        action: 'FOLD',
        color: 'gray',
        reason: `Posición "${pos}" no reconocida. Posiciones válidas: ${POSICIONES.join(', ')}.`,
        position: pos
      };
    }

    const desc = OPEN_RANGES[pos].descripcion;

    // La BB no abre: defiende o foldea.
    if (pos === 'BB') {
      if (this._inRange(code, pos)) {
        return {
          action: 'CALL',
          color: 'green',
          reason: `Big blind: no se abre. ${code} está en el rango de defensa. ${desc}.`,
          position: pos
        };
      }
      return {
        action: 'FOLD',
        color: 'gray',
        reason: `Big blind: ${code} fuera del rango de defensa. ${desc}.`,
        position: pos
      };
    }

    if (this._inRange(code, pos)) {
      const color = code.endsWith('s') ? 'green' : code.endsWith('o') ? 'yellow'
        : (GOLDEN_HANDS.includes(code) ? 'gold' : 'green');
      const reason = GOLDEN_HANDS.includes(code)
        ? `Mano dorada: ${code} abre desde cualquier posición. ${desc}.`
        : `${code} está en el rango de apertura de ${pos}. ${desc}.`;
      return { action: 'RAISE', color, reason, position: pos };
    }

    return {
      action: 'FOLD',
      color: 'gray',
      reason: `${code} NO está en el rango de apertura de ${pos}. ${desc}.`,
      position: pos
    };
  }

  /**
   * ¿La mano está en el rango de la posición?
   * Compara CLASSES de mano, así que hay que expandir los combos del rango
   * (no sirve comparar el token "A2s+" contra "AKs").
   */
  _inRange(code, pos) {
    if (!this._classCache) this._classCache = new Map();
    let set = this._classCache.get(pos);
    if (!set) {
      set = new Set();
      for (const e of this._eq.parseRange(OPEN_RANGES[pos].spec)) {
        for (const c of e.combos) set.add(this._eq._codeOf(c));
      }
      this._classCache.set(pos, set);
    }
    return set.has(code);
  }

  _handName(code) {
    const names = { T: '10', A: 'As', K: 'Rey', Q: 'Reina', J: 'Jota' };
    return String(code).split('').map(c => names[c] || c).join('');
  }

  _rankName(r) {
    const names = { T: '10', A: 'Ases', K: 'Reyes', Q: 'Reinas', J: 'Jotas' };
    return names[r] || `${r}s`;
  }
}

module.exports = PreflopReference;
module.exports.POSICIONES = POSICIONES;
