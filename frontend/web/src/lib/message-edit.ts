/** Messages may be edited by the sender for 2 hours after creation. */
export const MESSAGE_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function messageEditDeadline(createdAt: string): number {
  return new Date(createdAt).getTime() + MESSAGE_EDIT_WINDOW_MS;
}

export function canEditMessage(
  message: { id: number; sender: number; created_at: string; is_editable?: boolean | null },
  userId: number | undefined,
  now = Date.now(),
): boolean {
  if (!userId || message.id <= 0) return false;
  if (message.sender !== userId) return false;
  if (message.is_editable === true) return true;
  // WebSocket payloads may omit viewer context; evaluate the 2-hour window locally.
  return now <= messageEditDeadline(message.created_at);
}

export function messageEditTimeRemaining(createdAt: string, now = Date.now()): number {
  return Math.max(0, messageEditDeadline(createdAt) - now);
}
