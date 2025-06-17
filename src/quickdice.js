import OBR from "@owlbear-rodeo/sdk";
import { submitInput } from './roller.js';

export async function toggleDicePanel() {
    console.log("JustDices: Toggling dice panel");
    const metadata = await OBR.player.getMetadata();
    const dicePanelOpen = metadata["justdices.dicePanelOpen"] === true;

    if (dicePanelOpen) {
        console.log("JustDices: Closing dice panel");
        OBR.popover.close("justdices.quickdice");
        await OBR.player.setMetadata({ "justdices.dicePanelOpen": false });
        return;
    }

    console.log("JustDices: Opening dice panel");
    const anchor = document.getElementById("justdicesApp");
    OBR.popover.open({
        id: "justdices.quickdice",
        url: "/quickdice.html",
        height: 300,
        width: 250,
        anchorElementId: "justdicesApp",
        disableClickAway: true,
        //anchorOrigin: {vertical: "BOTTOM", horizontal: "RIGHT"},
    });
    await OBR.player.setMetadata({ "justdices.dicePanelOpen": true });
}

let isQuickDiceSetupDone = false; // Flag to track if setupQuickDice has been run

export async function setupQuickDice() {
    if (isQuickDiceSetupDone) {
        return;
    }
    await new Promise(resolve => {
        const checkExist = setInterval(() => {
            const diceTable = document.getElementById("dice-table");
            if (diceTable) {
                clearInterval(checkExist);
                resolve();
            }
        }, 100);
    });
    document.getElementById("dice-table").innerHTML = await createDiceTable();

    const dicePanel = document.getElementById('dicePanel');
    const closeDicePanelBtn = document.getElementById('closeDicePanel');
    const toggleHiddenRollsBtn = document.getElementById('toggleHiddenRolls');

    let hideRollsFromQuickPanel = false;

    if (!closeDicePanelBtn.dataset.listenerAdded) {
        closeDicePanelBtn.addEventListener('click', () => {
            console.log("JustDices: Closing dice panel from button");
            toggleDicePanel();
            return;
        });
        closeDicePanelBtn.dataset.listenerAdded = "true";
    }

    if (!toggleHiddenRollsBtn.dataset.listenerAdded) {
        toggleHiddenRollsBtn.addEventListener('click', () => {
            hideRollsFromQuickPanel = !hideRollsFromQuickPanel;
            toggleHiddenRollsBtn.textContent = hideRollsFromQuickPanel ? '🙈' : '🐵';
            return;
        });
        toggleHiddenRollsBtn.dataset.listenerAdded = "true";
    }

    // Gestion des clics sur les boutons de dés dans le tableau
    dicePanel.querySelectorAll('.dice-table button').forEach(btn => {
        btn.addEventListener('click', () => {
            const dice = btn.getAttribute('data-dice');
            const count = parseInt(btn.getAttribute('data-count'), 10);
            if (!dice || !count || count < 1) return;

            const rollCommand = hideRollsFromQuickPanel ? `/gr ${count}${dice}` : `/r ${count}${dice}`;
            submitInput(rollCommand);
        });
    });
    isQuickDiceSetupDone = true;
}

const diceTypes = [
    { label: "d4", value: "d4" },
    { label: "d6", value: "d6" },
    { label: "d8", value: "d8" },
    { label: "d10", value: "d10" },
    { label: "d12", value: "d12" },
    { label: "d20", value: "d20" },
    { label: "d100", value: "d100" },
    { label: "dF", value: "dF" }
];

async function createDiceTable() {
    return `
    <tbody>
        ${diceTypes.map(dice => `
        <tr>
            <th>${dice.label}</th>
            ${[1, 2, 3, 4, 5, 6].map(count => `
            <td>
                <button data-dice="${dice.value}" data-count="${count}" aria-label="${count} ${dice.label}">
                ${count}
                </button>
            </td>
            `).join('')}
        </tr>
        `).join('')}
    </tbody>
    `;
}

window.addEventListener('DOMContentLoaded', () => {
    setupQuickDice();
});
