# JustDices  

**For the full and exhaustive documentation, see [docs/store.md](/docs/store.md).**

**JustDices** is a formula-based dice roller extension for [Owlbear Rodeo](https://owlbear.rodeo), inspired by Roll20’s syntax.  
It allows quick, flexible dice rolls with support for formulas, hidden rolls, Pokémon Tabletop United rules, and a one-click QuickRolls panel.  

---

## Features  

- **Formula Parsing**  
  - Roll dice with standard notation: `d20`, `2d6+3`, `1d100-10`  
  - Supports **Fudge dice** (`dF`, `dFudge`, `XdF`)  
  - Supports **Pokémon Tabletop United DB rolls** (`db4`, `2db6` for crits)  
  - Min results are marked red, max results green  

- **Commands**  
  - `/r d20` → Public roll  
  - `/gr d20` → Private roll (only you + GMs see it)  
  - `/lr d20` → Liar roll (logged for everyone, result visible only to the roller until revealed)
  - `/br d20` → Blind roll (logged for everyone, result visible only to GMs until revealed)
  - Without `/r`, `/gr`, `/lr`, or `/br`, rolls are public by default
  - Compatible with modifiers (`+`, `-`, parentheses, decimals like `.75`)  

- **QuickRolls Panel**  
  - Grid of common dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`, `d1000`, `dF`)  
  - Click the die and number of dice to roll instantly  
  - 🐵 button toggles **hidden vs public rolls**  

- **Roll History**  
  - Shows player, formula, detailed results, and total  
  - Reroll button instantly repeats the same command  
  - Rolls aren’t stored permanently — closing the page clears history  

- **API Access**  
  - Other extensions can call `JustDices` via `OBR.broadcast`  
  - Example:  
    ```js
    const callId = crypto.randomUUID();

    OBR.broadcast.sendMessage("com.sewef.justdices/api.request", {
      callId,
      expression: "/r 4d6k3",
      showInLogs: false
    }, { destination: "LOCAL" });

    const unsub = OBR.broadcast.onMessage(
      "com.sewef.justdices/api.response",
      (evt) => {
        const res = evt.data;
        if (res.callId !== callId) return;
        unsub(); // unsubscribe after receiving our response

        if (res.ok) {
          console.log(`Rolled: ${res.expressionOut} = ${res.data.total}`);
        }
      }
    );
    ```

---

## Installation  

Add JustDices to Owlbear Rodeo using its manifest:  

```text
https://justdices.onrender.com/manifest.json
