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
    newEntry.className = "card log-entry-animate say-message";
    newEntry.style.borderColor = sender.color;
    newEntry.innerHTML = `
      <div class="log-entry">
        <div class="log-text">
          <span class="log user">${sender.name}:</span>
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

  if (text.hidden) {
    newEntry.classList.add("hidden-roll");
    newEntry.style.borderColor = sender.color + "80";
  } else {
    newEntry.classList.add("public-roll");
    newEntry.style.borderColor = sender.color;
  }

  const originalCommand = text.original || text.expression;
  const lockIcon = text.hidden ? '<span class="hidden-icon" title="Hidden Roll">🔒</span>' : '';

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">${lockIcon}${sender.name}:</span>
        <span class="log-expression">
          ${originalCommand}
          <span class="roll-tooltip" title="${escapeHTML(text.expressionExpanded || originalCommand)}">🔍</span>
        </span>
        <span class="log result truncated hidden-rolls">
          <span class="rolls-content">${text.rolls}</span>
        </span> = <span class="log total">${text.total}</span>
      </div>
      <button class="reroll-button" data-command="${text.original}" title="Reroll">
        <span class="dice-icon">🎲</span>
      </button>
    </div>
  `;

  logCards.insertBefore(newEntry, logCards.firstChild);

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
