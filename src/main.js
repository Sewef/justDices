import './style.css'
import OBR from "@owlbear-rodeo/sdk";
import { setupDiceRoller } from './roller.js';
import { setupJustDicesApi } from "./api.js";

// Function to apply theme based on Owlbear theme
function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.mode === 'DARK' ? 'dark' : 'light');
  root.style.setProperty('--text-color', theme.text.primary);
  root.style.setProperty('--text-color-disabled', theme.text.disabled);
}

// Build DOM structure using createElement instead of innerHTML to prevent XSS
function setupDOM() {
  const app = document.querySelector('#app');
  
  // Input row section
  const inputRow = document.createElement('div');
  inputRow.id = 'inputRow';
  
  const form = document.createElement('form');
  form.id = 'input';
  
  const inputGroup = document.createElement('div');
  inputGroup.className = 'input-group';
  
  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.id = 'inputField';
  inputField.placeholder = '1d8+6...';
  inputField.autocomplete = 'off';
  inputField.setAttribute('autocorrect', 'off');
  inputField.setAttribute('autocapitalize', 'off');
  inputField.spellcheck = 'false';
  
  const hiddenRollBtn = document.createElement('button');
  hiddenRollBtn.type = 'button';
  hiddenRollBtn.id = 'hiddenRollButton';
  hiddenRollBtn.title = 'Hidden roll';
  hiddenRollBtn.setAttribute('aria-label', 'Hidden roll');
  hiddenRollBtn.textContent = '🙈';
  
  const rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.id = 'rollButton';
  rollBtn.title = 'Roll it';
  rollBtn.setAttribute('aria-label', 'Roll it');
  rollBtn.textContent = '⚔️';
  
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.style.display = 'none';
  
  const toggleDiceBtn = document.createElement('button');
  toggleDiceBtn.type = 'button';
  toggleDiceBtn.id = 'toggleDicePanel';
  toggleDiceBtn.title = 'Quick Rolls panel';
  toggleDiceBtn.setAttribute('aria-label', 'Quick Rolls panel');
  toggleDiceBtn.textContent = '🎲';
  
  inputGroup.appendChild(inputField);
  inputGroup.appendChild(hiddenRollBtn);
  inputGroup.appendChild(rollBtn);
  inputGroup.appendChild(submitBtn);
  inputGroup.appendChild(toggleDiceBtn);
  
  form.appendChild(inputGroup);
  inputRow.appendChild(form);
  
  // Log container section
  const logContainer = document.createElement('div');
  logContainer.id = 'logContainer';
  
  const logTitle = document.createElement('h3');
  logTitle.textContent = 'Rolls History';
  
  const logCards = document.createElement('div');
  logCards.id = 'logCards';
  
  logContainer.appendChild(logTitle);
  logContainer.appendChild(logCards);
  
  app.appendChild(inputRow);
  app.appendChild(logContainer);
}

setupDOM();

OBR.onReady(async () => {
  // Detect and apply theme on load
  const theme = await OBR.theme.getTheme();
  applyTheme(theme);

  // Listen for theme changes
  OBR.theme.onChange((theme) => {
    applyTheme(theme);
  });

  OBR.player.getName().then((playerName) => {
    setupJustDicesApi();
    setupDiceRoller(playerName);
  });
});