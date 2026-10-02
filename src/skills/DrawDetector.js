/**
 * DrawDetector — draws, outs y sobrepares. EXACTOS, no estimados.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POR QUE EXISTE
 * `StreetDecider` clasifica el board como "seco" o "humedo" y nada mas.
 * Eso alcanza para elegir un sizing, pero NO para jugar turn y river.
 * En esas calles la pregunta no es "la equity supera el breakeven?" sino
 * "cuanto me falta, de que cartas, y cuantas le hacen eso al rival?".
 *
 * ═══════════════════════════════════════════════════════════════════
 * METODO: EXHAUSTIVO, NO MONTE CARLO
 * Se enumeran las cartas que faltan (47 flop, 45 turn, 43 river) y se
 * evalua la mano del heroe con cada una. Son <= 47 evaluaciones, no
 * 200.000 muestreos: el resultado es EXACTO y repetible entre corridas.
 *
 * MATEMATICA QUE NO SE PUEDE HACER MAL
 *   - 13 cartas por palo. Un flush draw con 4 cartas vistas deja
 *     13 - 4 = 9 outs. NO "9 menos las vistas" (eso da 5 y arruina todo).
 *   - 4 cartas por rank. Una escalera abierta son 2 ranks x 4 = 8 outs.
 */

const HR = require('./handRanker');

const SUITS = ['s', 'h', 'd', 'c'];
const RANK_CHARS = '23456789TJQKA';
const POR_PALO = 13;
const POR_RANK = 4;
const LLAMADAS_POR_CALLE = { preflop: 5, flop: 2, turn: 1, river: 0 };

/** Ranks de una escalera de 5 cartas. La rueda es A-5-4-3-2. */
function ranksDeEscalera(alto) {
  if (alto === 5) return [2, 3, 4, 5, 14];
  return [alto - 4, alto - 3, alto - 2, alto - 1, alto];
}

/**
 * Escaleras hechas y draws de escalera sobre un set de ranks unicos.
 *
 * OESD (open-ended): faltan 4 seguidos y el rank que falta es un EXTREMO.
 *   Ej 8,9,T,J -> falta el 7 o el Q. 2 ranks x 4 cartas = 8 outs.
 * Gutshot: faltan 4 seguidos y el rank que falta es INTERIOR.
 *   Ej 8,9,T,Q -> falta la J. 4 outs.
 * Doble gutshot: un mismo rank completa DOS escaleras distintas.
 */
function analizarEscaleras(rankSet) {
  let made = false;
  let altoHecho = 0;

  // ── Pasada 1: escalera YA HECHA ──
  for (let alto = 5; alto <= 14; alto++) {
    const need = ranksDeEscalera(alto);
    if (need.every(r => rankSet.has(r))) {
      made = true;
      if (alto > altoHecho) altoHecho = alto;
    }
  }

  const extremos = new Set();
  const interiores = new Map();

  // ── Pasada 2: draws de UNA carta ──
  // BUG ARREGLADO: antes contaba CUALQUIER escalera completable con una carta,
  // sin preguntar si esa escalera MEJORA la que ya tenemos. Con 9,8 contra
  // 7,6,5 (escalera de 9 hecha) reportaba "falta el 4" — pero el 4 completa la
  // escalera de 8, que es PEOR. No es un out: la mano no mejora.
  // Se descarta toda escalera cuyo alto sea <= el que ya se tiene.
  for (let alto = 5; alto <= 14; alto++) {
    if (alto <= altoHecho) continue;
    const need = ranksDeEscalera(alto);
    const faltan = need.filter(r => !rankSet.has(r));
    if (faltan.length !== 1) continue;

    const carta = faltan[0];
    const esExtremo = carta === need[0] || carta === need[4];
    if (esExtremo) {
      extremos.add(carta);
    } else {
      if (!interiores.has(carta)) interiores.set(carta, []);
      interiores.get(carta).push(alto);
    }
  }

  const dobleGutshot = [...interiores.values()].some(v => v.length >= 2);

  // Secuencia mas larga (para detectar backdoor).
  const desc = [...rankSet].sort((a, b) => b - a);
  let secuenciaMasLarga = 1;
  let actual = 1;
  for (let i = 1; i < desc.length; i++) {
    actual = desc[i - 1] - desc[i] === 1 ? actual + 1 : 1;
    if (actual > secuenciaMasLarga) secuenciaMasLarga = actual;
  }

  return {
    made,
    alto: altoHecho || null,
    extremos: [...extremos].sort((a, b) => a - b),
    interiores: [...interiores.entries()].map(([rank, altos]) => ({ rank, altos })),
    dobleGutshot,
    secuenciaMasLarga,
    backdoor: secuenciaMasLarga === 3,
    ranksQueCompletan: new Set([...extremos, ...interiores.keys()])
  };
}

class DrawDetector {
  /**
   * Analiza la mano del heroe contra el board.
   * @param {string} hole  "AhKh"
   * @param {string} board "Td9d4c" | "Td9d4c2h" | "Td9d4c2h7s" | ""
   */
  analyze(hole, board) {
    const hero = HR.fromString(String(hole).trim(), 'hole');
    const boardCards = board ? HR.fromString(String(board).trim(), 'board') : [];
    const street = this._streetOf(boardCards);

    // OJO: las cartas del ranker traen `rank` como NUMERO (10), pero el filtro
    // de abajo comparaba contra la LETRA ("Th"). Nunca coincidían, así que una
    // carta ya presente en el board entraba de nuevo en la lista de restantes
    // y el ranker tiraba "carta duplicada".
    const usados = new Set([...hero, ...boardCards].map(c => `${c.rank}${c.suit}`));
    const restantes = [];
    for (let r = 2; r <= 14; r++) {
      for (const s of SUITS) {
        if (!usados.has(`${r}${s}`)) {
          restantes.push({ rank: r, suit: s });
        }
      }
    }

    const valorActual = HR.rankCards([...hero, ...boardCards]);
    const catActual = HR.categoryOf(valorActual);
    const esValor = catActual >= HR.CAT.TWO_PAIR;
    const rankSet = new Set([...hero, ...boardCards].map(c => c.rank));
    const esc = analizarEscaleras(rankSet);

    // ── Color ──
    const porPalo = { s: 0, h: 0, d: 0, c: 0 };
    for (const c of [...hero, ...boardCards]) porPalo[c.suit]++;
    let paloMax = SUITS[0];
    for (const s of SUITS) if (porPalo[s] > porPalo[paloMax]) paloMax = s;
    const nPalo = porPalo[paloMax];
    const colorRestantes = nPalo === 4 ? POR_PALO - nPalo : 0;

    // ── Sobrepares (solo board sin pareja) ──
    const ranksBoard = boardCards.map(c => c.rank);
    const boardConPareja = ranksBoard.some((r, i) => ranksBoard.indexOf(r) !== i);
    const boardAltoNum = ranksBoard.length ? Math.max(...ranksBoard) : 0;
    const sobrepares = boardConPareja
      ? []
      : hero
        .filter(c => c.rank > boardAltoNum)
        .map(c => ({ carta: `${RANK_CHARS[c.rank - 2]}${c.suit}`, rank: c.rank }));

    // ── Enumeracion EXACTA de cartas que mejoran la mano ──
    // En el RIVER no hay runout: la mano ya esta completa. Enumerar una carta
    // mas daba 8 cartas y el ranker (que acepta de 5 a 7) tiraba. Ademas en
    // river no existen outs por definicion: no llega ninguna carta mas.
    const flushDraw = nPalo === 4;
    const llamadas = LLAMADAS_POR_CALLE[street];
    const tieneFuturo = llamadas > 0;
    const outs = [];
    if (tieneFuturo) {
      for (const c of restantes) {
      const nuevo = HR.rankCards([...hero, ...boardCards, c]);
      if (nuevo >= valorActual) continue;

      const catNuevo = HR.categoryOf(nuevo);
      const letra = `${RANK_CHARS[c.rank - 2]}${c.suit}`;

      let tipo;
      if (flushDraw && c.suit === paloMax && catNuevo === HR.CAT.FLUSH) tipo = 'flush';
      else if (esc.ranksQueCompletan.has(c.rank) && catNuevo >= HR.CAT.STRAIGHT) tipo = 'escalera';
      else if (sobrepares.some(s => s.rank === c.rank)) tipo = 'sobrepar';
      else if (catNuevo === HR.CAT.PAIR || catNuevo === HR.CAT.TWO_PAIR) tipo = 'pareja';
      else tipo = 'mejora';

      outs.push({ carta: letra, tipo, categoria: HR.CAT_NAMES[catNuevo] });
      }
    }

    const porTipo = {};
    for (const o of outs) porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1;

    // ── LIMPIOS vs COMPARTIDOS ──
    // Este es el punto que separa a un coach de una calculadora.
    // Que una carta "mejore mi mano" NO alcanza para contarla como out.
    //
    //   - flush / escalera: outs de verdad. Son los unicos que justifican
    //     un semibluff, porque me hacen una mano que el rival no tiene.
    //   - sobrepar: empareja mi carta hole, no el board. El rival solo
    //     mejora si tambien tiene ese rank, asi que cuenta como limpio
    //     solo si el board NO tiene pareja.
    //   - pareja: la carta empareja el BOARD. El rival mejora IGUAL que
    //     yo. Contarla como out es el error clasico: con 9h8h en Th9d4c el
    //     modulo dice 39 outs, y de esos 39 casi todos son del mismo palo
    //     para los dos. Bluffear asi es tirar el bote.
    const outsDeDraw = outs.filter(o => o.tipo === 'flush' || o.tipo === 'escalera');
    const outsDeOvercard = outs.filter(o => o.tipo === 'sobrepar');
    const outsCompartidos = outs.filter(o => o.tipo === 'pareja');
    const outsLimpios = boardConPareja
      ? outsDeDraw
      : [...outsDeDraw, ...outsDeOvercard];

    return {
      street,
      manoActual: HR.CAT_NAMES[catActual],
      esValor: catActual >= HR.CAT.TWO_PAIR,

      color: {
        palo: paloMax,
        cartasEnPalo: nPalo,
        flushDraw,
        backdoor: nPalo === 3,
        hecho: nPalo >= 5,
        outs: tieneFuturo ? colorRestantes : 0
      },

      escalera: {
        hecho: esc.made,
        alto: esc.alto,
        oesd: esc.extremos.length ? esc.extremos : null,
        oesdCartas: esc.extremos.length * POR_RANK,
        gutshots: esc.interiores.length ? esc.interiores : null,
        dobleGutshot: esc.dobleGutshot,
        backdoor: esc.backdoor,
        secuenciaMasLarga: esc.secuenciaMasLarga
      },

      boardConPareja,
      boardAlto: boardAltoNum ? RANK_CHARS[boardAltoNum - 2] : null,
      sobrepares,

      outs,
      outsPorTipo: porTipo,
      outsDeDraw: outsDeDraw.length,
      outsDeOvercard: outsDeOvercard.length,
      outsCompartidos: outsCompartidos.length,
      outsLimpios: outsLimpios.length,
      puedeSemibluff: tieneFuturo && outsLimpios.length > 0,
      notaOuts: !tieneFuturo
        ? 'En el river no hay outs: no llega ninguna carta mas.'
        : outsLimpios.length === 0
          ? 'Ningun out limpio: las cartas que mejoran la mano emparejan el board ' +
            'y mejoran igual al rival. No hay semibluff con esta mano.'
          : outsCompartidos.length > 0
            ? `${outsLimpios.length} outs limpios (los que te hacen una mano que el ` +
              `rival no tiene) y ${outsCompartidos.length} compartidos (emparejan el ` +
              `board, mejoran a los dos). Para bluffear cuentan solo los limpios.`
            : `${outsLimpios.length} outs limpios.`,
      // Con dos pares o mas los outs son irrelevantes para decidir: no
      // estamos esperando que la mano nos mejore.
      outsRelevantes: esValor ? null : (tieneFuturo ? outs.length : 0),
      outsTotales: tieneFuturo ? outs.length : 0,
      cartasRestantes: restantes.length,
      llamadasRestantes: llamadas,

      resumen: this._resumen(street, esc, nPalo, outs, sobrepares, boardConPareja)
    };
  }

  /**
   * Odds de un semibluff / call con N outs.
   * @param {number} outs    numero de outs limpios
   * @param {number} pot     bote ANTES de apostar
   * @param {number] bet     tamaño del bet del rival (o nuestro bluff)
   * @param {number} [toCall] lo que cuesta igualar; default = bet
   * @param {number} [faltan] cartas por ver: 2 flop, 1 turn, 0 river
   * @returns {{equityNecesaria, equityDeOuts, favorable, diferencia}}
   */
  static oddsDeOuts(outs, pot, bet, toCall = bet, faltan = 1) {
    if (!Number.isFinite(outs) || outs < 0) {
      throw new Error(`DrawDetector.oddsDeOuts: outs invalido (${outs}).`);
    }
    if (!Number.isFinite(pot) || pot <= 0) {
      throw new Error(`DrawDetector.oddsDeOuts: pot invalido (${pot}).`);
    }

    const equityNecesaria = toCall <= 0
      ? 0
      : Math.round((toCall / (pot + toCall)) * 10000) / 100;

    // Inclusion-exclusion real sobre las cartas que faltan, en vez de la regla
    // de thumb de "4% por out" (que solo valia con una carta por ver y
    // sobreestimaba el doble gutshot).
    let equityDeOuts = 0;
    if (faltan > 0 && outs > 0) {
      let probNinguno = 1;
      for (let i = 0; i < faltan; i++) {
        probNinguno *= (47 - i - outs) / (47 - i);
      }
      equityDeOuts = Math.round((1 - probNinguno) * 10000) / 100;
    }

    return {
      outs,
      equityNecesaria,
      equityDeOuts,
      diferencia: Math.round((equityDeOuts - equityNecesaria) * 100) / 100,
      favorable: equityDeOuts >= equityNecesaria
    };
  }

  _streetOf(boardCards) {
    const n = boardCards.length;
    if (n === 0) return 'preflop';
    if (n === 3) return 'flop';
    if (n === 4) return 'turn';
    return 'river';
  }

  _resumen(street, esc, nPalo, outs, sobrepares, boardConPareja) {
    const partes = [];

    if (esc.made) partes.push(`escalera de ${esc.alto} alto`);
    if (nPalo >= 5) partes.push('color hecho');
    else if (nPalo === 4) partes.push('flush draw');
    else if (nPalo === 3) partes.push('backdoor de color');

    if (esc.extremos.length) partes.push('OESD');
    else if (esc.interiores.length) partes.push('gutshot');
    else if (esc.backdoor) partes.push('backdoor de escalera');

    if (sobrepares.length) {
      partes.push(`${sobrepares.length} sobrepar${sobrepares.length > 1 ? 'es' : ''}`);
    }
    if (boardConPareja) partes.push('board emparejado');

    if (street === 'river') {
      partes.push('en river no hay outs: no llega ninguna carta mas');
    } else if (outs.length) {
      partes.push(`${outs.length} cartas que mejoran la mano`);
    }

    return partes.length ? partes.join(', ') : 'sin nada activo';
  }
}

module.exports = DrawDetector;
module.exports.POR_PALO = POR_PALO;
module.exports.POR_RANK = POR_RANK;
module.exports.LLAMADAS_POR_CALLE = LLAMADAS_POR_CALLE;
module.exports.ranksDeEscalera = ranksDeEscalera;
module.exports.analizarEscaleras = analizarEscaleras;