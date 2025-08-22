// dice-utils.js
import { evaluate } from "mathjs";

/* ===========================
   Tables & Constantes
=========================== */

// Table des dbX → expressions équivalentes
const DB_KEYWORD = [
    { key: "db28", value: "8d12+80" }, { key: "db27", value: "8d12+70" },
    { key: "db26", value: "7d12+65" }, { key: "db25", value: "6d12+60" },
    { key: "db24", value: "6d12+55" }, { key: "db23", value: "6d12+50" },
    { key: "db22", value: "6d12+45" }, { key: "db21", value: "6d12+40" },
    { key: "db20", value: "6d12+35" }, { key: "db19", value: "6d12+30" },
    { key: "db18", value: "6d12+25" }, { key: "db17", value: "5d12+25" },
    { key: "db16", value: "5d10+20" }, { key: "db15", value: "4d10+20" },
    { key: "db14", value: "4d10+15" }, { key: "db13", value: "4d10+10" },
    { key: "db12", value: "3d12+10" }, { key: "db11", value: "3d10+10" },
    { key: "db10", value: "3d8+10" }, { key: "db9", value: "2d10+10" },
    { key: "db8", value: "2d8+10" }, { key: "db7", value: "2d6+10" },
    { key: "db6", value: "2d6+8" }, { key: "db5", value: "1d8+8" },
    { key: "db4", value: "1d8+6" }, { key: "db3", value: "1d6+5" },
    { key: "db2", value: "1d6+3" }, { key: "db1", value: "1d6+1" },
];

// Tokenizer commun : fonctions, dés, décimaux nus, opérateurs, parenthèses
const TOKEN_REGEX =
    /([a-zA-Z_][a-zA-Z0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)])/gi;

/* ===========================
   Utilitaires
=========================== */

// Normalise .75 → 0.75
function normalizeToken(t) {
    return /^\.\d+$/.test(t) ? `0${t}` : t;
}

// Cherche la définition dbN
function findDbDef(keyNum) {
    const key = `db${keyNum}`.toLowerCase();
    return DB_KEYWORD.find(e => e.key.toLowerCase() === key) || null;
}

// Parse "NdX+K" → { diceCount, faces, bonus }
function parseDbValue(dbValue) {
    // ex: "2d6+8" ou "1d8+6"
    const [dicePart, bonusPart] = dbValue.split("+");
    const m = dicePart.trim().match(/^(\d*)d(\d+)$/i);
    if (!m) return null;
    return {
        diceCount: parseInt(m[1], 10) || 1,
        faces: parseInt(m[2], 10),
        bonus: bonusPart ? parseInt(bonusPart.trim(), 10) : 0,
    };
}

// Roule N dés à F faces → { rolls[], sum }
function rollNdX(diceCount, faces, mode) {
    const one = 1, max = faces;
    const draw = () =>
        mode === "max" ? max :
            mode === "min" ? one :
                (Math.floor(Math.random() * faces) + 1);

    const rolls = Array.from({ length: diceCount }, draw);
    const sum = rolls.reduce((a, b) => a + b, 0);
    return { rolls, sum };
}

// Roule dF (count) → { rolls[], sum } avec valeurs [-1,0,1]
function rollFudge(count, mode) {
  const draw = () =>
    mode === "max" ? 1 :
    mode === "min" ? -1 :
    [-1, 0, 1][Math.floor(Math.random() * 3)];

  const rolls = Array.from({ length: count }, draw);
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, sum };
}

// Colore min/max pour affichage
function decorateRolls(rolls, minVal, maxVal) {
    const same = (minVal === maxVal);
    return rolls.map(r => {
        if (!same && r === minVal) return `<span class="min">${r}</span>`;
        if (!same && r === maxVal) return `<span class="max">${r}</span>`;
        return String(r);
    }).join(", ");
}

// Met à jour les flags globaux min/max selon un paquet de jets
function updateMinMaxFlags(rolls, faces, flags) {
    flags.anyDiceRolled = true;
    for (const r of rolls) {
        if (r !== (faces === 1 ? 1 : 1)) flags.allDiceMin &&= (r === 1);      // équivalent lisible ci‑dessous
        if (r !== faces) flags.allDiceMax = false;
        if (r !== 1) flags.allDiceMin = false;
    }
}

// Variante pour dF (-1..1)
function updateMinMaxFlagsFudge(rolls, flags) {
    flags.anyDiceRolled = true;
    for (const r of rolls) {
        if (r !== -1) flags.allDiceMin = false;
        if (r !== 1) flags.allDiceMax = false;
    }
}

/* ===========================
   Parsing de la commande
=========================== */

export async function parseInput(text) {
    let rollExpression = "";
    let hidden = false;

    if (text.startsWith("/r") || text.startsWith("/roll")) {
        rollExpression = text.replace("/roll", "").replace("/r", "").trim();
    } else if (text.startsWith("/gr") || text.startsWith("/gmroll")) {
        rollExpression = text.replace("/gmroll", "").replace("/gr", "").trim();
        hidden = true;
    } else {
        rollExpression = text;
    }

    if (!rollExpression) return null;

    let mode = "normal";
    const modeMatch = rollExpression.match(/^(max|min)\b/i);
    if (modeMatch) {
        mode = modeMatch[1].toLowerCase();
        rollExpression = rollExpression.slice(modeMatch[0].length).trim();
    }

    // Validation large (fonctions + .75)
    const tokens = rollExpression.match(TOKEN_REGEX);
    if (!tokens) return null;
    const validTokenRegex =
        /^([a-zA-Z_][a-zA-Z0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)])$/i;

    for (const tok of tokens) {
        if (!validTokenRegex.test(tok)) return null;
    }

    return { rollExpression, hidden, mode };
}

/* ===========================
   Roll principal (DRY)
=========================== */

export async function rollExpression(text, mode = "normal") {
    const raw = text.toLowerCase().trim();

    // Tokenize + normalise
    const tokensRaw = raw.match(TOKEN_REGEX);
    if (!tokensRaw) {
        console.error("Impossible de tokeniser l'expression :", raw);
        return null;
    }
    const tokens = tokensRaw.map(normalizeToken);

    // Expression affichée (dbN → "(NdX+K)")
    const expandedTokens = tokens.map(tok => {
        const m = tok.match(/^(\d*)db(\d+)$/i);
        if (!m) return tok;
        const mult = parseInt(m[1], 10) || 1;
        const def = findDbDef(m[2]);
        if (!def) return tok;
        const block = `(${def.value})`;
        return mult > 1 ? Array(mult).fill(block).join(" + ") : block;
    });
    const exprExpanded = expandedTokens.join(" ");

    // Accumulateurs d’évaluation et flags
    const numericTokens = [];
    const detailedTokens = [];
    const flags = { anyDiceRolled: false, allDiceMin: true, allDiceMax: true };

    // Boucle tokens
    for (const tok of tokens) {
        let m;

        // dbN (avec multiplicateur éventuel)
        if ((m = tok.match(/^(\d*)db(\d+)$/i))) {
            const mult = parseInt(m[1], 10) || 1;
            const def = findDbDef(m[2]);
            if (!def) continue;

            const parsed = parseDbValue(def.value);
            if (!parsed) continue;

            const { diceCount, faces, bonus } = parsed;
            let sumNumeric = 0;
            const partsForDetail = [];

            for (let i = 0; i < mult; i++) {
                const { rolls, sum } = rollNdX(diceCount, faces, mode);
                updateMinMaxFlags(rolls, faces, flags);

                const decorated = decorateRolls(rolls, 1, faces);
                partsForDetail.push(`[ ${decorated} ]`);

                sumNumeric += sum + bonus;
            }

            detailedTokens.push(...partsForDetail, ...Array(mult).fill(`+ ${bonus}`));
            numericTokens.push(String(sumNumeric));
            continue;
        }

        // dF(udge)
        if ((m = tok.match(/^(\d*)dF(?:udge)?$/i))) {
            const count = parseInt(m[1], 10) || 4;
            const { rolls, sum } = rollFudge(count, mode);
            updateMinMaxFlagsFudge(rolls, flags);

            const decorated = decorateRolls(rolls, -1, 1);
            detailedTokens.push(`[ ${decorated} ]`);
            numericTokens.push(String(sum));
            continue;
        }

        // NdX
        if ((m = tok.match(/^(\d*)d(\d+)$/i))) {
            const diceCount = parseInt(m[1], 10) || 1;
            const faces = parseInt(m[2], 10);

            const { rolls, sum } = rollNdX(diceCount, faces, mode);
            updateMinMaxFlags(rolls, faces, flags);

            const decorated = decorateRolls(rolls, 1, faces);
            detailedTokens.push(`[ ${decorated} ]`);
            numericTokens.push(String(sum));
            continue;
        }

        // nombres, opérateurs, fonctions mathjs
        detailedTokens.push(tok);
        numericTokens.push(tok);
    }

    if (!flags.anyDiceRolled) {
        flags.allDiceMin = false;
        flags.allDiceMax = false;
    }

    const exprDetailed = detailedTokens.join(" ");
    const exprNumeric = numericTokens.join(" ");

    // Évaluation
    let total;
    try {
        total = evaluate(exprNumeric);
        total = Number(total.toPrecision(12));
    } catch (e) {
        console.error("Erreur d'évaluation mathjs :", exprNumeric, e);
        return null;
    }

    return {
        expression: exprExpanded,
        rolls: exprDetailed,
        total: total,
        allDiceMin: flags.allDiceMin,
        allDiceMax: flags.allDiceMax,
    };
}
