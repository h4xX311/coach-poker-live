/**
 * RangeEstimator — Asigna rangos probables a cada rival según posición y acción.
 */

const POSITION_RANGES = {
  UTG:  { vpip: 0.15, pfr: 0.12, description: 'Muy tight — solo manos premium' },
  HJ:   { vpip: 0.22, pfr: 0.18, description: 'Tight — manos fuertes' },
  CO:   { vpip: 0.30, pfr: 0.25, description: 'Moderado — rango amplio' },
  BTN:  { vpip: 0.40, pfr: 0.35, description: 'Loose — rango muy amplio' },
  SB:   { vpip: 0.35, pfr: 0.20, description: 'Moderado — defiende mucho' },
  BB:   { vpip: 0.45, pfr: 0.10, description: 'Loose — defiende con mucho' }
};

// Manas por porcentaje de rango (aproximado)
const RANGE_TIERS = {
  top5: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo'],
  top10: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs'],
  top20: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'AKo', 'AQo', 'AJo', 'KQs', 'KJs', 'QJs', 'JTs'],
  top30: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', 'AKo', 'AQo', 'AJo', 'KQo'],
  top50: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', '98s', '87s', '76s', '65s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo', 'JTo'],
  top100: ['todas']
};

class RangeEstimator {
  /**
   * Estima el rango de un rival basado en posición y acción observada.
   * @param {string} position — UTG, HJ, CO, BTN, SB, BB
   * @param {string} action — fold, call, raise, bet, check
   * @param {number} numPlayers — Número de jugadores en la mano
   * @returns {{ range: string[], tier: string, description: string, vpip: number, pfr: number }}
   */
  estimate(position, action, numPlayers = 6) {
    const pos = (position || 'BTN').toUpperCase();
    const act = (action || 'fold').toLowerCase();

    // Si hizo fold, no importa el rango
    if (act === 'fold') {
      return {
        range: [],
        tier: 'folded',
        description: 'El rival hizo fold — no tiene mano.',
        vpip: 0,
        pfr: 0
      };
    }

    // Determinar tier basado en acción
    let tierKey;
    switch (act) {
      case 'raise':
      case '3bet':
        tierKey = 'top10';
        break;
      case 'bet':
        tierKey = 'top20';
        break;
      case 'call':
        tierKey = 'top30';
        break;
      case 'check':
        tierKey = 'top50';
        break;
      default:
        tierKey = 'top30';
    }

    // Ajustar por posición
    const posData = POSITION_RANGES[pos] || POSITION_RANGES.BB;
    const range = RANGE_TIERS[tierKey] || RANGE_TIERS.top30;

    // Reducir rango si hay pocos jugadores (mesa corta)
    let adjustedRange = range;
    if (numPlayers <= 3) {
      // En mesas cortas, los rangos se amplían
      adjustedRange = tierKey === 'top10' ? RANGE_TIERS.top20 : 
                       tierKey === 'top20' ? RANGE_TIERS.top30 : 
                       tierKey === 'top30' ? RANGE_TIERS.top50 : range;
    }

    const description = `${posData.description}. Acción: ${act}. ${numPlayers} jugadores.`;

    return {
      range: adjustedRange,
      tier: tierKey,
      description,
      vpip: posData.vpip,
      pfr: posData.pfr
    };
  }

  /**
   * Compara la mano del héroe contra el rango estimado del rival.
   */
  compareVsRange(handCode, range) {
    const code = handCode.toUpperCase().replace(/[^0-9TJQKASO]/g, '');
    // Normalizar: rank alto primero
    const R = '23456789TJQKA';
    const m = code.match(/^([2-9TJQKA])([2-9TJQKA])([SO]?)$/i);
    let normalized = code;
    if (m) {
      const i1 = R.indexOf(m[1].toUpperCase());
      const i2 = R.indexOf(m[2].toUpperCase());
      const hi = i1 > i2 ? m[1] : m[2];
      const lo = i1 > i2 ? m[2] : m[1];
      normalized = hi + lo + (m[3] || '').toLowerCase();
    }
    const inRange = range.includes(normalized) || range.includes(normalized + 's') || range.includes(normalized + 'o');
    
    return {
      handCode: normalized,
      inRange,
      rangeSize: range.length,
      percentile: this._getPercentile(normalized, range)
    };
  }

  _getPercentile(code, range) {
    if (range.includes('todas')) return 50;
    const idx = range.indexOf(code);
    if (idx === -1) return 90; // Fuera del rango = mano débil
    return Math.round((1 - idx / range.length) * 100);
  }

  getPositionData(position) {
    return POSITION_RANGES[(position || 'BB').toUpperCase()] || POSITION_RANGES.BB;
  }
}

module.exports = RangeEstimator;
