/**
 * HandCodeParser — Interpreta manos en formato corto (AKo, QJs, 97s, 97o)
 * y las convierte en datos estructurados.
 */

const RANK_MAP = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };

class HandCodeParser {
  /**
   * @param {string} code — e.g. "AKo", "QJs", "97s", "T9o"
   * @returns {{ ranks: number[], suited: boolean, code: string, description: string }}
   */
  parse(code) {
    if (!code || typeof code !== 'string') {
      throw new Error(`HandCodeParser: código inválido "${code}"`);
    }

    const trimmed = code.trim().toUpperCase();

    // Validar formato: 2 chars de rango + sufijo (s/o) o 3 chars (e.g. "97s")
    const match = trimmed.match(/^([2-9TJQKA])([2-9TJQKA])([SO])$/i);
    if (!match) {
      throw new Error(
        `HandCodeParser: formato "${code}" no reconocido. ` +
        `Usa formato como AKo, QJs, 97s, T9o.`
      );
    }

    const rank1 = RANK_MAP[match[1]];
    const rank2 = RANK_MAP[match[2]];
    const suffix = match[3].toLowerCase();

    if (!rank1 || !rank2) {
      throw new Error(`HandCodeParser: rango no válido en "${code}"`);
    }

    const suited = suffix === 's';
    const offsuit = suffix === 'o';

    // Determinar par vs. mano no-pair
    const isPair = rank1 === rank2;

    // Cartas reales (asignar palo arbitrario para suited)
    let card1, card2;
    if (suited) {
      card1 = { rank: Math.max(rank1, rank2), suit: 's' };
      card2 = { rank: Math.min(rank1, rank2), suit: 's' };
    } else if (offsuit) {
      card1 = { rank: Math.max(rank1, rank2), suit: 's' };
      card2 = { rank: Math.min(rank1, rank2), suit: 'h' };
    } else {
      // Sin sufijo — asumir offsuit genérico
      card1 = { rank: Math.max(rank1, rank2), suit: 's' };
      card2 = { rank: Math.min(rank1, rank2), suit: 'h' };
    }

    const description = this._describe(card1, card2, suited, isPair);

    return {
      code: trimmed,
      ranks: [Math.max(rank1, rank2), Math.min(rank1, rank2)],
      suited,
      isPair,
      card1,
      card2,
      description
    };
  }

  _describe(card1, card2, suited, isPair) {
    const rankName = (r) => {
      const names = { 14: 'As', 13: 'Rey', 12: 'Reina', 11: 'Jota', 10: 'Diez' };
      return names[r] || String(r);
    };

    const suitName = (s) => ({ s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' }[s]);

    if (isPair) {
      return `Par de ${rankName(card1.rank)}s`;
    }

    const high = rankName(card1.rank);
    const low = rankName(card2.rank);
    const suitText = suited ? ` del mismo palo (${suitName(card1.suit)})` : ' de distinto palo';

    return `${high} y ${low}${suitText}`;
  }
}

module.exports = HandCodeParser;
