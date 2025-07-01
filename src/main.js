import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import javascriptLogo from './javascript.svg'
import { setupDiceRoller } from './roller.js';

const diceTypes = [
  { label: "d4", value: "d4" },
  { label: "d6", value: "d6" },
  { label: "d8", value: "d8" },
  { label: "d10", value: "d10" },
  { label: "d12", value: "d12" },
  { label: "d20", value: "d20" },
  { label: "d100", value: "d100" },
  { label: "d1000", value: "d1000" },
  { label: "dF", value: "dF" }
];

function createDiceTable() {
  return `
    <table class="dice-table">
      <tbody>
        ${diceTypes.map(dice => `
          <tr>
            <th>${dice.label}</th>
            ${[1,2,3,4,5,6].map(count => `
              <td>
                <button data-dice="${dice.value}" data-count="${count}" aria-label="${count} ${dice.label}">
                  ${count}
                </button>
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

document.querySelector('#app').innerHTML = `
  <div id="inputRow">
    <form id="input">
      <div class="input-group">
        <input type="text" id="inputField" placeholder="1d8+6..." />
        <button type="button" id="hiddenRollButton" title="Hidden roll" aria-label="Hidden roll">🙈</button>
        <button type="button" id="rollButton" title="Roll it" aria-label="Roll it">⚔️</button>
        <button type="submit" style="display: none;"></button>
      </div>
    </form>
    <button id="toggleDicePanel" title="Quick Rolls panel" aria-label="Quick Rolls panel">🎲</button>
  </div>

  <div id="logContainer">
    <h3>Rolls History</h3>
    <div id="logCards"></div>
  </div>

  <div id="dicePanel" class="hidden" aria-hidden="true" role="dialog" aria-label="Quick Dice Rolls Panel">
    <div class="panel-header">
      <h3>Quick Dice Rolls</h3>
      <div class="panel-controls">
        <button id="toggleHiddenRolls" title="Toggle hide rolls" aria-label="Toggle hide rolls">🐵</button>
        <button id="closeDicePanel" aria-label="Close panel">✖</button>
      </div>
    </div>
    ${createDiceTable()}
  </div>

  <div id="resizer">
◢
  </div>
`;

OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));