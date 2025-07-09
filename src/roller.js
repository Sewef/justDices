import OBR from "@owlbear-rodeo/sdk";
import { parseInput } from './dice-utils.js';
import { rollExpression } from './dice-utils.js';

async function setupQuickDice() {
  const toggleDicePanelBtn = document.getElementById('toggleDicePanel');
  const dicePanel = document.getElementById('dicePanel');
  const closeDicePanelBtn = document.getElementById('closeDicePanel');
  const toggleHiddenRollsBtn = document.getElementById('toggleHiddenRolls');

  let hideRollsFromQuickPanel = false;

  toggleDicePanelBtn.addEventListener('click', () => {
    const isHidden = dicePanel.classList.contains('hidden');
    if (isHidden) {
      dicePanel.classList.remove('hidden');
      dicePanel.setAttribute('aria-hidden', 'false');
    } else {
      dicePanel.classList.add('hidden');
      dicePanel.setAttribute('aria-hidden', 'true');
    }
  });

  closeDicePanelBtn.addEventListener('click', () => {
    dicePanel.classList.add('hidden');
    dicePanel.setAttribute('aria-hidden', 'true');
  });

  toggleHiddenRollsBtn.addEventListener('click', () => {
    hideRollsFromQuickPanel = !hideRollsFromQuickPanel;
    toggleHiddenRollsBtn.textContent = hideRollsFromQuickPanel ? '🙈' : '🐵';
    console.log(`Hide rolls from quick panel: ${hideRollsFromQuickPanel}`);
  });

  // Gestion des clics sur les boutons de dés dans le tableau
  dicePanel.querySelectorAll('.dice-table button').forEach(btn => {
    btn.addEventListener('click', () => {
      const dice = btn.getAttribute('data-dice');
      const count = parseInt(btn.getAttribute('data-count'), 10);
      if (!dice || !count || count < 1) return;

      // Exemple d'exécution de lancer (à adapter selon ta logique)
      const rollCommand = hideRollsFromQuickPanel ? `/gr ${count}${dice}` : `/r ${count}${dice}`;
      submitInput(rollCommand);
    });
  });
}

let isResizing = false;
let dirActive = null;
let startX, startY, startW, startH;

async function setupResizer() {
  const panel = document.querySelector('#app');
  const dirs = ['nw','ne','sw','se'];
  console.log("Setting up resizer for dice panel...");

  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.classList.add('resize-handle', dir);
    panel.appendChild(h);
    console.log(`Resize handle added for direction: ${dir}`, h);

    h.addEventListener('pointerdown', async e => {
      console.log(`Resizing started in direction: ${dir}`);
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
      newW = Math.max(100, newW);
      newH = Math.max(100, newH);
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
  setupQuickDice();
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
async function submitInput(text) {
  // console.log(text);

  // Parse input to get Roll Expression
  let parsedInput = await parseInput(text);
  if (!parsedInput) {
    console.error("Failed to parse input.");

    const inputField = document.getElementById("inputField");
    inputField.classList.add("input-error-text", "input-error-outline");
    setTimeout(() => {
      inputField.classList.remove("input-error-text", "input-error-outline");
    }, 1000);

    return;
  }

  // console.log(parsedInput);

  // Roll the dice using the parsed expression
  const rollResult = await rollExpression(parsedInput.rollExpression);

  const resultStr = {
    expression: `${text} (${rollResult.expression})`,
    rolls: rollResult.rolls,
    total: rollResult.total,
    hidden: parsedInput.hidden
  };

  // now everything is broadcasted then shown if necessary
  await broadcastLogEntry(await OBR.player.getName(), resultStr);

  document.getElementById("inputField").value = ""; // Clear the input field
}

// LOGGING
async function addLogEntry(eventData) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");

  newEntry.className = "card log-entry-animate";

  if (eventData.text.hidden) {
    newEntry.classList.add("hidden-roll");
    newEntry.style.borderColor = eventData.sender.color + "80";
  } else {
    newEntry.classList.add("public-roll");
    newEntry.style.borderColor = eventData.sender.color;
  }

  const originalCommand = eventData.text.expression.split(" (")[0];

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">
          ${eventData.text.hidden ? '<span class="hidden-icon" title="Hidden Roll">🔒</span>' : ''}
          ${eventData.sender.name}:
        </span> ${eventData.text.expression}<br>
        <span class="log result">${eventData.text.rolls}</span> = 
        <span class="log total">${eventData.text.total}</span>
      </div>
      <button class="reroll-button" data-command="${originalCommand}" title="Reroll">
        <span class="dice-icon">🎲</span>
      </button>
    </div>
  `;

  logCards.insertBefore(newEntry, logCards.firstChild);

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