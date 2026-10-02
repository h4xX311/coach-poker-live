/**
 * CoachPokerLive Agent — Agente entrenador de póker en vivo.
 * Carga la configuración YAML y ejecuta el workflow completo.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const WorkflowEngine = require('./workflow');
const TriggerSystem = require('./trigger');

class CoachPokerLiveAgent {
  constructor(configPath) {
    this.configPath = configPath || path.join(__dirname, '..', 'CoachPokerLive.yaml');
    this.config = null;
    this.workflow = null;
    this.triggerSystem = null;
    this._loadConfig();
  }

  /**
   * Carga la configuración desde el archivo YAML.
   */
  _loadConfig() {
    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.load(fileContents);
    } catch (e) {
      throw new Error(`No se pudo cargar la configuración: ${e.message}`);
    }

    // Inicializar workflow
    if (this.config.agents && this.config.agents.length > 0) {
      const agentConfig = this.config.agents[0];
      this.workflow = new WorkflowEngine(agentConfig);

      // Inicializar triggers
      this.triggerSystem = new TriggerSystem(this);
      if (this.config.triggers) {
        this.config.triggers.forEach(t => this.triggerSystem.register(t));
      }
    }
  }

  /**
   * Analiza una mano y devuelve el informe estratégico completo.
   * @param {Object} handState — Estado de la mano
   * @returns {Object} — Análisis completo
   */
  analyze(handState) {
    if (!this.workflow) {
      throw new Error('El workflow no está inicializado.');
    }

    // Validar entrada
    if (!handState.handCode) {
      throw new Error('Se requiere handCode (ej: "97s", "AKo")');
    }

    // Ejecutar workflow
    const analysis = this.workflow.execute(handState);

    // Formatear salida según config
    return this._formatOutput(analysis);
  }

  /**
   * Formatea la salida según la configuración del YAML.
   */
  _formatOutput(analysis) {
    const outputConfig = this.config.agents[0].output;

    const result = {
      success: true,
      format: outputConfig.format,
      timestamp: new Date().toISOString(),
      hand: analysis.parsedHand,
      position: analysis.situation?.position || analysis.adaptiveAdjustment?.playerStyle || 'unknown',
      analysis: {
        situation: analysis.situation,
        preflop: analysis.preflopReference,
        equity: analysis.equity,
        potOdds: analysis.potOdds,
        ranges: analysis.rangeEstimate,
        lines: analysis.lines,
        adaptive: analysis.adaptiveAdjustment,
        history: analysis.historyAnalysis,
        numOpponents: analysis.numOpponents || 1
      },
      recommendation: {
        action: analysis.adaptiveAdjustment?.action || analysis.lines?.best || analysis.situation?.recommendation?.action || 'FOLD',
        reasoning: analysis.adaptiveAdjustment?.reason || analysis.lines?.reasoning || analysis.situation?.recommendation?.reason || 'No se pudo generar recomendación',
        styleNote: analysis.adaptiveAdjustment?.styleNote || ''
      },
      explanation: analysis.explanation,
      quickSummary: analysis.quickSummary,
      recordId: analysis.savedRecord?.id
    };

    return result;
  }

  /**
   * Ejecuta un paso individual del workflow.
   */
  executeStep(stepName, input) {
    if (!this.workflow) {
      throw new Error('El workflow no está inicializado.');
    }
    return this.workflow.executeStep(stepName, input);
  }

  /**
   * Dispara un trigger.
   */
  fireTrigger(eventName, payload) {
    if (!this.triggerSystem) {
      throw new Error('El sistema de triggers no está inicializado.');
    }
    return this.triggerSystem.fire(eventName, payload);
  }

  /**
   * Devuelve información del agente.
   */
  getInfo() {
    const agentConfig = this.config.agents[0];
    return {
      name: agentConfig.name,
      role: agentConfig.role,
      description: agentConfig.description,
      skills: agentConfig.skills.map(s => s.name),
      workflow: agentConfig.workflow.map(w => w.step),
      triggers: this.triggerSystem ? this.triggerSystem.list() : []
    };
  }

  /**
   * Devuelve la configuración cargada.
   */
  getConfig() {
    return this.config;
  }
}

module.exports = CoachPokerLiveAgent;
