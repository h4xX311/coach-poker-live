/**
 * HistoryAnalyzer — Revisa patrones de juego y evolución del jugador.
 */

class HistoryAnalyzer {
  /**
   * Analiza el historial de manos para detectar patrones.
   * @param {Array} history — Historial de manos
   * @returns {{ patterns: Array, evolution: Object, recommendations: Array }}
   */
  analyze(history) {
    if (!history || !Array.isArray(history) || history.length === 0) {
      return {
        patterns: ['Sin historial suficiente — juega más manos para analizar patrones.'],
        evolution: { trend: 'neutral', handsAnalyzed: 0 },
        recommendations: []
      };
    }

    const patterns = this._detectPatterns(history);
    const evolution = this._analyzeEvolution(history);
    const recommendations = this._generateRecommendations(patterns, evolution);

    return {
      patterns,
      evolution,
      recommendations
    };
  }

  _detectPatterns(history) {
    const patterns = [];

    // Contar acciones
    const actions = { FOLD: 0, CALL: 0, RAISE: 0 };
    let totalEquity = 0;
    let equityCount = 0;
    let wins = 0;
    let losses = 0;

    history.forEach(h => {
      const action = h.analysis?.bestLine || h.action || 'FOLD';
      if (actions[action] !== undefined) actions[action]++;
      
      if (h.analysis?.equity) {
        totalEquity += h.analysis.equity;
        equityCount++;
      }
    });

    const total = history.length;
    const foldPct = Math.round((actions.FOLD / total) * 100);
    const callPct = Math.round((actions.CALL / total) * 100);
    const raisePct = Math.round((actions.RAISE / total) * 100);

    // Patrón: Fold excesivo
    if (foldPct > 60) {
      patterns.push(`🔴 Fold excesivo: ${foldPct}% de las manos. Estás muy tight — considera ampliar tu rango.`);
    } else if (foldPct < 20) {
      patterns.push(`🟡 Muy loose: solo foldeas el ${foldPct}%. Cuidado con jugar demasiadas manos.`);
    } else {
      patterns.push(`🟢 Balance de fold saludable: ${foldPct}%.`);
    }

    // Patrón: Equity promedio
    if (equityCount > 0) {
      const avgEquity = Math.round((totalEquity / equityCount) * 100) / 100;
      if (avgEquity > 55) {
        patterns.push(`🟢 Equity promedio alto: ${avgEquity}% — estás jugando manos fuertes.`);
      } else if (avgEquity < 45) {
        patterns.push(`🔴 Equity promedio bajo: ${avgEquity}% — estás llamando con manos débiles.`);
      } else {
        patterns.push(`🟡 Equity promedio: ${avgEquity}% — rango equilibrado.`);
      }
    }

    // Patrón: Uso de raise
    if (raisePct < 10 && total > 20) {
      patterns.push(`🟡 Poco uso del raise (${raisePct}%) — considera ser más agresivo.`);
    } else if (raisePct > 40) {
      patterns.push(`🟡 Raise frecuente (${raisePct}%) — asegúrate de tener respaldo.`);
    }

    // Patrón: Tamaño del historial
    if (total < 20) {
      patterns.push(`📊 Historial pequeño (${total} manos) — los patrones no son estadísticamente significativos aún.`);
    } else {
      patterns.push(`📊 ${total} manos analizadas — patrones confiables.`);
    }

    return patterns;
  }

  _analyzeEvolution(history) {
    if (history.length < 10) {
      return { trend: 'insufficient_data', handsAnalyzed: history.length };
    }

    // Comparar primera mitad vs segunda mitad
    const mid = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, mid);
    const secondHalf = history.slice(mid);

    const firstAvg = this._avgEquity(firstHalf);
    const secondAvg = this._avgEquity(secondHalf);

    const diff = secondAvg - firstAvg;

    let trend;
    if (diff > 5) trend = 'improving';
    else if (diff < -5) trend = 'declining';
    else trend = 'stable';

    return {
      trend,
      handsAnalyzed: history.length,
      firstHalfAvgEquity: firstAvg,
      secondHalfAvgEquity: secondAvg,
      equityDelta: Math.round(diff * 100) / 100
    };
  }

  _avgEquity(hands) {
    let total = 0;
    let count = 0;
    hands.forEach(h => {
      if (h.analysis?.equity) {
        total += h.analysis.equity;
        count++;
      }
    });
    return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
  }

  _generateRecommendations(patterns, evolution) {
    const recs = [];

    if (evolution.trend === 'improving') {
      recs.push('📈 Vas mejorando — sigue con la misma estrategia.');
    } else if (evolution.trend === 'declining') {
      recs.push('📉 Tu juego está empeorando — revisa si estás tiltando o jugando fuera de tu rango.');
    }

    // Recomendaciones basadas en patrones
    patterns.forEach(p => {
      if (p.includes('Fold excesivo')) {
        recs.push('💡 Prueba abrir tu rango desde CO y BTN.');
      }
      if (p.includes('Muy loose')) {
        recs.push('💡 Sé más selectivo preflop — calidad sobre cantidad.');
      }
      if (p.includes('equity promedio bajo')) {
        recs.push('💡 Evita llamar con manos por debajo del 40% de equity.');
      }
      if (p.includes('Poco uso del raise')) {
        recs.push('💡 Incorpora más raises para ganar iniciativa.');
      }
    });

    return recs.length > 0 ? recs : ['✅ No se detectan problemas mayores.'];
  }
}

module.exports = HistoryAnalyzer;
