import OBR from "@owlbear-rodeo/sdk";
import { registerDiceRollListener } from "./broadcastManager.js";
import { getRollVisibility } from "./rollVisibility.js";

OBR.onReady(async () => {
  const restoreBadge = async () => {
    await Promise.all([
      OBR.action.setBadgeBackgroundColor(),
      OBR.action.setBadgeText()
    ]);
  };

  OBR.action.onOpenChange((isOpen) => {
    if (isOpen) {
      restoreBadge().catch(error => {
        console.error("Unable to restore the JustDices badge:", error);
      });
    }
  });

  registerDiceRollListener(async (event) => {
    try {
      if (!event.data?.text) return;
      if (await OBR.action.isOpen()) return;

      const [playerId, role] = await Promise.all([
        OBR.player.getId(),
        OBR.player.getRole()
      ]);
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
      await OBR.action.setBadgeText(event.data.text.isSay ? "💬" : "🎲");
    } catch (error) {
      console.error("Unable to update the JustDices badge color:", error);
    }
  });
});
