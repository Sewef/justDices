// api.js
import OBR from "@owlbear-rodeo/sdk";
import { parseInput, rollExpression } from "./dice-utils.js";

let SELF_ID_PROMISE = null;
async function getSelfId() {
  if (!SELF_ID_PROMISE) {
    // console.log("[API] getSelfId() → fetch");
    SELF_ID_PROMISE = OBR.player.getId();
  } else {
    // console.log("[API] getSelfId() → cached");
  }
  return SELF_ID_PROMISE;
}

async function getSender() {
  const sender = {
    id: await OBR.player.getId(),
    name: await OBR.player.getName(),
    color: await OBR.player.getColor(),
    role: await OBR.player.getRole(),
  };
  // console.log("[API] getSender()", sender);
  return sender;
}

async function sendToLog(sender, text) {
  // console.log("[API] sendToLog()", sender, text);
  await OBR.broadcast.sendMessage(
    "justdices.dice-roll",
    { sender, user: sender.name, text },
    { destination: "ALL" }
  );
}

// --- Service ---
export function setupJustDicesApi() {
  // console.log("[API] Service setup: listening to justdices.api.request");
  OBR.broadcast.onMessage("justdices.api.request", async (evt) => {
    // console.log("[API] Request received", evt);
    const req = evt.data;
    if (!req || !req.callId || !req.requesterId) {
      console.warn("[API] Invalid request payload", req);
      return;
    }

    const base = { callId: req.callId, requesterId: req.requesterId, expressionIn: req.expression };
    // console.log("[API] Base context", base);

    try {
      const parsed = await parseInput(req.expression);
      // console.log("[API] Parsed input", parsed);
      if (!parsed) {
        console.error("[API] Parse failed");
        await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: "PARSE_ERROR", destination: "ALL" });
        return;
      }

      const roll = await rollExpression(parsed.rollExpression, parsed.mode || "normal");
      // console.log("[API] Roll result", roll);
      if (!roll) {
        console.error("[API] Roll failed");
        await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: "ROLL_ERROR", destination: "ALL" });
        return;
      }

      const textForLog = {
        expressionExpanded: roll.expanded,
        rolls: roll.rolls,
        total: roll.total,
        hidden: !!parsed.hidden,
        original: req.expression,
        allDiceMin: roll.allDiceMin,
        allDiceMax: roll.allDiceMax,
      };
      // console.log("[API] textForLog", textForLog);

      if (req.showInLogs) {
        const sender = await getSender();
        await sendToLog(sender, textForLog);
      }

      const response = {
        ...base,
        ok: true,
        expressionOut: roll.expression,
        rolls: roll.rolls,
        data: roll,
      };
      // console.log("[API] Sending response", response);

      await OBR.broadcast.sendMessage("justdices.api.response", response, {destination: "ALL"});
    } catch (e) {
      console.error("[API] Exception during roll", e);
      await OBR.broadcast.sendMessage("justdices.api.response", { ...base, ok: false, error: String(e), destination: "ALL" });
    }
  });
}

// --- Client ---
export async function apiRoll(callId, expression, showInLogs = true, timeoutMs = 5000) {
  // console.log("[API-CLIENT] apiRoll()", { callId, expression, showInLogs, timeoutMs });
  const requesterId = await getSelfId();
  // console.log("[API-CLIENT] requesterId", requesterId);

  let timeoutId;

  const waitResponse = new Promise((resolve) => {
    // console.log("[API-CLIENT] Subscribing to justdices.api.response");
    const handler = (evt) => {
      // console.log("[API-CLIENT] Response received broadcast (raw)", evt);
      const res = evt.data;
      if (!res) return;
      if (res.callId !== callId || res.requesterId !== requesterId) {
        // console.log("[API-CLIENT] Response ignored (not matching)", res);
        return;
      }
      // console.log("[API-CLIENT] Matched response", res);
      clearTimeout(timeoutId);
      resolve(res);
    };
    OBR.broadcast.onMessage("justdices.api.response", handler);
  });

  // console.log("[API-CLIENT] Sending request broadcast");
  await OBR.broadcast.sendMessage(
    "justdices.api.request",
    { callId, expression, showInLogs, requesterId },
    { destination: "ALL" }
  );

  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      console.error("[API-CLIENT] Timeout waiting for response", { callId, expression });
      reject(new Error("API_TIMEOUT"));
    }, timeoutMs);

    waitResponse.then(resolve).catch(reject);
  });
}

