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
    /([\p{L}_][\p{L}0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])/giu;

/* ===========================
   Utilitaires
=========================== */

const isNumeric = str => /^[-+]?(?:\d+|\d*\.\d+)$/.test(str.trim());

const isMathJsMethod = str => {
	try {
		return typeof evaluate(str) === 'function';
	} catch {
		return false;
	}
};

/* ===========================
   Parsing de la commande
=========================== */

export async function parseInput(text) {
    // Extract command and content
    const sayMatch = text.match(/^\/say\s+(.+)$/i);
    if (sayMatch) {
        return { type: "say", message: sayMatch[1] };
    }

    const rollMatch = text.match(/^\/(r|roll)\s+(.+)$/i);
    if (rollMatch) {
        const rollExpression = rollMatch[2].trim();
        const modeMatch = rollExpression.match(/^(max|min)\b/i);
        const mode = modeMatch ? modeMatch[1].toLowerCase() : "normal";
        const expr = modeMatch ? rollExpression.slice(modeMatch[0].length).trim() : rollExpression;
        
        const tokens = expr.match(TOKEN_REGEX);
        if (!tokens) return null;
        
        const validTokenRegex = /^([\p{L}_][\p{L}0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])$/iu;
        if (!tokens.every(tok => validTokenRegex.test(tok))) return null;
        
        return { type: "roll", rollExpression: expr, mode, hidden: false };
    }

    const grMatch = text.match(/^\/(gr|gmroll)\s+(.+)$/i);
    if (grMatch) {
        const rollExpression = grMatch[2].trim();
        const modeMatch = rollExpression.match(/^(max|min)\b/i);
        const mode = modeMatch ? modeMatch[1].toLowerCase() : "normal";
        const expr = modeMatch ? rollExpression.slice(modeMatch[0].length).trim() : rollExpression;
        
        const tokens = expr.match(TOKEN_REGEX);
        if (!tokens) return null;
        
        const validTokenRegex = /^([\p{L}_][\p{L}0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])$/iu;
        if (!tokens.every(tok => validTokenRegex.test(tok))) return null;
        
        return { type: "roll", rollExpression: expr, mode, hidden: true };
    }

    return null;
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

    let index = 0;
    let escaped = false;
    const tokens = [];

    for (const token of tokensRaw) {
        const [start, end] = [index, index + token.length];
        let newToken, match;

        if ((match = token.match(/^(\d*)db(\d+)$/i))) {
            newToken = new DBToken(match[1], match[2], start, end, mode);
        } else if ((match = token.match(/^(\d*)dF(?:udge)?$/i))) {
            newToken = new FudgeDiceToken(match[1], start, end, mode);
        } else if ((match = token.match(/^(\d*)d(\d+)$/i))) {
            newToken = new DiceToken(match[1], match[2], start, end, mode);
        } else if (token === "\\") {
            escaped = true;
            index = end;
            continue;
        } else if (!escaped && ["(", ")"].includes(token)) {
            newToken = new ParenToken(token, start, end);
        } else if (!escaped && ["+", "-", "*", "/"].includes(token)) {
            newToken = new OperatorToken(token, start, end);
        } else if (!escaped && isNumeric(token)) {
            newToken = new DigitToken(token, start, end);
        } else if (!escaped && isMathJsMethod(token)) {
            newToken = new FunctionToken(token, start, end);
        } else {
            newToken = new TextToken(token, start, end);
            escaped = false;
        }
        
        tokens.push(newToken);
        index = end;
    }

    return tokens;
}


export async function rollExpression(text, mode = "normal") {
    const tokens = getTokens(text, mode);
    if (!tokens) return null;

    let displayExpr = "", calcExpr = "", expandedExpr = "";
    for (const token of tokens) {
        displayExpr += ` ${token.display}`;
        calcExpr += ` ${token.value}`;
        expandedExpr += ` ${token.expanded}`;
    }

    let total;
    try {
        total = calcExpr.trim() ? Number(evaluate(calcExpr).toPrecision(12)) : 0;
    } catch (e) {
        console.error("Erreur d'évaluation mathjs :", calcExpr, e);
        return null;
    }

    const hasRolls = tokens.some(t => t._rolls);
    return {
        expression: text,
        expanded: expandedExpr.trim(),
        rolls: displayExpr,
        total,
        allDiceMin: hasRolls && tokens.every(t => t.allFumble),
        allDiceMax: hasRolls && tokens.every(t => t.allCrit),
    };
}
