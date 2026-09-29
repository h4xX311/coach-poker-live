# BRIEF: motor de coaching de póker calle por calle

Proyecto: `C:\Users\La'Roch\coach-poker-live` (Node v24, ya existe, ES modules).
Al usuario se lo llama **h4x**. Todos los comentarios y mensajes al usuario en **español**.

## CONTEXTO CRÍTICO — LEÉ ANTES DE TOCAR NADA

Este proyecto tiene un motor de equity ROTO. **No confíes en ningún número que salga hoy.**

**Bug 1 (crítico):** `EquityCalculator.js` → `_preflopEquity()` NO reparte cartas comunitarias.
Compara un score heurístico `_handStrength()` y devuelve 1/0/-1. Por eso en
`data/history.json` una mano `97s` dio `equity: 0` con **0 victorias en 397 intentos**.
Sin runout no hay equity. Contra `AKs` da 0% o 100%, nunca ~50%.

**Bug 2:** `_scoreHand()` solo mira `ranks[0]`, así que `KKKQQ` y `KKKJJ` dan el MISMO
score (el kicker nunca se compara). Igual para dos pares y trías.

**Bug 3:** `generateRange()` ordena por fuerza bruta con porcentajes inventados
(UTG 8%, etc). No es un rango real por posición/acción.

**NO ARREGLES ESTO A MEDIAS.** Si un número no lo podés defender con un test,
**dejalo bloqueado con un `throw` y un mensaje claro en español.** Es preferible
un motor chico y verificado que uno grande sin verificar.

## REGLAS DE ORO (ya nos quemamos con estas)

1. **Nunca inventes datos de póker** (rangos, charts, frecuencias). Si no tenés
   fuente, no lo inventes. Ya pasó: una tabla "Poker Prof" inventada dio 34.9% en
   UTG cuando corresponde ~17%.
2. **Todo número que salga necesita un test que lo defienda.**
3. **Ground truth verificable (asimétrico!):**
   - AA vs KK ≈ 82%, AA vs 99 ≈ 82%, AA vs 77 ≈ 82%, AA vs TT ≈ 82%
   - AKs vs AKo ≈ 57.5%, 87s vs AKo ≈ 38.7%
   - ⚠️ **NUNCA uses matchups simétricos como prueba** (AK vs AKs da 50% con el
     motor roto igual que con el sano). Ground truth tiene que ser ASIMÉTRICO.
4. **Orden de comparación:** el ranking va MENOR = mejor mano, y los desempates
   DENTRO de una categoría van al revés (par de ases > par de reyes). Ya
   cometimos este error: el par de ases salía peor que el de reyes.
5. **Emparejamiento:** una mano son 2 cartas DISTINTAS. Un par es 2 palos
   distintos del mismo rank (`Tc+Td`, NO `Tc+Tc`). Un rango es una LISTA DE
   MANOS, no una bolsa de cartas sueltas — si no, el motor puede darle al rival
   una mano fuera de su rango declarado.
6. **Shell en esta máquina:** el path tiene apóstrofo (`La'Roch`).
   `Set-Location "C:\Users\La*Roch\coach-poker-live"` funciona con wildcard.
   Los `node -e` / `python -c` inline con comillas **fallan**: escribí archivos
   y corré `node archivo.js`.
7. **No hay `git` instalado.** No hagas commits.
8. **No toques `data/history.json`.** Contiene 74 manos REALES de h4x. El campo
   `analysis` está contaminado y no vale nada, pero las manos son reales.
   No borres nada. Solo usalo como referencia de lectura.

## ENTREGABLES

### FASE 1 — `src/skills/handRanker.js` (nuevo)
Evaluador de manos correcto.
- Jerarquía: straight flush > quads > full house > flush > straight > trips >
  two pair > pair > high card, **con kickers comparados en todas**.
- **Rueda** (A-2-3-4-5) cuenta como 5 alto. Testear explícitamente que la rueda
  NO se trata como Broadway y que Broadway SÍ.
- API: `rank(board, hole) -> comparable`, menor = mejor. Funciona con 5, 6 y 7 cartas.
- Tests en `test/handRanker.test.js`. Casos adversariales obligatorios:
  dos full houses con par distinto, dos pares con mismo par alto y kicker distinto,
  rueda vs Broadway.

### FASE 2 — `src/skills/EquityCalculator.js` (reescribir)
- Preflop: enumeración o Monte Carlo **CON las 5 comunitarias**.
  `AA vs KK` tiene que dar **~82%, NO 100%**.
- Postflop: completar el board hasta 5 cartas y comparar.
- El rival se sortea **SIEMPRE** de manos del rango declarado. Test explícito:
  contra `"AsKs"` el rival **NUNCA** puede recibir `3sJd`.
- Reportar también **qué mano te mata y con qué frecuencia**.
- Test de regresión con el ground truth asimétrico. Si un número no cierra,
  **DILO y bloquealo**; no lo ajustes para que pase.

### FASE 3 — `src/skills/PreflopReference.js`
Revisalo y comparalo con un chart RFI 6-max sensato. Si sus números están mal,
decilo y corregilo. Mostrá el **% de apertura por posición** para que sea
auditable. Rangos estándar de apertura 6-max, % visible.

### FASE 4 — `src/skills/StreetDecider.js` (nuevo)
- Entrada: `{street, hole, board, pot, toCall, stack, position, villainAction, villainRange}`
- Salida: `{action: FOLD|CHECK|CALL|BET|RAISE, sizing, equity, breakeven, razonamiento}`
- Lógica:
  - `breakeven = toCall / (pot + toCall)`
  - `equity > breakeven + margen` → CALL / RAISE
  - `equity < breakeven - margen` → FOLD
  - en BB/SB con check gratis, el check no cuesta nada
  - sizing: bet de valor ~66-75% del bote en board seco, más chico en board mojado;
    raise ~2.7-3.2x
- **PREFLOP usa el chart, NO equity.** POSTFLOP usa equity real. Si equity no está
  disponible, **no inventes: bloquea**.
- Tests por cada calle, **incluyendo el caso de FOLD correcto** (el más importante).

### FASE 5 — `src/cli.js`
```bash
node cli.js hand --street flop --hole AhKh --board Td9d4c --pot 30 --toCall 12 --position BB --villainRange "TT+,AKs"
```
Salida legible en español con la decisión y los números.

## REPORTE FINAL (esto es lo que voy a leer)

1. Qué archivos creaste/modificaste.
2. **El output literal de los tests** (pegalo, no lo resumas). Si algo falla, pegá el fallo.
3. Una **tabla** con los números de equity que salen vs el ground truth esperado.
4. Qué queda **BLOQUEADO** y por qué.
5. Bugs extra que no te pedí buscar.

Sé honesto. Si algo no lo pudiste hacer, decilo.
