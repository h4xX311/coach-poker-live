#!/usr/bin/env node
/**
 * cli.js — Coach de poker calle por calle, en línea de comandos.
 *
 *   node cli.js hand --street flop --hole AhKh --board Td9d4c \
 *                    --pot 30 --toCall 12 --position BB --villainRange "TT+,AKs"
 *
 * Opciones:
 *   --street        preflop | flop | turn | river
 *   --hole          tus 2 cartas, ej. AhKh
 *   --board         comunitarias (omitir en preflop)
 *   --pot           bote actual
 *   --toCall        lo que tenés que poner para seguir (0 si nadieuasive)
 *   --stack         tu stack (opcional, para el sizing de raise)
 *   --position      UTG | HJ | CO | BTN | SB | BB
 *   --villainAction BET | RAISE | CHECK (por defecto CHECK)
 *   --villainRange  rango declarado del rival, ej. "TT+,AKs" (OBLIGATORIO postflop)
 *
 *   node cli.js preflop --hole AhKh --position BTN
 *   node cli.js ranges
 */
const StreetDecider = require('./src/skills/StreetDecider');
const PreflopReference = require('./src/skills/PreflopReference');

const argv = process.argv.slice(2);
const cmd = argv[0];

function parseArgs(args) {
  const out = { _positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._positional.push(a);
    }
  }
  return out;
}

function num(v, def) {
  if (v === undefined || v === true) return def;
  const n = Number(v);
  if (Number.isNaN(n)) return def;
  return n;
}

function line(char = '─', n = 58) { return char.repeat(n); }

function box(titulo, filas) {
  console.log(line());
  console.log(' ' + titulo);
  console.log(line());
  for (const f of filas) {
    if (f === '') { console.log(''); continue; }
    const [k, v] = Array.isArray(f) ? f : [null, f];
    console.log(k ? '  ' + k.padEnd(22) + v : '  ' + v);
  }
  console.log(line());
}

// ------------------------------------------------------------------ hand
function cmdHand(a) {
  const street = a.street && a.street !== '__street__' ? a.street
    : (a._positional[0] === '__street__' ? (a.street || 'flop') : (a._positional[0] || 'flop'));
  const hole = a.hole || a._positional[1];
  if (!hole) {
    console.error('Falta --hole (tus 2 cartas). Ej: --hole AhKh');
    process.exitCode = 1;
    return;
  }
  const input = {
    street,
    hole,
    board: a.board || '',
    pot: num(a.pot, street === 'preflop' ? 1.5 : 30),
    toCall: num(a.toCall, 0),
    stack: num(a.stack, 100),
    position: a.position || a._positional[2] || 'BB',
    villainAction: a.villainAction || (num(a.toCall, 0) > 0 ? 'BET' : 'CHECK'),
    villainRange: a.villainRange || a.villainrange
  };

  const sd = new StreetDecider({ iterations: num(a.iterations, 100000) });
  let r;
  try {
    r = sd.decide(input);
  } catch (e) {
    console.error('\n  BLOQUEADO: ' + e.message + '\n');
    process.exitCode = 2;
    return;
  }

  const ICON = { FOLD: '✗', CHECK: '·', CALL: '→', BET: '★', RAISE: '★' };
  console.log('');
  const filas = [
    ['Calle', r.street],
    ['Tu mano', r.mano],
    ['Board', input.board || '(preflop)'],
    ['Bote / toCall', `${input.pot} / ${input.toCall}`],
    ['Posición', input.position],
    ['Rango del rival', input.villainRange || '(no declarado)'],
    ['Método', r.metodo],
    '',
    null === r.equity ? ['Equity', 'no se calcula preflop sin bet del rival'] : ['Equity', r.equity + '%'],
    ['Breakeven', r.breakeven.toFixed(1) + '%']
  ];
  if (r.boardHumo) filas.push(['Board', r.boardHumo]);
  box('ANÁLISIS', filas);

  console.log('  DECISIÓN: ' + (ICON[r.action] || '') + '  ' + r.action +
    (r.sizing ? `  ${r.sizing}` : ''));
  console.log('');
  console.log('  ' + r.razonamiento);
  console.log('');
  console.log(line('═'));
  console.log('');
}

// ----------------------------------------------------------------- ranges
function cmdRanges() {
  const ref = new PreflopReference();
  console.log('');
  console.log(line('═'));
  console.log('  RANGOS DE APERTURA 6-max  (calculados sobre 1326 combinaciones)');
  console.log(line('═'));
  console.log('  ' + 'posición'.padEnd(10) + 'combinaciones'.padStart(15) + '%'.padStart(9));
  console.log('  ' + line('-', 33));
  for (const p of ref.getPositions()) {
    const r = ref.openPct(p);
    const nota = p === 'BB' ? '  (defiende, no abre)' : '';
    console.log('  ' + p.padEnd(10) + String(r.combinaciones).padStart(15) +
      (r.porcentaje + '%').padStart(9) + nota);
  }
  console.log(line('═'));
  console.log('');
}

// -------------------------------------------------------------------- main
function main() {
  const a = parseArgs(argv.slice(1));
  switch (cmd) {
    case 'hand':
      cmdHand(a);
      break;
    case 'preflop':
    case 'flop':
    case 'turn':
    case 'river':
      // Atajo: la calle es el propio comando.
      a.street = cmd;
      a._positional = ['__street__', ...a._positional];
      cmdHand(a);
      break;
    case 'ranges':
      cmdRanges();
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(fs_readHelp());
      break;
    default:
      console.error('Comando desconocido: "' + cmd + '"');
      console.error(fs_readHelp());
      process.exitCode = 1;
  }
}

function fs_readHelp() {
  return [
    '',
    'Coach de poker calle por calle — CoachPokerLive',
    '',
    '  node cli.js hand --street flop --hole AhKh --board Td9d4c \\',
    '                   --pot 30 --toCall 12 --position BB --villainRange "TT+,AKs"',
    '',
    '  node cli.js preflop --hole AhKh --position BTN',
    '  node cli.js ranges',
    '',
    'En postflop --villainRange es OBLIGATORIO: sin rango declarado el motor',
    'se BLOQUEA en vez de inventarse una equity.',
    ''
  ].join('\n');
}

main();
