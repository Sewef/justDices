/**
 * Validation utilities for input parsing
 */

// Common tokenizer: functions, dice, bare decimals, operators, parentheses
export const TOKEN_REGEX =
    /([\p{L}_][\p{L}0-9_]*|\d*d\d+!(?:>=\d+)?|\d*d\d+[kd]\d+|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])/giu;

/**
 * Validate tokens against the standard pattern
 * @param {string[]} tokens - Array of tokens to validate
 * @returns {boolean} True if all tokens are valid
 */
export function validateTokens(tokens) {
  const validTokenRegex = /^([\p{L}_][\p{L}0-9_]*|\d*d\d+!(?:>=\d+)?|\d*d\d+[kd]\d+|\d*d\d+|\d*db\d+|\d*dF(?:udge)?|\d+(?:\.\d+)?|\.\d+|[\+\-\*\/\(\)\\])$/iu;
  return tokens.every(tok => validTokenRegex.test(tok));
}

/**
 * Parse and validate an expression
 * @param {string} expr - Expression to validate
 * @returns {string[]|null} Tokens if valid, null otherwise
 */
export function parseAndValidateExpression(expr) {
  const tokens = expr.match(TOKEN_REGEX);
  if (!tokens) return null;
  
  if (!validateTokens(tokens)) return null;
  
  return tokens;
}
