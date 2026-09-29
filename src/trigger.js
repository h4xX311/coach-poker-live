/**
 * Trigger System — Maneja eventos que activan el agente.
 */

class TriggerSystem {
  constructor(agent) {
    this.agent = agent;
    this.triggers = [];
  }

  /**
   * Registra un trigger desde la configuración YAML.
   * @param {Object} triggerDef — { name, event, agent, action }
   */
  register(triggerDef) {
    this.triggers.push({
      name: triggerDef.name,
      event: triggerDef.event,
      agent: triggerDef.agent,
      action: triggerDef.action,
      enabled: true
    });
    return this;
  }

  /**
   * Dispara un trigger por nombre de evento.
   * @param {string} eventName — Nombre del evento
   * @param {Object} payload — Datos del evento
   * @returns {Object|null} — Resultado de la ejecución
   */
  fire(eventName, payload) {
    const trigger = this.triggers.find(t => t.event === eventName && t.enabled);
    if (!trigger) {
      return null;
    }

    console.log(`\n⚡ Trigger "${trigger.name}" activado por evento "${eventName}"`);
    console.log(`   Acción: ${trigger.action}`);

    if (this.agent && typeof this.agent.execute === 'function') {
      return this.agent.execute(payload);
    }

    return null;
  }

  /**
   * Habilita un trigger.
   */
  enable(name) {
    const t = this.triggers.find(t => t.name === name);
    if (t) t.enabled = true;
    return this;
  }

  /**
   * Deshabilita un trigger.
   */
  disable(name) {
    const t = this.triggers.find(t => t.name === name);
    if (t) t.enabled = false;
    return this;
  }

  /**
   * Lista todos los triggers.
   */
  list() {
    return this.triggers.map(t => ({
      name: t.name,
      event: t.event,
      enabled: t.enabled
    }));
  }
}

module.exports = TriggerSystem;
