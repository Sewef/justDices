/**
 * Broadcast manager for handling OBR message communication
 */
import OBR from "@owlbear-rodeo/sdk";

const DICE_ROLL_CHANNEL = "com.sewef.justdices/dice-roll";

/**
 * Sends a log entry to all players
 * @param {Object} sender - Sender info {id, name, color, role}
 * @param {Object} text - Roll/say data
 */
export async function broadcastLogEntry(sender, text) {
  await OBR.broadcast.sendMessage(
    DICE_ROLL_CHANNEL,
    { sender, user: sender.name, text },
    { destination: 'ALL' }
  );
}

/**
 * Registers a listener for incoming dice rolls
 * @param {Function} onMessage - Callback(event) when message received
 */
export function registerDiceRollListener(onMessage) {
  OBR.broadcast.onMessage(DICE_ROLL_CHANNEL, onMessage);
}

/**
 * Get sender info for current player
 * @returns {Promise<Object>} Sender object with id, name, color, role
 */
export async function getCurrentSender() {
  return {
    id: await OBR.player.getId(),
    name: await OBR.player.getName(),
    color: await OBR.player.getColor(),
    role: await OBR.player.getRole(),
  };
}
