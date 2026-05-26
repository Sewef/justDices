/**
 * UI Manager for handling DOM interactions and display
 */

const escapeHTML = str => !str ? "" : str
  .replace(/&/g, "&amp;")
  .replace(/"/g, "&quot;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const eventListeners = new Map(); // Track listeners for cleanup

/**
 * Display error message with visual feedback
 * @param {string} msg - Error message
 */
export function showInputError(msg) {
  const inputField = document.getElementById("inputField");
  if (!inputField) {
    console.warn("Input field not found for error display");
    return;
  }
  
  inputField.classList.add("input-error-text", "input-error-outline");
  setTimeout(() => {
    if (inputField) {
      inputField.classList.remove("input-error-text", "input-error-outline");
    }
  }, 1000);
}

/**
 * Add a log entry to the display
 * @param {Object} eventData - {text, sender}
 * @param {Function} onReroll - Callback(command) when reroll clicked
 */
export function addLogEntry(eventData, onReroll) {
  const logCards = document.getElementById("logCards");
  if (!logCards) {
    console.warn("Log cards container not found");
    return;
  }

  const newEntry = document.createElement("div");
  const { text, sender } = eventData;

  // Handle "say" message
  if (text.isSay) {
    const safeSenderName = escapeHTML(sender?.name || "Unknown");
    newEntry.className = "card log-entry-animate say-message";
    newEntry.style.borderColor = sender.color;
    newEntry.innerHTML = `
      <div class="log-entry">
        <div class="log-text">
          <span class="log user">${safeSenderName}:</span>
          <span class="log-message">${escapeHTML(text.message)}</span>
        </div>
      </div>
    `;
    logCards.insertBefore(newEntry, logCards.firstChild);
    return;
  }

  // Handle roll entry
  const criticalClass = (text.allDiceMax ? " critical-flex" : "") + (text.allDiceMin ? " critical-failure" : "");
  newEntry.className = "card log-entry-animate" + criticalClass;
  if (text.allDiceMax) newEntry.classList.add('critical-flex-glow');
  if (text.allDiceMin) newEntry.classList.add('critical-failure-glow');

  if (text.hidden) {
    newEntry.classList.add("hidden-roll");
    newEntry.style.borderColor = sender.color + "80";
  } else {
    newEntry.classList.add("public-roll");
    newEntry.style.borderColor = sender.color;
  }

  const originalCommand = text.original || text.expression;
  const safeSenderName = escapeHTML(sender?.name || "Unknown");
  const safeOriginalCommand = escapeHTML(originalCommand || "");
  const safeExpandedExpression = escapeHTML(text.expressionExpanded || originalCommand || "");
  const lockIcon = text.hidden ? '<span class="hidden-icon" title="Hidden Roll">🔒</span>' : '';

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">${lockIcon}${safeSenderName}:</span>
        <span class="log-expression">
          ${safeOriginalCommand}
          <span class="roll-tooltip" title="${safeExpandedExpression}">🔍</span>
        </span>
        <span class="log result truncated hidden-rolls">
          <span class="rolls-content">${text.rolls}</span>
        </span> = <span class="log total">${text.total}</span>
      </div>
      <button class="reroll-button" data-command="${safeOriginalCommand}" title="Reroll">
        <span class="dice-icon">🎲</span>
      </button>
    </div>
  `;

  logCards.insertBefore(newEntry, logCards.firstChild);

  // After the failure animation ends, remove the class so the card's
  // border-color transitions back to the player's color (inline style).
  if (text.allDiceMax) {
    setTimeout(() => newEntry.classList.remove('critical-flex-glow'), 800);
  }
  if (text.allDiceMin) {
    setTimeout(() => newEntry.classList.remove('critical-failure-glow'), 800);
  }

  // Setup expand/collapse for long results
  const resultSpan = newEntry.querySelector(".log.result");
  const contentSpan = resultSpan.querySelector(".rolls-content");

  requestAnimationFrame(() => {
    if (contentSpan && contentSpan.scrollHeight > contentSpan.clientHeight + 2) {
      const btn = document.createElement("button");
      btn.className = "expand-rolls";
      btn.textContent = "▼";
      
      const toggleExpand = () => {
        resultSpan.classList.toggle("expanded");
        btn.textContent = resultSpan.classList.contains("expanded") ? "▲" : "▼";
      };
      
      btn.addEventListener("click", toggleExpand);
      resultSpan.appendChild(btn);
      trackListener(btn, "click", toggleExpand);
    }
  });

  // Setup reroll button
  const rerollBtn = newEntry.querySelector(".reroll-button");
  const handleReroll = async (e) => {
    const command = e.currentTarget.getAttribute("data-command");
    if (command) await onReroll(command);
  };
  
  rerollBtn.addEventListener("click", handleReroll);
  trackListener(rerollBtn, "click", handleReroll);
}

/**
 * Get input field value
 * @returns {string} Trimmed input value
 */
export function getInputValue() {
  const input = document.getElementById("inputField");
  if (!input) {
    console.warn("Input field not found");
    return "";
  }
  return input.value.trim();
}

/**
 * Clear input field
 */
export function clearInput() {
  const input = document.getElementById("inputField");
  if (input) {
    input.value = "";
  } else {
    console.warn("Input field not found for clearing");
  }
}

/**
 * Set input field value
 * @param {string} value - Value to set
 */
export function setInputValue(value) {
  const input = document.getElementById("inputField");
  if (input) {
    input.value = value;
  } else {
    console.warn("Input field not found for setting value");
  }
}

/**
 * Track event listeners for cleanup
 * @param {Element} element - DOM element
 * @param {string} eventType - Event type (click, etc)
 * @param {Function} handler - Handler function
 */
function trackListener(element, eventType, handler) {
  const key = `${element.toString()}_${eventType}`;
  if (!eventListeners.has(key)) {
    eventListeners.set(key, []);
  }
  eventListeners.get(key).push({ element, eventType, handler });
}

/**
 * Clean up all tracked event listeners
 */
export function cleanupListeners() {
  eventListeners.forEach(listeners => {
    listeners.forEach(({ element, eventType, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(eventType, handler);
      }
    });
  });
  eventListeners.clear();
}

/**
 * Display a help card in the log with available commands
 */
export function showHelpCard() {
  const logCards = document.getElementById("logCards");
  if (!logCards) return;

  const card = document.createElement("div");
  card.className = "card log-entry-animate help-card";

  card.innerHTML = `
    <div class="help-card-content">
      <div class="help-title">🎲 JustDices — Commands</div>
      <table class="help-table">
        <tbody>
          <tr><td class="help-cmd">/r or /roll &lt;expr&gt;</td><td>Public roll (optional, assumed by default)</td></tr>
          <tr><td class="help-cmd">/gr or /gmroll &lt;expr&gt;</td><td>Hidden roll (GM only)</td></tr>
          <tr><td class="help-cmd">/say &lt;msg&gt;</td><td>Send a message</td></tr>
          <tr><td class="help-cmd">/help</td><td>Show this help</td></tr>
        </tbody>
      </table>
      <div class="help-section-title">Dice notation</div>
      <table class="help-table">
        <tbody>
          <tr><td class="help-cmd">NdX</td><td>Roll N dice of X sides — e.g. <em>2d6</em></td></tr>
          <tr><td class="help-cmd">NdX!</td><td>Exploding dice — e.g. <em>4d6!</em></td></tr>
          <tr><td class="help-cmd">NdX!&gt;=T</td><td>Explode on threshold — e.g. <em>4d6!&gt;=5</em></td></tr>
          <tr><td class="help-cmd">NdXkN</td><td>Keep highest N — e.g. <em>4d6k3</em></td></tr>
          <tr><td class="help-cmd">NdXdN</td><td>Drop lowest N — e.g. <em>4d6d1</em></td></tr>
          <tr><td class="help-cmd">NdF</td><td>Fudge/Fate dice</td></tr>
          <tr><td class="help-cmd">NdbX</td><td>Damage Base 1-28 (PTU 1.05)</td></tr>
        </tbody>
      </table>
      <div class="help-section-title">Modifiers</div>
      <table class="help-table">
        <tbody>
          <tr><td class="help-cmd">max &lt;expr&gt;</td><td>Force maximum values</td></tr>
          <tr><td class="help-cmd">min &lt;expr&gt;</td><td>Force minimum values</td></tr>
        </tbody>
      </table>
      <div class="help-tip">Math expressions are supported — e.g. <em>/r 2d6+floor(1d4/2)</em><br>
      Use ↑ and ↓ arrow keys to cycle through command history.<br>
      Full documentation and API available <a href="https://sewef.github.io/justDices/index.html" target="_blank" rel="noopener noreferrer">here</a>.</div>
    </div>
  `;

  logCards.insertBefore(card, logCards.firstChild);
}
