import OBR from "@owlbear-rodeo/sdk";
import { parseInput } from './dice-utils.js';
import { rollExpression } from './dice-utils.js';

let localConfig = {
  playerName: "",
}

// SETUP
export function setupDiceRoller(playerName) {

  console.log(`Setting up dice roller for player: ${playerName}`);

  localConfig.playerName = playerName;

  // Setup Submit event
  document.getElementById("input").addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent form from refreshing the page
    await submitInput(document.getElementById("inputField").value);
  });
}

// INPUT WORKFLOW
async function submitInput(text) {
  console.log(text);

  // Parse input to get Roll Expression
  let parsedInput = await parseInput(text);
  if (!parsedInput) {
    console.error("Failed to parse input.");
    return;
  }

  console.log(parsedInput);

  // Roll the dice using the parsed expression
  const rollResult = await rollExpression(parsedInput.rollExpression);

  const resultStr = {
    expression: `${text} (${rollResult.expression})`,
    rolls: rollResult.rolls,
    total: rollResult.total
  };
  
  addLogEntry(localConfig.playerName, resultStr);
  broadcastLogEntry(localConfig.playerName, resultStr);
}

// LOGGING
function addLogEntry(user, text) {
  const logCards = document.getElementById("logCards");
  const newEntry = document.createElement("div");
  newEntry.className = "card";

  const originalCommand = text.expression.split(" (")[0];

  newEntry.innerHTML = `
    <div class="log-entry">
      <div class="log-text">
        <span class="log user">${user}:</span> ${text.expression}<br>
        <span class="log result">${text.rolls}</span> = 
        <span class="log total">${text.total}</span>
      </div>
      <button class="reroll-button" data-command="${originalCommand}">🎲</button>
    </div>
  `;

  logCards.insertBefore(newEntry, logCards.firstChild);

  newEntry.querySelector(".reroll-button").addEventListener("click", (e) => {
    const command = e.target.getAttribute("data-command");
    if (command) {
      submitInput(command);
    }
  });
}


function broadcastLogEntry(user, text) {
  return;
}