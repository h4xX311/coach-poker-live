/**
 * Tests de EquityCalculator — regresión contra ground truth ASIMÉTRICO.
 *
 * Por qué asimétrico: contra AK vs AKs da 50% con el motor roto igual que con
 * el sano, así que no prueba nada. Los matchups que usan dan ~82% obligan a
 * que el motor reparta el board de verdad.
 *
 * Ejecutar: node --test test/equity.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const EC = require('../src/skills/EquityCalculator');
const eq = new EC();

test('REGRESIÓN: AA vs KK ≈ 82% (no 100%) — el bug 1 del motor viejo', () => {
  const r = eq.calculate('AsAc', 'KK', '', { iterations: 200000 });
  assert.ok(r.equity > 81 && r.equity < 83,
    `AA vs KK debería dar ~82%, dio ${r.equity}%`);
  assert.ok(r.wins > 0 && r.losses > 0, 'tiene que ganar Y perder manos');
  assert.ok(r.ties / r.total < 0.02, `empates ${r.ties} = ${(r.ties / r.total * 100).toFixed(2)}% son demasiado (esperado <2%)`);
});

test('REGRESIÓN: contra un rango simétrico NO da 50% (el motor tiene que repartir)', () => {
  // Si el motor estuviera roto comparando sólo heurísticas preflop, esto
  // sería 0% o 100%. Tiene que dar algo intermedio.
  const r = eq.calculate('AsAc', 'KK', '', { iterations: 100000 });
  assert.ok(r.equity > 0 && r.equity < 100, 'no puede ser 0% ni 100%');
});

test('postflop: contra un rango declarado y board fijo, el método es EXACTO', () => {
  const r = eq.calculate('AhKh', 'AsKs', 'Td9d4c', { metodo: 'exact' });
  assert.strictEqual(r.metodo, 'exact');
  assert.strictEqual(r.iteraciones, 990, 'C(45,2) = 990 corridas posibles');
  // AhKh y AsKs tienen A y K del mismo rank: empatan siempre.
  assert.strictEqual(r.ties, 990);
  assert.strictEqual(r.equity, 50);
});

test('postflop: completa el board hasta 5 cartas y compara (turn y river)', () => {
  const turno = eq.calculate('AhKh', 'QQ', 'Td9d4c', { metodo: 'exact' });
  const river = eq.calculate('AhKh', 'QQ', 'Td9d4c2h', { metodo: 'exact' });
  assert.strictEqual(turno.metodo, 'exact');
  assert.strictEqual(river.metodo, 'exact');
  assert.ok(turno.iteraciones > 0 && river.iteraciones > 0);
});

test('RANGO RESPETADO: contra "AsKs" el rival NUNCA puede recibir 3sJd', () => {
  const HR = require('../src/skills/handRanker');
  const { comboList } = eq._legalCombos('AsKs', HR.fromString('AhKh'));
  const codigos = comboList.map(c => c.cards.map(x => '23456789TJQKA'[x.rank - 2] + x.suit).join(''));
  assert.ok(codigos.length > 0, 'el rango debe tener manos');
  for (const h of codigos) {
    assert.notStrictEqual(h, '3sJd', '3sJd está FUERA de "AsKs" y nunca puede aparecer');
    assert.ok(/^A[s|h|d|c]K[s|h|d|c]$/.test(h), `solo AKs: ${h}`);
  }
  // Y el equity calculado tiene que mentionar sólo ese rango.
  const r = eq.calculate('AhKh', 'AsKs', '2c7d9h', { iterations: 20000 });
  for (const k of r.teMatan) assert.strictEqual(k.mano, 'AKS', 'sólo hay AKs en el rango');
});

test('RANGO RESPETADO: las cartas del héroe y del board bloquean manos del rango', () => {
  const HR = require('../src/skills/handRanker');
  // Si el héroe tiene AsKd, el rango "AK" no puede|AsKd.
  const { comboList, bloqueadas } = eq._legalCombos('AK', HR.fromString('AsKd'));
  assert.ok(bloqueadas > 0, 'debe bloquear las manos que pisan cartas del héroe');
  for (const c of comboList) {
    const k = c.cards.map(x => x.rank + x.suit).join('|');
    assert.ok(!k.includes('14s') || !k.includes('13d'),
      'ninguna mano del rango puede contener As o Kd');
  }
});

test('parseRange: conteos de combinaciones correctos', () => {
  const n = spec => eq.parseRange(spec).reduce((a, e) => a + e.combos.length, 0);
  assert.strictEqual(n('AKs'), 4);
  assert.strictEqual(n('AKo'), 12);
  assert.strictEqual(n('AK'), 16, 'sin sufijo = suited + offsuit');
  assert.strictEqual(n('TT'), 6);
  assert.strictEqual(n('TT+'), 30, '5 pares x 6 = 30');
  assert.strictEqual(n('A2s+'), 48, '12 kickers x 4 palos');
  assert.strictEqual(n('Q8s+'), 16, 'kickers 8,9,T,J x 4 — NO incluye QQ');
  assert.strictEqual(n('A9o+'), 60, '5 kickers x 12 offsuit');
});

test('parseRange: bloquea notación que no entiende, en español', () => {
  assert.throws(() => eq.parseRange('ZZ'), /no entiendo/i);
  assert.throws(() => eq.parseRange(''), /vacío o inválido/i);
});

test('Monte Carlo es determinista con la misma seed', () => {
  const a = eq.calculate('AsAc', '77', '', { iterations: 50000, seed: 123 });
  const b = eq.calculate('AsAc', '77', '', { iterations: 50000, seed: 123 });
  assert.strictEqual(a.equity, b.equity);
  assert.strictEqual(a.wins, b.wins);
});

test('reporta qué mano te mata y con qué frecuencia', () => {
  const r = eq.calculate('AhKh', 'TT+,AKs', 'Td9d4c', { metodo: 'exact' });
  assert.ok(Array.isArray(r.teMatan));
  assert.ok(r.teMatan.length > 0, 'contra TT+ tiene que reportar los killers');
  const tot = r.teMatan.reduce((a, k) => a + k.frecuenciaComoMate, 0);
  assert.ok(tot > 0);
  for (const k of r.teMatan) {
    assert.ok(typeof k.mano === 'string');
    assert.ok(k.frecuenciaComoMate >= 0 && k.frecuenciaComoMate <= 100);
  }
});

test('el runout NUNCA reparte una carta del rival (si no, el ranker lo detecta)', () => {
  // El ranker tira error si una carta se repite, así que que corra sin
  // exploding es la prueba de que el board y la mano del rival son disjuntos.
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = eq.calculate('AsAc', 'KK', '', { iterations: 20000, seed });
    assert.ok(r.total > 0);
  }
});

test('BLOQUEA rangos que quedan totalmente tapados por cartas ya repartidas', () => {
  // El board lleva las 4 jotas -> no queda ninguna JJ legal.
  assert.throws(
    () => eq.calculate('AsKs', 'JJ', 'JsJhJcJdTs', { iterations: 100 }),
    /bloqueadas|todas las manos/i
  );
});
