/**
 * AI Coach — Módulo de coaching con IA usando OpenCode Zen.
 * Endpoint: https://opencode.ai/zen/v1/chat/completions
 * Auth: Authorization: Bearer $OPENCODE_API_KEY
 */

const https = require('https');

class AICoach {
  constructor() {
    this.modelId = 'longcat-2.5-preview-free';
    this.apiKey = process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_KEY || '';
    this.apiUrl = 'https://opencode.ai/zen/v1/chat/completions';
  }

  /**
   * Genera un análisis de coaching con IA basado en el análisis del workflow.
   */
  async generateCoaching(analysis, context) {
    const prompt = this._buildPrompt(analysis, context);

    try {
      const response = await this._callZenAPI(prompt);
      return response;
    } catch (e) {
      console.error('AI Coach error:', e.message);
      return this._fallbackCoaching(analysis, context);
    }
  }

  /**
   * Construye el prompt para el modelo Zen.
   */
  _buildPrompt(analysis, context) {
    const hand = analysis.parsedHand;
    const equity = analysis.equity;
    const potOdds = analysis.potOdds;
    const lines = analysis.lines;
    const preflop = analysis.preflopReference;
    const ranges = analysis.rangeEstimate;

    return `Eres un entrenador profesional de póker con 20 años de experiencia. Analiza la siguiente mano y da consejos claros, prácticos y educativos.

## Contexto de la mano
- Mano del jugador: ${hand.description} (${hand.code})
- Posición del jugador: ${context.position}
- Calle: ${context.street || 'preflop'}
- Pot size: ${context.potSize}
- Cantidad a pagar: ${context.callAmount}
- Cantidad a subir: ${context.raiseAmount}
- Stack del jugador: ${context.stackSize}
- Número de jugadores: ${context.numPlayers || 6}

## Análisis técnico
- Equity: ${equity.equity}%
- Pot odds: ${potOdds.potOddsPercent}%
- EV del call: ${potOdds.ev}
- Mejor línea: ${lines.best}
- Razón: ${lines.reasoning}

## Referencia preflop
- Acción recomendada: ${preflop.action}
- Razón: ${preflop.reason}

## Rangos del rival
- Tier: ${ranges.tier}
- Descripción: ${ranges.description}

## Líneas de juego
${lines.lines.map(l => `- ${l.action}: EV ${l.ev} (${l.recommendation})`).join('\n')}

## Tu tarea
Proporciona un análisis de coaching que incluya:
1. **Resumen ejecutivo** (1-2 frases)
2. **Análisis de la situación** (2-3 frases)
3. **Recomendación clara** (qué hacer y por qué)
4. **Error común** (qué evitar)
5. **Consejo profesional** (tip avanzado)

Sé directo, práctico y educativo. Usa un tono de mentor profesional. Responde en español.`;
  }

  /**
   * Llama a la API de OpenCode Zen.
   */
  _callZenAPI(prompt) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: this.modelId,
        messages: [
          { role: 'system', content: 'Eres un entrenador profesional de póker. Responde siempre en español.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      const url = new URL(this.apiUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].message) {
              resolve(json.choices[0].message.content);
            } else if (json.error) {
              reject(new Error(json.error.message || 'Error de Zen API'));
            } else {
              reject(new Error('Respuesta inválida de Zen API'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Coaching de respaldo basado en reglas.
   */
  _fallbackCoaching(analysis, context) {
    const lines = analysis.lines;
    const equity = analysis.equity;
    const potOdds = analysis.potOdds;
    const best = lines.best;

    const advice = {
      FOLD: `**Resumen ejecutivo:** Foldea esta mano. No tienes suficiente equity para justificar seguir invirtiendo.\n\n**Análisis de la situación:** Tu equity es del ${equity.equity}%, lo cual está por debajo de los pot odds (${potOdds.potOddsPercent}%). Esto significa que a largo plazo perdiendo fichas con esta mano.\n\n**Recomendación clara:** Foldea. No arriesgues más fichas en esta mano.\n\n**Error común:** Muchos jugadores llaman con manos marginales "por curiosidad" o "para ver qué pasa". Esto es caro a largo plazo.\n\n**Consejo profesional:** Aprender a foldear manos marginales es una de las habilidades más rentables en el póker.`,
      CALL: `**Resumen ejecutivo:** Paga el call. Tienes odds suficientes para ver la siguiente calle.\n\n**Análisis de la situación:** Tu equity es del ${equity.equity}%, lo cual supera los pot odds (${potOdds.potOddsPercent}%). El call es rentable a largo plazo.\n\n**Recomendación clara:** Paga el call. No subas a menos que tengas una lectura fuerte del rival.\n\n**Error común:** Subir con manos que solo pueden ganar por bluff. Si tienes equity, el call es más rentable.\n\n**Consejo profesional:** El call con odds positivas es la base del póker rentable. Confía en las matemáticas.`,
      RAISE: `**Resumen ejecutivo:** Sube. Tienes ventaja o suficiente fold equity para ganar el pot.\n\n**Análisis de la situación:** Tu equity es del ${equity.equity}%. El raise te da la iniciativa y puede hacer que el rival foldee.\n\n**Recomendación clara:** Sube para construir el pot o para ganar el pot inmediatamente.\n\n**Error común:** Hacer raises demasiado pequeños que no presionan al rival.\n\n**Consejo profesional:** El raise puede ser rentable por fold equity incluso con manos no tan fuertes. No subestimes el poder de la iniciativa.`
    };

    return advice[best] || 'No se pudo generar un análisis. Intenta de nuevo.';
  }

  /**
   * Genera una respuesta rápida para Telegram.
   */
  async generateTelegramResponse(analysis, context) {
    const fullCoaching = await this.generateCoaching(analysis, context);
    const lines = analysis.lines;
    const equity = analysis.equity;
    const potOdds = analysis.potOdds;

    return `🃏 *Coach Poker Live*

🎴 *Tu mano:* ${analysis.parsedHand.description}
📍 *Posición:* ${context.position}
📊 *Equity:* ${equity.equity}%
💰 *Pot Odds:* ${potOdds.potOddsPercent}%
⚡ *EV:* ${potOdds.ev > 0 ? '+' : ''}${potOdds.ev}

🎯 *Recomendación: ${lines.best}*

${fullCoaching}

---
*Coach Poker Live v2.0 con OpenCode Zen*`;
  }

  /**
   * Verifica si la API key está configurada.
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = AICoach;
