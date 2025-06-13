import OBR from "@owlbear-rodeo/sdk";
import { parseInput } from './dice-utils.js';
import { rollExpression } from './dice-utils.js';

let localConfig = {
  playerName: "",
}

// SETUP
export function setupDiceRoller(playerName) {

  // console.log(`Setting up dice roller for player: ${playerName}`);
  // console.log("Connection ID:", OBR.player.id);

  localConfig.playerName = playerName;

  // Setup Submit event
  document.getElementById("hiddenRollButton").addEventListener("click", async () => {
    const value = document.getElementById("inputField").value;
    await submitInput("/gr " + value);
  });


  document.getElementById("input").addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent form from refreshing the page
    const value = document.getElementById("inputField").value;
    await submitInput("/r " + value);
  });

  OBR.broadcast.onMessage("justdices.dice-roll", async (event) => {
    // console.log(event);
    const currentPlayer = await OBR.player.id;
    const isGM = await OBR.player.getRole() === "GM";

    // console.log("Current Player ID:", currentPlayer);
    // console.log("Sender ID:", event.data.id);
  
    let show = true;
    if (event.data.text.hidden) {
      // console.log("Jet caché reçu, vérification des permissions...");
      if (event.data.id !== currentPlayer && !isGM) {
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
  //addLogEntry(localConfig.playerName, resultStr);
  broadcastLogEntry(localConfig.playerName, resultStr);
}

// LOGGING
function addLogEntry(user, text) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");
  newEntry.className = "card log-entry-animate";  // Ajout de la classe animée

  const originalCommand = text.expression.split(" (")[0];

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">${user}:</span> ${text.expression}<br>
        <span class="log result">${text.rolls}</span> = 
        <span class="log total">${text.total}</span>
      </div>
      <button class="reroll-button" data-command="${originalCommand}" title="Relancer le jet">
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

function broadcastLogEntry(user, text) {
  // console.log(`Broadcasting log entry from ${user}:`, text);
  OBR.broadcast.sendMessage("justdices.dice-roll", { id: OBR.player.id, user: user, text: text }, { destination: 'ALL' });
}