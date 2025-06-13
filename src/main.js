import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupDiceRoller } from './roller.js';

if (import.meta.env.MODE !== 'development') {
  console.log = function () {};
}

document.querySelector('#app').innerHTML = `
  <form id="input">
    <input type="text" id="inputField" placeholder="1d8+6..." />
    <input type="submit" value=">">
  </form>
  <div id="logContainer">
    <h3>Historique des jets</h3>
    <div id="logCards">
    <div>
  </div>
</div>

`
OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));
