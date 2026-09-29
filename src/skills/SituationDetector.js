/**
 * SituationDetector — Detecta la situación actual de la mano.
 * Maneja múltiples rivales y todas las situaciones posibles.
 */

class SituationDetector {
  /**
   * Detecta la situación preflop.
   * @param {Object} ctx — Contexto de la mano
   * @returns {Object} — Situación detectada
   */
  detectPreflop(ctx) {
    const { position, villainAction, potSize, callAmount, raiseAmount, numPlayers, numOpponents, opponentPositions } = ctx;

    const isIP = this._isIP(position, numPlayers);
    const isOOP = !isIP;
    const stackDepth = this._getStackDepth(ctx.stackSize, potSize);
    const numOpp = numOpponents || 1;

    // Situaciones preflop según número de rivales
    if (villainAction === 'fold' || villainAction === 'check') {
      return {
        street: 'preflop',
        situation: 'unraised',
        description: `Pot sin subir — ${numOpp} rival${numOpp > 1 ? 'es' : ''} en la mano`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getUnraisedRecommendation(position, stackDepth, numOpp)
      };
    }

    if (villainAction === 'raise') {
      return {
        street: 'preflop',
        situation: 'facing_raise',
        description: `Te enfrentas a un raise — ${numOpp} rival${numOpp > 1 ? 'es' : ''} en la mano`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingRaiseRecommendation(position, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === '3bet') {
      return {
        street: 'preflop',
        situation: 'facing_3bet',
        description: `Te enfrentas a un 3-bet de ${numOpp} rival${numOpp > 1 ? 'es' : ''}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacing3BetRecommendation(position, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === '4bet') {
      return {
        street: 'preflop',
        situation: 'facing_4bet',
        description: `Te enfrentas a un 4-bet de ${numOpp} rival${numOpp > 1 ? 'es' : ''}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacing4BetRecommendation(position, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === 'call') {
      return {
        street: 'preflop',
        situation: 'facing_call',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} llamaron — pot multijugador`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingCallRecommendation(position, stackDepth, isIP, numOpp)
      };
    }

    return {
      street: 'preflop',
      situation: 'unknown',
      description: 'Situación no identificada',
      isIP,
      isOOP,
      stackDepth,
      numOpponents: numOpp,
      recommendation: { action: 'FOLD', reason: 'Situación no clara' }
    };
  }

  /**
   * Detecta la situación postflop.
   */
  detectPostflop(ctx) {
    const { street, villainAction, potSize, callAmount, raiseAmount, numPlayers, position, numOpponents } = ctx;

    const isIP = this._isIP(position, numPlayers);
    const isOOP = !isIP;
    const stackDepth = this._getStackDepth(ctx.stackSize, potSize);
    const numOpp = numOpponents || 1;

    if (villainAction === 'bet') {
      return {
        street,
        situation: 'facing_bet',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} apostaron en ${street}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingBetRecommendation(street, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === 'check') {
      return {
        street,
        situation: 'facing_check',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} hicieron check en ${street}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingCheckRecommendation(street, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === 'raise') {
      return {
        street,
        situation: 'facing_raise_postflop',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} subieron en ${street}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingRaisePostflopRecommendation(street, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === 'check_raise') {
      return {
        street,
        situation: 'facing_check_raise',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} hicieron check-raise en ${street}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingCheckRaiseRecommendation(street, stackDepth, isIP, numOpp)
      };
    }

    if (villainAction === 'donk_bet') {
      return {
        street,
        situation: 'facing_donk_bet',
        description: `${numOpp} rival${numOpp > 1 ? 'es' : ''} hicieron donk bet en ${street}`,
        isIP,
        isOOP,
        stackDepth,
        numOpponents: numOpp,
        recommendation: this._getFacingDonkBetRecommendation(street, stackDepth, isIP, numOpp)
      };
    }

    return {
      street,
      situation: 'unknown',
      description: 'Situación no identificada',
      isIP,
      isOOP,
      stackDepth,
      numOpponents: numOpp,
      recommendation: { action: 'CHECK', reason: 'Situación no clara' }
    };
  }

  _isIP(position, numPlayers) {
    // IP se calcula automáticamente basándose en la posición del usuario
    // y el número de rivales en la mano
    const latePositions = ['CO', 'BTN'];
    const middlePositions = ['HJ'];
    const earlyPositions = ['UTG'];
    const blinds = ['SB', 'BB'];
    
    if (numPlayers <= 2) return true; // Heads-up: siempre IP
    if (numPlayers <= 3) return latePositions.includes(position) || position === 'SB';
    if (numPlayers <= 5) return latePositions.includes(position) || position === 'SB';
    
    // En mesas 6-max:
    // - CO, BTN: IP contra la mayoría
    // - HJ: IP contra BTN, SB, BB
    // - UTG: OOP contra todos
    // - SB, BB: OOP contra todos excepto el otro blind
    if (latePositions.includes(position)) return true;
    if (middlePositions.includes(position)) return true; // HJ es IP contra BTN, SB, BB
    if (earlyPositions.includes(position)) return false; // UTG es OOP
    if (blinds.includes(position)) return false; // Ciegas son OOP
    return false;
  }

  _getStackDepth(stackSize, potSize) {
    const bb = potSize / 1.5;
    const stackBB = stackSize / bb;
    if (stackBB < 10) return 'short';
    if (stackBB < 20) return 'medium';
    return 'deep';
  }

  // Recomendaciones preflop con múltiples rivales
  _getUnraisedRecommendation(position, stackDepth, numOpponents) {
    if (numOpponents >= 4) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — solo manos premium` };
    if (numOpponents >= 3) return { action: 'CALL', reason: `Contra ${numOpponents} rivales — juega tight` };
    if (stackDepth === 'short') return { action: 'RAISE', reason: 'Stack corto — abre para ganar el pot' };
    return { action: 'RAISE', reason: `Abre desde ${position} contra ${numOpponents} rival${numOpponents > 1 ? 'es' : ''}` };
  }

  _getFacingRaiseRecommendation(position, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 3) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    if (stackDepth === 'short') return { action: 'CALL', reason: 'Stack corto — llama y ve el flop' };
    if (isIP) return { action: 'CALL', reason: 'En posición — llama y juega postflop' };
    return { action: 'RAISE', reason: 'Fuera de posición — 3-bet para tomar iniciativa' };
  }

  _getFacing3BetRecommendation(position, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 2) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    if (stackDepth === 'short') return { action: 'FOLD', reason: 'Stack corto — fold' };
    return { action: 'CALL', reason: 'Llama y juega postflop' };
  }

  _getFacing4BetRecommendation(position, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 2) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    if (stackDepth === 'short') return { action: 'FOLD', reason: 'Stack corto — fold' };
    return { action: 'CALL', reason: 'Llama y ve el showdown' };
  }

  _getFacingCallRecommendation(position, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 3) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    return { action: 'RAISE', reason: `Pot multijugador — sube para aislar` };
  }

  // Recomendaciones postflop con múltiples rivales
  _getFacingBetRecommendation(street, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 3) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    if (street === 'flop') return { action: 'CALL', reason: 'Flop — llama con manos fuertes y draws' };
    if (street === 'turn') return { action: 'CALL', reason: 'Turn — evalúa según pot odds' };
    return { action: 'CALL', reason: 'River — decide según pot odds' };
  }

  _getFacingCheckRecommendation(street, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 3) return { action: 'CHECK', reason: `Contra ${numOpponents} rivales — check` };
    if (isIP) return { action: 'BET', reason: 'En posición — apuesta para ganar el pot' };
    return { action: 'CHECK', reason: 'Fuera de posición — check y ve el showdown' };
  }

  _getFacingRaisePostflopRecommendation(street, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 2) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    if (stackDepth === 'short') return { action: 'FOLD', reason: 'Stack corto — fold' };
    return { action: 'CALL', reason: 'Llama y evalúa el showdown' };
  }

  _getFacingCheckRaiseRecommendation(street, stackDepth, isIP, numOpponents) {
    return { action: 'FOLD', reason: 'Check-raise indica mano fuerte — fold' };
  }

  _getFacingDonkBetRecommendation(street, stackDepth, isIP, numOpponents) {
    if (numOpponents >= 2) return { action: 'FOLD', reason: `Contra ${numOpponents} rivales — fold` };
    return { action: 'CALL', reason: 'Donk bet — llama y evalúa' };
  }
}

module.exports = SituationDetector;
