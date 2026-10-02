/**
 * MultiOpponentHandler — Maneja situaciones multiway (3+ jugadores).
 */

class MultiOpponentHandler {
  /**
   * Ajusta la estrategia para situaciones multiway.
   * @param {Object} input
   * @param {number} input.numOponents — Número de rivales
   * @param {number} input.equity — Equity del héroe
   * @param {number} input.potSize — Tamaño del pot
   * @param {number} input.toCall — Cantidad a pagar
   * @returns {{ adjustedEquity: number, strategy: string, notes: string }}
   */
  handle(input) {
    const { numOponents, equity, potSize, toCall } = input;

    // En mesas multiway, el rango debe ser más tight
    const tightnessFactor = Math.max(0.6, 1 - (numOponents - 1) * 0.12);
    const adjustedEquity = equity * tightnessFactor;

    // Calcular pot odds efectivos
    const effectivePotOdds = toCall / (potSize + toCall);

    let strategy;
    let notes;

    if (numOponents === 2) {
      strategy = 'heads_up';
      notes = 'Duelo 1v1, rango estándar';
    } else if (numOponents === 3) {
      strategy = 'three_way';
      notes = '3 jugadores, rango más tight';
    } else if (numOponents >= 4) {
      strategy = 'multiway';
      notes = '4+ jugadores, solo manos premium';
    }

    // Ajuste por tamaño del pot
    if (potSize > 100) {
      notes += ' Pot grande, jugar agresivo con manos fuertes';
    }

    return {
      adjustedEquity: Math.round(adjustedEquity * 100) / 100,
      strategy,
      notes
    };
  }

  /**
   * Calcula la probabilidad de que al menos un rival tenga una mano mejor.
   */
  calculateDominationRisk(numOponents, heroEquity) {
    // Probabilidad de que ningún rival tenga mejor mano
    const noDominationProb = Math.pow(heroEquity, numOponents);
    return 1 - noDominationProb;
  }
}

module.exports = MultiOpponentHandler;
