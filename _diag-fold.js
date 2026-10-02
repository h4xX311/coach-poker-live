/**
 * Diagnostico: por que AhKh en Td9d4c vs "TT+,AKs" no da FOLD.
 * NO ajusta nada. Solo mide y reporta.
 */
const EquityCalculator = require('./src/skills/EquityCalculator');

const eq = new EquityCalculator();
const L = (t) => console.log(t);

L('='.repeat(64));
L('CASO QUE FALLA EL TEST');
L('='.repeat(64));
L('AhKh en Td9d4c vs "TT+,AKs", pot 30, toCall 12');
L('breakeven = 12/42 = ' + (12 / 42 * 100).toFixed(2) + '%');
L('El test espera FOLD (equity ~21%).');
L('');

const r = eq.calculate('AhKh', 'TT+,AKs', 'Td9d4c', { iterations: 200000 });
L('Resultado del motor:');
L('  equity      = ' + r.equity + '%');
L('  metodo      = ' + r.metodo);
L('  iteraciones = ' + r.iteraciones);
L('  wins/ties/losses = ' + r.wins + ' / ' + r.ties + ' / ' + r.losses);
L('  combos rango= ' + r.manosEnRango + ' (bloqueadas ' + r.manosBloqueadas + ')');
L('');
L('  Te matan:');
for (const k of r.teMatan) {
  L('    ' + k.mano.padEnd(5) + ' ' + k.vecesQueTeMate + ' veces (' + k.frecuenciaComoMate.toFixed(2) + '%)');
}

L('');
L('='.repeat(64));
L('CONTROLES: el motor acierta en lo simple?');
L('='.repeat(64));
const c1 = eq.calculate('AsAc', 'TT+', 'Kh7d2c', { iterations: 200000 });
L('AsAc vs TT+ en Kh7d2c (seco): ' + c1.equity + '%   [esperado ~78-82%]');

const c2 = eq.calculate('AsAc', '72o', 'Kh7d2c', { iterations: 200000 });
L('AsAc vs 72o en Kh7d2c:        ' + c2.equity + '%   [esperado ~78-85%]');

const c3 = eq.calculate('AhKh', '72o', 'Kh7d2c', { iterations: 200000 });
L('AhKh vs 72o en Kh7d2c:         ' + c3.equity + '%   [esperado ~85-92%]');

L('');
L('='.repeat(64));
L('GROUND TRUTH ASIMETRICO (BRIEF.md)');
L('='.repeat(64));
const gt = [
  ['AsAc', '7c7c', 82, 'AA vs 77'],
  ['AsAc', '9c9c', 82, 'AA vs 99'],
  ['AsAc', 'TcTc', 82, 'AA vs TT'],
  ['AsAc', 'KcKc', 82, 'AA vs KK'],
  ['AcKc', 'AcKc', 50, 'AKs vs AKs (SIMETRICO, no prueba nada)'],
  ['AcKc', 'AhKh', 57.5, 'AKs vs AKo'],
  ['8c7c', 'AhKh', 38.7, '87s vs AKo']
];
for (const [h, rg, exp, nota] of gt) {
  try {
    const x = eq.calculate(h, rg, [], { iterations: 200000 });
    const d = (x.equity - exp).toFixed(1);
    L(h.padEnd(6) + ' vs ' + rg.padEnd(8) + ' = ' + String(x.equity).padStart(6) +
      '%  [esp ' + exp + '%]  d=' + d.padStart(6) + '   ' + nota);
  } catch (e) {
    L(h + ' vs ' + rg + ' ERROR: ' + e.message);
  }
}
