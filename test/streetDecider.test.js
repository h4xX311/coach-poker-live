/**
 * Tests de StreetDecider — decisiones calle por calle.
 * Ejecutar: node --test test/streetDecider.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const SD = require('../src/skills/StreetDecider');

const sd = new SD({ iterations: 60000 });

test('PREFLOP usa el CHART, no equity (equity viene null)', () => {
  const r = sd.decide({
    street: 'preflop', hole: 'AhKh', pot: 1.5, toCall: 0, position: 'BTN',
    villainAction: 'NONE'
  });
  assert.strictEqual(r.action, 'RAISE');
  assert.strictEqual(r.equity, null, 'preflop NO debe calcular equity si no hay bet del rival');
  assert.match(r.metodo, /chart/i);
  assert.match(r.razonamiento, /AKs/);
});

test('PREFLOP: mano mala en UTG foldea, mano buena sube', () => {
  const mala = sd.decide({ street: 'preflop', hole: '7h2h', pot: 1.5, toCall: 0, position: 'UTG', villainAction: 'NONE' });
  const buena = sd.decide({ street: 'preflop', hole: 'AsKs', pot: 1.5, toCall: 0, position: 'UTG', villainAction: 'NONE' });
  assert.strictEqual(mala.action, 'FOLD');
  assert.strictEqual(buena.action, 'RAISE');
});

test('PREFLOP: la BB no abre, foldea o defiende', () => {
  const r = sd.decide({ street: 'preflop', hole: '7h2h', pot: 1.5, toCall: 0, position: 'BB', villainAction: 'NONE' });
  assert.ok(r.action === 'FOLD' || r.action === 'CHECK',
    `la BB no debería RAISE, dio ${r.action}`);
});

test('PREFLOP BLOQUEADO: bet del rival sin villainRange -> throw, no inventa', () => {
  assert.throws(
    () => sd.decide({ street: 'preflop', hole: 'AhKh', pot: 3, toCall: 2, position: 'BB', villainAction: 'RAISE' }),
    /BLOQUEADO/
  );
});

test('POSTFLOP BLOQUEADO: sin villainRange -> throw, no inventa equity', () => {
  assert.throws(
    () => sd.decide({ street: 'flop', hole: 'AhKh', board: 'Td9d4c', pot: 30, toCall: 12, position: 'BB', villainAction: 'BET' }),
    /BLOQUEADO/
  );
});

test('POSTFLOP: el caso de FOLD correcto (el más importante)', () => {
  // AhKh en Td9d4c es dominado por TT+ y no tiene nada: equity ~21%.
  const r = sd.decide({
    street: 'flop', hole: 'AhKh', board: 'Td9d4c', pot: 30, toCall: 12,
    position: 'BB', villainAction: 'BET', villainRange: 'TT+,AKs'
  });
  assert.strictEqual(r.action, 'FOLD');
  assert.ok(r.breakeven > r.equity, `equity ${r.equity}% debe ser < breakeven ${r.breakeven}%`);
  assert.match(r.razonamiento, /Fold/i);
});

test('POSTFLOP: breakeven = toCall / (pot + toCall)', () => {
  const r = sd.decide({
    street: 'flop', hole: 'AsKs', board: 'Td9d4c', pot: 30, toCall: 12,
    position: 'BB', villainAction: 'BET', villainRange: '22+,A2s+,K8s+'
  });
  assert.ok(Math.abs(r.breakeven - (12 / 42 * 100)) < 0.01, 'breakeven = 12/42 = 28.57%');
});

test('POSTFLOP: equity alta + breakeven bajo -> CALL', () => {
  const r = sd.decide({
    street: 'flop', hole: 'AsAc', board: 'Th9d4c', pot: 30, toCall: 6,
    position: 'BB', villainAction: 'BET', villainRange: '22+,A2s+,K8s+,QTs+,JTs'
  });
  assert.ok(['CALL', 'RAISE'].includes(r.action), `esperaba CALL/RAISE, dio ${r.action}`);
  assert.ok(r.equity > r.breakeven, `equity ${r.equity}% debería superar breakeven ${r.breakeven}%`);
});

test('POSTFLOP: board con nuts y equity alta -> BET de valor con sizing', () => {
  const r = sd.decide({
    street: 'flop', hole: 'AsAc', board: 'AhKsQd', pot: 30, toCall: 0,
    position: 'BB', villainAction: 'CHECK', villainRange: '22+,A2s+,K8s+'
  });
  assert.strictEqual(r.action, 'BET');
  assert.ok(r.sizing > 0, 'un bet tiene que llevar tamaño');
});

test('POSTFLOP: en BB/SB el check es gratis (nunca pagás para ver una carta)', () => {
  const r = sd.decide({
    street: 'flop', hole: '9h8h', board: 'Td9d4c', pot: 30, toCall: 0,
    position: 'BB', villainAction: 'CHECK', villainRange: 'TT+,AKs'
  });
  assert.strictEqual(r.action, 'CHECK');
  assert.match(r.razonamiento, /gratis/i);
});

test('POSTFLOP: sizing — board seco se betea más grande que board húmedo', () => {
  const seco = sd.decide({
    street: 'flop', hole: 'AsAc', board: 'Kc7d2c', pot: 30, toCall: 0,
    position: 'BB', villainAction: 'CHECK', villainRange: '22+,A2s+'
  });
  const humedo = sd.decide({
    street: 'flop', hole: 'AsAc', board: 'Kc2c9c', pot: 30, toCall: 0,
    position: 'BB', villainAction: 'CHECK', villainRange: '22+,A2s+'
  });
  assert.strictEqual(seco.boardHumo, 'seco');
  assert.strictEqual(humedo.boardHumo, 'húmedo');
  // La regla de tamaño (75% seco vs 55% húmedo) se comprueba directamente,
  // sin atarlo a que esa mano particular sea un bet.
  const betSeco = sd._betSize(30, 'seco', 'valor');
  const betHumedo = sd._betSize(30, 'húmedo', 'valor');
  assert.ok(betSeco > betHumedo, `seco (${betSeco}) debe ser > húmedo (${betHumedo})`);
});

test('POSTFLOP: valida que el board tenga la cantidad correcta de cartas', () => {
  assert.throws(
    () => sd.decide({ street: 'flop', hole: 'AhKh', board: 'Td9d', pot: 30, toCall: 0, position: 'BB', villainRange: 'TT+' }),
    /3 cartas/
  );
});

test('rechaza entradas inválidas con mensaje en español', () => {
  assert.throws(() => sd.decide({ hole: 'AhKh', pot: 30 }), /falta "street"/);
  assert.throws(() => sd.decide({ street: 'quinta', hole: 'AhKh', pot: 30, villainRange: 'TT+' }), /no reconocida/);
  assert.throws(() => sd.decide({ street: 'flop', hole: 'AhKh', board: 'Td9d4c', pot: 'mucho', villainRange: 'TT+' }), /"pot" debe ser un número/);
});
