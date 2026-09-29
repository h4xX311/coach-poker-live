/**
 * StreetDecider — Decide FOLD / CHECK / CALL / BET / RAISE calle por calle.
 *
 * REGLAS (ver test/streetDecider.test.js):
 *  - PREFLOP usa el CHART, NO equity. POSTFLOP usa equity real.
 *  - breakeven = toCall / (pot + toCall)
 *  - equity > breakeven + margen  -> CALL / RAISE
 *  - equity < breakeven - margen  -> FOLD
 *  - En BB/SB con check gratis, el check no cuesta nada.
 *  - Si la equity no está disponible (sin rango del rival declarado), se
 *    BLOQUEA con un throw: no se inventa equity.
 */

const EC = require('./EquityCalculator');
const PR = require('./PreflopReference');

const ACCIONES = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

/** Margen mínimo de ventaja para actuar: 3 puntos porcentuales de equity. */
const MARGEN_EQUITY = 0.03;

class StreetDecider {
  constructor(opts = {}) {
    this.eq = new EC();
    this.ref = new PR();
    this.margen = opts.margen != null ? opts.margen : MARGEN_EQUITY;
    this.iterations = opts.iterations || 100000;
  }

  /**
   * @param {object} in
   *  street: 'preflop'|'flop'|'turn'|'river'
   *  hole: 'AhKh'
   *  board: 'Td9d4c'
   *  pot, toCall, stack: números
   *  position: 'BB','SB',...
   *  villainAction: 'BET'|'RAISE'|'CHECK'|...
   *  villainRange: 'TT+,AKs'  (OBLIGATORIO en postflop)
   * @returns {{action, sizing, equity, breakeven, razonamiento}}
   */
  decide(input) {
    const {
      street, hole, board = '', pot, toCall = 0, stack = 0,
      position, villainAction = 'CHECK', villainRange
    } = input || {};

    if (!street) {
      throw new Error('StreetDecider: falta "street" (preflop | flop | turn | river).');
    }
    if (hole == null) {
      throw new Error('StreetDecider: falta "hole" (tus dos cartas, ej. "AhKh").');
    }
    if (typeof pot !== 'number' || pot < 0) {
      throw new Error('StreetDecider: "pot" debe ser un número >= 0.');
    }

    const st = String(street).toLowerCase();
    if (st === 'preflop') return this._decidePreflop({ hole, position, toCall, pot, stack, villainRange, villainAction });
    if (st === 'flop' || st === 'turn' || st === 'river') {
      return this._decidePostflop({ st, hole, board, pot, toCall, stack, position, villainAction, villainRange });
    }
    throw new Error(`StreetDecider: calle "${street}" no reconocida. Usa preflop, flop, turn o river.`);
  }

  // ---------- PREFLOP: el chart manda, no la equity ----------
  _decidePreflop({ hole, position, toCall, pot, stack, villainRange, villainAction }) {
    const cards = this.eq._toCards(hole, 'héroe');
    if (cards.length !== 2) throw new Error('StreetDecider: "hole" debe tener exactamente 2 cartas.');

    // Código de mano, ej. AhKh -> AKs / AKo
    const code = this._codeOf(cards);
    if (!code) {
      throw new Error(`StreetDecider: no pude interpretar la mano "${hole}".`);
    }
    const pos = String(position || '').toUpperCase();
    if (!this.ref.getPositions().includes(pos)) {
      throw new Error(
        `StreetDecider: posición "${position}" no reconocida. ` +
        `Válidas: ${this.ref.getPositions().join(', ')}.`
      );
    }

    const chart = this.ref.consult(code, pos);
    const facingBet = String(villainAction).toUpperCase() === 'BET' || String(villainAction).toUpperCase() === 'RAISE';
    const breakeven = pot > 0 ? toCall / (pot + toCall) : 0;

    let action;
    let sizing = null;
    let razonamiento;

    if (!facingBet) {
      // Nadie apostó: seguimos el chart para ABRIR.
      if (chart.action === 'RAISE') {
        action = 'RAISE';
        sizing = stack > 0 ? Math.min(Math.round(pot * 2.5 * 100) / 100, stack) : null;
        razonamiento =
          `${code} abre desde ${pos} según el chart (${this.ref.openPct(pos).porcentaje}% de apertura). ` +
          `Raise ~2.5x el bote.`;
      } else if (pos === 'BB' || pos === 'SB') {
        action = 'CHECK';
        razonamiento = `${code} no está en el rango de ${pos}. Con check gratis, no pago para ver una carta.`;
      } else {
        action = 'FOLD';
        razonamiento = `${code} no está en el rango de apertura de ${pos} (${this.ref.openPct(pos).porcentaje}%).`;
      }
    } else {
      // Facing a bet/raise preflop: el chart NO alcanza, hace falta el rango del rival.
      if (!villainRange) {
        throw new Error(
          'StreetDecider BLOQUEADO: estás dependiendo de una bet/raise preflop y no declaraste ' +
          '"villainRange". El chart de apertura no sirve para defender: sin el rango del rival ' +
          'no hay forma de defender la decisión. NO SE INVENTA la equity.'
        );
      }
      const ev = this.eq.calculate(cards, villainRange, '', { iterations: this.iterations });
      const eqPct = ev.equity / 100;
      if (eqPct > breakeven + this.margen) {
        action = 'CALL';
        razonamiento =
          `Preflop contra "${villainRange}": tu equity ${ev.equity}% > breakeven ${(breakeven * 100).toFixed(1)}% + margen. Call.`;
      } else if (eqPct < breakeven - this.margen) {
        action = 'FOLD';
        razonamiento =
          `Preflop contra "${villainRange}": tu equity ${ev.equity}% < breakeven ${(breakeven * 100).toFixed(1)}% - margen. Fold.`;
      } else {
        action = 'FOLD';
        razonamiento =
          `Preflop contra "${villainRange}": equity ${ev.equity}% vs breakeven ${(breakeven * 100).toFixed(1)}% — ` +
          `dentro del margen, sin ventaja paracalling. Fold (o squeeze si querés steal).`;
      }
      return {
        action, sizing, equity: ev.equity, breakeven: breakeven * 100,
        mano: code, street: 'preflop', metodo: 'equity contra rango declarado',
        razonamiento
      };
    }

    return {
      action, sizing, equity: null, breakeven: breakeven * 100, mano: code, street: 'preflop',
      metodo: 'chart preflop (no equity)',
      razonamiento
    };
  }

  // ---------- POSTFLOP: equity real contra el rango declarado ----------
  _decidePostflop({ st, hole, board, pot, toCall, stack, position, villainAction, villainRange }) {
    if (!villainRange) {
      throw new Error(
        'StreetDecider BLOQUEADO: en postflop hace falta "villainRange" (ej. "TT+,AKs") para ' +
        'calcular la equity real. Sin rango declarado no se puede decidir, y no se inventa.'
      );
    }
    const cards = this.eq._toCards(hole, 'héroe');
    const boardCards = this.eq._toCards(board, 'board');
    const esperado = { flop: 3, turn: 4, river: 5 }[st];
    if (boardCards.length !== esperado) {
      throw new Error(
        `StreetDecider: en ${st} el board debe tener ${esperado} cartas, tiene ${boardCards.length}.`
      );
    }

    const ev = this.eq.calculate(cards, villainRange, boardCards, { iterations: this.iterations });
    const eqPct = ev.equity / 100;
    const breakeven = pot > 0 ? toCall / (pot + toCall) : 0;

    const pos = String(position || '').toUpperCase();
    const checkGratis = (pos === 'BB' || pos === 'SB') && toCall === 0;
    const facing = String(villainAction).toUpperCase();
    const wet = this._boardWetness(boardCards);

    let action;
    let sizing = null;
    let razonamiento;

    if (toCall === 0) {
      // Nadie puso:.check o bet de valor.
      if (eqPct > 0.60) {
        action = 'BET';
        sizing = this._betSize(pot, wet, 'valor');
        razonamiento =
          `Equity ${ev.equity}% contra "${villainRange}": bet de valor. ` +
          `Sizing ${Math.round(sizing * 100)}% del bote (board ${wet}).`;
      } else {
        action = checkGratis ? 'CHECK' : 'CHECK';
        razonamiento =
          `Equity ${ev.equity}% contra "${villainRange}": sin bet de valor. Check.` +
          (checkGratis ? ' El check es gratis en BB/SB.' : '');
      }
    } else if (eqPct > breakeven + this.margen) {
      action = 'CALL';
      razonamiento =
        `Equity ${ev.equity}% > breakeven ${(breakeven * 100).toFixed(1)}% + margen ` +
        `${(this.margen * 100).toFixed(0)}%. Call.` +
        this._killerText(ev);
    } else if (eqPct < breakeven - this.margen) {
      action = 'FOLD';
      razonamiento =
        `Equity ${ev.equity}% < breakeven ${(breakeven * 100).toFixed(1)}% - margen ` +
        `${(this.margen * 100).toFixed(0)}%. Fold.` +
        this._killerText(ev);
    } else {
      // Dentro del margen: el check gratis siempre es mejor que pagar.
      if (checkGratis) {
        action = 'CHECK';
        razonamiento =
          `Equity ${ev.equity}% apenas alcanza el breakeven ${(breakeven * 100).toFixed(1)}%. ` +
          `En BB/SB el check es gratis: no tires dinero.`;
      } else {
        action = 'FOLD';
        razonamiento =
          `Equity ${ev.equity}% no supera el breakeven ${(breakeven * 100).toFixed(1)}% con margen. Fold.`;
      }
    }

    return {
      action, sizing, equity: ev.equity, breakeven: breakeven * 100,
      mano: this._codeOf(cards), street: st, boardHumo: wet,
      metodo: `equity real vs "${villainRange}" (${ev.metodo}, ${ev.iteraciones} iteraciones)`,
      razonamiento
    };
  }

  /** Sizing: bet de valor ~66-75% del bote en board seco, más chico en mojado. */
  _betSize(pot, wet, tipo = 'valor') {
    if (pot <= 0) return 0;
    // Board seco -> más grande (75%); mojado -> más chico (55%).
    const frac = wet === 'seco' ? 0.75 : (wet === 'húmedo' ? 0.55 : 0.66);
    return Math.round(pot * frac * 100) / 100;
  }

  /** Clasifica el board: seco / normal / húmedo (no es una cifra inventada, es etiqueta). */
  _boardWetness(boardCards) {
    if (boardCards.length < 3) return 'normal';
    // "húmedo" = muchas cartas del mismo palo o conectadas.
    const suits = {};
    for (const c of boardCards) suits[c.suit] = (suits[c.suit] || 0) + 1;
    const maxSuit = Math.max(...Object.values(suits));
    const ranks = boardCards.map(c => c.rank).sort((a, b) => a - b);
    let conectadas = 0;
    for (let i = 1; i < ranks.length; i++) if (ranks[i] - ranks[i - 1] === 1) conectadas++;
    if (maxSuit >= 3 || conectadas >= 3) return 'húmedo';
    if (maxSuit === 2 && conectadas <= 1) return 'seco';
    return 'normal';
  }

  _killerText(ev) {
    if (!ev.teMatan || ev.teMatan.length === 0) return '';
    const top = ev.teMatan[0];
    return ` Te mata sobre todo ${top.mano} (${top.frecuenciaComoMate.toFixed(1)}% de las veces).`;
  }

  _codeOf(cards) {
    return this.eq._codeOf(cards);
  }
}

module.exports = StreetDecider;
module.exports.ACCIONES = ACCIONES;
