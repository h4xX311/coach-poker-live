/**
 * MultiOpponentHandler — Maneja manos con múltiples rivales.
 * Calcula equity contra múltiples rangos usando simulación Monte Carlo.
 */

const RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const SUITS = ['s', 'h', 'd', 'c'];

// Generar todas las combinaciones de 2 cartas
const ALL_HANDS = [];
for (let i = 0; i < RANKS.length; i++) {
  for (let j = 0; j < SUITS.length; j++) {
    for (let k = i; k < RANKS.length; k++) {
      for (let l = 0; l < SUITS.length; l++) {
        if (i === k && j >= l) continue;
        ALL_HANDS.push([{ rank: RANKS[i], suit: SUITS[j] }, { rank: RANKS[k], suit: SUITS[l] }]);
      }
    }
  }
}

class MultiOpponentHandler {
  /**
   * Calcula la equity contra múltiples rivales.
   */
  calculateEquityVsMultiple(heroCards, opponentRanges, board = []) {
    if (!opponentRanges || opponentRanges.length === 0) {
      return { equity: 50, wins: 0, ties: 0, losses: 0, total: 0 };
    }

    if (opponentRanges.length === 1) {
      return this._calculateVsSingle(heroCards, opponentRanges[0], board);
    }

    return this._calculateVsMultiple(heroCards, opponentRanges, board);
  }

  _calculateVsSingle(heroCards, villainRange, board) {
    const EquityCalculator = require('./EquityCalculator');
    const calc = new EquityCalculator();
    return calc.calculate(heroCards, villainRange, board);
  }

  /**
   * Simulación Monte Carlo contra múltiples rivales.
   */
  _calculateVsMultiple(heroCards, opponentRanges, board) {
    const numSimulations = 500;
    let wins = 0;
    let ties = 0;
    let losses = 0;

    // Filtrar cartas ya usadas
    const usedCards = [...heroCards, ...board].map(c => `${c.rank}${c.suit}`);
    const availableHands = ALL_HANDS.filter(hand => {
      return !hand.some(c => usedCards.includes(`${c.rank}${c.suit}`));
    });

    for (let i = 0; i < numSimulations; i++) {
      // Generar manos aleatorias para cada rival sin repetir cartas
      const villainHands = this._generateVillainHands(availableHands, opponentRanges.length);
      
      const result = this._evaluateMultiWay(heroCards, villainHands, board);
      if (result > 0) wins++;
      else if (result === 0) ties++;
      else losses++;
    }

    const total = numSimulations;
    const equity = ((wins + ties / 2) / total) * 100;

    return {
      equity: Math.round(equity * 100) / 100,
      wins,
      ties,
      losses,
      total
    };
  }

  /**
   * Genera manos aleatorias para cada rival sin repetir cartas.
   */
  _generateVillainHands(availableHands, numVillains) {
    const hands = [];
    const used = new Set();
    
    for (let v = 0; v < numVillains; v++) {
      let attempts = 0;
      while (attempts < 100) {
        const idx = Math.floor(Math.random() * availableHands.length);
        const hand = availableHands[idx];
        const key = hand.map(c => `${c.rank}${c.suit}`).sort().join(',');
        
        if (!used.has(key)) {
          used.add(key);
          hands.push(hand);
          break;
        }
        attempts++;
      }
    }
    
    return hands;
  }

  /**
   * Evalúa una mano multiway.
   */
  _evaluateMultiWay(heroCards, villainHands, board) {
    const heroScore = this._bestHandScore([...heroCards, ...board]);
    let bestVillain = 0;
    
    for (const villain of villainHands) {
      if (!villain) continue;
      const villainScore = this._bestHandScore([...villain, ...board]);
      if (villainScore > bestVillain) bestVillain = villainScore;
    }

    if (heroScore > bestVillain) return 1;
    if (heroScore < bestVillain) return -1;
    return 0;
  }

  /**
   * Calcula el mejor score de 5 cartas.
   */
  _bestHandScore(cards) {
    if (cards.length < 5) return this._handStrength(cards);
    
    let bestScore = 0;
    for (let a = 0; a < cards.length - 4; a++)
      for (let b = a + 1; b < cards.length - 3; b++)
        for (let c = b + 1; c < cards.length - 2; c++)
          for (let d = c + 1; d < cards.length - 1; d++)
            for (let e = d + 1; e < cards.length; e++) {
              const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
              const score = this._scoreHand(combo);
              if (score > bestScore) bestScore = score;
            }
    return bestScore;
  }

  _handStrength(hand) {
    if (!hand || hand.length < 2) return 0;
    const [c1, c2] = hand;
    const high = Math.max(c1.rank, c2.rank);
    const low = Math.min(c1.rank, c2.rank);
    const suited = c1.suit === c2.suit;
    const paired = c1.rank === c2.rank;
    let score = high * 100 + low;
    if (paired) score += 1000;
    if (suited) score += 50;
    if (high - low === 1) score += 30;
    if (high - low === 2) score += 15;
    return score;
  }

  _scoreHand(cards) {
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const uniqueRanks = [...new Set(ranks)];
    let isStraight = false;
    if (uniqueRanks.length === 5) {
      isStraight = uniqueRanks[0] - uniqueRanks[4] === 4;
      if (!isStraight && uniqueRanks[0] === 14 && uniqueRanks[1] === 5) isStraight = true;
    }
    if (isStraight && isFlush) return 9000000 + ranks[0];
    if (counts[0] === 4) return 8000000 + ranks[0];
    if (counts[0] === 3 && counts[1] === 2) return 7000000 + ranks[0];
    if (isFlush) return 6000000 + ranks[0];
    if (isStraight) return 5000000 + ranks[0];
    if (counts[0] === 3) return 4000000 + ranks[0];
    if (counts[0] === 2 && counts[1] === 2) return 3000000 + ranks[0];
    if (counts[0] === 2) return 2000000 + ranks[0];
    return 1000000 + ranks[0];
  }

  /**
   * Ajusta la recomendación según el número de rivales.
   */
  adjustForNumOpponents(recommendation, numOpponents) {
    const adjustments = {
      1: { action: 'RAISE', reason: 'Contra 1 rival — puedes ser más agresivo' },
      2: { action: 'CALL', reason: 'Contra 2 rivales — juega más conservador' },
      3: { action: 'CALL', reason: 'Contra 3 rivales — solo manos fuertes' },
      4: { action: 'FOLD', reason: 'Contra 4 rivales — foldea manos marginales' },
      5: { action: 'FOLD', reason: 'Contra 5 rivales — solo manos premium' }
    };
    const adj = adjustments[numOpponents] || adjustments[1];
    return {
      action: adj.action,
      reason: `${recommendation.reason} | Ajuste: ${adj.reason}`
    };
  }

  /**
   * Genera rangos para múltiples rivales según sus posiciones.
   */
  generateOpponentRanges(opponentPositions, villainAction) {
    const EquityCalculator = require('./EquityCalculator');
    const calc = new EquityCalculator();
    return opponentPositions.map(pos => calc.generateRange(pos, villainAction));
  }
}

module.exports = MultiOpponentHandler;
