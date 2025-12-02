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
    /([\p{L}_][\p{L}0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|>=|<=|[\+\-\*\/\(\)\\><?=;:|&])/giu;
const DB_TOKEN = /^(\d*)db(\d+)$/i;
const FUDGE_TOKEN = /^(\d*)dF(?:udge)?$/i;
const DICE_TOKEN = /^(\d*)d(\d+)$/i;

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
    let hidden = text.startsWith("/gr") || text.startsWith("/gmroll");
    let rollExpression = text
        .replace("/gmroll ", "")
        .replace("/gr ", "")
        .replace("/roll ", "")
        .replace("/r ", "")

    // TODO: throw a clean error when managing errors correctly
    if (!rollExpression) return null;

    let mode = "normal";
    const modeMatch = rollExpression.match(/^(max|min)\b/i);
    if (modeMatch) {
        mode = modeMatch[1].toLowerCase();
        rollExpression = rollExpression.replace(modeMatch[1], "").trim()
    }

    // Validation large (fonctions + .75)
    const rawTokens = rollExpression.match(TOKEN_REGEX);
    // TODO: throw a clean error when managing errors correctly
    if (!rawTokens) return null;
    const validTokenRegex =
        /^([\p{L}_][\p{L}0-9_]*|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|>=|<=|[\+\-\*\/\(\)\\><?=;:|&])$/iu;

    for (const tok of rawTokens) {
        // TODO: throw a clean error when managing errors correctly
        if (!validTokenRegex.test(tok)) return null;
    }
    console.log(rollExpression);

    const tokens = getTokens(rollExpression, mode)
    return { tokens, hidden };
}

const tokenBuilders = [
    {
        test: token => token.match(DB_TOKEN),
        build: (match, idx, _token, mode) => new DBToken(match[1], match[2], ...idx, mode)
    }, {
        test: token => token.match(FUDGE_TOKEN),
        build: (match, idx, _token, mode) => new FudgeDiceToken(match[1], ...idx, mode)
    }, {
        test: token => token.match(DICE_TOKEN),
        build: (match, idx, _token, mode) => new DiceToken(match[1], match[2], ...idx, mode)
    }, {
        test: token => ["(", ")"].includes(token),
        build: (_match, idx, token, _mode) => new ParenToken(token, ...idx)
    }, {
        test: token => ["+", "-", "*", "/", ">=", "<=", ":", "?", ">", "<", ";", "|", "&"].includes(token),
        build: (_match, idx, token, _mode) => new OperatorToken(token, ...idx)
    }, {
        test: token => isNumeric(token),
        build: (_match, idx, token, _mode) => new DigitToken(token, ...idx)
    }, {
        test: _token => true,
        build: (_match, idx, token, _mode) => new FunctionToken(token, ...idx)
    },
];

function buildToken(token, indexes, mode, escaped) {
    if (escaped) return new TextToken(token, ...indexes);

    for (const { test, build } of tokenBuilders) {
        const match = test(token);
        if (match) return build(match, indexes, token, mode);
    }

    return new TextToken(token, ...indexes);
};

function getTokens(text, mode) {
    const raw = text.toLowerCase().trim();

    const tokensRaw = raw.match(TOKEN_REGEX);
    if (!tokensRaw) {
        console.error("Impossible de tokeniser l'expression :", raw);
        return null;
    }    

    let cursor = 0;
    let escaped = false;
    const tokens = [];

    console.log("raw tokens:", tokensRaw);
    for (const token of tokensRaw) {
        const indexes = [cursor, cursor + token.length];
        if (token === "\\") {
            escaped = true;
            cursor = indexes[1];
            continue;
        }

        tokens.push(buildToken(token, indexes, mode, escaped));
        escaped = false;
        cursor = indexes[1];
    }

    console.log("token objects", tokens);
    return tokens;
}

/* ===========================
   Roll principal (DRY)
=========================== */

export async function rollExpression(tokens) {
    let displayExpr = "";
    let calcExpr = "";

    for (const token of tokens) {
        displayExpr += ` ${token.display}`;
        calcExpr += ` ${token.value}`;
    }

    let total;
    try {
        if (calcExpr.trim() !== "") {
            //TODO: Gérer les multiples retours qui renvoient un object (essaye a=5;a+2)
            total = evaluate(calcExpr);
            console.log(total.entries)
            if (typeof total === "number") {
                total = Number(total.toPrecision(12));
            }
        }
    } catch (error) {
        console.error("Erreur d'évaluation mathjs :", calcExpr, error);
        return null;
    }

    return {
        rolls: displayExpr,
        total: total || 0,
        allDiceMin: tokens.some(token => token._rolls) && tokens.every(token => token.allFumble),
        allDiceMax: tokens.some(token => token._rolls) && tokens.every(token => token.allCrit),
    };
}
