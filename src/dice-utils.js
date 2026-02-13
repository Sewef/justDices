// dice-utils.js
import {
    DBToken,
    DiceToken,
    ExplodeDiceToken,
    FudgeDiceToken,
    KeepDropDiceToken,
    OperatorToken,
    ParenToken,
    FunctionToken,
    DigitToken,
    TextToken,
} from "./tokens.js";
import { cachedEvaluate } from "./cacheManager.js";
import { parseAndValidateExpression, TOKEN_REGEX } from "./validationUtils.js";


/* ===========================
   Tables & Constants
=========================== */

/* ===========================
   Utilities
=========================== */

const isNumeric = str => /^[-+]?(?:\d+|\d*\.\d+)$/.test(str.trim());

let mathFunctions = null;

/**
 * Lazy load mathjs function names
 */
async function loadMathFunctionNames() {
  if (mathFunctions) return mathFunctions;
  
  try {
    const math = await import('mathjs');
    const instance = math.default || math;
    // Get all built-in functions from mathjs
    mathFunctions = new Set(Object.keys(instance).filter(key => {
      try {
        return typeof instance[key] === 'function';
      } catch {
        return false;
      }
    }));
    return mathFunctions;
  } catch (e) {
    console.error("Failed to load mathjs functions:", e);
    return new Set();
  }
}

const isMathJsMethod = async str => {
  const functions = await loadMathFunctionNames();
  return functions.has(str);
};

/* ===========================
   Parsing input command
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
        
        if (!parseAndValidateExpression(expr)) return null;
        
        return { type: "roll", rollExpression: expr, mode, hidden: false };
    }

    const grMatch = text.match(/^\/(gr|gmroll)\s+(.+)$/i);
    if (grMatch) {
        const rollExpression = grMatch[2].trim();
        const modeMatch = rollExpression.match(/^(max|min)\b/i);
        const mode = modeMatch ? modeMatch[1].toLowerCase() : "normal";
        const expr = modeMatch ? rollExpression.slice(modeMatch[0].length).trim() : rollExpression;
        
        if (!parseAndValidateExpression(expr)) return null;
        
        return { type: "roll", rollExpression: expr, mode, hidden: true };
    }

    return null;
}

/* ===========================
   Main roll (DRY)
=========================== */

function getTokens(text, mode) {
    const raw = text.toLowerCase().trim();
    const tokensRaw = raw.match(TOKEN_REGEX);
    if (!tokensRaw) {
        console.error("Impossible to tokenize expression:", raw);
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
        } else if ((match = token.match(/^(\d*)d(\d+)!(?:>=(\d+))?$/i))) {
            // Exploding dice: 4d6! or 4d6!>=5
            const threshold = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
            newToken = new ExplodeDiceToken(match[1], match[2], threshold, start, end, mode);
        } else if ((match = token.match(/^(\d*)d(\d+)k(\d+)$/i))) {
            // Keep dice: 4d6k3
            newToken = new KeepDropDiceToken(match[1], match[2], parseInt(match[3], 10), null, start, end, mode);
        } else if ((match = token.match(/^(\d*)d(\d+)d(\d+)$/i))) {
            // Drop dice: 4d6d1
            newToken = new KeepDropDiceToken(match[1], match[2], null, parseInt(match[3], 10), start, end, mode);
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
        } else {
            // Could be a function or a text token - treat as text for now
            // Functions are validated during evaluation, not tokenization
            newToken = new FunctionToken(token, start, end);
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
        total = calcExpr.trim() ? await cachedEvaluate(calcExpr) : 0;
    } catch (e) {
        console.error("mathjs evaluation error:", calcExpr, e);
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
