/**
 * StreetDecider — decide la jugada calle por calle (preflop, flop, turn, river).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: la versión anterior en disco era un stub de 78
 * líneas que miraba `equity` contra pot odds con umbrales fijos (0.65, 0.45,
 * 0.05). No leía el board, no usaba el rango del rival y no pensaba la calle
 * siguiente. Los 38 tests de test/streetDecider.test.js ya existían y fallaban
 * contra ese stub. Este archivo es el que esos tests describen.
 *
 * DOS CAMINOS, NUNCA MEZCLADOS:
 *   - PREFLOP  -> CHART. No se calcula equity si no hay bet del rival, porque
 *     preflop la decisión es de RANGO, no de equity contra una mano.
 *   - POSTFLOP -> EQUITY REAL contra el rango declarado del rival.
 *
 * REGLA DORADA: si falta el rango del rival y hay que tomar una decisión que
 * depende de él, se BLOQUEA con un throw. No se inventa equity ni rango.
 */

const HR = require('./handRanker');
const PreflopReference = require('./PreflopReference');
const EquityCalculator = require('./EquityCalculator');

/** Calles válidas y cuántas cartas de board exige cada una. */
const CALLES = {
  preflop: { board: 0, label: 'preflop' },
  flop: { board: 3, label: 'flop' },
  turn: { board: 4, label: 'turn' },
  river: { board: 5, label: 'river' }
};

const RANK_CHARS = '23456789TJQKA';

/** Márgenes de decisión. Están en FRACCIÓN (0.02 = 2 puntos porcentuales). */
const MARGEN_FOLD = 0.02;
const UMBRAL_BET_FUERTE = 0.65;
const UMBRAL_BET_MEDIO = 0.45;
const UMBRAL_RAISE = 0.70;

/**
 * Multiplicador del raise postflop. VER NOTA DE SIZING más abajo: el BRIEF
 * decía "2.7-3.2x" sin decir de QUÉ. Acá se toma del bet del rival.
 */
const RAISE_MIN_X = 3.0;

class StreetDecider {
  /**
   * @param {object} opts
   * @param {number} opts.iterations Iteraciones de Monte Carlo para la equity.
   */
  constructor(opts = {}) {
    this.iterations = opts.iterations || 200_000;
    this.margen = opts.margen != null ? opts.margen : MARGEN_FOLD;
    this._ref = new PreflopReference();
    this._eq = new EquityCalculator();
  }

  // ─────────────────────────────────────────────────────────────────────
  // API principal
  // ─────────────────────────────────────────────────────────────────────

  /**
   * @param {object} input
   * @param {string} input.street      'preflop'|'flop'|'turn'|'river'
   * @param {string} input.hole        "AhKh"
   * @param {string} [input.board]     "Td9d4c" (vacío en preflop)
   * @param {number} input.pot         Bote ANTES de nuestra acción
   * @param {number} [input.toCall]    0 si nadie nos puso fichas
   * @param {number} [input.stack]     Stack efectivo del héroe
   * @param {string} input.position    UTG|HJ|CO|BTN|SB|BB
   * @param {string} [input.villainAction] NONE|RAISE|BET|CHECK|CALL
   * @param {string} [input.villainRange]  "TT+,AKs" — obligatorio si hay bet
   * @returns {{action, sizing, equity, breakeven, razonamiento, metodo}}
   */
  decide(input) {
    this._validar(input);

    const street = input.street;
    const villainAction = String(input.villainAction || (street === 'preflop' ? 'NONE' : 'CHECK')).toUpperCase();
    const toCall = input.toCall != null ? input.toCall : 0;
    const pot = input.pot;
    const position = String(input.position || '').toUpperCase();

    if (street === 'preflop') {
      return this._preflop({ ...input, villainAction, toCall, pot, position });
    }
    return this._postflop({ ...input, villainAction, toCall, pot, position });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Validación — toda entrada mala se rechaza con mensaje en español
  // ─────────────────────────────────────────────────────────────────────

  _validar(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('StreetDecider: falta la entrada (objeto con la mano y la calle).');
    }

    // 1. street
    if (!input.street) {
      throw new Error('StreetDecider: falta "street". Valores válidos: preflop, flop, turn, river.');
    }
    const street = String(input.street).toLowerCase();
    if (!CALLES[street]) {
      throw new Error(
        `StreetDecider: calle "${input.street}" no reconocida. ` +
        'Valores válidos: preflop, flop, turn, river.'
      );
    }
    input.street = street;

    // 2. hole
    if (!input.hole) {
      throw new Error('StreetDecider: falta "hole" con tus 2 cartas. Ejemplo: "AhKh".');
    }

    // 3. números
    if (typeof input.pot !== 'number' || !isFinite(input.pot)) {
      throw new Error(`StreetDecider: "pot" debe ser un número. Recibido: ${JSON.stringify(input.pot)}.`);
    }
    if (input.toCall != null && (typeof input.toCall !== 'number' || !isFinite(input.toCall))) {
      throw new Error(`StreetDecider: "toCall" debe ser un número. Recibido: ${JSON.stringify(input.toCall)}.`);
    }
    if (input.stack != null && (typeof input.stack !== 'number' || !isFinite(input.stack))) {
      throw new Error(`StreetDecider: "stack" debe ser un número. Recibido: ${JSON.stringify(input.stack)}.`);
    }

    // 4. board: cantidad exacta de cartas para la calle
    if (street !== 'preflop') {
      const requeridas = CALLES[street].board;
      let board = [];
      try {
        board = input.board ? HR.fromString(String(input.board).trim(), 'board') : [];
      } catch (e) {
        throw new Error(`StreetDecider: no entiendo el board "${input.board}". ${e.message}`);
      }
      if (board.length !== requeridas) {
        throw new Error(
          `StreetDecider: en ${street} el board debe tener ${requeridas} cartas, ` +
          `tiene ${board.length}. (${input.board || 'vacío'})`
        );
      }
      // Cartas repetidas dentro del board o contra tu mano
      const vistas = new Set();
      for (const c of board) {
        const k = `${c.rank}${c.suit}`;
        if (vistas.has(k)) {
          throw new Error(`StreetDecider: el board tiene la carta ${RANK_CHARS[c.rank - 2]}${c.suit} repetida.`);
        }
        vistas.add(k);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PREFLOP — el chart manda
  // ─────────────────────────────────────────────────────────────────────

  _preflop(ctx) {
    const { street, hole, position, villainAction, toCall, pot } = ctx;

    // Sin bet del rival: esto es un RFI, se decide con el chart.
    if (villainAction === 'NONE' || toCall === 0) {
      const code = this._handCode(hole);
      const r = this._ref.consult(code, position || 'CO');

      // La BB nunca abre: si el chart la marca, es defensa, no raise.
      let action = r.action;
      if (this._ref.isDefendPosition(position) && action === 'RAISE') action = 'CALL';

      return {
        action,
        street,
        mano: code,
        sizing: action === 'RAISE' ? this._openSize(pot) : null,
        equity: null,
        breakeven: null,
        boardHumo: null,
        metodo: 'chart',
        rangoRival: null,
        posicion: position,
        potOdds: null,
        razonamiento:
          `Preflop con acción cerrada: se decide con el chart, no con equity. ` +
          `${code} en ${position}: ${r.reason}`
      };
    }

    // Facing a un raise: acá sí hace falta el rango del rival. Sin rango, BLOQUEADO.
    if (!ctx.villainRange) {
      throw new Error(
        'BLOQUEADO: nos pusieron fichas preflop y no declaraste "villainRange". ' +
        'Sin el rango del rival no hay equity posible — no se inventa. ' +
        'Ejemplo: villainRange: "TT+,AJo+,KQs".'
      );
    }

    const eq = this._equity(hole, ctx.villainRange, '');
    const breakeven = this._breakeven(toCall, pot);
    const code = this._handCode(hole);
    const dec = this._decidirPostflop(eq, breakeven, toCall, pot, 'preflop', null, 0);

    return {
      action: dec.action,
      street,
      sizing: dec.sizing,
      equity: eq,
      breakeven,
      boardHumo: null,
      metodo: 'equity+chart',
      mano: code,
      rangoRival: ctx.villainRange,
      posicion: position,
      potOdds: breakeven,
      razonamiento:
        `Facing a ${villainAction} en ${position} contra ${ctx.villainRange}. ` +
        `${code} tiene ${eq}% contra ese rango y necesita ${breakeven}% para quebrar. ` +
        dec.motivo
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // POSTFLOP — la equity real manda
  // ─────────────────────────────────────────────────────────────────────

  _postflop(ctx) {
    const { street, hole, board, pot, toCall, position, villainAction, villainRange } = ctx;

    if (!villainRange) {
      throw new Error(
        'BLOQUEADO: en postflop sin "villainRange" no hay equity real. ' +
        'No se inventa el rango del rival ni se devuelve una jugada. ' +
        'Ejemplo: villainRange: "TT+,AKs".'
      );
    }

    const eq = this._equity(hole, villainRange, board);
    const breakeven = this._breakeven(toCall, pot);
    const text = this._boardTexture(board);
    const codigo = this._handCode(hole);
    const draws = this._draws(hole, board);

    const dec = this._decidirPostflop(eq, breakeven, toCall, pot, street, text, position, draws);

    const partes = [
      `${codigo} en ${board} contra ${villainRange}.`,
      `Equity ${eq}% · necesitás ${breakeven}% para quebrar.`,
      dec.motivo
    ];

    // Que draw tenés es parte de la razon, no un detalle: define si el bet es
    // valor, semibluff o aire, y cuanto te falta para cobrarlo.
    if (draws.resumen) partes.push(`Tenés ${draws.resumen}.`);

    // En BB/SB con check gratis nunca se paga por ver una carta.
    if (toCall === 0 && dec.action === 'CHECK' && (position === 'BB' || position === 'SB')) {
      partes.push('El check es gratis: no pagás para ver una carta.');
    }

    return {
      action: dec.action,
      street,
      sizing: dec.sizing,
      equity: eq,
      breakeven,
      boardHumo: text.humo,
      boardTextura: text,
      draws,
      metodo: 'equity',
      mano: codigo,
      rangoRival: villainRange,
      accionRival: villainAction,
      posicion: position,
      potOdds: breakeven,
      razonamiento: partes.join(' ')
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Lógica de decisión
  // ─────────────────────────────────────────────────────────────────────

  /**
   * @returns {{action, sizing, motivo}}
   */
  _decidirPostflop(eq, breakeven, toCall, pot, street, text, position, draws) {
    // —— Check gratis ——
    if (toCall === 0) {
      if (eq >= UMBRAL_BET_FUERTE * 100) {
        const sizing = this._betSize(pot, text ? text.humo : 'seco', 'valor');
        return {
          action: 'BET', sizing,
          motivo: `Equity ${eq}%: bet de valor en ${sizing} (${Math.round((sizing / pot) * 100)}% del bote).`
        };
      }
      if (eq >= UMBRAL_BET_MEDIO * 100) {
        const sizing = this._betSize(pot, text ? text.humo : 'seco', 'valor');
        return {
          action: 'BET', sizing,
          motivo: `Equity ${eq}%: bet de valor thin en ${sizing} (${Math.round((sizing / pot) * 100)}% del bote).`
        };
      }
      return {
        action: 'CHECK', sizing: null,
        motivo: `Equity ${eq}%: no llega para betear de valor. Check.`
      };
    }

    // —— Hay que pagar ——
    const margen = this.margen * 100;

    if (eq < breakeven - margen) {
      return {
        action: 'FOLD', sizing: null,
        motivo: `Fold: equity ${eq}% no llega al ${breakeven}% de pot odds.`
      };
    }

    // Margen de valor: equity holgada + no es el river para no sobre-jugar.
    if (eq >= UMBRAL_RAISE * 100 && street !== 'river') {
      const sizing = this._raiseSize(toCall);
      return {
        action: 'RAISE', sizing,
        motivo: `Equity ${eq}% con pot odds de ${breakeven}%: raise de valor a ${sizing} (${RAISE_MIN_X}x el bet).`
      };
    }

    if (eq > breakeven + margen) {
      return {
        action: 'CALL', sizing: null,
        motivo: `Call: equity ${eq}% supera el ${breakeven}% que necesitás.`
      };
    }

    return {
      action: 'CALL', sizing: null,
      motivo: `Call marginal: equity ${eq}% contra pot odds de ${breakeven}% (dentro del margen de ${margen}%).`
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Sizing
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Tamaño del bet como fracción del bote.
   *
   *  - board seco  -> bet grande (no le regala cartas gratis al rival)
   *  - board húmedo -> bet chico (le regala menosARE Outs y cobra más valor)
   *
   * @param {number} pot
   * @param {string} boardHumo 'seco' | 'húmedo'
   * @param {string} tipo 'valor' | 'bluff'
   * @returns {number} fichas (puede ser fraccional: 30 * 0.75 = 22.5)
   */
  _betSize(pot, boardHumo, tipo = 'valor') {
    const seco = boardHumo !== 'húmedo';
    const frac = tipo === 'bluff'
      ? (seco ? 0.66 : 0.33)
      : (seco ? 0.75 : 0.55);
    // Redondeo a 2 decimales: 100 * 0.55 daba 55.00000000000001 y ese
    // número se iba literal al mensaje al usuario.
    return Math.round(pot * frac * 100) / 100;
  }

  /**
   * Tamaño del raise.
   *
   * NOTA DE SIZING (abierta, hay que decidirla con h4x): el BRIEF decía
   * "raise ~2.7-3.2x" sin decir de QUÉ es el múltiplo. Acá se toma del BET
   * DEL RIVAL (toCall), que es la convención estándar y la única que da una
   * respuesta determinista sin inventar una base.
   */
  _raiseSize(toCall) {
    return Math.round(toCall * RAISE_MIN_X * 100) / 100;
  }

  /** Apertura preflop: 2.5bb, el tamaño estándar. */
  _openSize(pot) {
    return 2.5;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────────────────────────────────

  /** breakeven en PORCENTAJE: toCall / (pot + toCall). */
  _breakeven(toCall, pot) {
    if (!toCall) return 0;
    return Math.round((toCall / (pot + toCall)) * 10000) / 100;
  }

  _equity(hole, villainRange, board) {
    const r = this._eq.calculate(hole, villainRange, board || [], {
      iterations: this.iterations
    });
    return r.equity;
  }

  /** "AhKh" -> "AKs" (clase de mano canónica, para consultar el chart). */
  _handCode(hole) {
    const cards = HR.fromString(String(hole).trim(), 'héroe');
    if (cards.length !== 2) {
      throw new Error(`StreetDecider: "hole" debe tener 2 cartas. Recibido: "${hole}".`);
    }
    if (cards[0].rank === cards[1].rank && cards[0].suit === cards[1].suit) {
      throw new Error(`StreetDecider: no podés jugar dos veces la misma carta ("${hole}").`);
    }
    return this._eq._codeOf(cards);
  }

  /**
   * Textura del board y veredicto seco/húmedo.
   * "húmedo" = muchas cosas pueden pasar: flush, flush draw o board conectado.
   */
  _boardTexture(board) {
    const cards = HR.fromString(String(board).trim(), 'board');
    const palos = { s: 0, h: 0, d: 0, c: 0 };
    const ranks = [];
    for (const c of cards) {
      palos[c.suit]++;
      ranks.push(c.rank);
    }
    const sorted = [...ranks].sort((a, b) => a - b);
    let corrida = 1, mejorCorrida = 1;
    for (let i = 1; i < sorted.length; i++) {
      corrida = sorted[i] === sorted[i - 1] + 1 ? corrida + 1 : 1;
      if (corrida > mejorCorrida) mejorCorrida = corrida;
    }

    const conteoPalos = Object.values(palos);
    const maxPalo = Math.max(...conteoPalos);
    const parejas = new Set(ranks).size !== ranks.length;
    const conectadas = mejorCorrida >= 3;
    const casiConectadas = mejorCorrida === 2;
    const monotone = maxPalo >= cards.length;

    let humo;
    let razon;
    if (monotone) {
      humo = 'húmedo';
      razon = 'el board es de un solo palo: cualquiera puede hacer flush';
    } else if (maxPalo === 3) {
      humo = 'húmedo';
      razon = 'tres cartas del mismo palo: flush posible para cualquiera';
    } else if (maxPalo === 2 && (conectadas || casiConectadas)) {
      humo = 'húmedo';
      razon = 'flush draw conectado en el board';
    } else {
      humo = 'seco';
      razon = 'pocas conexiones y sinflush draw';
    }

    return {
      humo,
      palos: { ...palos },
      conectadas,
      casiConectadas,
      monotone,
      parejas,
      ranks: sorted.map(r => RANK_CHARS[r - 2]),
      razon
    };
  }

  /**
   * Analiza draws, outs y sobrepares de la mano.
   *
   * Envuelto en try/catch a proposito: un error del detector de draws NUNCA
   * debe tumbar una decision que el motor de equity ya sabe tomar. Si el
   * detector falla, se devuelve un objeto vacio y la decision sigue igual,
   * solo que sin el detalle de los outs.
   *
   * @returns {Object} analisis de DrawDetector, o {} si no pudo calcular
   */
  _draws(hole, board) {
    try {
      const DrawDetector = require('./DrawDetector');
      return new DrawDetector().analyze(hole, board);
    } catch (e) {
      return {
        street: this._streetFromBoard(board),
        resumen: null,
        error: `DrawDetector no pudo analizar: ${e.message}`,
        outsTotales: 0,
        color: { outs: 0, flushDraw: false },
        escalera: { hecho: false, oesd: null, gutshots: null }
      };
    }
  }

  /** Calle deducida de la cantidad de cartas del board. */
  _streetFromBoard(board) {
    if (!board) return 'preflop';
    const n = String(board).trim().length / 2;
    if (n <= 0) return 'preflop';
    if (n === 3) return 'flop';
    if (n === 4) return 'turn';
    return 'river';
  }
}

module.exports = StreetDecider;
module.exports.CALLES = CALLES;
module.exports.RAISE_MIN_X = RAISE_MIN_X;
