// Extraer los specs directamente del archivo y calcular el % real
const fs = require('fs');
const EC = require('./src/skills/EquityCalculator');

const src = fs.readFileSync('./src/skills/PreflopReference.js', 'utf8');
const ec = new EC();

// Parsear el bloque OPEN_RANGES: UTG: { spec: '...' }
const re = /^\s*(UTG|HJ|CO|BTN|SB|BB):\s*\{\s*\n\s*spec:\s*'([^']+)'/gm;

const oficial = { UTG: 14.3, HJ: 18.9, CO: 25.5, BTN: 43.3, SB: 33.0, BB: null };
const TOTAL = 1326;

console.log('POS  |  CALCULADO  |  OFICIAL  |  DELTA');
console.log('-----+-------------+-----------+--------');

let m;
while ((m = re.exec(src)) !== null) {
  const pos = m[1];
  const spec = m[2];
  try {
    const parsed = ec.parseRange(spec);
    let n = 0;
    for (const c of parsed) n += c.combos.length;
    const pct = (n / TOTAL) * 100;
    const off = oficial[pos];
    const delta = off === null ? '   n/a' : (pct - off).toFixed(1).padStart(6);
    console.log(
      pos.padEnd(4) + ' |' + (pct.toFixed(2) + '%').padStart(11) + ' |' +
      (off === null ? '   n/a' : (off + '%').padStart(9)) + ' |' + delta
    );
  } catch (e) {
    console.log(pos.padEnd(4) + ' | ERROR: ' + e.message);
  }
}
