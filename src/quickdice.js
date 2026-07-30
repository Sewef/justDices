import OBR from "@owlbear-rodeo/sdk";
import { submitInput } from './roller.js';

const QUICK_DICE_POPOVER_ID = "justdices.quickdice";
const QUICK_DICE_DRAG_POPOVER_ID = "justdices.quickdice.drag";
const QUICK_DICE_POPOVER_SIZE = { width: 200, height: 290 };
const QUICK_DICE_POSITION_METADATA_KEY = "justdices.quickdicePosition";
const QUICK_DICE_VIEWPORT_MARGIN = 16;
const PANEL_OPEN_METADATA_KEY = "justdices.dicePanelOpen";
const HIDE_ROLLS_METADATA_KEY = "justdices.hideRollsFromQuickPanel";
const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100", "d1000", "dF"];
const DICE_COUNTS = [1, 2, 3, 4, 5, 6];

function isQuickDicePosition(position) {
    return position &&
        Number.isFinite(position.left) &&
        Number.isFinite(position.top);
}

function clampPopoverPosition(position, viewportWidth, viewportHeight) {
    return {
        left: Math.min(
            Math.max(position.left, QUICK_DICE_VIEWPORT_MARGIN),
            Math.max(QUICK_DICE_VIEWPORT_MARGIN, viewportWidth - QUICK_DICE_POPOVER_SIZE.width - QUICK_DICE_VIEWPORT_MARGIN),
        ),
        top: Math.min(
            Math.max(position.top, QUICK_DICE_VIEWPORT_MARGIN),
            Math.max(QUICK_DICE_VIEWPORT_MARGIN, viewportHeight - QUICK_DICE_POPOVER_SIZE.height - QUICK_DICE_VIEWPORT_MARGIN),
        ),
    };
}

async function getQuickDicePosition(metadata) {
    const [viewportWidth, viewportHeight] = await Promise.all([
        OBR.viewport.getWidth(),
        OBR.viewport.getHeight(),
    ]);
    const savedPosition = metadata[QUICK_DICE_POSITION_METADATA_KEY];
    const position = isQuickDicePosition(savedPosition)
        ? savedPosition
        : {
            left: viewportWidth - QUICK_DICE_POPOVER_SIZE.width - QUICK_DICE_VIEWPORT_MARGIN,
            top: viewportHeight - QUICK_DICE_POPOVER_SIZE.height - QUICK_DICE_VIEWPORT_MARGIN,
        };

    return {
        position: clampPopoverPosition(position, viewportWidth, viewportHeight),
        viewportWidth,
        viewportHeight,
    };
}

function getQuickDicePopover(position) {
    return {
        id: QUICK_DICE_POPOVER_ID,
        url: "/quickdice.html",
        ...QUICK_DICE_POPOVER_SIZE,
        disableClickAway: true,
        hidePaper: true,
        anchorReference: "POSITION",
        anchorPosition: position,
        anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
        transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    };
}

function getQuickDiceDragPopover(position) {
    return {
        ...getQuickDicePopover(position),
        id: QUICK_DICE_DRAG_POPOVER_ID,
        url: "/quickdice-drag.html",
        hidePaper: false,
        disableClickAway: true,
    };
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme.mode === "DARK" ? "dark" : "light");
    root.style.setProperty("--text-color", theme.text.primary);
    root.style.setProperty("--text-color-disabled", theme.text.disabled);
}

export async function toggleDicePanel() {
    const metadata = await OBR.player.getMetadata();

    if (metadata[PANEL_OPEN_METADATA_KEY] === true) {
        await OBR.popover.close(QUICK_DICE_POPOVER_ID);
        await OBR.player.setMetadata({ [PANEL_OPEN_METADATA_KEY]: false });
        return;
    }

    const savedPosition = metadata[QUICK_DICE_POSITION_METADATA_KEY];
    const position = isQuickDicePosition(savedPosition)
        ? savedPosition
        : (await getQuickDicePosition(metadata)).position;

    await OBR.popover.open(getQuickDicePopover(position));
    await OBR.player.setMetadata({
        [PANEL_OPEN_METADATA_KEY]: true,
        [QUICK_DICE_POSITION_METADATA_KEY]: position,
    });
}

let isQuickDiceSetupDone = false;

async function setupThemeListener() {
    try {
        applyTheme(await OBR.theme.getTheme());
        OBR.theme.onChange(applyTheme);
    } catch (error) {
        console.error("Error setting up theme listener:", error);
    }
}

function createDiceTable() {
    return `
    <tbody>
        ${DICE_TYPES.map(dice => `
        <tr>
            <th>${dice}</th>
            ${DICE_COUNTS.map(count => `
            <td>
                <button data-dice="${dice}" data-count="${count}" aria-label="${count} ${dice}">
                ${count}
                </button>
            </td>
            `).join('')}
        </tr>
        `).join('')}
    </tbody>
    `;
}

function setupDragHandle(handle, initialState) {
    let { position, viewportWidth, viewportHeight } = initialState;
    let activePointerId = null;
    let queuedPosition = null;
    let isMoving = false;
    let dragPreviewReady = false;
    let openingDragPreview = null;

    const moveDragPreview = async (nextPosition) => {
        queuedPosition = nextPosition;
        if (!dragPreviewReady || isMoving) return;

        isMoving = true;
        while (activePointerId !== null && queuedPosition) {
            const target = queuedPosition;
            queuedPosition = null;
            try {
                await OBR.popover.open(getQuickDiceDragPopover(target));
            } catch (error) {
                console.error("Unable to move the QuickDice drag preview:", error);
            }
        }
        isMoving = false;
    };

    handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || activePointerId !== null) return;

        activePointerId = event.pointerId;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();

        openingDragPreview = OBR.popover.open(getQuickDiceDragPopover(position))
            .then(() => {
                if (activePointerId === null) return;
                dragPreviewReady = true;
                document.documentElement.classList.add("quickdice-dragging");
                void moveDragPreview(position);
            })
            .catch((error) => {
                console.error("Unable to open the QuickDice drag preview:", error);
            });

        Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()])
            .then(([width, height]) => {
                viewportWidth = width;
                viewportHeight = height;
            })
            .catch((error) => {
                console.warn("Unable to refresh the Owlbear viewport size:", error);
            });
    });

    handle.addEventListener("pointermove", (event) => {
        if (event.pointerId !== activePointerId) return;

        position = clampPopoverPosition({
            left: position.left + event.movementX,
            top: position.top + event.movementY,
        }, viewportWidth, viewportHeight);
        void moveDragPreview(position);
    });

    const stopDragging = async (event) => {
        if (event.pointerId !== activePointerId) return;
        activePointerId = null;
        queuedPosition = null;

        if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
        }

        await openingDragPreview;
        while (isMoving) {
            await new Promise(resolve => window.setTimeout(resolve, 0));
        }

        try {
            await OBR.popover.close(QUICK_DICE_DRAG_POPOVER_ID);
        } catch (error) {
            console.error("Unable to close the QuickDice drag preview:", error);
        }

        try {
            await OBR.popover.open(getQuickDicePopover(position));
            await OBR.player.setMetadata({
                [QUICK_DICE_POSITION_METADATA_KEY]: position,
            });
        } catch (error) {
            console.error("Unable to place the QuickDice popover:", error);
        } finally {
            document.documentElement.classList.remove("quickdice-dragging");
            dragPreviewReady = false;
            openingDragPreview = null;
        }
    };

    handle.addEventListener("pointerup", event => void stopDragging(event));
    handle.addEventListener("pointercancel", event => void stopDragging(event));
}

export async function setupQuickDice() {
    if (isQuickDiceSetupDone) return;

    const diceTable = document.getElementById("dice-table");
    const dragHandle = document.getElementById("dragDicePanel");
    const closeButton = document.getElementById("closeDicePanel");
    const hiddenRollsButton = document.getElementById("toggleHiddenRolls");

    if (!diceTable || !dragHandle || !closeButton || !hiddenRollsButton) {
        console.error("QuickDice setup failed: required DOM elements are missing");
        return;
    }

    isQuickDiceSetupDone = true;
    diceTable.innerHTML = createDiceTable();

    const metadata = await OBR.player.getMetadata();
    const positionState = await getQuickDicePosition(metadata);
    let hideRolls = metadata[HIDE_ROLLS_METADATA_KEY] === true;

    setupDragHandle(dragHandle, positionState);
    hiddenRollsButton.textContent = hideRolls ? "🙈" : "🐵";

    closeButton.addEventListener("click", () => {
        void toggleDicePanel();
    });

    hiddenRollsButton.addEventListener("click", async () => {
        hideRolls = !hideRolls;
        hiddenRollsButton.textContent = hideRolls ? "🙈" : "🐵";
        await OBR.player.setMetadata({ [HIDE_ROLLS_METADATA_KEY]: hideRolls });
    });

    diceTable.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-dice]");
        if (!button) return;

        const dice = button.dataset.dice;
        const count = Number.parseInt(button.dataset.count, 10);
        if (!dice || !Number.isInteger(count) || count < 1) return;

        submitInput(`/${hideRolls ? "gr" : "r"} ${count}${dice}`);
    });

    await setupThemeListener();
}

window.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("dicePanel")) return;

    OBR.onReady(() => {
        void setupQuickDice();
    });
});
