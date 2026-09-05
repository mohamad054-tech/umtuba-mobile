export function canSendPrivateVisual(input: {
  blocked: boolean;
  mutedOnly?: boolean;
}): { allowed: boolean; reason: "ok" | "blocked" } {
  if (input.blocked) {
    return { allowed: false, reason: "blocked" };
  }
  return { allowed: true, reason: "ok" };
}

export function canOpenPrivateVisual(input: {
  viewerId: string;
  senderId: string;
  recipientId: string;
  blocked: boolean;
  viewed: boolean;
  expiresAt: string | null;
  nowIso: string;
}): { allowed: boolean; reason: "ok" | "blocked" | "expired" | "not_participant" } {
  if (input.blocked) {
    return { allowed: false, reason: "blocked" };
  }

  if (input.viewerId !== input.senderId && input.viewerId !== input.recipientId) {
    return { allowed: false, reason: "not_participant" };
  }

  if (input.expiresAt) {
    const expires = Date.parse(input.expiresAt);
    const now = Date.parse(input.nowIso);
    if (!Number.isNaN(expires) && !Number.isNaN(now) && now >= expires) {
      return { allowed: false, reason: "expired" };
    }
  }

  return { allowed: true, reason: "ok" };
}

export function canonicalPair(
  userA: string,
  userB: string
): {
  userLowId: string;
  userHighId: string;
  pairKey: string;
} | null {
  const a = userA.trim();
  const b = userB.trim();
  if (!a || !b || a === b) {
    return null;
  }
  const [userLowId, userHighId] = a < b ? [a, b] : [b, a];
  return {
    userLowId,
    userHighId,
    pairKey: `${userLowId}:${userHighId}`,
  };
}
