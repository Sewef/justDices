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
    <div id="logCards">
    <div>
  </div>

  <div id="historyContainer">
  <h3>Historique des jets</h3>
  <ul id="rollHistory"></ul>
</div>

`
OBR.onReady(() => OBR.player.getName().then((playerName) => {
  setupDiceRoller(playerName);
}));
