/**
 * Cache manager for mathjs evaluations and lazy loading
 */

let mathEvaluate = null;
const evaluationCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Lazy load mathjs module
 * @returns {Promise<Function>} mathjs evaluate function
 */
async function loadMathjs() {
  if (mathEvaluate) return mathEvaluate;
  
  try {
    // Import mathjs and get the evaluate function
    const math = await import('mathjs');
    // Try different ways to get evaluate depending on how mathjs exports it
    mathEvaluate = math.evaluate || math.default?.evaluate || math.default;
    
    if (!mathEvaluate || typeof mathEvaluate !== 'function') {
      throw new Error("Could not find evaluate function in mathjs");
    }
    
    return mathEvaluate;
  } catch (e) {
    console.error("Failed to load mathjs:", e);
    throw e;
  }
}

/**
 * Evaluate a mathematical expression with caching
 * @param {string} expr - Expression to evaluate
 * @returns {Promise<number>} Result of evaluation
 */
export async function cachedEvaluate(expr) {
  const trimmed = expr.trim();
  
  // Check cache first
  if (evaluationCache.has(trimmed)) {
    return evaluationCache.get(trimmed);
  }
  
  // Load mathjs if needed
  const evaluate = await loadMathjs();
  
  try {
    const result = Number(evaluate(trimmed).toPrecision(12));
    
    // Store in cache with size limit
    if (evaluationCache.size >= MAX_CACHE_SIZE) {
      const firstKey = evaluationCache.keys().next().value;
      evaluationCache.delete(firstKey);
    }
    evaluationCache.set(trimmed, result);
    
    return result;
  } catch (e) {
    console.error("mathjs evaluation error:", trimmed, e);
    throw e;
  }
}

/**
 * Clear the evaluation cache
 */
export function clearCache() {
  evaluationCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache size and stats
 */
export function getCacheStats() {
  return {
    size: evaluationCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
