# Preflop 6-max cash — referencia CITADA

Scope: cash game 6-max, ~100bb deep, NLHE, seats UTG / HJ / CO / BTN / SB / BB.
Last updated by the site: **October 1, 2026** (todas las páginas Poker Skill consultadas).

Regla dura de este documento: **todo número va con su URL exacta al lado**. Si algo no se
verificó leyendo la fuente, va como `SIN FUENTE`. No completar desde memoria.

---

## 1. Bitácora de verificación (qué leí y qué no)

### Páginas leídas con éxito (contenido obtido)

| # | URL | Estado | Qué aportó |
|---|-----|--------|-----------|
| S1 | `https://www.pokerskill.com/charts/preflop/` | 200, OK | Grids 6-max de apertura, supuestos globales, chart de facing-a-raise (BTN vs CO), full ring |
| S2 | `https://www.pokerskill.com/charts/opening-ranges/` | 200, OK | Un grid por asiento (UTG, MP, HJ, CO, BTN, SB) + grid de **defensa BB vs subida del BTN**, aritmética de combinaciones, ajustes |
| S3 | `https://www.pokerskill.com/charts/3bet-ranges/` | 200, OK | BTN vs apertura CO (3bet/call/fold), 3bet desde ciega vs apertura EP, tamaños de 3bet |

### Páginas que NO pude leer (y por lo tanto no aportan ningún número)

| Fuente | URL intentada | Resultado |
|--------|---------------|-----------|
| GTO Wizard blog | `https://blog.gtowizard.com/what-is-a-3-bet-range/` | **404** ("Page not found") |
| GTO Wizard blog (índice) | `https://blog.gtowizard.com/` | 200, pero el índice no expone ningún artículo de rangos preflop con números; el solver vive en `app.gtowizard.com/solutions` detrás de login. **Ningún dato citado** |
| Modern Poker Theory (Dandara Estrada) | `https://www.dandaraestrada.com/modern-poker-theory` | **DNS: ENOTFOUND** (dominio no resuelve) |
| PokerCoaching | — | **No consultada.** `SIN FUENTE` |

**Consecuencia:** todo lo numérico en este archivo viene de S1/S2/S3. No hay ni un solo
porcentaje de GTO Wizard, PokerCoaching ni Modern Poker Theory. Si el coach necesita
contrastar contra solver, esa es una fuente pendiente, no un dato que ya esté acá.

### Verificaciones que NO pude hacer

- **Recálculo de combinaciones por scripting:** `exec` no está disponible en esta sesión
  (`Approved executables: none`). No pude recomutar ningún conteo de 1326 combinaciones.
  Consecuencia: **no publico conteos de combos** salvo el 694 de la BB que viene de
  contexto verificado previamente (ver §7, nota).
- **Contraste entre fuentes:** con una sola familia de charts leída, no hay verificación
  cruzada posible. Los charts de Poker Skill son **rangos de enseñanza simplificados**
  (cada mano = una sola acción), no salidas de solver. S1 lo dice literal:
  *"Each range here is ours: a simplified teaching range that gives every hand one action."*
  (`https://www.pokerskill.com/charts/preflop/#method`)

---

## 2. Supuestos globales de TODOS los rangos de este archivo

Fuente única para los cinco supuestos:

> `https://www.pokerskill.com/charts/preflop/#method` y `https://www.pokerskill.com/charts/opening-ranges/#method`

- Cash game, **~100 big blinds** de stack.
- **Pot sin abrir** (nobody raised yet) para los rangos de apertura.
- Raise a **~2.5 bb** desde cualquier asiento, **3 bb desde la SB**.
- Mesa **6-max**, salvo donde se indica explícitamente full ring.
- Con stack corto los rangos **dejan de aplicar**: pasa a push/fold
  (`https://www.pokerskill.com/charts/push-fold/`).

> Advertencia operativa: a ~10bb el raise ya no es un raise; a 15bb la HJ está shoveando;
> a 20bb stealing y shove se solapan. Cifras y umbrales citados en
> `https://www.pokerskill.com/charts/push-fold/#five-bb`, `#ten-bb`, `#fifteen-bb`,
> `#twenty-bb`, `#when-push-fold`.

---

## 3. SECCIÓN A — Rangos de APERTURA (RFI: raise first in)

**Definición:** pot sin abrir, la acción llega a vos, elegís una mano inicial para **subir**.
Fuente de todos los porcentajes y strings: `https://www.pokerskill.com/charts/opening-ranges/`
(los mismos grids también en `https://www.pokerskill.com/charts/preflop/`).

### A.1 UTG — 14.3%

URL: `https://www.pokerskill.com/charts/opening-ranges/#utg` (grid: `https://www.pokerskill.com/charts/preflop/#utg`)

```
Raise (14.3% de manos): 22+, ATs+, A5s-A2s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo
Fold: todo lo demás
```
- Es el asiento **más tight** del set a 6-max: todavía quedan **cinco jugadores por actuar**
  detrás tuyo (`https://www.pokerskill.com/charts/opening-ranges/#utg`).
- Trampa documentada: **A5s–A2s entra y A9s–A6s sale**, al revés de lo que hace la mayoría.
  Razón citada: hacen flush de nuts y escalera del wheel, y **bloquean los ases** que un
  rival detrás podría tener (`https://www.pokerskill.com/charts/opening-ranges/#utg`).
- **KJo, ATo y QJo son FOLD** aquí (`https://www.pokerskill.com/charts/opening-ranges/#utg`).
- Leak citado explícitamente por el sitio: jugar K9s / A2o en UTG no corresponde a su línea.

### A.2 HJ — 18.9%

URL: `https://www.pokerskill.com/charts/opening-ranges/#hj` (grid: `https://www.pokerskill.com/charts/preflop/#hijack`)

```
Raise (18.9% de manos): 22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, ATo+, KJo+
Fold: todo lo demás
```
- "About a third more than under the gun (14.3%)" — cita textual de
  `https://www.pokerskill.com/charts/opening-ranges/#hj`.
- Lo que se suma respecto de UTG: **todos los ases suited** + un escalón más en cada
  secuencia suited (K9s, Q9s, J9s, T8s, 87s) + los dos offsuit broadways que en UTG
  eran fold (ATo, KJo) (`https://www.pokerskill.com/charts/opening-ranges/#hj`).
- Quedan **cuatro jugadores detrás**, y dos de ellos actúan después tuyo en toda la mano
  (`https://www.pokerskill.com/charts/opening-ranges/#hj`).

### A.3 CO — 25.5%

URL: `https://www.pokerskill.com/charts/opening-ranges/#co` (grid: `https://www.pokerskill.com/charts/preflop/#cutoff`)

```
Raise (25.5% de manos): 22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, 54s, A8o+, KTo+, QJo
Fold: todo lo demás
```
- "Not quite twice as many as under the gun (14.3%)" — `https://www.pokerskill.com/charts/opening-ranges/#co`.
- Punto donde **stealing se vuelve parte real del juego**: quedan 3 jugadores y dos son
  blinds que prefieren quedarse su dinero (`https://www.pokerskill.com/charts/opening-ranges/#co`).
- **Los suited connectors ganan su lugar: 54s, 65s, 76s** (`https://www.pokerskill.com/charts/opening-ranges/#co`).
- Leak nombrado por el sitio: **faltar QTs y A8o** en CO.
- Ejemplo del sitio: **Q♣8♣ en CO = RAISE** (Q8s está dentro, la columna de suited queens
  llega hasta Q8s); la misma mano dos asientos antes es **FOLD** porque el chart de UTG
  corta en QTs (`https://www.pokerskill.com/charts/opening-ranges/#how-to-read`).

### A.4 BTN — 43.3%

URL: `https://www.pokerskill.com/charts/opening-ranges/#btn` (grid: `https://www.pokerskill.com/charts/preflop/#button`)

```
Raise (43.3% de manos): 22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o
Fold: todo lo demás
```
- **El chart más ancho del set.** "Three times as many as under the gun (14.3%)" —
  `https://www.pokerskill.com/charts/opening-ranges/#btn`.
- Razón: actuás después de ambos blinds en cada calle, y solo dos jugadores te separan del bote.
- La zona offsuit **se abre mucho**: **A2o, K8o, Q9o, J9o** son raise en BTN y serían
  "quick folds three seats earlier" (`https://www.pokerskill.com/charts/opening-ranges/#btn`).
- **QJo es raise en el botón** (el chart de UTG la foldea) — `https://www.pokerskill.com/charts/opening-ranges/#btn`.
- **El sitio marca fold-too-much como el error caro de este asiento:** "A folded button is
  a pot you never contested." — `https://www.pokerskill.com/charts/opening-ranges/#btn`

### A.5 SB — 33.0%

URL: `https://www.pokerskill.com/charts/opening-ranges/#sb` (grid: `https://www.pokerskill.com/charts/preflop/#small-blind`)

```
Raise (33.0% de manos): 22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 76s, 65s, 54s, A5o+, K9o+, QTo+, JTo
Fold: todo lo demás
```
- **Raise size 3bb, no 2.5bb** (`https://www.pokerskill.com/charts/opening-ranges/#sb`).
- "About three quarters as many as the button (43.3%)" — `https://www.pokerskill.com/charts/opening-ranges/#sb`.
- Solo queda la BB, atacás a un jugador, **pero jugás out of position todas las calles**;
  por eso es más tight que el botón (`https://www.pokerskill.com/charts/opening-ranges/#sb`).
- **Este chart es raise-or-fold, sin limpear.** El sitio lo dice explícitamente y aclara que
  los escritores de poker **discrepan** sobre este asiento: otros enseñan una estrategia que
  **limpea** las manos jugables más débiles. *"Raise-or-fold is the simpler habit to build,
  and it is the one this chart takes."* — `https://www.pokerskill.com/charts/opening-ranges/#sb`

### A.6 Orden de magnitud (ladder)

| Asiento | % manos | URL |
|---------|---------|-----|
| UTG | 14.3% | `https://www.pokerskill.com/charts/opening-ranges/#utg` |
| HJ | 18.9% | `https://www.pokerskill.com/charts/opening-ranges/#hj` |
| CO | 25.5% | `https://www.pokerskill.com/charts/opening-ranges/#co` |
| SB | 33.0% | `https://www.pokerskill.com/charts/opening-ranges/#sb` |
| BTN | 43.3% | `https://www.pokerskill.com/charts/opening-ranges/#btn` |
| BB (defensa, NO apertura) | 52.3% | `https://www.pokerskill.com/charts/opening-ranges/#bb` |

---

## 4. SECCIÓN B — Rangos de DEFENSA

> **La BB no "abre".** Cierra la acción antes del flop, así que nunca ve el spot de
> "folded to you". Su pregunta es **defender contra una subida**: call o 3bet.
> `https://www.pokerskill.com/charts/opening-ranges/#bb`

### B.1 BB vs subida del BTN — 52.3% defendido

URL: `https://www.pokerskill.com/charts/opening-ranges/#bb`
(PNG: `https://www.pokerskill.com/charts/opening-ranges/6-max-big-blind-defend-range-chart.png`)

```
Defend (52.3% de manos): 22+, A2s+, K2s+, Q2s+, J4s+, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o
Fold: todo lo demás
```
- Es el **número más ancho de la página**, y por un motivo distinto al botón: la BB ya está
  invertida y recibe mejor precio (`https://www.pokerskill.com/charts/opening-ranges/#bb`).
- Cita: "The big blind defends 52.3% of hands against a button raise, **more than the button
  opens (43.3%)**" — `https://www.pokerskill.com/charts/opening-ranges/#bb`.
- **OJO — scope:** este chart está construido para **una subida del botón**. El sitio
  advierte que **contra una subida de un asiento temprano la mayor parte del fondo del chart
  pasa a ser FOLD**, porque el rango que te sube es mucho más fuerte y las offsuit débiles
  dejan de pagar su precio. `https://www.pokerskill.com/charts/opening-ranges/#bb`
- Enfrentarse a un **shove** en vez de a un raise es otra pregunta y más ajustada:
  `https://www.pokerskill.com/charts/push-fold/#calling`
- **694 combinaciones** — de contexto verificado previo del proyecto, NO re-verificado en
  esta corrida (no había `exec`). Ver §7.

### B.2 Por qué la SB casi nunca hace call de un raise

Fuente: `https://www.pokerskill.com/charts/preflop/#facing-a-raise` (sección "Calling a raise")

- En la SB la BB todavía está detrás y quedás **out of position contra todos** el resto de la mano.
- Cita textual: *"Face a cutoff raise there in Poker Skill's lessons and the right answer is
  **never a call**. When in doubt from the small blind, **3-bet or fold**."*
- En la BB en cambio, algunas de esas manos **sí son call**, porque cerrás la acción a mejor precio.
  Ejemplo concreto del sitio: **QJs es call contra una apertura UTG en la BB**, y este chart de
  3bet la deja en blanco. `https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`

---

## 5. SECCIÓN C — Facing a una subida: 3bet / call / fold

### C.1 BTN vs apertura del CO — el chart de 3bet más ancho de 6-max

URL: `https://www.pokerskill.com/charts/3bet-ranges/#btn-vs-co`
(PNG: `https://www.pokerskill.com/charts/preflop/button-vs-cutoff-raise-3bet-call-fold-chart.png`)

Spot: el CO sube, la acción llega al BTN, ambos blinds siguen detrás.
Supuesto declarado: **CO abrió a 2.5bb** (`https://www.pokerskill.com/charts/preflop/#facing-a-raise`).

```
3-bet (5.7% de manos): JJ+, AKs, AKo, A5s-A2s, KQs, KJs, 76s, 65s, 54s
Call  (14.0% de manos): 22-TT, A9s-A6s, AQs, AJs, ATs, KTs, K9s, QJs, QTs, Q9s, JTs, J9s, T9s, T8s, 98s, 87s, AQo, AJo, KQo, KJo, QJo
Fold: todo lo demás
TotalContinuation: 19.8% de manos
```
- Cita: "the button 3-bets 5.7% of hands and calls 14.0%, **more than twice as many calls
  as 3-bets**" — `https://www.pokerskill.com/charts/3bet-ranges/#btn-vs-co`.
- **La forma del rango importa más que la lista.** El grupo de raise se parte en dos
  (`https://www.pokerskill.com/charts/3bet-ranges/#btn-vs-co`):
  - **Valor:** pares desde jotas para arriba + AK suited y offsuit (quieren bote grande).
  - **Bluff:** A5s–A2s, KQs, KJs, 76s/65s/54s — están ahí por lo que hacen **cuando los llamen**
    (bloquean, hacen flush de nuts, cuestan poco si fallan).
- **Lo de en medio** (AQo, KQo, pares medios) **hace call**: *"strong enough to play a pot and
  not strong enough to want the biggest one, and calling with them in position is the cheapest
  way to keep the cutoff's weaker hands in."* — `https://www.pokerskill.com/charts/3bet-ranges/#btn-vs-co`
- Check del sitio: **K♦J♦ en BTN vs CO = 3-BET**, no call. Está en la mitad de bluff
  (KJs) del range publicado. *"Calling is the common mistake here."*
  — `https://www.pokerskill.com/charts/preflop/#facing-a-raise`

### C.2 Subir el valor de 3bet según quién subió

URL: `https://www.pokerskill.com/charts/preflop/#facing-a-raise` (tabla "Value hands by the raiser's seat")

| Quién subió | 3bet por valor | 3bet como bluff |
|---|---|---|
| CO o BTN | **JJ+, AK** | A5s-A2s, KQs, KJs, 76s, 65s, 54s |
| HJ o anterior | **QQ+, AK** | A5s-A2s, KQs, y **menos** de los suited connectors chicos |
| Un jugador que nunca foldea | **solo tus manos de valor** | **Ninguna** — *"Bluffing a station is lighting money on fire"* |

### C.3 SB vs apertura de posición temprana (UTG+2 a 3bb) — 4.8%

URL: `https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`
(PNG: `https://www.pokerskill.com/charts/3bet-ranges/blind-vs-early-position-open-3bet-chart.png`)

```
3-bet (4.8% de manos): JJ+, AKo, AJs+, A5s-A2s
Fold: todo lo demás   (NO hay call desde la SB)
```
- ⚠️ **Este chart es de mesa 9-handed**, no 6-max: el spot fuente es una subida a 3bb del
  tercer asiento temprano de una mesa de 9, que esta página llama **UTG+2**
  (`https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`).
- Cita: "4.8% of hands, a little under half as many as early position opens at a full ring
  table (**10.6%**)" — `https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`.
- **Todo lo que no está pintado es FOLD, no call**, porque la BB sigue detrás y un call la
  invita barata mientras jugás OOP (`https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`).
- **Procedencia declarada de este chart** — importante para valorar el dato
  (`https://www.pokerskill.com/charts/3bet-ranges/#method`):
  - Las manos de **valor (JJ+, AK, AJs+)** vienen de ***Advanced Concepts in No-Limit Hold'em***.
  - **Los cuatro ases suited chicos (A5s–A2s) NO son la lista del libro**, que los deja
    sin nombrar. Son *"our reading"* del sitio: *"The handful is where the source stops being
    specific."* Traducción: esa parte del chart es **interpretación, no cita**.

### C.4 BB vs la misma apertura (UTG+2 a 3bb)

URL: `https://www.pokerskill.com/charts/3bet-ranges/#blinds-vs-early`

- Según el mismo libro, la **BB 3betea MENOS** que la SB contra esa apertura: **QQ+, AKs, AQs**.
- **Porcentaje: `SIN FUENTE`.** La página publica el string pero **no da el % de manos**
  para la BB. No lo calculo (ver §7).
- Nota operativa del sitio: si la subida vino de **posición tardía** en vez de temprana,
  **este chart es demasiado tight** y el modelo más cercano es el chart del botón (C.1).

### C.5 Lo que las páginas NO cubren (gap declarado por el propio sitio)

Fuente: `https://www.pokerskill.com/charts/3bet-ranges/#what-we-do-not-draw`

- Una biblioteca completa de 3bet a 6-max serían **15 grids** (un opener × un re-raiser).
  **El sitio publica 2** y lo dice como decisión deliberada: *"we would rather ship two
  charts you can trust than fifteen you cannot."*
- El segundo chart (S1 vs apertura EP) es **full ring**, porque ahí está el spot del libro.
- **Falta** el spot con **un caller ya en el bote** (squeeze). Lo que sí dice la lección de
  squeeze: **QQ hace 3bet** y manos como **76s y 32s foldean**, *"because calling costs the
  full raise and pushes nobody out."* — `https://www.pokerskill.com/charts/3bet-ranges/#what-we-do-not-draw`
- **13 de 15 grids de 3bet 6-max: `SIN FUENTE`.** Si el coach necesita esos, hay que
  resolverlos con solver o con tabla propia, no con esta fuente.

---

## 6. SECCIÓN D — Tamaños (sizing)

| Contexto | Tamaño | URL |
|----------|--------|-----|
| Apertura, cualquier asiento | ~2.5 bb | `https://www.pokerskill.com/charts/preflop/#method` |
| Apertura desde SB | ~3 bb | `https://www.pokerskill.com/charts/preflop/#method` |
| 3bet **in position** | ~3× la subida original (≈8.5bb en el spot BTN vs CO) | `https://www.pokerskill.com/charts/3bet-ranges/#sizing` y `https://www.pokerskill.com/charts/preflop/#facing-a-raise` |
| 3bet **out of position** | ~4× la subida original (≈10bb) | `https://www.pokerskill.com/charts/3bet-ranges/#sizing` y `https://www.pokerskill.com/charts/preflop/#facing-a-raise` |

- Cita del razonamiento: *"Out of position you are paying for the disadvantage: a bigger raise
  makes it more expensive for the opener to call and see a flop with the better seat."*
  — `https://www.pokerskill.com/charts/3bet-ranges/#sizing`
- **Usa el MISMO tamaño con manos de valor y con bluff.** Un rango que sube más con aces que
  con A4s se lee en una sesión. `https://www.pokerskill.com/charts/3bet-ranges/#sizing`
- Elegí un tamaño cuyo **bote resultant te guste barlear en el flop**
  (`https://www.pokerskill.com/charts/3bet-ranges/#sizing`).
- **SB vs CO: el call nunca es la respuesta** (ver B.2) — `https://www.pokerskill.com/charts/preflop/#facing-a-raise`

---

## 7. Aritmética de combinaciones y qué números NO están publicados

### Reglas de conteo (citadas)

URL: `https://www.pokerskill.com/charts/opening-ranges/#how-to-read`

- Cada **par** = **6** combinaciones; cada **suited** = **4**; cada **offsuit** = **12**.
- "The percentage printed under each chart **is not the share of boxes coloured in**. It is
  the share of **actual card combinations**, and the two differ... **A chart can look half
  full and still play a quarter of your hands.**"
- Las cifras del sitio se calculan **desde el mismo string de rango que dibuja el grid**, así
  que tabla y grid no pueden discrepar (`https://www.pokerskill.com/charts/opening-ranges/#ladder`).
- Denominador implícito del deck: **1326** combinaciones.

### Conteos de combos

| Rango | Combos | Estado |
|-------|--------|--------|
| BB vs BTN | **694** | Contexto verificado previo del proyecto (52.3% × 1326 ≈ 694, consistente). **No re-verificado en esta corrida** — `exec` no disponible, sin forma de recomputar. |
| Todos los demás | `SIN FUENTE` | El sitio **no publica** conteos de combos por rango, y no pude recalcularlos sin `exec`. **No inventar ni estimar.** |

**Regla para el motor:** si necesita conteos de combos, hay que agregarlos con un script
propio que parsee los strings de §3/§4/§5 y cuente 6/4/12. Ese script es trabajo pendiente,
no algo que esté verificado acá.

---

## 8. SECCIÓN E — Ajustes a los charts (qualitativo, citado)

URL: `https://www.pokerskill.com/charts/opening-ranges/#adjusting`

- **Apretar** cuando algo adelante rompe el supuesto: un limper, un stack corto atrás buscando
  spot, o una mesa donde tres personas llaman cada raise.
- **Aflojar** cuando se postean antes, hay más dinero muerto que ganar si todos foldean;
  y aflojar contra rivales que foldean todo.
- **A 10bb el raise deja de ser un raise** y lo reemplaza el chart de push/fold a 10bb:
  `https://www.pokerskill.com/charts/push-fold/#ten-bb`
- A 15bb la HJ está shoveando: `https://www.pokerskill.com/charts/push-fold/#fifteen-bb`
- A 20bb stealing y shove se solapan: `https://www.pokerskill.com/charts/push-fold/#twenty-bb`
- Cuándo empieza el push/fold: `https://www.pokerskill.com/charts/push-fold/#when-push-fold`

---

## 9. Gaps: qué le falta a esta referencia

| # | Gap | Por qué |
|---|-----|---------|
| 1 | **GTO Wizard / solver: 0 números** | `blog.gtowizard.com/what-is-a-3-bet-range/` da **404**; el índice del blog no expone rangos preflop; el solver está detrás de login en `app.gtowizard.com/solutions` |
| 2 | **PokerCoaching: sin consultar** | No consultado en esta corrida |
| 3 | **Modern Poker Theory: inaccesible** | `www.dandaraestrada.com` → **ENOTFOUND** |
| 4 | **13 de 15 grids de 3bet 6-max** | El sitio solo publica 2, por política editorial explícita (`https://www.pokerskill.com/charts/3bet-ranges/#what-we-do-not-draw`) |
| 5 | **% de la BB vs apertura EP** | El sitio publica el string (QQ+, AKs, AQs) pero **no el porcentaje** |
| 6 | **Conteos de combos** | Salvo BB=694, no publicados y no recalculables sin `exec` |
| 7 | **SB vs BTN / BB vs CO / BB vs UTG: defensa por asiento** | Solo está la BB vs BTN. No hay call-vs-3bet split para la BB contra otras aperturas |
| 8 | **SB: chart raise-or-fold vs limpear** | El sitio lo declara como discrepancia real entre autores y elige raise-or-fold |
| 9 | **Call/3bet split en la BB vs BTN** | El chart B.1 da **"defend" agregado (52.3%)**, **no** separado en call vs 3bet |

---

## 10. Cómo debe usar el motor este archivo

1. **Contexto obligatorio:** todo rango acá es válido **solo** a ~100bb, pot sin abrir,
   2.5bb de raise (3bb desde SB), 6-max, mesa promedio. Verificar antes de aplicar.
2. **Distinción no negociable:** §3 = **apertura/raise**. §4 y §5 = **defensa (call/3bet)**.
   **La BB nunca "abre"**; su entrada es defend contra una subida. `SIN EXCEPCIÓN`.
3. **Nunca completar desde memoria.** Si el motor necesita un número que acá dice
   `SIN FUENTE`, tiene que resolverlo por solver o pedirlo explícitamente. Rellenar es peor
   que no tener.
4. **Preferir el string de rango** sobre un porcentaje cuando se contradigan entre sí: el sitio
   garantiza que el % se deriva del string, pero solo para los grids que publica.
5. **Citation obligatoria** al responder: cada afirmación numérica debe arrastrar su URL de §1.
