/**
 * Skill registry — Importa y registra todos los skills del agente.
 */

const HandCodeParser = require('./HandCodeParser');
const GameRecorder = require('./GameRecorder');
const HistoryAnalyzer = require('./HistoryAnalyzer');
const EquityCalculator = require('./EquityCalculator');
const PotOddsAnalyzer = require('./PotOddsAnalyzer');
const RangeEstimator = require('./RangeEstimator');
const LineEvaluator = require('./LineEvaluator');
const TeachingModule = require('./TeachingModule');
const PreflopReference = require('./PreflopReference');
const AdaptiveStrategyEngine = require('./AdaptiveStrategyEngine');
const DrawDetector = require('./DrawDetector');

module.exports = {
  HandCodeParser,
  GameRecorder,
  HistoryAnalyzer,
  EquityCalculator,
  PotOddsAnalyzer,
  RangeEstimator,
  LineEvaluator,
  TeachingModule,
  PreflopReference,
  AdaptiveStrategyEngine,
  DrawDetector,
  SituationDetector: require('./SituationDetector'),
  MultiOpponentHandler: require('./MultiOpponentHandler'),
  StreetDecider: require('./StreetDecider'),
  handRanker: require('./handRanker')
};
