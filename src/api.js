// api.js
import OBR from "@owlbear-rodeo/sdk";
import { parseInput, rollExpression } from "./dice-utils.js";
import { broadcastLogEntry, getCurrentSender } from "./broadcastManager.js";
import { getPlayerContext } from "./playerContext.js";

const API_CHANNEL_REQUEST = "com.sewef.justdices/api.request";
const API_CHANNEL_RESPONSE = "com.sewef.justdices/api.response";
let apiRequestUnsubscribe = null;
const apiResponseHandlers = new Map(); // Map<callId, unsubscribe> for concurrent calls

const getSelfId = async () => (await getPlayerContext()).id;
const createRollId = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function setupJustDicesApi() {
  if (apiRequestUnsubscribe) return apiRequestUnsubscribe;

  apiRequestUnsubscribe = OBR.broadcast.onMessage(API_CHANNEL_REQUEST, async (evt) => {
    const req = evt.data;
    if (!req?.callId) {
      console.warn("[API] Invalid request payload", req);
      return;
    }

    const base = { callId: req.callId, expressionIn: req.expression };

    try {
      // Check if expression already has a command prefix
      const hasCommand = /^\/(r|roll|gr|gmroll|lr|liarroll|br|blindroll|say)\b/i.test(req.expression);
      const command = hasCommand ? req.expression : "/r " + req.expression;
      
      const parsed = await parseInput(command);
      if (!parsed) {
        console.error("[API] Parse failed");
        await OBR.broadcast.sendMessage(API_CHANNEL_RESPONSE, { ...base, ok: false, error: "PARSE_ERROR" }, { destination: "LOCAL" });
        return;
      }

      // Handle "say" command
      if (parsed.type === "say") {
        if (req.showInLogs) {
          const sender = await getCurrentSender();
          await broadcastLogEntry(sender, { isSay: true, message: parsed.message, original: req.expression });
        }
        const response = { ...base, ok: true, data: { isSay: true, message: parsed.message } };
        await OBR.broadcast.sendMessage(API_CHANNEL_RESPONSE, response, { destination: "LOCAL" });
        return;
      }

      // Handle roll command
      const roll = await rollExpression(parsed.rollExpression, parsed.mode);
      if (!roll) {
        console.error("[API] Roll failed");
        await OBR.broadcast.sendMessage(API_CHANNEL_RESPONSE, { ...base, ok: false, error: "ROLL_ERROR" }, { destination: "LOCAL" });
        return;
      }

      if (req.showInLogs) {
        const sender = await getCurrentSender();
        await broadcastLogEntry(sender, { expressionExpanded: roll.expanded, rolls: roll.rolls, total: roll.total, hidden: parsed.hidden, liar: parsed.liar, blind: parsed.blind, original: command, allDiceMin: roll.allDiceMin, allDiceMax: roll.allDiceMax, rollId: createRollId() });
      }

      const response = { ...base, ok: true, expressionOut: roll.expression, rolls: roll.rolls, data: roll };
      await OBR.broadcast.sendMessage(API_CHANNEL_RESPONSE, response, { destination: "LOCAL" });
    } catch (e) {
      console.error("[API] Exception during roll", e);
      await OBR.broadcast.sendMessage(API_CHANNEL_RESPONSE, { ...base, ok: false, error: String(e) }, { destination: "LOCAL" });
    }
  });

  return apiRequestUnsubscribe;
}

// --- Client ---
export async function apiRoll(callId, expression, showInLogs = true, timeoutMs = 5000) {
  // const requesterId = await getSelfId();

  return new Promise((resolve, reject) => {
    // Ensure we do not keep stale listeners for duplicate callIds.
    const previousUnsubscribe = apiResponseHandlers.get(callId);
    if (previousUnsubscribe) {
      previousUnsubscribe();
      apiResponseHandlers.delete(callId);
    }

    let timeoutId = null;

    const cleanup = () => {
      const registeredUnsubscribe = apiResponseHandlers.get(callId);
      if (registeredUnsubscribe) {
        registeredUnsubscribe();
        apiResponseHandlers.delete(callId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    timeoutId = setTimeout(() => {
      console.error("[API-CLIENT] Timeout waiting for response", { callId, expression });
      cleanup();
      reject(new Error("API_TIMEOUT"));
    }, timeoutMs);

    const handler = (evt) => {
      const res = evt.data;
      if (!res || res.callId !== callId) return;
      
      cleanup();
      resolve(res);
    };

    const unsubscribeResponse = OBR.broadcast.onMessage(API_CHANNEL_RESPONSE, handler);
    apiResponseHandlers.set(callId, unsubscribeResponse);
    // Only the requester's JustDices instance must execute the roll. Sending to
    // every connection would create one roll per player, each owned by that player.
    OBR.broadcast.sendMessage(API_CHANNEL_REQUEST, { callId, expression, showInLogs }, { destination: "LOCAL" });
  });
}

export function cleanupJustDicesApi() {
  apiRequestUnsubscribe?.();
  apiRequestUnsubscribe = null;
  for (const unsubscribeResponse of apiResponseHandlers.values()) {
    unsubscribeResponse();
  }
  apiResponseHandlers.clear();
}

