import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupDiceRoller } from './roller.js';

document.querySelector('#app').innerHTML = `
  <form id="input">
    <input type="text" id="inputField" placeholder="1d8+6..." />
    <input type="submit" value=">">
  </form>
  <div id="logContainer">
    <h2>Logs</h2>
    <div id="logCards">
      <div class="card">Log Entry 1</div>
    <div>
  </div>
`
OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));
