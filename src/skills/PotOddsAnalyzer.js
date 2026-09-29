/**
 * PotOddsAnalyzer — Determina si el call es rentable según pot odds y EV.
 */

class PotOddsAnalyzer {
  /**
   * Analiza si un call es rentable.
   * @param {number} potSize — Tamaño actual del pot
   * @param {number} callAmount — Cantidad a pagar para el call
   * @param {number} equity — Equity del jugador (0-100)
   * @param {number} position — Posición del jugador
   * @returns {{ potOdds: number, potOddsPercent: number, ev: number, profitable: boolean, recommendation: string }}
   */
  analyze(potSize, callAmount, equity) {
    if (potSize <= 0) throw new Error('PotOddsAnalyzer: potSize debe ser > 0');

    // Si no hay call (fold/check), los pot odds no aplican
    if (callAmount <= 0) {
      return {
        potOdds: 0,
        potOddsPercent: 0,
        ev: 0,
        profitable: false,
        recommendation: 'Sin call — pot odds no aplican (fold o check)'
      };
    }

    const potOdds = callAmount / (potSize + callAmount);
    const potOddsPercent = potOdds * 100;

    // EV = (equity/100 * (potSize + callAmount)) - callAmount
    const ev = (equity / 100 * (potSize + callAmount)) - callAmount;

    const profitable = equity > potOddsPercent;

    let recommendation;
    if (profitable && equity > potOddsPercent + 10) {
      recommendation = 'CALL fuerte — equity supera ampliamente los pot odds';
    } else if (profitable) {
      recommendation = 'CALL marginal — equity supera los pot odds por poco';
    } else if (equity > potOddsPercent - 5) {
      recommendation = 'CALL borderline — casi rentable, considera odds implícitos';
    } else {
      recommendation = 'FOLD — equity insuficiente para justificar el call';
    }

    return {
      potOdds: Math.round(potOdds * 10000) / 10000,
      potOddsPercent: Math.round(potOddsPercent * 100) / 100,
      ev: Math.round(ev * 100) / 100,
      profitable,
      recommendation
    };
  }

  /**
   * Calcula la cantidad máxima que se puede pagar siendo rentable.
   */
  maxProfitableCall(potSize, equity) {
    // equity% * (pot + call) = call
    // call = equity% * pot / (1 - equity%)
    const eq = equity / 100;
    if (eq >= 1) return Infinity;
    return (eq * potSize) / (1 - eq);
  }

  /**
   * Calcula el EV de un raise.
   */
  evRaise(potSize, raiseAmount, equity, foldEquity) {
    // FE% * pot + (1-FE%) * [equity% * (pot+raise) - (1-equity%) * raise]
    const fe = foldEquity / 100;
    const eq = equity / 100;

    const ev = fe * potSize + (1 - fe) * (eq * (potSize + raiseAmount) - (1 - eq) * raiseAmount);

    return Math.round(ev * 100) / 100;
  }

  /**
   * Calcula el EV de un fold (siempre 0, pero útil para comparar).
   */
  evFold() {
    return 0;
  }

  /**
   * Calcula el EV de un check (siempre 0).
   */
  evCheck() {
    return 0;
  }
}

module.exports = PotOddsAnalyzer;
