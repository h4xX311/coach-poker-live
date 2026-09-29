/**
 * GameRecorder — Guarda cada mano/mesa en un historial estructurado (JSON).
 */

const fs = require('fs');
const path = require('path');

class GameRecorder {
  constructor(dataDir = path.join(__dirname, '..', '..', 'data')) {
    this.dataDir = dataDir;
    this.historyFile = path.join(dataDir, 'history.json');
    this._ensureDataDir();
  }

  _ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify({ hands: [], sessions: [] }, null, 2));
    }
  }

  /**
   * Guarda una mano en el historial.
   * @param {Object} handData — Datos de la mano
   * @returns {Object} — El registro guardado con timestamp
   */
  record(handData) {
    const history = this._loadHistory();

    const entry = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      hand: handData.parsedHand,
      position: handData.position,
      action: handData.action,
      potSize: handData.potSize,
      callAmount: handData.callAmount,
      analysis: {
        equity: handData.analysis?.equity,
        potOdds: handData.analysis?.potOdds,
        bestLine: handData.analysis?.lines?.best,
        ev: handData.analysis?.lines?.lines?.[0]?.ev
      }
    };

    history.hands.push(entry);

    // Mantener solo las últimas 500 manos
    if (history.hands.length > 500) {
      history.hands = history.hands.slice(-500);
    }

    this._saveHistory(history);
    return entry;
  }

  /**
   * Guarda una sesión de juego.
   */
  recordSession(sessionData) {
    const history = this._loadHistory();

    const session = {
      id: this._generateId(),
      startTime: sessionData.startTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      handsPlayed: sessionData.handsPlayed || 0,
      profit: sessionData.profit || 0,
      notes: sessionData.notes || ''
    };

    history.sessions.push(session);

    // Mantener solo las últimas 100 sesiones
    if (history.sessions.length > 100) {
      history.sessions = history.sessions.slice(-100);
    }

    this._saveHistory(history);
    return session;
  }

  /**
   * Devuelve el historial completo.
   */
  getHistory() {
    return this._loadHistory();
  }

  /**
   * Devuelve las últimas N manos.
   */
  getRecentHands(n = 10) {
    const history = this._loadHistory();
    return history.hands.slice(-n);
  }

  /**
   * Limpia el historial.
   */
  clear() {
    const data = { hands: [], sessions: [] };
    this._saveHistory(data);
    return data;
  }

  _loadHistory() {
    try {
      const raw = fs.readFileSync(this.historyFile, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { hands: [], sessions: [] };
    }
  }

  _saveHistory(data) {
    fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = GameRecorder;
