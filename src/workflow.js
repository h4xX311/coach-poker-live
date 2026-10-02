/**
 * Workflow Engine — Ejecuta los pasos del agente en orden.
 */

const skills = require('./skills');
const handRanker = require('./handRanker');

class WorkflowEngine {
  constructor(config) {
    this.config = config;
    this.skillInstances = {};
    this._initSkills();
  }

  _initSkills() {
    // Mapeo directo de nombres a clases (evita problemas con el registry)
    const skillMap = {
      HandCodeParser: require('./skills/HandCodeParser'),
      GameRecorder: require('./skills/GameRecorder'),
      HistoryAnalyzer: require('./skills/HistoryAnalyzer'),
      EquityCalculator: require('./skills/EquityCalculator'),
      PotOddsAnalyzer: require('./skills/PotOddsAnalyzer'),
      RangeEstimator: require('./skills/RangeEstimator'),
      LineEvaluator: require('./skills/LineEvaluator'),
      TeachingModule: require('./skills/TeachingModule'),
      PreflopReference: require('./skills/PreflopReference'),
      AdaptiveStrategyEngine: require('./skills/AdaptiveStrategyEngine'),
      SituationDetector: require('./skills/SituationDetector'),
      MultiOpponentHandler: require('./skills/MultiOpponentHandler')
    };

    // Instanciar todos los skills del mapa (no solo los del YAML)
    for (const [name, SkillClass] of Object.entries(skillMap)) {
      try {
        this.skillInstances[name] = new SkillClass();
      } catch (e) {
        this.skillInstances[name] = SkillClass;
      }
    }
  }

  /**
   * Ejecuta el workflow completo para una mano.
   * @param {Object} handState — Estado de la mano
   * @param {string} handState.handCode — Código de la mano (ej: "97s")
   * @param {string} handState.position — Posición (UTG, HJ, CO, BTN, SB, BB)
   * @param {number} handState.potSize — Tamaño del pot
   * @param {number} handState.callAmount — Cantidad a pagar
   * @param {number} handState.raiseAmount — Cantidad a subir
   * @param {string} handState.villainPosition — Posición del rival
   * @param {string} handState.villainAction — Acción del rival (fold, call, raise, bet)
   * @param {number} handState.stackSize — Stack del jugador
   * @param {number} handState.numPlayers — Número de jugadores
   * @param {number} handState.foldEquity — Probabilidad de fold del rival (0-100)
   * @returns {Object} — Análisis completo
   */
  execute(handState) {
    const ctx = {
      handCode: handState.handCode,
      position: handState.position || 'BTN',
      potSize: handState.potSize || 0,
      callAmount: handState.callAmount || 0,
      raiseAmount: handState.raiseAmount !== undefined ? handState.raiseAmount : (handState.callAmount || 0) * 2,
      villainPosition: handState.villainPosition || 'UTG',
      villainAction: handState.villainAction || 'raise',
      stackSize: handState.stackSize || 1000,
      numPlayers: handState.numPlayers || 6,
      foldEquity: handState.foldEquity || 30,
      numOpponents: handState.numOpponents || 1,
      opponentPositions: handState.opponentPositions || [],
      street: handState.street || 'preflop'
    };

    const results = {};

    // Paso 1: Parsear la mano
    const parser = this._getSkill('HandCodeParser');
    results.parsedHand = parser.parse(ctx.handCode);

    // Paso 2: Detectar situación
    const situationDetector = this._getSkill('SituationDetector');
    const isPreflop = !ctx.street || ctx.street === 'preflop';
    if (isPreflop) {
      results.situation = situationDetector.detectPreflop(ctx);
    } else {
      results.situation = situationDetector.detectPostflop(ctx);
    }

    // Paso 3: Consultar referencia preflop
    const preflop = this._getSkill('PreflopReference');
    results.preflopReference = preflop.consult(ctx.handCode, ctx.position);

    // Paso 4: Estimar rangos del rival
    const rangeEst = this._getSkill('RangeEstimator');
    results.rangeEstimate = rangeEst.estimate(ctx.villainPosition, ctx.villainAction, ctx.numPlayers);

    // Paso 5: Calcular equity (con soporte multi-rival)
    const equityCalc = this._getSkill('EquityCalculator');
    const heroCards = [results.parsedHand.card1, results.parsedHand.card2];
    const numOpponents = handState.numOpponents || 1;
    
    if (numOpponents > 1) {
      // Usar MultiOpponentHandler para múltiples rivales
      // Las posiciones de los rivales se calculan automáticamente basándose en la posición del usuario
      const multiHandler = this._getSkill('MultiOpponentHandler');
      const positionOrder = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
      const userPosIndex = positionOrder.indexOf(ctx.position);
      const opponentPositions = [];
      for (let i = userPosIndex + 1; i < positionOrder.length && opponentPositions.length < numOpponents; i++) {
        opponentPositions.push(positionOrder[i]);
      }
      // Si no hay suficientes rivales después, agregar desde el principio
      for (let i = 0; i < userPosIndex && opponentPositions.length < numOpponents; i++) {
        opponentPositions.push(positionOrder[i]);
      }
      
      const opponentRanges = multiHandler.generateOpponentRanges(opponentPositions, ctx.villainAction);
      results.equity = multiHandler.calculateEquityVsMultiple(heroCards, opponentRanges, []);
      results.numOpponents = numOpponents;
      results.opponentPositions = opponentPositions;
    } else {
      // Contra 1 rival, usar cálculo normal
      const villainRange = equityCalc.generateRange(ctx.villainPosition, ctx.villainAction);
      results.equity = equityCalc.calculate(heroCards, villainRange, []);
      results.numOpponents = 1;
      results.opponentPositions = [ctx.villainPosition];
    }

    // Paso 6: Analizar pot odds
    const potOdds = this._getSkill('PotOddsAnalyzer');
    results.potOdds = potOdds.analyze(ctx.potSize, ctx.callAmount, results.equity.equity);

    // Paso 7: Evaluar líneas de juego usando StreetDecider
    const streetDecider = this._getSkill('StreetDecider');
    const heroCardsStr = `${results.parsedHand.card1.rank}${results.parsedHand.card1.suit}${results.parsedHand.card2.rank}${results.parsedHand.card2.suit}`;
    const boardStr = (handState.board || []).join('');
    
    const decision = streetDecider.decide({
      street: isPreflop ? 'preflop' : ctx.street,
      hole: heroCardsStr,
      board: boardStr,
      pot: ctx.potSize,
      toCall: ctx.callAmount,
      stack: ctx.stackSize,
      position: ctx.position,
      villainAction: ctx.villainAction,
      villainRange: '22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s,A2o+,K2o+,Q2o+,J2o+,T2o+,92o+,82o+,72o+,62o+,52o+,42o+,32o'
    });
    
    results.lines = {
      best: decision.action,
      lines: [
        { action: 'FOLD', ev: 0, recommendation: decision.action === 'FOLD' ? 'Correcto' : 'No recomendado' },
        { action: 'CALL', ev: 0, recommendation: decision.action === 'CALL' ? 'Correcto' : 'No recomendado' },
        { action: 'RAISE', ev: 0, recommendation: decision.action === 'RAISE' ? 'Correcto' : 'No recomendado' }
      ],
      reasoning: decision.razonamiento
    };

    // Paso 8: Estrategia adaptativa
    const adaptive = this._getSkill('AdaptiveStrategyEngine');
    const history = this._getSkill('GameRecorder').getRecentHands(50);
    adaptive.updateProfile(history.map(h => ({
      action: h.analysis?.bestLine || 'FOLD',
      analysis: { equity: h.analysis?.equity }
    })));
    results.adaptiveProfile = adaptive.getProfile();
    results.adaptiveAdjustment = adaptive.adapt(
      { action: results.lines.best, reason: results.lines.reasoning },
      { equity: results.equity.equity, position: ctx.position }
    );

    // Paso 9: Explicación pedagógica
    const teaching = this._getSkill('TeachingModule');
    results.explanation = teaching.explain(results);
    results.quickSummary = teaching.quickSummary(results);

    // Paso 10: Guardar en historial (una sola vez)
    const recorder = this._getSkill('GameRecorder');
    results.savedRecord = recorder.record({
      parsedHand: results.parsedHand,
      position: ctx.position,
      action: results.lines.best,
      potSize: ctx.potSize,
      callAmount: ctx.callAmount,
      analysis: results
    });

    // Paso 11: Analizar historial
    const historyAnalyzer = this._getSkill('HistoryAnalyzer');
    const fullHistory = recorder.getHistory().hands;
    results.historyAnalysis = historyAnalyzer.analyze(fullHistory);

    return results;
  }

  _getSkill(name) {
    const skill = this.skillInstances[name];
    if (!skill) {
      throw new Error(`Skill "${name}" no encontrada. Disponibles: ${Object.keys(this.skillInstances).join(', ')}`);
    }
    return skill;
  }

  /**
   * Ejecuta un paso individual del workflow.
   */
  executeStep(stepName, input) {
    const skill = this._getSkill(stepName);
    
    switch (stepName) {
      case 'HandCodeParser':
        return skill.parse(input.handCode);
      case 'PreflopReference':
        return skill.consult(input.handCode, input.position);
      case 'RangeEstimator':
        return skill.estimate(input.position, input.action, input.numPlayers);
      case 'EquityCalculator': {
        const range = skill.generateRange(input.villainPosition, input.villainAction);
        return skill.calculate(input.heroCards, range, input.board || []);
      }
      case 'PotOddsAnalyzer':
        return skill.analyze(input.potSize, input.callAmount, input.equity);
      case 'LineEvaluator':
        return skill.evaluate(input.context);
      case 'StreetDecider':
        return skill.decide(input);
      case 'TeachingModule':
        return skill.explain(input.analysis);
      case 'AdaptiveStrategyEngine':
        return skill.adapt(input.recommendation, input.context);
      case 'HistoryAnalyzer':
        return skill.analyze(input.history);
      case 'GameRecorder':
        return skill.record(input.handData);
      default:
        throw new Error(`Paso "${stepName}" no reconocido en el workflow.`);
    }
  }
}

module.exports = WorkflowEngine;
