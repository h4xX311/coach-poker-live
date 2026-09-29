/**
 * AdaptiveStrategyEngine — Aprende del historial y ajusta recomendaciones
 * según el estilo del jugador (agresivo, tight, loose, equilibrado).
 */

class AdaptiveStrategyEngine {
  constructor() {
    this.playerProfile = {
      style: 'balanced', // tight, loose, aggressive, balanced
      aggression: 0.5,   // 0-1
      tightness: 0.5,    // 0-1
      adaptability: 0.5  // 0-1
    };
  }

  /**
   * Actualiza el perfil del jugador basado en el historial.
   */
  updateProfile(history) {
    if (!history || history.length === 0) return this.playerProfile;

    // Calcular métricas
    let folds = 0, calls = 0, raises = 0;
    let totalEquity = 0, equityCount = 0;

    history.forEach(h => {
      const action = h.analysis?.bestLine || h.action || 'FOLD';
      if (action === 'FOLD') folds++;
      else if (action === 'CALL') calls++;
      else if (action === 'RAISE') raises++;

      if (h.analysis?.equity) {
        totalEquity += h.analysis.equity;
        equityCount++;
      }
    });

    const total = history.length || 1;
    const foldRate = folds / total;
    const raiseRate = raises / total;
    const avgEquity = equityCount > 0 ? totalEquity / equityCount : 50;

    // Determinar estilo
    let style;
    if (foldRate > 0.5) style = 'tight';
    else if (foldRate < 0.25 && raiseRate > 0.3) style = 'aggressive';
    else if (foldRate < 0.2) style = 'loose';
    else style = 'balanced';

    this.playerProfile = {
      style,
      aggression: Math.round(raiseRate * 100) / 100,
      tightness: Math.round(foldRate * 100) / 100,
      adaptability: 0.5,
      avgEquity: Math.round(avgEquity * 100) / 100,
      handsAnalyzed: history.length
    };

    return this.playerProfile;
  }

  /**
   * Ajusta la recomendación según el perfil del jugador.
   */
  adapt(baseRecommendation, context) {
    const { style, aggression, tightness } = this.playerProfile;
    const adjusted = { ...baseRecommendation };
    const notes = [];

    switch (style) {
      case 'tight':
        notes.push('Eres tight — esta recomendación ya es conservadora.');
        // Si es tight, ser un poco más liberal con calls
        if (baseRecommendation.action === 'FOLD' && context.equity > 35) {
          adjusted.action = 'CALL';
          adjusted.reason = 'Ajuste adaptativo: tu estilo tight te hace foldear de más. Con esta equity, el call es rentable.';
        }
        break;

      case 'aggressive':
        notes.push('Eres agresivo — puedes añadir más raises a tu juego.');
        if (baseRecommendation.action === 'CALL' && context.equity > 50) {
          adjusted.action = 'RAISE';
          adjusted.reason = 'Ajuste adaptativo: tu estilo agresivo + equity alta = raise para construir el pot.';
        }
        break;

      case 'loose':
        notes.push('Eres loose — esta recomendación ya es liberal.');
        // Si es loose, ser más conservador
        if (baseRecommendation.action === 'CALL' && context.equity < 45) {
          adjusted.action = 'FOLD';
          adjusted.reason = 'Ajuste adaptativo: tu estilo loose te hace llamar de más. Con esta equity, foldea.';
        }
        break;

      case 'balanced':
      default:
        notes.push('Estilo equilibrado — recomendación estándar.');
        break;
    }

    adjusted.styleNote = notes.join(' ');
    adjusted.playerStyle = style;

    return adjusted;
  }

  /**
   * Devuelve el perfil actual.
   */
  getProfile() {
    return this.playerProfile;
  }

  /**
   * Resetea el perfil.
   */
  reset() {
    this.playerProfile = {
      style: 'balanced',
      aggression: 0.5,
      tightness: 0.5,
      adaptability: 0.5
    };
    return this.playerProfile;
  }
}

module.exports = AdaptiveStrategyEngine;
