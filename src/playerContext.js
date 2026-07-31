import OBR from "@owlbear-rodeo/sdk";

let currentPlayer = null;
let initializationPromise = null;
let unsubscribe = null;

export function initializePlayerContext() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = Promise.all([
    OBR.player.getName(),
    OBR.player.getColor(),
    OBR.player.getRole()
  ]).then(([name, color, role]) => {
    currentPlayer = { id: OBR.player.id, name, color, role };
    unsubscribe = OBR.player.onChange(player => {
      currentPlayer = {
        id: player.id,
        name: player.name,
        color: player.color,
        role: player.role
      };
    });
    return currentPlayer;
  }).catch(error => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

export async function getPlayerContext() {
  return currentPlayer ?? initializePlayerContext();
}

export function cleanupPlayerContext() {
  unsubscribe?.();
  unsubscribe = null;
  currentPlayer = null;
  initializationPromise = null;
}
