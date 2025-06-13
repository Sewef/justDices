import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import javascriptLogo from './javascript.svg'
import { setupDiceRoller } from './roller.js';

document.querySelector('#app').innerHTML = `
  <form id="input">
    <div class="input-group">
      <input type="text" id="inputField" placeholder="1d8+6..." />
      <button type="button" id="hiddenRollButton" title="Hidden roll">🙈</button>
      <button type="button" id="rollButton" title="Roll it">⚔️</button>
      <button type="submit" style="display: none;"></button>
    </div>
  </form>
  <div id="logContainer">
    <h3>Rolls History</h3>
    <div id="logCards">
    </div>
  </div>
`;

OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));
