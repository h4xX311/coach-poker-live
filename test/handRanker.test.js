/**
 * Tests de handRanker — evaluación de manos, casos adversariales.
 * Ejecutar: node --test test/handRanker.test.js
 *
 * CONVENCIÓN: menor número = mejor mano. Se compara con `<`.
 */
const test = require('node:test');
const assert = require('node:assert');
const HR = require('../src/skills/handRanker');

const R = (s) => HR.fromString(s, 'test');

test('jerarquía base: straight flush > quads > full house > flush > straight > trips > two pair > pair > high card', () => {
  const sf   = HR.rankCards(R('9s8s7s6s5s')); // escalera de color
  const qd   = HR.rankCards(R('9d9c9h9s2d')); // cuatro iguales
  const fh   = HR.rankCards(R('9d9c9h2d2c')); // full house
  const fl   = HR.rankCards(R('9s8s7s6s2s')); // color
  const st   = HR.rankCards(R('9s8d7c6h5s')); // escalera
  const tr   = HR.rankCards(R('9d9c9h2d3c')); // trio
  const tp   = HR.rankCards(R('9d9c8d8h2s')); // dos pares
  const pr   = HR.rankCards(R('9d9c2d3c4s')); // par
  const hc   = HR.rankCards(R('AsKhQdJc9s')); // carta alta
  const orden = [sf, qd, fh, fl, st, tr, tp, pr, hc];
  const nombres = ['escalera de color','cuatro iguales','full house','color','escalera','trío','dos pares','par','carta alta'];
  for (let i = 0; i + 1 < orden.length; i++) {
    assert.ok(orden[i] < orden[i + 1],
      `esperaba ${nombres[i]} < ${nombres[i+1]} (índices ${i}/${i+1})`);
  }
});

test('ADVERSARIAL: par de ases > par de reyes > par de reinas > par de jotas (menor = mejor)', () => {
  assert.ok(HR.rankCards(R('AsAdKhQdJc')) < HR.rankCards(R('KsKdQhJcTd')));
  assert.ok(HR.rankCards(R('KsKdQhJcTd')) < HR.rankCards(R('QsQdJh9c8d')));
  assert.ok(HR.rankCards(R('QsQdJh9c8d')) < HR.rankCards(R('JsJdTh9s8d')));
});

test('ADVERSARIAL: mismo par, kicker distinto manda', () => {
  const a = HR.rankCards(R('AsAdKhQdJc')); // AA + K Q J
  const b = HR.rankCards(R('AsAdKhQdTc')); // AA + K Q T
  assert.ok(a < b, 'AA con kicker J le gana a AA con kicker T');
});

test('ADVERSARIAL: dos pares, mismo par alto, kicker distinto', () => {
  const a = HR.rankCards(R('KsKhQsQd2c')); // K K Q Q 2
  const b = HR.rankCards(R('KsKhQsQd3c')); // K K Q Q 3
  const c = HR.rankCards(R('KsKhJsJd2c')); // K K J J 2
  assert.ok(b < a, 'QQ kicker 3 tiene que ganarle a QQ kicker 2');
  assert.ok(a < c, 'QQ > JJ con mismo kicker');
});

test('ADVERSARIAL: dos full houses — el par MÁS ALTO gana (AAA33 > AAA22 > KKKAA)', () => {
  const aaa33 = HR.rankCards(R('AsAdAh3s3d')); // AAA + 33
  const aaa22 = HR.rankCards(R('AsAdAh2s2d')); // AAA + 22
  const kkkAA = HR.rankCards(R('KsKdKcAsAd')); // KKK + AA
  assert.ok(aaa33 < aaa22, 'con trío de ases, el par de 3 gana al par de 2');
  assert.ok(aaa22 < kkkAA, 'trío de ases > trío de reyes');
});

test('ADVERSARIAL: full house, orden de cartas no importa', () => {
  const a = HR.rankCards(R('AsAdAh2s2d'));
  const c = HR.rankCards(R('2s2d2cAsAd')); // 222AA no es lo mismo, así que uso el mismo set reordenado
  const b = HR.rankCards(R('AhAsAd2d2s')); // mismo set que (a), otro orden
  assert.strictEqual(a, b, 'AAA22 reordenado = AAA22');
  assert.notStrictEqual(a, c); // sanity: 222AA es full house de 2, distinto
});

test('ADVERSARIAL: tríos con kicker distinto (el bug 2 del motor viejo)', () => {
  const a = HR.rankCards(R('KsKhKcQsJd')); // KKK + Q J
  const b = HR.rankCards(R('KsKhKcQsTd')); // KKK + Q T
  assert.ok(a < b, 'KKKQJ > KKKQT — el kicker SÍ se compara');
  assert.notStrictEqual(a, b);
});

test('ADVERSARIAL: la rueda NO es Broadway, y Broadway SÍ es Broadway', () => {
  const rueda    = HR.rankCards(R('As2d3c4h5s'));   // 5 alto (rueda)
  const seis     = HR.rankCards(R('2d3c4h5s6s'));  // 6 alto
  const broadway = HR.rankCards(R('AsKdQcJhTs'));  // A alto
  // La rueda es la PEOR escalera: Broadway < 6-alto < rueda
  assert.ok(broadway < seis, 'Broadway le gana al 6 alto');
  assert.ok(seis < rueda, '6 alto le gana a la rueda (5 alto)');
  assert.notStrictEqual(rueda, broadway, 'la rueda NO puede valer como Broadway');
});

test('ADVERSARIAL: escalera de color — la rueda de color es la peor; color normal es peor que cualquier esc. de color', () => {
  const sfRueda = HR.rankCards(R('As2s3s4s5s')); // esc. de color 5 alto
  const sfSeis  = HR.rankCards(R('2s3s4s5s6s')); // esc. de color 6 alto
  const flush   = HR.rankCards(R('AsJs9s7s5s'));  // color normal
  assert.ok(sfSeis < sfRueda, '6 alto de color > rueda de color');
  assert.ok(sfRueda < flush, 'cualquier escalera de color > color normal');
});

test('funciona con 5, 6 y 7 cartas', () => {
  const a5 = HR.rankCards(R('AsKdQcJhTs'));
  const a6 = HR.rankCards(R('AsKdQcJhTs2d'));
  const a7 = HR.rankCards(R('AsKdQcJhTs2d3c'));
  // Con cartas que no cambian la mejor mano, el valor NO empeora
  assert.ok(a5 <= a6 && a6 <= a7, 'con más cartas la mano no empeora');
  const b6 = HR.rankCards(R('2c3d4h5s7c9d')); // sin escalera
  const b7 = HR.rankCards(R('2c3d4h5s6c9d')); // el 6 completa escalera
  assert.notStrictEqual(b6, b7);
  assert.ok(b7 < b6, 'agregar el 6 completa la escalera');
});

test('rank(board, hole) es equivalente a rankCards(board+hole)', () => {
  const board = R('Td9d4c');
  const hole  = R('AhKh');
  assert.strictEqual(HR.rank(board, hole), HR.rankCards([...board, ...hole]));
});

test('best-5 de 7: usa las 5 mejores, no las 5 primeras', () => {
  // Kh Ks Kd 2c 2d 4h 5h => mejor mano es full house KKK con 22
  const v = HR.rankCards(R('KhKsKd2c2d4h5h'));
  assert.strictEqual(HR.describe(v), 'full house');
  // Kh Ks Kd 2c 3c 4h 5h => trío de reyes (no hay par)
  const t = HR.rankCards(R('KhKsKd2c3c4h5h'));
  assert.strictEqual(HR.describe(t), 'trío');
});

test('rechaza entradas inválidas con mensaje en español', () => {
  assert.throws(() => HR.rankCards(R('AsAdKcKhQsQsTs')), /duplicada/);
  assert.throws(() => HR.rankCards(R('AsAdKcQhJhTs9s8d')), /entre 5 y 7/);
  assert.throws(() => HR.rank([], R('As')), /exactamente 2 cartas/);
  assert.throws(() => HR.fromString('XaAdKcQhJh'), /rank inválido/);
  assert.throws(() => HR.fromString('AhKx'), /palo inválido/);
});
