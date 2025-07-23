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

export async function rollExpression(inputText) {
    const raw = inputText.toLowerCase().trim();
    let exprExpanded = raw;
    let allDiceMax = true;
    let allDiceMin = true;

    // 1. Expand dbX
    exprExpanded = exprExpanded.replace(/(\d*)db(\d+)/gi, (_, countStr, num) => {
        const key = `db${num}`;
        const entry = DBKeyword.find(e => e.key.toLowerCase() === key.toLowerCase());
        if (!entry) return `db${num}`;
        const count = parseInt(countStr, 10) || 1;
        return Array(count).fill(entry.value).join(" + ");
    });

    // 2. Traitement unifié de exprNumeric et exprDetailed
    let exprNumeric = exprExpanded;
    let exprDetailed = raw.replace(/(\d*)db(\d+)/gi, (_, countStr, num) => {
        const key = `db${num}`;
        const entry = DBKeyword.find(e => e.key.toLowerCase() === key.toLowerCase());
        if (!entry) return `db${num}`;
        const count = parseInt(countStr, 10) || 1;

        const [, diceExpr, bonusStr] = entry.value.match(/^(\d*d\d+)\s*\+\s*(\d+)$/i);
        const bonus = parseInt(bonusStr, 10);
        const [n, sides] = diceExpr.split("d").map(Number);

        const results = [];

        for (let i = 0; i < count; i++) {
            const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
            const rollSum = rolls.reduce((a, b) => a + b, 0);
            const formatted = rolls.map(r => {
                if (r === 1) return `<span class="min">${r}</span>`;
                if (r === sides) return `<span class="max">${r}</span>`;
                return `${r}`;
            });
            results.push(`( [ ${formatted.join(", ")} ] + [ ${bonus} ] )`);
        }

        return results.join(" + ");
    });

    const diceResults = [];

    // Fudge dice
    exprNumeric = exprNumeric.replace(/(\d*)dF(?:udge)?/gi, (_, countStr) => {
        const count = parseInt(countStr, 10) || 4;
        const rolls = Array.from({ length: count }, () => [-1, 0, 1][Math.floor(Math.random() * 3)]);
        diceResults.push({ type: "fudge", rolls });
        allDiceMax = false;
        allDiceMin = false;
        return rolls.reduce((a, b) => a + b, 0);
    });

    exprDetailed = exprDetailed.replace(/(\d*)dF(?:udge)?(\s*[\+\-]\s*\d+)?/gi, (_, countStr, bonusPart) => {
        const { rolls } = diceResults.shift();

        const formatted = rolls.map(r => {
            if (r === -1) return `<span class="min">-1</span>`;
            if (r === 1) return `<span class="max">1</span>`;
            return `0`;
        });

        let result = `[ ${formatted.join(", ")} ]`;

        if (bonusPart) {
            const bonusMatch = bonusPart.match(/([\+\-])\s*(\d+)/);
            if (bonusMatch) {
                const op = bonusMatch[1];
                const bonus = bonusMatch[2];
                result += ` ${op} [ ${bonus} ]`;
            }
        }

        return result;
    });

    // NdX dice
    exprNumeric = exprNumeric.replace(/(\d*)d(\d+)/gi, (_, countStr, sidesStr) => {
        const count = parseInt(countStr, 10) || 1;
        const sides = parseInt(sidesStr, 10);
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
        diceResults.push({ type: "normal", rolls, sides });
        if (rolls.some(r => r !== sides)) {
            allDiceMax = false;
        }
        allDiceMin = diceResults.length > 0 && diceResults.every(group =>
            group.rolls && group.rolls.length > 0 && group.rolls.every(r => r === 1)
        );
        return rolls.reduce((a, b) => a + b, 0);
    });

    exprDetailed = exprDetailed.replace(/(\d*)d(\d+)((\s*[\+\-]\s*\d+)+)?/gi, (_, countStr, sidesStr, bonusPart) => {
        const { rolls, sides } = diceResults.shift();

        const formattedRolls = rolls.map(r => {
            if (r === 1) return `<span class="min">${r}</span>`;
            if (r === sides) return `<span class="max">${r}</span>`;
            return `${r}`;
        });

        let result = `[ ${formattedRolls.join(", ")} ]`;

        if (bonusPart) {
            const bonuses = bonusPart.match(/([\+\-])\s*(\d+)/g);
            if (bonuses) {
                for (const bonus of bonuses) {
                    const match = bonus.match(/([\+\-])\s*(\d+)/);
                    if (!match) continue;
                    const op = match[1];
                    const value = match[2];
                    result += ` ${op} [ ${value} ]`;
                }
            }
        }

        return result;
    });

    // 3. Évaluer
    let total;
    try {
        total = evaluate(exprNumeric);
        total = Number(total.toPrecision(12));
    } catch (e) {
        console.error("Erreur d'évaluation mathjs :", exprNumeric, e);
        return null;
    }
        // Ajoute une mise en forme aux nombres restants dans exprDetailed// Si le premier terme n'est pas entre crochets, l'encadrer
exprDetailed = exprDetailed.replace(/^(\d+)(?![^[]*[\]])/, "[ $1 ]");

    exprDetailed = exprDetailed.replace(/([+\-])\s*(\d+)(?![^[]*[\]])/g, (_, sign, num) => {
        return ` ${sign} [ ${num} ]`;
    });

    if (diceResults.length === 0) {
        allDiceMin = false;
        allDiceMax = false;
    }

    return {
        expression: exprExpanded,
        rolls: exprDetailed,
        total,
        allDiceMax,
        allDiceMin
    };
}


