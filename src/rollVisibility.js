/**
 * Resolve how a broadcast log entry is exposed to the current player.
 *
 * Hidden (/gr) rolls are the only entries absent from other players' logs.
 * Liar (/lr) and blind (/br) rolls remain visible to everyone, but their
 * result is concealed according to the roll mode.
 */
export function getRollVisibility(text, senderId, playerId, role) {
  const isGM = role === "GM";
  const isRoller = senderId === playerId;
  const isHidden = Boolean(text?.hidden);
  const isLiar = Boolean(text?.liar);
  const isBlind = Boolean(text?.blind);

  return {
    isVisible: Boolean(text) && (!isHidden || isRoller || isGM),
    canViewResult: (!isLiar && !isBlind)
      || (isLiar && isRoller)
      || (isBlind && isGM),
    canReveal: (isHidden || isLiar || isBlind) && (isRoller || isGM)
  };
}
