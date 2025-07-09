
// INPUT PARSING
export async function parseInput(text) {
    // console.log(`Parsing input: ${text}`);

    let rollExpression = "";
    let hidden = false;

    if (text.startsWith("/r") || text.startsWith("/roll")) {
        rollExpression = text.replace("/roll", "").replace("/r", "").trim();
    }
    else if (text.startsWith("/gr") || text.startsWith("/gmroll")) {
        rollExpression = text.replace("/gmroll", "").replace("/gr", "").trim();
        hidden = true;
    }
    else {
        rollExpression = text;
    }

    if (!rollExpression) {
        console.error("No roll expression provided.");
        return null;
    }

    // Validation détaillée : on extrait TOUTES les parties
    const tokens = rollExpression.match(
        /(\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|[\+\-\*\/\(\)])/gi
    );
    if (!tokens) {
        console.error("Impossible de découper l'expression :", rollExpression);
        return null;
    }

    // On accepte aussi *, /, (, ), et les constantes décimales
    const validTokenRegex = /^(\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|[\+\-\*\/\(\)])$/i;
    // - \d*d\d+ : dés classiques (ex: d6, 3d20)
    // - \d*db\d+ : dés spéciaux de bonus (ex: db14)
    // - \d*dF(udge)? : dés Fudge (ex: dF, 4dF, 2dFudge)
    // - \d+ : constantes (ex: 5)

    for (const token of tokens) {
        if (!validTokenRegex.test(token)) {
            console.error(`Invalid token in roll expression: "${token}"`);
            return null;
        }
    }

    return {
        rollExpression: rollExpression,
        hidden: hidden
    };
}

// Handle keywords and special cases
const DBKeyword = [
    { key: "db28", value: "8d12+80" },
    { key: "db27", value: "8d12+70" },
    { key: "db26", value: "7d12+65" },
    { key: "db25", value: "6d12+60" },
    { key: "db24", value: "6d12+55" },
    { key: "db23", value: "6d12+50" },
    { key: "db22", value: "6d12+45" },
    { key: "db21", value: "6d12+40" },
    { key: "db20", value: "6d12+35" },
    { key: "db19", value: "6d12+30" },
    { key: "db18", value: "6d12+25" },
    { key: "db17", value: "5d12+25" },
    { key: "db16", value: "5d10+20" },
    { key: "db15", value: "4d10+20" },
    { key: "db14", value: "4d10+15" },
    { key: "db13", value: "4d10+10" },
    { key: "db12", value: "3d12+10" },
    { key: "db11", value: "3d10+10" },
    { key: "db10", value: "3d8+10" },
    { key: "db9", value: "2d10+10" },
    { key: "db8", value: "2d8+10" },
    { key: "db7", value: "2d6+10" },
    { key: "db6", value: "2d6+8" },
    { key: "db5", value: "1d8+8" },
    { key: "db4", value: "1d8+6" },
    { key: "db3", value: "1d6+5" },
    { key: "db2", value: "1d6+3" },
    { key: "db1", value: "1d6+1" }
];

// dice-utils.js

export async function rollExpression(text) {
    // 1. Nettoyage minimal (on garde les espaces entre tokens pour faciliter le split)
    const raw = text.toLowerCase().trim();

    // 2. Tokenisation en dés, nombres, opérateurs et parenthèses
    const tokenRegex = /(\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|[\+\-\*\/\(\)])/gi;
    const tokens = raw.match(tokenRegex);
    if (!tokens) {
        console.error("Impossible de tokeniser l'expression :", raw);
        return null;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. Construire exprExpanded : on remplace les dbN par leur entry.value
    const expandedTokens = tokens.map(tok => {
        const m = tok.match(/^(\d*)db(\d+)$/i);
        if (m) {
            // trouve la définition dans DBKeyword
            const key = `db${m[2]}`.toLowerCase();
            const entry = DBKeyword.find(e => e.key.toLowerCase() === key);
            if (!entry) {
                console.warn(`Définition manquante pour ${key}`);
                return tok;
            }
            // si on a un multiplicateur devant (ex "2db4"), on le préserve :
            const count = parseInt(m[1], 10) || 1;
            const def = entry.value;        // ex "1d8+6"
            return count > 1
                ? Array(count).fill(def).join(" + ")
                : def;
        }
        // sinon, on garde le token tel quel
        return tok;
    });
    const exprExpanded = expandedTokens.join(" ");
    console.log("Expression développée :", exprExpanded);
    // ────────────────────────────────────────────────────────────────────────

    const numericTokens = [];
    const detailedTokens = [];

    // 3. Parcours de chaque token
    for (let tok of tokens) {
        // 3a) dbN  → on regarde dans DBKeyword pour retrouver le "value"
        let m;
        if (m = tok.match(/^(\d*)db(\d+)$/i)) {
            const count = parseInt(m[1], 10) || 1;
            const key = `db${m[2]}`.toLowerCase();

            // 1) Trouve la définition dans DBKeyword
            const entry = DBKeyword.find(e => e.key.toLowerCase() === key);
            if (!entry) {
                // Pas trouvé => on skip ou on log une erreur
                console.error(`Définiton manquante pour ${key}`);
                continue;
            }

            // 2) On a entry.value par exemple "1d6+4"
            //    On peut la re-tokeniser pour extraire dé et bonus
            const [, diceExpr, bonusStr] = entry.value.match(/^(\d*d\d+)\s*\+\s*(\d+)$/i);
            const bonus = parseInt(bonusStr, 10);

            // 3) Pour 'count' répétitions, on refait 'count' fois « diceExpr »
            let sumNumeric = 0;
            const detailedParts = [];
            for (let i = 0; i < count; i++) {
                // Lance le diceExpr, qui est du type "1d6" ou "2d8" etc.
                const [n, sides] = diceExpr.split("d").map(Number);
                const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
                const subSum = rolls.reduce((a, b) => a + b, 0);
                sumNumeric += subSum;
                detailedParts.push(`[ ${rolls.join(", ")} ]`);
            }
            // ajoute aussi le bonus 'count' fois
            sumNumeric += bonus * count;

            // 4) Alimente vos tableaux
            //    - pour le détail, on injecte d’abord chacun des jets, puis + bonus
            detailedTokens.push(
                ...detailedParts,
                ...Array(count).fill(`+ ${bonus}`)
            );
            //    - pour le numérico, juste la somme globale de ce token
            numericTokens.push(`${sumNumeric}`);

            continue;
        }


        // 3b) dFudge
        if (m = tok.match(/^(\d*)dF(?:udge)?$/i)) {
            const count = parseInt(m[1], 10) || 4;
            const rolls = Array.from({ length: count }, () => [-1, 0, 1][Math.floor(Math.random() * 3)]);
            const sum = rolls.reduce((a, b) => a + b, 0);
            detailedTokens.push(`[ ${rolls.join(", ")} ]`);
            numericTokens.push(`${sum}`);
            continue;
        }

        // 3c) NdX
        if (m = tok.match(/^(\d*)d(\d+)$/i)) {
            const count = parseInt(m[1], 10) || 1;
            const faces = parseInt(m[2], 10);
            const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
            const sum = rolls.reduce((a, b) => a + b, 0);
            detailedTokens.push(`[ ${rolls.join(", ")} ]`);
            numericTokens.push(`${sum}`);
            continue;
        }

        // 3d) tout le reste (nombres, + - * / ou parenthèses)
        detailedTokens.push(tok);
        numericTokens.push(tok);
    }

    // 4. Reconstruction
    const exprDetailed = detailedTokens.join(" ");
    const exprNumeric = numericTokens.join(" ");
    console.log("Expression détaillée :", exprDetailed);
    console.log("Expression numérique :", exprNumeric);

    // 5. Évaluation safe + tronquage
    let total;
    try {
        total = Function(`"use strict";return(${exprNumeric});`)();
        total = Number(total.toPrecision(12));
    } catch (e) {
        console.error("Erreur d'évaluation :", exprNumeric, e);
        return null;
    }

    return {
        expression: exprExpanded,
        rolls: exprDetailed,
        total: total
    };
}






