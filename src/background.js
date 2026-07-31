import OBR from "@owlbear-rodeo/sdk";
import { registerDiceRollListener } from "./broadcastManager.js";
import { getRollVisibility } from "./rollVisibility.js";
import { cleanupJustDicesApi, setupJustDicesApi } from "./api.js";
import {
  cleanupPlayerContext,
  getPlayerContext,
  initializePlayerContext
} from "./playerContext.js";

OBR.onReady(async () => {
  await initializePlayerContext();
  setupJustDicesApi();

  const [initialBadgeColor, initialBadgeText] = await Promise.all([
    OBR.action.getBadgeBackgroundColor(),
    OBR.action.getBadgeText()
  ]);

  const restoreBadge = async () => {
    const updates = [OBR.action.setBadgeText(initialBadgeText)];
    if (initialBadgeColor !== undefined) {
      updates.push(OBR.action.setBadgeBackgroundColor(initialBadgeColor));
    }
    await Promise.all(updates);
  };

  const unsubscribeOpenChange = OBR.action.onOpenChange((isOpen) => {
    if (isOpen) {
      restoreBadge().catch(error => {
        console.error("Unable to restore the JustDices badge:", error);
      });
    }
  });

  const unsubscribeDiceRoll = registerDiceRollListener(async (event) => {
    try {
      if (!event.data?.text) return;
      if (await OBR.action.isOpen()) return;

      const { id: playerId, role } = await getPlayerContext();
      const visibility = getRollVisibility(
        event.data.text,
        event.data.sender?.id,
        playerId,
        role
      );
      if (!visibility.isVisible) return;

      // The player lookup above is asynchronous: make sure the action was not
      // opened while visibility was being resolved.
      if (await OBR.action.isOpen()) return;
      await OBR.action.setBadgeBackgroundColor(event.data.sender.color);
      const badge = event.data.text.isSay
        ? "💬"
        : event.data.text.isRickroll ? "🪩" : "🎲";
      await OBR.action.setBadgeText(badge);
    } catch (error) {
      console.error("Unable to update the JustDices badge color:", error);
    }
  });

  window.addEventListener("beforeunload", () => {
    unsubscribeOpenChange();
    unsubscribeDiceRoll();
    cleanupJustDicesApi();
    cleanupPlayerContext();
  }, { once: true });
});
