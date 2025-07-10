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
        width: 200,
        disableClickAway: true,
        hidePaper: true,
        anchorReference: "ELEMENT",
        anchorElementId: "grid-button",
    });
    await OBR.player.setMetadata({ "justdices.dicePanelOpen": true });
}

let isQuickDiceSetupDone = false;
let hideRollsFromQuickPanel = false;

export async function setupQuickDice() {
    if (isQuickDiceSetupDone) return;

    await new Promise(resolve => {
        const checkExist = setInterval(() => {
            const diceTable = document.getElementById("dice-table");
            const dicePanel = document.getElementById("dicePanel");
            const closeDicePanelBtn = document.getElementById("closeDicePanel");
            const toggleHiddenRollsBtn = document.getElementById("toggleHiddenRolls");

            if (diceTable && dicePanel && closeDicePanelBtn && toggleHiddenRollsBtn) {
                clearInterval(checkExist);
                resolve();
            }
        }, 100);
    });

    // ✅ tous les éléments sont garantis présents ici
    const diceTable = document.getElementById("dice-table");
    const dicePanel = document.getElementById("dicePanel");
    const closeDicePanelBtn = document.getElementById("closeDicePanel");
    const toggleHiddenRollsBtn = document.getElementById("toggleHiddenRolls");

    diceTable.innerHTML = await createDiceTable();

    if (!closeDicePanelBtn.dataset.listenerAdded) {
        closeDicePanelBtn.addEventListener('click', () => {
            console.log("JustDices: Closing dice panel from button");
            toggleDicePanel();
        });
        closeDicePanelBtn.dataset.listenerAdded = "true";
    }

    if (!toggleHiddenRollsBtn.dataset.listenerAdded) {
        toggleHiddenRollsBtn.addEventListener('click', async () => {
            
            const metadata = await OBR.player.getMetadata();
            const hideRollsFromQuickPanel = !(metadata["justdices.hideRollsFromQuickPanel"]);
            await OBR.player.setMetadata({ "justdices.hideRollsFromQuickPanel": hideRollsFromQuickPanel });
            toggleHiddenRollsBtn.textContent = hideRollsFromQuickPanel ? '🙈' : '🐵';
        });
        toggleHiddenRollsBtn.dataset.listenerAdded = "true";
    }

    dicePanel.querySelectorAll('.dice-table button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const dice = btn.getAttribute('data-dice');
            const count = parseInt(btn.getAttribute('data-count'), 10);
            if (!dice || !count || count < 1) return;

            const metadata = await OBR.player.getMetadata();
            let hideRollsFromQuickPanel = metadata["justdices.hideRollsFromQuickPanel"] === true;
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
    { label: "d1000", value: "d1000" },
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
