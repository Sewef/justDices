import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
  
    <input type="text" id="inputField" placeholder="Type something here" />
    <div id="logContainer">
      <h2>Card Logs</h2>
      <div class="card" id="log1">Log Entry 1</div>
      <div class="card" id="log2">Log Entry 2</div>
      <div class="card" id="log3">Log Entry 3</div>
    </div>
`

setupCounter(document.querySelector('#counter'))
