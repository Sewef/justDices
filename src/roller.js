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
// SETUP
export function setupDiceRoller(playerName) {
  setupQuickDice();
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
      if (event.data.senderId !== currentPlayer && !isGM) {
        // console.log("Jet caché non affiché (pas le lanceur ni GM).");
        show = false;
      }
    }

    if (show) addLogEntry(event.data.user, event.data.text);
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
  //addLogEntry(OBR.player.getName(), resultStr);
  await broadcastLogEntry(await OBR.player.getName(), resultStr);

  document.getElementById("inputField").value = ""; // Clear the input field
}

// LOGGING
async function addLogEntry(user, text) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");

  newEntry.className = "card log-entry-animate";

  if (text.hidden) {
    newEntry.classList.add("hidden-roll");
  } else {
    newEntry.classList.add("public-roll");
  }

  const originalCommand = text.expression.split(" (")[0];

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">
          ${text.hidden ? '<span class="hidden-icon" title="Hidden Roll">🔒</span>' : ''}
          ${user}:
        </span> ${text.expression}<br>
        <span class="log result">${text.rolls}</span> = 
        <span class="log total">${text.total}</span>
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
  // console.log(`Broadcasting log entry from ${user}:`, text);
  OBR.broadcast.sendMessage("justdices.dice-roll", { senderId: OBR.player.id, user: user, text: text }, { destination: 'ALL' });
}