
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

    // Validation détaillée : découpage en tokens par + ou -
    const tokens = rollExpression.split(/[\+\-]/).map(t => t.trim());

    const validTokenRegex = /^(\d*d\d+|db\d+|\d+)$/i;
    // - \d*d\d+ : 0 ou plusieurs dés + d + taille dé (ex: 1d6, d20 = 1d20 implicite)
    // - db\d+ : notre token spécial (ex: db12)
    // - \d+ : nombre entier (ex: 4, 10)

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
    // console.log(`Rolling expression: ${text}`);
    let expression = text.toLowerCase().replaceAll(" ", "").trim();

    // Expand multiplier-based keywords like "2db4"
    expression = expression.replace(/(\d+)db(\d+)/g, (match, multiplier, dbLevel) => {
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

    // console.log(`Final roll expression: ${expression}`);

    const rolls = [];
    const rollParts = expression.split('+').map(part => part.trim());

    for (const part of rollParts) {
        const match = part.match(/(\d*)d(\d+)/);
        if (match) {
            const numDice = parseInt(match[1]) || 1;
            const dieSize = parseInt(match[2]);
            const rollResults = [];

            for (let i = 0; i < numDice; i++) {
                const roll = Math.floor(Math.random() * dieSize) + 1;
                let type = "normal";
                if (roll === 1) type = "min";
                else if (roll === dieSize) type = "max";
                rollResults.push({ value: roll, type });
            }

            rolls.push({
                expression: part,
                results: rollResults,
                total: rollResults.reduce((sum, roll) => sum + roll.value, 0)
            });
        } else {
            // Handle plain numbers or subtractions
            const subParts = part.split('-').map(subPart => subPart.trim());
            let total = parseInt(subParts[0]);

            for (let i = 1; i < subParts.length; i++) {
                total -= parseInt(subParts[i]);
            }

            rolls.push({
                expression: part,
                results: [{ value: total, type: "normal" }],
                total: total
            });
        }
    }


    const totalRoll = rolls.reduce((sum, roll) => sum + roll.total, 0);
    // console.log(`Roll results:`, rolls);

    let rollText = rolls.map(roll => {
        const formatted = roll.results.map(res => {
            if (res.type === "min") return `<span class="min">${res.value}</span>`;
            if (res.type === "max") return `<span class="max">${res.value}</span>`;
            return `${res.value}`;
        }).join(', ');
        return `[ ${formatted} ]`;
    }).join(' + ');


    // console.log(`Roll breakdown: ${rollText}`);
    // console.log(`Total roll: ${totalRoll}`);

    return {
        expression: expression,
        rolls: rollText,
        total: totalRoll
    };
}

