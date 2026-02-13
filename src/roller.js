import OBR from "@owlbear-rodeo/sdk";
import { parseInput, rollExpression } from './dice-utils.js';
import { toggleDicePanel } from "./quickdice.js";
import { broadcastLogEntry, registerDiceRollListener, getCurrentSender } from "./broadcastManager.js";
import { 
  addLogEntry, 
  showInputError, 
  getInputValue, 
  clearInput, 
  setInputValue,
  cleanupListeners 
} from "./uiManager.js";

const minPanelWidth = 350;
const minPanelHeight = 200;
const inputHistory = [];
let historyIndex = -1;
let isResizing = false;
let dirActive = null;
let startX, startY, startW, startH;

const getCursorFor = dir => (dir === 'nw' || dir === 'se') ? 'nwse-resize' : 'nesw-resize';

async function setupResizer() {
  const panel = document.querySelector('#app');
  const handlers = {};

  for (const dir of ['nw', 'ne', 'sw', 'se']) {
    const h = document.createElement('div');
    h.classList.add('resize-handle', dir);
    panel.appendChild(h);

    handlers[dir] = {
      onPointerMove: async e => {
        if (!isResizing || dirActive !== dir) return;
        e.preventDefault();
        const dx = e.clientX - startX, dy = e.clientY - startY;
        await OBR.action.setWidth(Math.max(minPanelWidth, startW + (dir.includes('e') ? dx : -dx)));
        await OBR.action.setHeight(Math.max(minPanelHeight, startH + (dir.includes('s') ? dy : -dy)));
      },
      onPointerUp: e => {
        if (!isResizing || dirActive !== dir) return;
        e.preventDefault();
        isResizing = false;
        dirActive = null;
        document.body.style.cursor = '';
        h.releasePointerCapture(e.pointerId);
        h.removeEventListener('pointermove', handlers[dir].onPointerMove);
        h.removeEventListener('pointerup', handlers[dir].onPointerUp);
      }
    };

    h.addEventListener('pointerdown', async e => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      dirActive = dir;
      [startX, startY] = [e.clientX, e.clientY];
      [startW, startH] = [await OBR.action.getWidth(), await OBR.action.getHeight()];
      document.body.style.cursor = getCursorFor(dir);
      h.setPointerCapture(e.pointerId);
      h.addEventListener('pointermove', handlers[dir].onPointerMove, { passive: false });
      h.addEventListener('pointerup', handlers[dir].onPointerUp, { passive: false });
    }, { passive: false });
  }
}

export function setupDiceRoller(playerName) {
  console.log(`JustDices: Setting up dice roller for player: ${playerName}`);
  setupResizer();
  document.getElementById('toggleDicePanel').addEventListener('click', () => toggleDicePanel());

  const handleRoll = async (isHidden = false) => {
    const value = getInputValue();
    const prefix = isHidden ? "/gr " : "/r ";
    const command = value.startsWith("/") ? value : prefix + value;
    await submitInput(command);
  };

  document.getElementById("hiddenRollButton").addEventListener("click", () => handleRoll(true));
  document.getElementById("rollButton").addEventListener("click", () => handleRoll());

  document.getElementById("input").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = getInputValue();
    const command = value.startsWith("/") ? value : "/r " + value;
    await submitInput(command);
    clearInput();
  });

  document.getElementById("inputField").addEventListener("keydown", (e) => {
    const input = document.getElementById("inputField");
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      historyIndex = historyIndex < 0 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
      setInputValue(inputHistory[historyIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      if (historyIndex < inputHistory.length - 1) setInputValue(inputHistory[++historyIndex]);
      else { historyIndex = -1; setInputValue(""); }
    }
  });

  // Register broadcast listener for incoming rolls
  registerDiceRollListener(async (event) => {
    const [currentPlayer, isGM] = [await OBR.player.id, await OBR.player.getRole() === "GM"];
    const isHidden = event.data.text.hidden;
    if (!isHidden || event.data.sender.id === currentPlayer || isGM) {
      addLogEntry(event.data, submitInput);
    }
  });
}

export async function submitInput(text, triggerInputError = null) {
  const errorHandler = triggerInputError || ((msg) => {
    showInputError(msg);
    OBR.notification.show(msg, "ERROR");
  });

  const parsedInput = await parseInput(text);
  if (!parsedInput) {
    console.error("Failed to parse input.");
    errorHandler("Invalid command.");
    return;
  }

  // Add to history
  if (text.trim()) {
    inputHistory.push(text.trim());
    if (inputHistory.length > 50) inputHistory.shift();
  }
  historyIndex = -1;

  // Handle "say" command
  if (parsedInput.type === "say") {
    const sender = await getCurrentSender();
    const resultStr = {
      isSay: true,
      message: parsedInput.message,
      original: text,
    };
    await broadcastLogEntry(sender, resultStr);
    return;
  }

  // Handle roll command
  const rollResult = await rollExpression(parsedInput.rollExpression, parsedInput.mode);
  if (!rollResult) {
    console.error("rollExpression returned null.");
    errorHandler("Dice roll failed (syntax error?).");
    return;
  }

  const sender = await getCurrentSender();
  const resultStr = {
    expressionExpanded: rollResult.expanded,
    rolls: rollResult.rolls,
    total: rollResult.total,
    hidden: parsedInput.hidden,
    original: text,
    allDiceMax: rollResult.allDiceMax,
    allDiceMin: rollResult.allDiceMin
  };

  await broadcastLogEntry(sender, resultStr);
}


/**
 * Cleanup resources when page unloads
 */
export function cleanup() {
  cleanupListeners();
  inputHistory.length = 0;
  historyIndex = -1;
}

// Register cleanup on page unload
window.addEventListener('beforeunload', cleanup);
