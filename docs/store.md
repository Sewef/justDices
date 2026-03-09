---
title: JustDices
description: A formula-based dice roller - fast, flexible, and API‑friendly.
author: Sewef
image: https://raw.githubusercontent.com/Sewef/justDices/refs/heads/main/docs/JustDicesSplash.png
icon: https://raw.githubusercontent.com/Sewef/justDices/refs/heads/main/docs/JustDices.png
tags:
  - dice
  - automation
manifest: https://justdices.onrender.com/manifest.json
learn-more: https://github.com/Sewef/justDices/
---

# JustDices
JustDices is a fast, flexible dice roller for Owlbear Rodeo, mostly based on Roll20 system.
Type natural formulas, click a button, or call the broadcast API from other extensions.
Outputs are clear, color‑coded, and support private GM rolls. Also, it supports Pokemon Tabletop United 1.05 Damage Bases.

## Highlights
- Resizable window, drag and drop any of the corner.
- Formula engine: NdX, dF/dFudge, PTU Damage Base dbX, arithmetic (`+ - * /`), parentheses.
- Math functions (via mathjs): e.g. `sqrt(25) + ceil(2.1)`.
- Crit coloring: per‑die min rolls in red, max rolls in green.
- Public & GM rolls: `/r` public, `/gr` private to GM + roller.
- Handy aliases: `max …` or `min …` to force all dice to max/min.
- History with reroll: one‑click reroll reuses the exact command and preserves public/private.
- Stateless: no data is saved locally or remotely; reload clears the list.
- OBR broadcast API: trigger rolls from any extension and receive a structured response.

## Commands

`/r <expr>` or `/roll <expr>` → public roll broadcast to the room.

*Example: `/r d20`, `/roll 2d6+3`, `/r max 10d20`*

`/gr <expr>` or `/gmroll <expr>` → private roll visible to GM & roller only.

*Example: `/gr db6`, `/gmroll (2dF + 1)`*

`/say <message>` → send a text message to the chat (via API only).

*Example: `/say The beast roars!`*

No prefix? JustDices treats it like public (same as `/r`). 

Case‑insensitive: `/R`, `/Gr`, `dFUDGE`, `Db6` all work.

Commands history: press ↑ or ↓ to navigate in previous ran commands.

## Formula Language
### Core
- `NdX` → roll N dice with X faces:
  - `1d20,` `d20`, `D20` → all valid (case‑insensitive).
  - Works with arithmetic and parentheses: `2d6 + 3`, `(1d8+2) * 2.`
- QoL for decimals: `10 * .75` is the same as `10 * 0.75`).
- Math functions (mathjs): e.g. `sqrt(25)`, `abs(-3) + round(2.5)`.
- Common helpers that work out of the box: `sqrt`, `abs`, `min`, `max`, `ceil`, `floor`, `round`, etc (needs improvements to support more functions).

⚠️ Functions are evaluated by mathjs. Unknown names will throw a parse error.

### Advanced Dice Modifiers
- `Nd X!` → exploding dice (reroll when max face is rolled).
  - Example: `4d6!` → rolls 4d6 and rerolls any die showing 6.
  - `Nd X!>= Y` → explode on threshold (reroll when die shows Y or higher).
  - Example: `4d6!>=5` → reroll on 5 or 6.
- `Nd X k Y` → keep highest Y dice.
  - Example: `4d6k3` → roll 4d6, keep the best 3.
- `Nd X d Y` → drop lowest Y dice.
  - Example: `4d6d1` → roll 4d6, drop the worst 1.

### Fudge / Fate
- `dF` or `dFudge` → default 4 dice in the set [-1, 0, 1].
- Use `XdF` for a custom count: `2dF`, `6dF`, etc.

### PTU Damage Base (Pokemon Tabletop United 1.05)
- `dbX` expands to a full dice+bonus expression (e.g. `db6` → `2d6+8`).
- You can multiply a DB block: `2db4` (crits), `3db6`, etc.
- You can mix DB with regular math: `db6 + 1d4 - 2`.

A built‑in table covers db1 through db28.

### Prefixes
`max …` → force every die to its maximum value.

*Example: `/r max 10d20` → `[20,20, …]`*

`min …` → force every die to its minimum value.

*Example: `/r min db6` → the internal `d6` rolls will all be `1`.*

Place max/min before the expression: `/r max (db6 + 1d4)`.

## Buttons
- Roll it (⚔️) → sends /r <expr>.
- Hidden roll (🙈) → sends /gr <expr>.

If the formula already starts with the opposite prefix, the UI warns you.
- Quick Rolls panel (🎲) → opens the Quick Rolls panel (see below)

## Quick Rolls
- The QuickRolls panel gives you a grid of the most common dice. Just click the amount of dice you want to roll and let it work, the roll is sent like a regular formula.
- The Toggle hide rolls (🐵/🙈) button toggles between public rolls and hidden rolls.
- Because of Owlbear limitations, the panel cannot be moved.

## History
- The typed expression is shown on top of the output card, hovering the manifying glass 🔍 will show the expanded expression.
- The detailed result shows every die:
`[ 5, 1 ] + 3`
- Per‑die coloring:
  - Min face (e.g., `1` on `d20`) is red.
  - Max face (e.g., `20` on `d20`) is green.
- Little animations when all dice are min or max value.
- "Hidden" rolls are only seen by the GMs and the player who rolled.
- Clicking on the Reroll (🎲) button on the right of a card will reroll the exact expression.
- Nothing is saved in the browser, refreshing will clear the local history.

## API
Make your extension roll dice via OBR broadcasts and get a structured response.

### Request
```JS
// Channel: "justdices.api.request"
OBR.broadcast.sendMessage("justdices.api.request", {
  callId,        // string: unique id to correlate response
  requesterId,   // string: await OBR.player.getId()
  expression,    // string: same syntax as the input box (e.g. "/r 2d6+3", "max 10d20")
  showInLogs     // boolean (default true): also push to JustDices log
}, { destination: "ALL" });
```

### Parameters

- `callId` *(required)* → A unique identifier for this API call. Used to correlate the request and the response.
- `requesterId` *(required)* → The ID of the player/extension making the request. Usually use the Extension name and/or the player name (`await OBR.player.getId()`).
- `expression` *(required)* → The formula or full command (`/r`, `/gr`, `max`, `min` etc allowed).
- `showInLogs` (*optional, default true)* → Whether to also print in the JustDices log.

### Response
Listen on the response channel and filter by your `callId` & `requesterId`.

```JS
OBR.broadcast.onMessage("justdices.api.response", (evt) => {
  const res = evt.data;
  if (res.callId !== myCallId || res.requesterId !== myRequesterId) return;

  if (res.ok) {
    console.log("Total:", res.data.total);
    console.log("Expanded:", res.expressionOut);
    console.log("Detail (HTML):", res.rolls);
  } else {
    console.warn("Roll failed:", res.error);
  }
});
```

#### Response structure (`ok: true`)

For **roll** responses:
```JS
{
  callId: string,
  requesterId: string,
  expressionIn: string,      // what you sent
  ok: true,
  expressionOut: string,     // expanded display (e.g. "(2d6+8) + 1d4")
  rolls: string,             // HTML string with colored dice, e.g. "[ 5, <span class='min'>1</span> ] + 3"
  data: {
    expression: string,      // same as expressionOut
    rolls: string,           // same as rolls
    total: number,
    allDiceMin: boolean,
    allDiceMax: boolean
  }
}
```

For **say** responses:
```JS
{
  callId: string,
  requesterId: string,
  expressionIn: string,      // what you sent (e.g. "/say Hello!")
  ok: true,
  data: {
    isSay: true,
    message: string          // the message text
  }
}
```

#### Response shape (`ok: false`)
```JS
{
  callId: string,
  requesterId: string,
  expressionIn: string,
  ok: false,
  error: "PARSE_ERROR" | "ROLL_ERROR" | string
}
```
#### Typical errors
- `PARSE_ERROR` → invalid syntax or unsupported tokens.
- `ROLL_ERROR` → internal failure during evaluation.
- (Client‑side) `API_TIMEOUT` → no response received before your own timeout.