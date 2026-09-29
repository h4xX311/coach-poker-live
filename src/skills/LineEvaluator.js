/**
 * LineEvaluator — Analiza fold/call/raise con pros y contras.
 */

class LineEvaluator {
  /**
   * Evalúa las tres líneas de juego y recomienda la mejor.
   * @param {Object} context — Contexto de la mano
   * @param {number} context.equity — Equity del jugador (0-100)
   * @param {number} context.potSize — Tamaño del pot
   * @param {number} context.callAmount — Cantidad a pagar
   * @param {number} context.raiseAmount — Cantidad a subir
   * @param {number} context.foldEquity — Probabilidad de que el rival haga fold (0-100)
   * @param {string} context.position — Posición del jugador
   * @param {number} context.stackSize — Stack del jugador
   * @param {string} context.handCode — Código de la mano
   * @returns {{ lines: Array, best: string, reasoning: string }}
   */
  evaluate(context) {
    const { equity, potSize, callAmount, raiseAmount, foldEquity, position, stackSize, handCode } = context;

    const lines = [];

    // === FOLD ===
    const foldEv = 0;
    const foldLine = {
      action: 'FOLD',
      ev: foldEv,
      pros: [
        'Pierdes solo lo ya invertido en el pot',
        'No arriesgas más stack',
        'Manos marginales se castigan caro post-flop'
      ],
      cons: [
        'Regalas el pot al rival',
        'Si el rival hace bluff, pierdes equity',
        'Demasiado tight te hace explotable'
      ],
      risk: 'Ninguno',
      recommendation: equity < 35 ? 'Opción viable' : 'Demasiado tight'
    };
    lines.push(foldLine);

    // === CALL ===
    const callEv = (equity / 100 * (potSize + callAmount)) - callAmount;
    const callProfitable = equity > (callAmount / (potSize + callAmount)) * 100;
    const callLine = {
      action: 'CALL',
      ev: Math.round(callEv * 100) / 100,
      pros: [
        'Mantiene el pot controlado',
        'Permite ver más cartas',
        'Si tienes odds, es rentable a largo plazo',
        'No revelas debilidad ni fuerza'
      ],
      cons: [
        'Sigues invertiendo con mano marginal',
        'Posición post-flop puede ser mala',
        'El rival puede seguir presionando'
      ],
      risk: callProfitable ? 'Bajo' : 'Medio',
      recommendation: callProfitable ? 'Opción viable' : 'Riesgo alto'
    };
    lines.push(callLine);

    // === RAISE ===
    const raiseEv = this._calcRaiseEv(potSize, raiseAmount, equity, foldEquity);
    const raiseLine = {
      action: 'RAISE',
      ev: Math.round(raiseEv * 100) / 100,
      pros: [
        'Puedes ganar el pot inmediatamente (fold equity)',
        'Si tienes mano fuerte, construyes el pot',
        'Te da iniciativa post-flop',
        'Presiona al rival con manos mediocres'
      ],
      cons: [
        'Compromete más stack',
        'Si te llaman, often estás behind',
        'Requiere lectura correcta del rival'
      ],
      risk: foldEquity > 50 ? 'Medio' : 'Alto',
      recommendation: foldEquity > 40 ? 'Opción viable' : 'Especulativo'
    };
    lines.push(raiseLine);

    // Determinar mejor línea
    const best = lines.reduce((prev, curr) => curr.ev > prev.ev ? curr : prev);
    const reasoning = this._generateReasoning(best, lines, context);

    return {
      lines: lines.sort((a, b) => b.ev - a.ev),
      best: best.action,
      reasoning
    };
  }

  _calcRaiseEv(potSize, raiseAmount, equity, foldEquity) {
    const fe = foldEquity / 100;
    const eq = equity / 100;

    // FE * pot + (1-FE) * [eq * (pot+raise) - (1-eq) * raise]
    return fe * potSize + (1 - fe) * (eq * (potSize + raiseAmount) - (1 - eq) * raiseAmount);
  }

  _generateReasoning(best, lines, context) {
    const parts = [];
    
    parts.push(`La mejor línea es ${best.action} con EV de ${best.ev}.`);

    if (best.action === 'CALL' && context.equity > 50) {
      parts.push(`Tienes equity del ${context.equity}% — el call es claramente rentable.`);
    } else if (best.action === 'RAISE' && context.foldEquity > 50) {
      parts.push(`El rival tiene ${context.foldEquity}% de fold equity — raise es rentable por el factor de bluff.`);
    } else if (best.action === 'FOLD') {
      parts.push(`Tu equity (${context.equity}%) no justifica seguir invirtiendo.`);
    }

    // Añadir nota sobre líneas alternativas
    const alt = lines.find(l => l.action !== best.action && l.ev > 0);
    if (alt) {
      parts.push(`Como alternativa, ${alt.action} tiene EV de ${alt.ev}.`);
    }

    return parts.join(' ');
  }
}

module.exports = LineEvaluator;
