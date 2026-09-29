/**
 * CoachPokerLive — Agente entrenador de póker en vivo.
 * Punto de entrada principal.
 */

const CoachPokerLiveAgent = require('./src/agent');

// Crear instancia del agente
const agent = new CoachPokerLiveAgent();

// ============================================================
// MODO DE USO
// ============================================================

// Ejemplo 1: Analizar una mano directamente
// const result = agent.analyze({
//   handCode: '97s',
//   position: 'CO',
//   potSize: 100,
//   callAmount: 30,
//   raiseAmount: 80,
//   villainPosition: 'BTN',
//   villainAction: 'raise',
//   stackSize: 1000,
//   numPlayers: 6,
//   foldEquity: 35
// });
// console.log(JSON.stringify(result, null, 2));

// Ejemplo 2: Usar el trigger
// const result = agent.fireTrigger('new_hand_state', {
//   handCode: 'AKo',
//   position: 'UTG',
//   potSize: 50,
//   callAmount: 20,
//   raiseAmount: 60,
//   villainPosition: 'BB',
//   villainAction: 'call',
//   stackSize: 1500,
//   numPlayers: 4,
//   foldEquity: 25
// });

// ============================================================
// CLI INTERACTIVO
// ============================================================

function printBanner() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🃏 COACH POKER LIVE v1.0 🃏                    ║');
  console.log('║     Tu entrenador estratégico de póker en vivo          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

function printHelp() {
  console.log('Uso: node index.js [opciones]');
  console.log('');
  console.log('Opciones:');
  console.log('  --mano <codigo>     Código de la mano (ej: 97s, AKo, QJs)');
  console.log('  --pos <posicion>    Tu posición (UTG, HJ, CO, BTN, SB, BB)');
  console.log('  --pot <tamaño>      Tamaño del pot');
  console.log('  --call <cantidad>   Cantidad a pagar');
  console.log('  --raise <cantidad>  Cantidad a subir');
  console.log('  --rival <pos>       Posición del rival');
  console.log('  --accion <acción>   Acción del rival (fold, call, raise, bet)');
  console.log('  --stack <tamaño>    Tu stack');
  console.log('  --jugadores <n>     Número de jugadores');
  console.log('  --foldeq <pct>      Fold equity del rival (0-100)');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node index.js --mano 97s --pos CO --pot 100 --call 30 --raise 80 --rival BTN --accion raise');
  console.log('');
  console.log('Comandos especiales:');
  console.log('  --help              Muestra esta ayuda');
  console.log('  --info              Información del agente');
  console.log('');
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        result[key] = value;
        i++;
      }
    }
  }
  return result;
}

function printResult(result) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    📊 RESULTADO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Mano: ${result.hand.description} (${result.hand.code})`);
  console.log(`Posición: ${result.analysis.preflopReference.position}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  PREFLOP');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Acción: ${result.analysis.preflopReference.action}`);
  console.log(`  ${result.analysis.preflopReference.reason}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  EQUITY Y POT ODDS');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Equity: ${result.analysis.equity.equity}%`);
  console.log(`  Pot Odds: ${result.analysis.potOdds.potOddsPercent}%`);
  console.log(`  EV del call: ${result.analysis.potOdds.ev > 0 ? '+' : ''}${result.analysis.potOdds.ev}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  RANGOS DEL RIVAL');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Tier: ${result.analysis.ranges.tier}`);
  console.log(`  ${result.analysis.ranges.description}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  LÍNEAS DE JUEGO');
  console.log('───────────────────────────────────────────────────────────');
  result.analysis.lines.lines.forEach((l, i) => {
    const marker = i === 0 ? '✅' : '  ';
    console.log(`  ${marker} ${l.action} — EV: ${l.ev > 0 ? '+' : ''}${l.ev} (${l.recommendation})`);
  });
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  🎯 RECOMENDACIÓN');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  ${result.recommendation.action}`);
  console.log(`  ${result.recommendation.reasoning}`);
  if (result.recommendation.styleNote) {
    console.log(`  ${result.recommendation.styleNote}`);
  }
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  📚 EXPLICACIÓN');
  console.log('───────────────────────────────────────────────────────────');
  console.log(result.explanation);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Registro guardado: ${result.recordId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printBanner();
    printHelp();
    return;
  }

  if (args.includes('--info')) {
    printBanner();
    const info = agent.getInfo();
    console.log('Agente:', info.name);
    console.log('Rol:', info.role);
    console.log('Descripción:', info.description);
    console.log('Skills:', info.skills.join(', '));
    console.log('Workflow:', info.workflow.join(' → '));
    console.log('Triggers:', info.triggers.map(t => `${t.name} (${t.event})`).join(', '));
    return;
  }

  const params = parseArgs(args);

  if (!params.mano) {
    console.log('❌ Error: Se requiere --mano <codigo>');
    console.log('Usa --help para ver la ayuda.');
    process.exit(1);
  }

  printBanner();

  try {
    const result = agent.analyze({
      handCode: params.mano,
      position: params.pos || 'BTN',
      potSize: parseFloat(params.pot) || 100,
      callAmount: parseFloat(params.call) || 30,
      raiseAmount: parseFloat(params.raise) || 80,
      villainPosition: params.rival || 'UTG',
      villainAction: params.accion || 'raise',
      stackSize: parseFloat(params.stack) || 1000,
      numPlayers: parseInt(params.jugadores) || 6,
      foldEquity: parseFloat(params.foldeq) || 30
    });

    printResult(result);
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

// Exportar para uso como módulo
module.exports = { CoachPokerLiveAgent, agent };
