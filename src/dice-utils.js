import { evaluate } from "mathjs";

// INPUT PARSING
export async function parseInput(text) {
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

    // On ne valide plus manuellement les tokens — mathjs gère les erreurs
    return {
        rollExpression,
        hidden
    };
}

// Table des dbX → expressions équivalentes
const DBKeyword = [
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
    { key: "db2", value: "1d6+3" }, { key: "db1", value: "1d6+1" }
];

export async function rollExpression(text) {
    const raw = text.toLowerCase().trim();

    // Dés, dbN, dF(udge), nombres, opérateurs, parenthèses
    const tokenRegex = /([a-zA-Z_][a-zA-Z0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)])/gi;

    const tokens = raw.match(tokenRegex).map(t => (/^\.\d+$/.test(t) ? "0" + t : t));
    if (!tokens) {
        console.error("Impossible de tokeniser l'expression :", raw);
        return null;
    }

    // ── 1) Construire l'expression 'affichée' en développant dbN proprement ──
    //    (dbN -> "(NdX+Bonus)" ; 2dbN -> "(NdX+Bonus) + (NdX+Bonus)")
    const expandedTokens = tokens.map(tok => {
        const m = tok.match(/^(\d*)db(\d+)$/i);
        if (!m) return tok;

        const count = parseInt(m[1], 10) || 1;
        const key = `db${m[2]}`.toLowerCase();
        const entry = DBKeyword.find(e => e.key.toLowerCase() === key);
        if (!entry) {
            console.warn(`Définition manquante pour ${key}`);
            return tok;
        }
        const block = `(${entry.value})`;
        return count > 1 ? Array(count).fill(block).join(" + ") : block;
    });
    const exprExpanded = expandedTokens.join(" ");

    // ── 2) Construire le détail et la valeur numérique ──
    const numericTokens = [];
    const detailedTokens = [];

    for (let tok of tokens) {
        // a) dbN
        let m;
        if ((m = tok.match(/^(\d*)db(\d+)$/i))) {
            const mult = parseInt(m[1], 10) || 1;
            const key = `db${m[2]}`.toLowerCase();
            const entry = DBKeyword.find(e => e.key.toLowerCase() === key);
            if (!entry) {
                console.error(`Définition manquante pour ${key}`);
                continue;
            }

            // entry.value du style "NdX+B" (ex: "2d6+8")
            const parts = entry.value.split("+");
            const dicePart = parts[0].trim();              // "2d6"
            const bonus = parts[1] ? parseInt(parts[1].trim(), 10) : 0;

            const md = dicePart.match(/^(\d*)d(\d+)$/i);
            if (!md) {
                console.error(`Format db invalide: ${entry.value}`);
                continue;
            }

            const diceCount = parseInt(md[1], 10) || 1;
            const faces = parseInt(md[2], 10);

            let sumNumeric = 0;
            const detailedParts = [];

            for (let i = 0; i < mult; i++) {
                const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * faces) + 1);
                const subSum = rolls.reduce((a, b) => a + b, 0);
                sumNumeric += subSum + bonus;
                detailedParts.push(`[ ${rolls.join(", ")} ]`);
            }

            // Détail lisible : les jets, puis “+ bonus” répété mult fois (jamais en crochets)
            detailedTokens.push(...detailedParts, ...Array(mult).fill(`+ ${bonus}`));
            // Numérique : une seule valeur globale
            numericTokens.push(String(sumNumeric));
            continue;
        }

        // b) dF / dFudge
        if ((m = tok.match(/^(\d*)dF(?:udge)?$/i))) {
            const count = parseInt(m[1], 10) || 4;
            const rolls = Array.from({ length: count }, () => [-1, 0, 1][Math.floor(Math.random() * 3)]);
            const sum = rolls.reduce((a, b) => a + b, 0);
            detailedTokens.push(`[ ${rolls.join(", ")} ]`);
            numericTokens.push(String(sum));
            continue;
        }

        // c) NdX
        if ((m = tok.match(/^(\d*)d(\d+)$/i))) {
            const count = parseInt(m[1], 10) || 1;
            const faces = parseInt(m[2], 10);
            const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
            const sum = rolls.reduce((a, b) => a + b, 0);
            detailedTokens.push(`[ ${rolls.join(", ")} ]`);
            numericTokens.push(String(sum));
            continue;
        }

        // d) nombres, opérateurs, parenthèses
        detailedTokens.push(tok);
        numericTokens.push(tok);
    }

    const exprDetailed = detailedTokens.join(" ");
    const exprNumeric = numericTokens.join(" ");

    // ── 3) Évaluer le total ──
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
        total: total
    };
}



