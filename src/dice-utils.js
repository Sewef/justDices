
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

    // Validation détaillée : découpage en tokens par + ou -
    const tokens = rollExpression.split(/[\+\-]/).map(t => t.trim());

    const validTokenRegex = /^(\d*d\d+|\d*db\d+|\d*dF(udge)?|\d+)$/i;
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



export async function rollExpression(text) {
    let expression = text.toLowerCase().replaceAll(" ", "").trim();

    // Expand multiplier-based keywords like "2db4"
    expression = expression.replace(/(\d+)db(\d+)/g, (_, multiplier, dbLevel) => {
        return Array.from({ length: parseInt(multiplier) }, () => `db${dbLevel}`).join(' + ');
    });

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

    DBKeyword.forEach(({ key, value }) => {
        expression = expression.replaceAll(key, value);
    });

    const rolls = [];
    // Split expression into parts, keeping the operators
    const rollParts = [];
    let regex = /([+-]?[^+-]+)/g;
    let match;
    while ((match = regex.exec(expression)) !== null) {
        rollParts.push(match[0].trim());
    }
    for (const partWithOp of rollParts) {
        let operator = 1;
        let part = partWithOp;
        if (part.startsWith('+')) {
            part = part.slice(1);
        } else if (part.startsWith('-')) {
            operator = -1;
            part = part.slice(1);
        }
        part = part.trim();

        // 🎲 Gestion des dés Fudge
        if (part.match(/^(\d*)dF(udge)?$/i)) {
            const matchFudge = part.match(/^(\d*)dF(udge)?$/i);
            const numDice = parseInt(matchFudge[1]) || 4; // par défaut 4 dés Fudge
            const rollResults = [];

            for (let i = 0; i < numDice; i++) {
                const val = [-1, 0, 1][Math.floor(Math.random() * 3)] * operator;
                rollResults.push({ value: val, type: "fudge" });
            }

            rolls.push({
                expression: (operator === -1 ? '-' : '') + part,
                results: rollResults,
                total: rollResults.reduce((sum, r) => sum + r.value, 0)
            });

            continue;
        }

        // 🎲 Gestion classique des dés (NdX)
        const matchDice = part.match(/(\d*)d(\d+)/);
        if (matchDice) {
            const numDice = parseInt(matchDice[1]) || 1;
            const dieSize = parseInt(matchDice[2]);
            const rollResults = [];

            for (let i = 0; i < numDice; i++) {
                const roll = (Math.floor(Math.random() * dieSize) + 1) * operator;
                let type = "normal";
                if (Math.abs(roll) === 1) type = "min";
                else if (Math.abs(roll) === dieSize) type = "max";
                rollResults.push({ value: roll, type });
            }

            rolls.push({
                expression: (operator === -1 ? '-' : '') + part,
                results: rollResults,
                total: rollResults.reduce((sum, roll) => sum + roll.value, 0)
            });
        } else {
            // 🎯 Constantes
            let total = (parseInt(part) || 0) * operator;

            rolls.push({
                expression: (operator === -1 ? '-' : '') + part,
                results: [{ value: total, type: "normal" }],
                total: total
            });
        }
    }

    const totalRoll = rolls.reduce((sum, roll) => sum + roll.total, 0);

    let rollText = rolls.map(roll => {
        const formatted = roll.results.map(res => {
            if (res.type === "fudge") {
                if (res.value === 1) return `<span class="fudge-plus">+1</span>`;
                if (res.value === 0) return `<span class="fudge-zero">0</span>`;
                if (res.value === -1) return `<span class="fudge-minus">−1</span>`;
            }
            if (res.type === "min") return `<span class="min">${res.value}</span>`;
            if (res.type === "max") return `<span class="max">${res.value}</span>`;
            return `${res.value}`;
        }).join(', ');
        return `[ ${formatted} ]`;
    }).join(' + ');

    return {
        expression: expression,
        rolls: rollText,
        total: totalRoll
    };
}

