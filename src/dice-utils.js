// dice-utils.js
import { evaluate } from "mathjs";
import {
    DBToken,
    DiceToken,
    FudgeDiceToken,
    OperatorToken,
    ParenToken,
    FunctionToken,
    DigitToken,
    TextToken,
} from "./tokens.js";


/* ===========================
   Tables & Constantes
=========================== */

// Tokenizer commun : fonctions, dés, décimaux nus, opérateurs, parenthèses
const TOKEN_REGEX =
    /([a-zA-Z_][a-zA-Z0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])/gi;

/* ===========================
   Utilitaires
=========================== */

function isNumeric(str) {
    return /^[-+]?(?:\d+|\d*\.\d+)$/.test(str.trim());
}

function isMathJsMethod(str) {
    try {
        const result = evaluate(str);
        return typeof result === 'function';
    } catch {
        return false;
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
        /^([a-zA-Z_][a-zA-Z0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])$/i;

    for (const tok of tokens) {
        if (!validTokenRegex.test(tok)) return null;
    }
    console.log(rollExpression);

    return { rollExpression, hidden, mode };
}

/* ===========================
   Roll principal (DRY)
=========================== */

function getTokens(text, mode) {
    const raw = text.toLowerCase().trim();

    const tokensRaw = raw.match(TOKEN_REGEX);
    if (!tokensRaw) {
        console.error("Impossible de tokeniser l'expression :", raw);
        return null;
    }
    let match;
    let index = 0;
    let escaped = false;
    const tokens = [];
    console.log("raw tokens:", tokensRaw);
    for (const token of tokensRaw) {
        const indexes = [index, index + token.length];
        let newToken;
        if ((match = token.match(/^(\d*)db(\d+)$/i))) {
            newToken = new DBToken(match[1], match[2], ...indexes, mode);
        } else if ((match = token.match(/^(\d*)dF(?:udge)?$/i))) {
            newToken = new FudgeDiceToken(match[1], ...indexes);
        } else if ((match = token.match(/^(\d*)d(\d+)$/i))) {
            newToken = new DiceToken(match[1], match[2], ...indexes, mode);
        } else if (token === "\\") {
            escaped = true;
            index = indexes.end;
            continue;
        } else if (!escaped && ["(",")"].includes(token)) {
            newToken = new ParenToken(token, ...indexes);
        } else if (!escaped && ["+", "-", "*", "/"].includes(token)) {
            newToken = new OperatorToken(token, ...indexes);
        } else if (!escaped && isNumeric(token)) {
            newToken = new DigitToken(token, ...indexes);
        } else if (!escaped && isMathJsMethod(token)) {
            newToken = new FunctionToken(token, ...indexes);
        } else {
            newToken = new TextToken(token, ...indexes);
            escaped = false;
        }
        tokens.push(newToken);
        index = indexes.end;
    }
    console.log("token objects", tokens);
    return tokens;
}


export async function rollExpression(text, mode = "normal") {
    const tokens = getTokens(text, mode);

    let displayExpr = "";
    let calcExpr = "";

    for (const token of tokens) {
        displayExpr += ` ${token.display}`;
        calcExpr += ` ${token.value}`;
    }

    let total;
    try {
        if (calcExpr.trim() !== "") {
            total = evaluate(calcExpr);
            total = Number(total.toPrecision(12));
        }
    } catch (e) {
        console.error("Erreur d'évaluation mathjs :", calcExpr, e);
        return null;
    }

    return {
        expression: text,
        rolls: displayExpr,
        total: total || 0,
        allDiceMin: tokens.some(token => token._rolls) && tokens.every(token => token.allFumble),
        allDiceMax: tokens.some(token => token._rolls) && tokens.every(token => token.allCrit),
    };
}
