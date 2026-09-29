/**
 * TeachingModule — Explica la lógica paso a paso como un coach humano.
 */

class TeachingModule {
  /**
   * Genera una explicación pedagógica del análisis.
   * @param {Object} analysis — Resultado del workflow completo
   * @returns {string} — Explicación paso a paso
   */
  explain(analysis) {
    const sections = [];

    // 1. Contexto de la mano
    sections.push(this._explainContext(analysis));

    // 2. Análisis preflop
    sections.push(this._explainPreflop(analysis));

    // 3. Equity y pot odds
    sections.push(this._explainMath(analysis));

    // 4. Rangos del rival
    sections.push(this._explainRanges(analysis));

    // 5. Líneas de juego
    sections.push(this._explainLines(analysis));

    // 6. Conclusión
    sections.push(this._explainConclusion(analysis));

    // 7. Lección clave
    sections.push(this._keyLesson(analysis));

    return sections.join('\n\n');
  }

  _explainContext(a) {
    const h = a.parsedHand;
    return `📋 **TU MANO**\nTienes ${h.description} (${h.code}). ${
      h.isPair ? 'Es un par — tienes un proyecto de trío.' :
      h.suited ? 'Es suited — tienes potencial de flush.' :
      'Es offsuit — menos potencial de draw.'
    } Posición: ${a.position || 'No especificada'}.`;
  }

  _explainPreflop(a) {
    const ref = a.preflopReference;
    return `📊 **ANÁLISIS PREFLOP**\n${ref.reason}\nAcción recomendada: **${ref.action}** (${ref.color}).`;
  }

  _explainMath(a) {
    const eq = a.equity;
    const po = a.potOdds;
    return `🧮 **EQUITY Y POT ODDS**\nTu equity es del **${eq.equity}%** contra el rango del rival. Los pot odds son **${po.potOddsPercent}%**. ${
      po.profitable 
        ? `Como tu equity (${eq.equity}%) supera los pot odds (${po.potOddsPercent}%), el call es **rentable** a largo plazo.` 
        : `Como tu equity (${eq.equity}%) es menor a los pot odds (${po.potOddsPercent}%), el call **no es rentable** a largo plazo.`
    }\nEV del call: ${po.ev > 0 ? '+' : ''}${po.ev} chips.`;
  }

  _explainRanges(a) {
    const r = a.rangeEstimate;
    return `🎯 **RANGOS DEL RIVAL**\n${r.description}\nRango estimado: **${r.tier}** (${r.range.length} manos). ${
      r.range.includes('todas') ? 'El rango es muy amplio — incluye casi todas las manos.' :
      `Manos típicas: ${r.range.slice(0, 8).join(', ')}${r.range.length > 8 ? '...' : ''}.`
    }`;
  }

  _explainLines(a) {
    const lines = a.lines;
    const best = lines.lines[0];
    let text = `🛤️ **LÍNEAS DE JUEGO**\n`;
    lines.lines.forEach((l, i) => {
      const marker = i === 0 ? '✅' : '  ';
      text += `${marker} **${l.action}** — EV: ${l.ev > 0 ? '+' : ''}${l.ev} (${l.recommendation})\n`;
    });
    text += `\n**Recomendación: ${best.action}** — ${lines.reasoning}`;
    return text;
  }

  _explainConclusion(a) {
    const best = a.lines.best;
    const actions = {
      FOLD: 'Foldea. No inviertas más fichas en esta mano.',
      CALL: 'Paga el call. Tienes odds suficientes para ver el siguiente street.',
      RAISE: 'Sube. Tienes ventaja o suficiente fold equity para ganar el pot.'
    };
    return `🎯 **CONCLUSIÓN**\n${actions[best] || 'Evalúa la situación.'}`;
  }

  _keyLesson(a) {
    const lessons = {
      FOLD: '🟡 **LECCIÓN:** Aprender a foldear manos marginales es clave para no perder fichas a largo plazo. No todas las manos se juegan.',
      CALL: '🟢 **LECCIÓN:** El call con odds positivas es rentable a largo plazo. Confía en las matemáticas.',
      RAISE: '🔴 **LECCIÓN:** El raise puede ser rentable por fold equity incluso con manos no tan fuertes. No subestimes el poder de la iniciativa.'
    };
    return lessons[a.lines.best] || '🟡 **LECCIÓN:** Cada mano es una decisión matemática a largo plazo.';
  }

  /**
   * Genera un resumen rápido (formato corto).
   */
  quickSummary(analysis) {
    return {
      hand: analysis.parsedHand.description,
      action: analysis.lines.best,
      equity: analysis.equity.equity,
      ev: analysis.lines.lines[0].ev,
      oneLiner: this._oneLiner(analysis)
    };
  }

  _oneLiner(a) {
    const best = a.lines.best;
    const eq = a.equity.equity;
    return `${a.lines.best} — equity ${eq}% (${eq > 50 ? 'favor' : 'contra'}), EV ${a.lines.lines[0].ev > 0 ? '+' : ''}${a.lines.lines[0].ev}.`;
  }
}

module.exports = TeachingModule;
