/**
 * PreflopReference — rangos de apertura (RFI) 6-max, con FUENTE REAL y
 * percentages verificables.
 *
 * ═══════════════════════════════════════════════════════════════════
 * FUENTE (citada, auditable):
 *   Poker Skill — "Preflop chart library", 6-max opening ranges
 *   https://www.pokerskill.com/charts/preflop/pokerskill-preflop-charts.pdf
 *   Descargado y renderizado a imagen (10 páginas) el 2026-09-30.
 *   Contexto declarado por la propia fuente: "6-handed cash game, about 100
 *   big blinds deep, action folded to you".
 *
 * POR QUÉ SE REESCRIBIÓ POR COMPLETO: la versión anterior decía "rangos GTO
 * basados en Red Chip Poker" — una fuente que nadie verificó, sin URL y sin
 * documento. Sus porcentajes calculadosaban 3 a 12 puntos PORCENTUALES más
 * de lo que la fuente real dice:
 *
 *   Posición   inventado   Poker Skill (real)   delta
 *   UTG          17.35%          14.3%         +3.05
 *   HJ           24.89%          18.9%          +5.99
 *   CO           34.24%          25.5%          +8.74
 *   BTN          51.13%          43.3%          +7.83
 *   SB           44.80%          33.0%         +11.80
 *
 *   Abrir 51% en BTN en vez de 43% es jugar 8 puntos de más: dinero real.
 *
 * LA BB NO ABRE. La versión anterior le daba un rango de "apertura" de 39.67%
 * cuando la BB no abre: es un error de concepto, no un número. Este chart NO
 * trae una página de BB, así que no hay fuente y NO SE INVENTA: queda BLOQUEADA.
 *
 * ═══════════════════════════════════════════════════════════════════
 * REGLA DORADA:
 *  - El rango es una LISTA DE MANOS (notación compacta) que EquityCalculator
 *    expande a combinaciones concretas. El % se CALCULA, no se escribe a mano.
 *  - Se guarda el % IMPRESO en el chart como dato de referencia, y se guarda
 *    el % CALCULADO aparte. Cuando los dos no coinciden, se muestran los dos.
 *    NO se ajusta el rango para forzar que coincidan (eso sería falsificar).
 *  - Sin fuente → null → el llamador BLOQUEA.
 */

const EC = require('./EquityCalculator');

const POSICIONES = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSICIONES_QUE_ABREN = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

const FUENTE = {
  nombre: 'Poker Skill — Preflop chart library',
  url: 'https://www.pokerskill.com/charts/preflop/pokerskill-preflop-charts.pdf',
  contexto: '6-handed cash game, ~100bb deep, action folded to you',
  descargado: '2026-09-30',
  metodo: 'PDF descargado y renderizado a imagen (pypdfium2, 1530x1980). ' +
    'Rangos transcritos de las celdas verdes y del texto del encabezado de cada página.'
};

/**
 * Rangos RFI 6-max transcritos de las páginas 2 a 6 del chart.
 * `porcentajeImpreso` es el número que la fuente imprime en su encabezado.
 */
const OPEN_RANGES = {
  UTG: {
    // El encabezado del chart dice "A5s-A2s". El parser no entiende el guion
    // de rango, así que va expandido a mano: A5s,A4s,A3s,A2s. Mismo rango.
    spec: '22+,ATs+,A5s,A4s,A3s,A2s,KTs+,QTs+,JTs,T9s,98s,AJo+,KQo',
    porcentajeImpreso: 14.3,
    pagina: 2,
    descripcion: 'Under the gun: rango de apertura más cerrado del 6-max.'
  },
  HJ: {
    spec: '22+,A2s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,ATo+,KJo+',
    porcentajeImpreso: 18.9,
    pagina: 3,
    descripcion: 'Hijack: rango medio.'
  },
  CO: {
    spec: '22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,87s,76s,65s,54s,A8o+,KTo+,QJo',
    porcentajeImpreso: 25.5,
    pagina: 4,
    descripcion: 'Cutoff: rango amplio.'
  },
  BTN: {
    spec: '22+,A2s+,K2s+,Q4s+,J6s+,T6s+,95s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T9o,98o',
    porcentajeImpreso: 43.3,
    pagina: 5,
    descripcion: 'Botón: el rango de apertura más amplio del 6-max.'
  },
  SB: {
    spec: '22+,A2s+,K4s+,Q6s+,J7s+,T7s+,96s+,86s+,76s,65s,54s,A5o+,K9o+,QTo+,JTo',
    porcentajeImpreso: 33.0,
    pagina: 6,
    descripcion: 'Small blind: rango de apertura/limpeo.'
  },
  BB: {
    // BUG CONCEPTUAL CORREGIDO (2026-10-02): antes decía "no hay fuente".
    // Sí la hay, en otra página del mismo sitio que el PDF:
    // https://www.pokerskill.com/charts/opening-ranges/
    // "6-max cash game, about 100 big blinds deep, facing a button raise"
    // La BB NO ABRE: DEFENDE. Cualquier spec de "apertura" era un error de
    // concepto, no un número mal calculado.
    spec: null,
    porcentajeImpreso: null,
    pagina: null,
    descripcion:
      'Big blind: NO abre, defiende. Ver DEFEND_RANGES.'
  }
};

/**
 * RANGOS DE DEFENSA (la BB no abre: defiende).
 *
 * Fuente: https://www.pokerskill.com/charts/opening-ranges/
 * Texto literal: "6-max cash game, about 100 big blinds deep, facing a
 * button raise. Defend (52.3% of hands): 22+, A2s+, K2s+, Q2s+, J4s+, T6s+,
 * 95s+, 85s+, 74s+, 64s+, 53s+, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o"
 *
 * Verificado: 694 combinaciones de 1326 = 52.34% contra 52.3% impreso.
 * Delta 0.04 puntos porcentuales.
 *
 * POR QUÉ ES LA MÁS ANCHA DE LA PÁGINA: la BB ya puso 1 ficha y se le ofrecen
 * más. No está pagando por ver una carta. La misma fuente lo dice.
 */
const DEFEND_RANGES = {
  'BB_vs_BTN': {
    spec: '22+,A2s+,K2s+,Q2s+,J4s+,T6s+,95s+,85s+,74s+,64s+,53s+,A2o+,K5o+,Q8o+,J8o+,T8o+,97o+,87o',
    porcentajeImpreso: 52.3,
    spot: 'BB vs raise de BTN',
    fuente: 'https://www.pokerskill.com/charts/opening-ranges/'
  },
  // Lo mas ancho que la fuente documenta en 6-max. Si el raise viene de CO o
  // de antes, el rango REAL es mas cerrado, pero no hay fuente: se bloquea.
  'BB_vs_early': null,
  'BB_vs_CO': null
};

/**
 * Spots de "facing a raise" documentados por la fuente.
 *
 * CORRECCION IMPORTANTE (2026-10-02): la transcripcion que hice leyendo el
 * PDF a ojo daba 3-bet = AA,KK,QQ,JJ,AKs,AKo,A5s-A2s,QJs,JTs,76s,65s,54s.
 * El TEXTO de la web dice 3-bet = JJ+,AKs,AKo,A5s-A2s,KQs,KJs,76s,65s,54s.
 *
 * LAS DOS TIENEN 76 COMBOS. Por eso el chequeo de porcentaje daba 5.73% en
 * ambas y NO PODIA distinguirlas. La diferencia son las manos, no la cantidad:
 * mi version subia QJs y JTs (demasiado flojo) y no tenia KQs ni KJs.
 * Gana el texto, que es la fuente literal; la lectura de color de un render
 * mio no la es.
 *
 * LECCION: un porcentaje igual NO valida una transcripcion. Dos rangos
 * distintos pueden dar el mismo numero.
 */
const FACING_RAISE_SPOTS = {
  'BTN_vs_CO': {
    spot: 'BTN vs apertura de CO',
    pagina: 7,
    threBetPct: 5.7,
    callPct: 14.0,
    totalPct: 19.8,
    fuente: 'https://www.pokerskill.com/charts/3bet-ranges/',
    // "3-bet (5.7% of hands): JJ+, AKs, AKo, A5s-A2s, KQs, KJs, 76s, 65s, 54s"
    // A5s-A2s expandido: el parser no entiende el guion.
    threBet: 'JJ+,AKs,AKo,A5s,A4s,A3s,A2s,KQs,KJs,76s,65s,54s',
    // "Call (14.0% of hands): 22-TT, A9s-A6s, AQs, AJs, ATs, KTs, K9s, QJs,
    //  QTs, Q9s, JTs, J9s, T9s, T8s, 98s, 87s, AQo, AJo, KQo, KJo, QJo"
    // 22-TT y A9s-A6s expandidos carta por carta.
    call:
      '22,33,44,55,66,77,88,99,TT,' +
      'A9s,A8s,A7s,A6s,AQs,AJs,ATs,KTs,K9s,QJs,QTs,Q9s,JTs,J9s,' +
      'T9s,T8s,98s,87s,AQo,AJo,KQo,KJo,QJo'
  },

  /**
   * NUEVO (2026-10-02). Fuente: /charts/3bet-ranges/
   * "Facing a 3 big blind open from UTG+2, the small blind 3-bets 4.8% of
   *  hands, a little under half as many as early position opens at a full
   *  ring table (10.6%)."
   *
   * OJO: "AJs+" en la leyenda de la fuente significa "suited aces con kicker
   * más alto que J, hasta AKs" — o sea AKs, AQs y AJs. NO es solo AJs.
   * Verificado: JJ+ (24) + AKo (12) + AJs+ (12) + A5s-A2s (16) = 64
   * combinaciones = 4.83% contra 4.8% impreso. Delta 0.03.
   *
   * (Una versión previa de esta nota decía 4.52% y lo atribuir a que las
   * cuatro ruedas eran lectura de Poker Skill. Era un error mío de lectura
   * de "AJs+", no un límite de la fuente.)
   */
  'SB_vs_early': {
    spot: 'SB vs apertura de early position (3bb, UTG+2)',
    threBetPct: 4.8,
    callPct: 0,
    totalPct: 4.8,
    fuente: 'https://www.pokerskill.com/charts/3bet-ranges/',
    threBet: 'JJ+,AKo,AJs+,A5s,A4s,A3s,A2s',
    call: null,
    nota:
      'Verificado: 64 combinaciones = 4.83% contra 4.8% impreso. La fuente ' +
      'reconoce que las cuatro ruedas (A5s-A2s) son su lectura del libro, ' +
      'no la lista original de Advanced Concepts.'
  }
};

/** Manos que abren/suben sin importar la posición. */
const GOLDEN_HANDS = [
  'AA', 'KK', 'QQ', 'JJ', 'TT',
  'AKs', 'AQs', 'AJs', 'ATs',
  'AKo', 'AQo', 'AJo',
  'KQs', 'KJs', 'KTs',
  'QJs', 'QTs', 'JTs'
];

/**
 * Normaliza un código de mano a forma canónica (rank alto primero).
 * OJO: el orden alfabético NO es el de ranks ("A" < "K" como strings, pero
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

const TOTAL_COMBOS = 1326; // C(52,2)

class PreflopReference {
  constructor() {
    this._eq = new EC();
    this._cache = new Map();
    this._classCache = new Map();
  }

  /** Datos de la fuente, para que cualquier consumidor pueda citarlos. */
  getFuente() {
    return { ...FUENTE };
  }

  getPositions() {
    return POSICIONES.slice();
  }

  /** Posiciones que tienen rango de apertura con fuente real. */
  getOpeningPositions() {
    return POSICIONES_QUE_ABREN.slice();
  }

  /**
   * Notación compacta del rango de apertura de una posición.
   * Devuelve null cuando NO hay fuente (BB, posiciones inventadas, acciones
   * sin chart). El llamador debe BLOQUEAR, no adivinar.
   */
  rangeSpecFor(posicion, accion) {
    const pos = String(posicion || '').toUpperCase();
    const act = String(accion || 'RFI').toUpperCase();

    const esApertura = ['RFI', 'RAISE', 'OPEN', 'LIMPEO', 'LIMPEAR', ''].includes(act);
    if (!esApertura) {
      // 3-bet / call / fold preflop SOLO existen para el spot documentado.
      return null;
    }

    const r = OPEN_RANGES[pos];
    if (!r || !r.spec) return null;
    return r.spec;
  }

  /**
   * Busca un spot de "facing a raise" sin importar mayúsculas.
   * OJO: la clave del objeto es 'BTN_vs_CO' pero se consulta en mayúsculas
   * ('BTN_VS_CO'). Un lookup directo devolvía null siempre.
   */
  _findSpot(spot) {
    const s = String(spot || '').toUpperCase();
    const key = Object.keys(FACING_RAISE_SPOTS).find(k => k.toUpperCase() === s);
    return key ? FACING_RAISE_SPOTS[key] : null;
  }

  /**
   * Rango de 3-bet o call para el único spot con chart.
   * @returns {string|null} spec, o null si el spot no está documentado.
   */
  facingRaiseSpec(spot, accion) {
    const s = this._findSpot(spot);
    if (!s) return null;
    const act = String(accion || 'threBet').toLowerCase();
    if (act === 'threbet' || act === '3bet' || act === 'raise') return s.threBet;
    if (act === 'call') return s.call;
    return null;
  }

  facingRaiseInfo(spot) {
    const s = this._findSpot(spot);
    return s ? { ...s } : null;
  }

  /** La BB no abre: defiende. */
  isDefendPosition(posicion) {
    return String(posicion || '').toUpperCase() === 'BB';
  }

  /**
   * Rango de defensa de la BB, con FUENTE.
   *
   * El spot documentado es "BB vs raise de BTN" (52.3% de las manos).
   * El rango REAL depende de quién raisea: si el raise viene de CO o de
   * earlier, el rango es mas cerrado. Pero solo hay fuente para el spot del
   * boton, asi que los demas spots devuelven null y el llamador BLOQUEA en
   * vez de usar el rango del boton como si sirviera para todos.
   *
   * @param {string} spot  'BB_vs_BTN' | 'BB_vs_CO' | 'BB_vs_early'
   * @returns {string|null}
   */
  defendSpec(spot) {
    const s = String(spot || 'BB_vs_BTN').toUpperCase();
    const key = Object.keys(DEFEND_RANGES).find(k => k.toUpperCase() === s);
    const r = key ? DEFEND_RANGES[key] : null;
    return r && r.spec ? r.spec : null;
  }

  defendInfo(spot) {
    const s = String(spot || 'BB_vs_BTN').toUpperCase();
    const key = Object.keys(DEFEND_RANGES).find(k => k.toUpperCase() === s);
    if (!key) return null;
    const r = DEFEND_RANGES[key];
    if (!r || !r.spec) {
      return {
        bloqueado: true,
        spot,
        razon:
          `No hay fuente para el rango de defensa de BB contra "${spot}". ` +
          'El rango documentado es contra una subida del boton. Contra un ' +
          'raise de cutoff o de early el rango real es MAS CERRADO, asi que ' +
          'usar el del boton seria abrir de mas. Pasame el rango del rival ' +
          'o el spot exacto.'
      };
    }
    const out = { ...r, bloqueado: false };
    out.combinaciones = this._countCombos(r.spec);
    out.porcentajeCalculado =
      Math.round((out.combinaciones / TOTAL_COMBOS) * 10000) / 100;
    out.delta = Math.round((out.porcentajeCalculado - r.porcentajeImpreso) * 100) / 100;
    return out;
  }

  /** Cuenta combinaciones de una spec sin devolver la estructura. */
  _countCombos(spec) {
    let n = 0;
    for (const e of this._eq.parseRange(spec)) n += e.combos.length;
    return n;
  }

  /** Todos los spots de defensa que tienen fuente real. */
  getDefendSpots() {
    return Object.keys(DEFEND_RANGES)
      .filter(k => DEFEND_RANGES[k] && DEFEND_RANGES[k].spec);
  }

  /**
   * Decide una mano en BB contra un raise.
   *
   * @param {string} handCode "97s", "A2o", "TT"
   * @param {string} spot      'BB_vs_BTN' por defecto
   */
  consultDefense(handCode, spot = 'BB_vs_BTN') {
    const code = canon(handCode);
    if (!code) {
      throw new Error(
        `PreflopReference: mano "${handCode}" inválida. Se espera algo como "97s", "A2o", "TT".`
      );
    }
    const info = this.defendInfo(spot);
    if (!info || info.bloqueado) {
      return {
        action: 'BLOQUEADO',
        color: 'gray',
        position: 'BB',
        bloqueado: true,
        reason: info
          ? info.razon
          : `Spot "${spot}" desconocido. Spots con fuente: ${this.getDefendSpots().join(', ')}.`
      };
    }

    if (this._inSpec(code, info.spec)) {
      const golden = GOLDEN_HANDS.includes(code);
      return {
        action: 'CALL',
        color: golden ? 'gold' : 'green',
        position: 'BB',
        bloqueado: false,
        reason:
          `${code} DEFENDE contra subida del boton (chart Poker Skill, ` +
          `/charts/opening-ranges/): ${info.porcentajeImpreso}% de las manos ` +
          `defienden (calculado ${info.porcentajeCalculado}%). ` +
          'La BB ya puso 1 ficha y se le ofrecen más: no está pagando por ver ' +
          'una carta.' +
          (golden ? ' Mano dorada.' : ''),
        spec: info.spec,
        porcentaje: info.porcentajeCalculado
      };
    }

    return {
      action: 'FOLD',
      color: 'gray',
      position: 'BB',
      bloqueado: false,
      reason:
        `${code} NO defiende contra una subida del boton ` +
        `(chart Poker Skill, /charts/opening-ranges/: defienden ` +
        `${info.porcentajeImpreso}% de las manos).`,
      spec: info.spec
    };
  }

  /** ¿La mano está en una spec arbitraria? */
  _inSpec(code, spec) {
    const parsed = this._eq.parseRange(spec);
    for (const e of parsed) {
      for (const c of e.combos) {
        if (this._eq._codeOf(c) === code) return true;
      }
    }
    return false;
  }

  /**
   * % REAL de apertura, CALCULADO sobre las 1326 combinaciones.
   *
   * Devuelve los tres números por separado y NUNCA los mezcla:
   *   porcentajeCalculado — sale de contar combinaciones (verificable)
   *   porcentajeImpreso   — el que imprime la fuente
   *   delta               — la diferencia, por si la fuente se contradice
   *
   * @returns {{posicion, combinaciones, manos, total, porcentajeCalculado,
   *            porcentajeImpreso, delta, fuente, hayFuente}}
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

    const r = OPEN_RANGES[pos];
    if (!r.spec) {
      throw new Error(
        `BLOQUEADO: no hay rango de apertura con fuente para ${pos}. ` +
        `${r.descripcion} Sin fuente no se inventa un rango — ` +
        'necesitás pasar el rango del rival explícitamente.'
      );
    }

    const parsed = this._eq.parseRange(r.spec);
    let combos = 0;
    const clases = new Set();
    for (const e of parsed) {
      combos += e.combos.length;
      for (const c of e.combos) clases.add(this._eq._codeOf(c));
    }

    const calculado = Math.round((combos / TOTAL_COMBOS) * 10000) / 100;
    const out = {
      posicion: pos,
      combinaciones: combos,
      manos: clases.size,
      total: TOTAL_COMBOS,
      porcentajeCalculado: calculado,
      porcentajeImpreso: r.porcentajeImpreso,
      delta: r.porcentajeImpreso === null
        ? null
        : Math.round((calculado - r.porcentajeImpreso) * 100) / 100,
      pagina: r.pagina,
      fuente: FUENTE.url,
      hayFuente: true,
      spec: r.spec
    };
    this._cache.set(pos, out);
    return out;
  }

  /**
   * Consulta el chart preflop para una mano y posición.
   * @param {string} handCode "97s", "AKo", "TT"
   * @param {string} posicion UTG, HJ, CO, BTN, SB, BB
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

    // ── La BB NO ABRE: DEFENDE ──
    // Si no hay nada que enfrentar, no hay decisión que tomar. Si ya nos
    // pusieron fichas, la decisión va por consultDefense(), que sí tiene
    // fuente para el spot del botón.
    if (this.isDefendPosition(pos)) {
      return {
        action: 'CHECK',
        color: 'gray',
        reason:
          'Big blind: la BB no abre. Si la acción está cerrada, no hay nada ' +
          'que responder y la decisión es CHECK. Si ya te pusieron fichas, ' +
          'usá consultDefense() — hay rango con fuente solo contra subida del ' +
          'botón (52.3% defiende).',
        position: pos,
        bloqueado: false
      };
    }

    const desc = OPEN_RANGES[pos].descripcion;
    if (this._inRange(code, pos)) {
      const color = GOLDEN_HANDS.includes(code) ? 'gold' : 'green';
      const reason = GOLDEN_HANDS.includes(code)
        ? `Mano dorada: ${code} abre desde cualquier posición. ${desc}.`
        : `${code} está en el rango de apertura de ${pos} (chart Poker Skill, pág. ${OPEN_RANGES[pos].pagina}). ${desc}.`;
      return { action: 'RAISE', color, reason, position: pos, bloqueado: false };
    }

    return {
      action: 'FOLD',
      color: 'gray',
      reason:
        `${code} NO está en el rango de apertura de ${pos} ` +
        `(chart Poker Skill, pág. ${OPEN_RANGES[pos].pagina}). ${desc}.`,
      position: pos,
      bloqueado: false
    };
  }

  /**
   * ¿La mano está en el rango de la posición?
   * Compara CLASES de mano, así que hay que expandir los combos del rango
   * (no sirve comparar el token "A2s+" contra "AKs").
   */
  _inRange(code, pos) {
    let set = this._classCache.get(pos);
    if (!set) {
      const spec = OPEN_RANGES[pos] && OPEN_RANGES[pos].spec;
      if (!spec) return false;
      set = new Set();
      for (const e of this._eq.parseRange(spec)) {
        for (const c of e.combos) set.add(this._eq._codeOf(c));
      }
      this._classCache.set(pos, set);
    }
    return set.has(code);
  }

  /** Todas las clases de mano del rango de una posición. */
  clasesEnRango(pos) {
    const spec = this.rangeSpecFor(pos, 'RFI');
    if (!spec) return [];
    const set = new Set();
    for (const e of this._eq.parseRange(spec)) {
      for (const c of e.combos) set.add(this._eq._codeOf(c));
    }
    return [...set];
  }
}

module.exports = PreflopReference;
module.exports.POSICIONES = POSICIONES;
module.exports.POSICIONES_QUE_ABREN = POSICIONES_QUE_ABREN;
module.exports.OPEN_RANGES = OPEN_RANGES;
module.exports.DEFEND_RANGES = DEFEND_RANGES;
module.exports.FACING_RAISE_SPOTS = FACING_RAISE_SPOTS;
module.exports.FUENTE = FUENTE;
module.exports.TOTAL_COMBOS = TOTAL_COMBOS;
module.exports.canon = canon;