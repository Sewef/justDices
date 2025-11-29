import OBR from "@owlbear-rodeo/sdk";
import { parseInput } from './dice-utils.js';
import { rollExpression } from './dice-utils.js';
import { toggleDicePanel } from "./quickdice.js";

const minPanelWidth = 350;
const minPanelHeight = 200;

const inputHistory = [];
let historyIndex = -1;

let isResizing = false;
let dirActive = null;
let startX, startY, startW, startH;

async function setupResizer() {
  const panel = document.querySelector('#app');
  const dirs = ['nw', 'ne', 'sw', 'se'];
  // console.log("Setting up resizer for dice panel...");

  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.classList.add('resize-handle', dir);
    panel.appendChild(h);
    // console.log(`Resize handle added for direction: ${dir}`, h);

    h.addEventListener('pointerdown', async e => {
      // console.log(`Resizing started in direction: ${dir}`);
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      dirActive = dir;
      startX = e.clientX;
      startY = e.clientY;
      startW = await OBR.action.getWidth();
      startH = await OBR.action.getHeight();
      document.body.style.cursor = getCursorFor(dir);
      h.setPointerCapture(e.pointerId);
      h.addEventListener('pointermove', onPointerMove, { passive: false });
      h.addEventListener('pointerup', onPointerUp, { passive: false });
    }, { passive: false });

    const onPointerMove = async e => {
      if (!isResizing || dirActive !== dir) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW + (dir.includes('e') ? dx : -dx);
      let newH = startH + (dir.includes('s') ? dy : -dy);
      newW = Math.max(minPanelWidth, newW);
      newH = Math.max(minPanelHeight, newH);
      await OBR.action.setWidth(newW);
      await OBR.action.setHeight(newH);
    };

    const onPointerUp = e => {
      if (!isResizing || dirActive !== dir) return;
      e.preventDefault();
      isResizing = false;
      dirActive = null;
      document.body.style.cursor = '';
      h.releasePointerCapture(e.pointerId);
      h.removeEventListener('pointermove', onPointerMove);
      h.removeEventListener('pointerup', onPointerUp);
    };
  });
}

function getCursorFor(dir) {
  return (dir === 'nw' || dir === 'se') ? 'nwse-resize' : 'nesw-resize';
}

// SETUP
export function setupDiceRoller(playerName) {

  document.getElementById('toggleDicePanel').addEventListener('click', () => {
    toggleDicePanel();
  });

  setupResizer();

  console.log(`JustDices: Setting up dice roller for player: ${playerName}`);
  // console.log("Connection ID:", OBR.player.id);

  // Setup Submit event
  document.getElementById("hiddenRollButton").addEventListener("click", async () => {
    const value = document.getElementById("inputField").value;
    const command = value.trim().startsWith("/gr") ? value : "/gr " + value;
    await submitInput(command);
  });

  document.getElementById("rollButton").addEventListener("click", async () => {
    const value = document.getElementById("inputField").value;
    const command = value.trim().startsWith("/r") ? value : "/r " + value;
    await submitInput(command);
  });

  document.getElementById("input").addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent form from refreshing the page
    const value = document.getElementById("inputField").value;
    let command = value.trim();
    if (!command.startsWith("/gr") && !command.startsWith("/r")) {
      command = "/r " + command;
    }
    await submitInput(command);
    document.getElementById("inputField").value = "";
  });

  document.getElementById("inputField").addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      if (historyIndex < 0) historyIndex = inputHistory.length - 1;
      else if (historyIndex > 0) historyIndex--;
      inputField.value = inputHistory[historyIndex];
    }
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      if (historyIndex < inputHistory.length - 1) {
        historyIndex++;
        inputField.value = inputHistory[historyIndex];
      } else {
        historyIndex = -1;
        inputField.value = "";
      }
    }
  });

  OBR.broadcast.onMessage("justdices.dice-roll", async (event) => {
    // console.log(event);
    const currentPlayer = await OBR.player.id;
    const isGM = await OBR.player.getRole() === "GM";

    // console.log("Current Player ID:", currentPlayer);
    // console.log("Sender ID:", event.data.senderId);

    let show = true;
    if (event.data.text.hidden) {
      // console.log("Jet caché reçu, vérification des permissions...");
      if (event.data.sender.id !== currentPlayer && !isGM) {
        // console.log("Jet caché non affiché (pas le lanceur ni GM).");
        show = false;
      }
    }

    if (show) addLogEntry(event.data);
  });
}

// INPUT WORKFLOW
export async function submitInput(text) {
  // Utilitaire : affiche une erreur et déclenche l'animation d'erreur
  function triggerInputError(message) {
    const inputField = document.getElementById("inputField");
    if (!inputField) return;

    OBR.notification.show(message, "ERROR");

    inputField.classList.add("input-error-text", "input-error-outline");

    setTimeout(() => {
      inputField.classList.remove("input-error-text", "input-error-outline");
    }, 1000);
  }

  // 1. Parse l’input pour extraire l’expression
  const parsedInput = await parseInput(text);
  if (!parsedInput) {
    console.error("Failed to parse input.");
    triggerInputError("Invalid or empty dice command.");
    return;
  }

  // 2. Lance les dés
  const rollResult = await rollExpression(parsedInput.rollExpression, parsedInput.mode);
  if (!rollResult) {
    console.error("rollExpression returned null.");
    triggerInputError("Dice roll failed (syntax error?).");
    return;
  }


  // 3. Construit l’objet de résultat en utilisant exprDetailed / exprNumeric
  const resultStr = {
    // Affiche l’input original, puis l’expression numérique entre parenthèses
    expression: `${text} (${rollResult.expression})`,
    // Dans 'rolls', on met le détail formaté
    rolls: rollResult.rolls,
    total: rollResult.total,
    hidden: parsedInput.hidden,
    original: text,
    allDiceMax: rollResult.allDiceMax,
    allDiceMin: rollResult.allDiceMin
  };

  if (text.trim()) {
    inputHistory.push(text.trim());
    if (inputHistory.length > 50) inputHistory.shift(); // Limiter à 50
  }
  historyIndex = -1; // Reset navigation après un envoi

  // 4. Envoie au log (et au GM si hidden)
  await broadcastLogEntry(
    await OBR.player.getName(),
    resultStr
  );
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}



// LOGGING
async function addLogEntry(eventData) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");

  let criticalClass = "";
  if (eventData.text.allDiceMax) criticalClass = " critical-flex";
  if (eventData.text.allDiceMin) criticalClass = " critical-failure";

  newEntry.className = "card log-entry-animate" + criticalClass;

  if (eventData.text.hidden) {
    newEntry.classList.add("hidden-roll");
    newEntry.style.borderColor = eventData.sender.color + "80";
  } else {
    newEntry.classList.add("public-roll");
    newEntry.style.borderColor = eventData.sender.color;
  }

  const originalCommand = eventData.text.original;

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">
          ${eventData.text.hidden ? '<span class="hidden-icon" title="Hidden Roll">🔒</span>' : ''}
          ${eventData.sender.name}:
        </span>
        <span class="log-expression">
          ${eventData.text.original || originalCommand}
          <span class="roll-tooltip" title="${escapeHTML(escapeHTML(eventData.text.expression))}">🔍</span>
        </span>
        <span class="log result truncated hidden-rolls">
          <span class="rolls-content">${eventData.text.rolls}</span>
        </span>


 = 
        <span class="log total">${eventData.text.total}</span>
      </div>
      <button class="reroll-button" data-command="${eventData.text.original}" title="Reroll">
        <span class="dice-icon">🎲</span>
      </button>
    </div>
  `;

  logCards.insertBefore(newEntry, logCards.firstChild);

  const resultSpan = newEntry.querySelector(".log.result");
  const contentSpan = resultSpan.querySelector(".rolls-content");

  requestAnimationFrame(() => {
    const isOverflowing = contentSpan.scrollHeight > contentSpan.clientHeight + 2;

    if (isOverflowing) {
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


  const rerollBtn = newEntry.querySelector(".reroll-button");
  if (rerollBtn) {
    rerollBtn.addEventListener("click", async (e) => {
      const command = e.currentTarget.getAttribute("data-command");
      if (command) {
        await submitInput(command);
      }
    });
  }
}

async function broadcastLogEntry(user, text) {
  let sender;
  (async () => {
    sender = {
      id: await OBR.player.getId(),
      name: await OBR.player.getName(),
      color: await OBR.player.getColor(),
      role: await OBR.player.getRole(),
    };

    OBR.broadcast.sendMessage("justdices.dice-roll", { sender: sender, user: user, text: text }, { destination: 'ALL' });
  })();

}