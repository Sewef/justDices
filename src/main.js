import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import javascriptLogo from './javascript.svg'
import { setupDiceRoller } from './roller.js';

document.querySelector('#app').innerHTML = `
  <div id="inputRow">
    <form id="input">
      <div class="input-group">
        <input type="text" id="inputField" placeholder="1d8+6..." />
        <button type="button" id="hiddenRollButton" title="Hidden roll">🙈</button>
        <button type="button" id="rollButton" title="Roll it">⚔️</button>
        <button type="submit" style="display: none;"></button>
      </div>
    </form>
    <button id="toggleDicePanel" title="Quick Rolls panel">🎲</button>
  </div>

  <div id="logContainer">
    <h3>Rolls History</h3>
    <div id="logCards">
    </div>
  </div>


<div id="dicePanel" class="hidden" aria-hidden="true" role="dialog" aria-label="Quick Dice Rolls Panel">
<div class="panel-header">
  <h3>Quick Dice Rolls</h3>
  <div class="panel-controls">
    <button id="toggleHiddenRolls" title="Toggle hide rolls">🐵</button>
    <button id="closeDicePanel" aria-label="Close panel">✖</button>
  </div>
</div>

  
  <table class="dice-table">
    <tbody>
      <tr>
        <th>d4</th>
        <td><button data-dice="d4" data-count="1">1</button></td>
        <td><button data-dice="d4" data-count="2">2</button></td>
        <td><button data-dice="d4" data-count="3">3</button></td>
        <td><button data-dice="d4" data-count="4">4</button></td>
        <td><button data-dice="d4" data-count="5">5</button></td>
        <td><button data-dice="d4" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d6</th>
        <td><button data-dice="d6" data-count="1">1</button></td>
        <td><button data-dice="d6" data-count="2">2</button></td>
        <td><button data-dice="d6" data-count="3">3</button></td>
        <td><button data-dice="d6" data-count="4">4</button></td>
        <td><button data-dice="d6" data-count="5">5</button></td>
        <td><button data-dice="d6" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d8</th>
        <td><button data-dice="d8" data-count="1">1</button></td>
        <td><button data-dice="d8" data-count="2">2</button></td>
        <td><button data-dice="d8" data-count="3">3</button></td>
        <td><button data-dice="d8" data-count="4">4</button></td>
        <td><button data-dice="d8" data-count="5">5</button></td>
        <td><button data-dice="d8" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d10</th>
        <td><button data-dice="d10" data-count="1">1</button></td>
        <td><button data-dice="d10" data-count="2">2</button></td>
        <td><button data-dice="d10" data-count="3">3</button></td>
        <td><button data-dice="d10" data-count="4">4</button></td>
        <td><button data-dice="d10" data-count="5">5</button></td>
        <td><button data-dice="d10" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d12</th>
        <td><button data-dice="d12" data-count="1">1</button></td>
        <td><button data-dice="d12" data-count="2">2</button></td>
        <td><button data-dice="d12" data-count="3">3</button></td>
        <td><button data-dice="d12" data-count="4">4</button></td>
        <td><button data-dice="d12" data-count="5">5</button></td>
        <td><button data-dice="d12" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d20</th>
        <td><button data-dice="d20" data-count="1">1</button></td>
        <td><button data-dice="d20" data-count="2">2</button></td>
        <td><button data-dice="d20" data-count="3">3</button></td>
        <td><button data-dice="d20" data-count="4">4</button></td>
        <td><button data-dice="d20" data-count="5">5</button></td>
        <td><button data-dice="d20" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>d100</th>
        <td><button data-dice="d100" data-count="1">1</button></td>
        <td><button data-dice="d100" data-count="2">2</button></td>
        <td><button data-dice="d100" data-count="3">3</button></td>
        <td><button data-dice="d100" data-count="4">4</button></td>
        <td><button data-dice="d100" data-count="5">5</button></td>
        <td><button data-dice="d100" data-count="6">6</button></td>
      </tr>
      <tr>
        <th>dF</th>
        <td><button data-dice="dF" data-count="1">1</button></td>
        <td><button data-dice="dF" data-count="2">2</button></td>
        <td><button data-dice="dF" data-count="3">3</button></td>
        <td><button data-dice="dF" data-count="4">4</button></td>
        <td><button data-dice="dF" data-count="5">5</button></td>
        <td><button data-dice="dF" data-count="6">6</button></td>
      </tr>
    </tbody>
  </table>
</div>

`;

OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));
