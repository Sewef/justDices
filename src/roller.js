import OBR from "@owlbear-rodeo/sdk";
import { parseInput, rollExpression } from './dice-utils.js';
import { toggleDicePanel } from "./quickdice.js";

const minPanelWidth = 350;
const minPanelHeight = 200;
const inputHistory = [];
let historyIndex = -1;
let isResizing = false;
let dirActive = null;
let startX, startY, startW, startH;

const getCursorFor = dir => (dir === 'nw' || dir === 'se') ? 'nwse-resize' : 'nesw-resize';
const escapeHTML = str => !str ? "" : str
  .replace(/&/g, "&amp;")
  .replace(/"/g, "&quot;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

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

  const triggerInputError = msg => {
    const inputField = document.getElementById("inputField");
    if (!inputField) return;
    OBR.notification.show(msg, "ERROR");
    inputField.classList.add("input-error-text", "input-error-outline");
    setTimeout(() => inputField.classList.remove("input-error-text", "input-error-outline"), 1000);
  };

  const handleRoll = async (isHidden = false) => {
    const value = document.getElementById("inputField").value.trim();
    const prefix = isHidden ? "/gr " : "/r ";
    const command = value.startsWith(isHidden ? "/gr" : "/r") ? value : prefix + value;
    await submitInput(command, triggerInputError);
  };

  document.getElementById("hiddenRollButton").addEventListener("click", () => handleRoll(true));
  document.getElementById("rollButton").addEventListener("click", () => handleRoll());

  document.getElementById("input").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = document.getElementById("inputField").value.trim();
    const command = value.startsWith("/gr") || value.startsWith("/r") ? value : "/r " + value;
    await submitInput(command, triggerInputError);
    document.getElementById("inputField").value = "";
  });

  document.getElementById("inputField").addEventListener("keydown", (e) => {
    const input = document.getElementById("inputField");
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      historyIndex = historyIndex < 0 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
      input.value = inputHistory[historyIndex];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      if (historyIndex < inputHistory.length - 1) input.value = inputHistory[++historyIndex];
      else { historyIndex = -1; input.value = ""; }
    }
  });

  OBR.broadcast.onMessage("justdices.dice-roll", async (event) => {
    const [currentPlayer, isGM] = [await OBR.player.id, await OBR.player.getRole() === "GM"];
    if (!event.data.text.hidden || event.data.sender.id === currentPlayer || isGM) {
      addLogEntry(event.data);
    }
  });
}

export async function submitInput(text, triggerInputError = null) {
  const errorHandler = triggerInputError || (msg => OBR.notification.show(msg, "ERROR"));

  const parsedInput = await parseInput(text);
  if (!parsedInput) {
    console.error("Failed to parse input.");
    errorHandler("Invalid or empty dice command.");
    return;
  }

  const rollResult = await rollExpression(parsedInput.rollExpression, parsedInput.mode);
  if (!rollResult) {
    console.error("rollExpression returned null.");
    errorHandler("Dice roll failed (syntax error?).");
    return;
  }

  const resultStr = {
    expressionExpanded: rollResult.expanded,
    rolls: rollResult.rolls,
    total: rollResult.total,
    hidden: parsedInput.hidden,
    original: text,
    allDiceMax: rollResult.allDiceMax,
    allDiceMin: rollResult.allDiceMin
  };

  if (text.trim()) {
    inputHistory.push(text.trim());
    if (inputHistory.length > 50) inputHistory.shift();
  }
  historyIndex = -1;

  await broadcastLogEntry(await OBR.player.getName(), resultStr);
}

async function addLogEntry(eventData) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");
  const { text, sender } = eventData;

  const criticalClass = text.allDiceMax ? " critical-flex" : text.allDiceMin ? " critical-failure" : "";
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

  const resultSpan = newEntry.querySelector(".log.result");
  const contentSpan = resultSpan.querySelector(".rolls-content");

  requestAnimationFrame(() => {
    if (contentSpan.scrollHeight > contentSpan.clientHeight + 2) {
      const btn = document.createElement("button");
      btn.className = "expand-rolls";
      btn.textContent = "▼";
      btn.addEventListener("click", () => {
        resultSpan.classList.toggle("expanded");
        btn.textContent = resultSpan.classList.contains("expanded") ? "▲" : "▼";
      });
      resultSpan.appendChild(btn);
    }
  });

  newEntry.querySelector(".reroll-button").addEventListener("click", async e => {
    const command = e.currentTarget.getAttribute("data-command");
    if (command) await submitInput(command);
  });
}

async function broadcastLogEntry(user, text) {
  const sender = {
    id: await OBR.player.getId(),
    name: await OBR.player.getName(),
    color: await OBR.player.getColor(),
    role: await OBR.player.getRole(),
  };
  OBR.broadcast.sendMessage("justdices.dice-roll", { sender, user, text }, { destination: 'ALL' });
}
