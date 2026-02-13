// api.js
import OBR from "@owlbear-rodeo/sdk";
import { parseInput, rollExpression } from "./dice-utils.js";

let SELF_ID_PROMISE = null;

const getSelfId = () => SELF_ID_PROMISE ??= OBR.player.getId();

const getSender = async () => ({
    id: await OBR.player.getId(),
    name: await OBR.player.getName(),
    color: await OBR.player.getColor(),
    role: await OBR.player.getRole(),
});

const sendToLog = (sender, text) => OBR.broadcast.sendMessage(
    "justdices.dice-roll",
    { sender, user: sender.name, text },
    { destination: "ALL" }
);

export function setupJustDicesApi() {
  OBR.broadcast.onMessage("justdices.api.request", async (evt) => {
    const req = evt.data;
    if (!req?.callId || !req?.requesterId) {
      console.warn("[API] Invalid request payload", req);
      return;
    }

    const base = { callId: req.callId, requesterId: req.requesterId, expressionIn: req.expression };

    try {
      const parsed = await parseInput(req.expression);
      if (!parsed) {
        console.error("[API] Parse failed");
        await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: "PARSE_ERROR", destination: "LOCAL" });
        return;
      }

      const roll = await rollExpression(parsed.rollExpression, parsed.mode || "normal");
      if (!roll) {
        console.error("[API] Roll failed");
        await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: "ROLL_ERROR", destination: "LOCAL" });
        return;
      }

      if (req.showInLogs) {
        const sender = await getSender();
        await sendToLog(sender, { expressionExpanded: roll.expanded, rolls: roll.rolls, total: roll.total, hidden: !!parsed.hidden, original: req.expression, allDiceMin: roll.allDiceMin, allDiceMax: roll.allDiceMax });
      }

      const response = { ...base, ok: true, expressionOut: roll.expression, rolls: roll.rolls, data: roll };
      await OBR.broadcast.sendMessage("justdices.api.response", response, { destination: "LOCAL" });
    } catch (e) {
      console.error("[API] Exception during roll", e);
      await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: String(e), destination: "LOCAL" });
    }
  });
}

// --- Client ---
export async function apiRoll(callId, expression, showInLogs = true, timeoutMs = 5000) {
  const requesterId = await getSelfId();

  return new Promise((resolve, reject) => {
    let timeoutId = setTimeout(() => {
      console.error("[API-CLIENT] Timeout waiting for response", { callId, expression });
      reject(new Error("API_TIMEOUT"));
    }, timeoutMs);

    const handler = (evt) => {
      const res = evt.data;
      if (!res || res.callId !== callId || res.requesterId !== requesterId) return;
      
      clearTimeout(timeoutId);
      OBR.broadcast.onMessage("justdices.api.response", null);
      resolve(res);
    };

    OBR.broadcast.onMessage("justdices.api.response", handler);
    OBR.broadcast.sendMessage("justdices.api.request", { callId, expression, showInLogs, requesterId }, { destination: "ALL" });
  });
}

