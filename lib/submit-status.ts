// Whether the player's last tap reached the server (v1.16). A missing status
// or a timeout means the phone cannot know, so the player should tap again.
// The server still ignores a repeated tap for a turn that already finished.
export function submitDelivery(error: { name?: string; status?: number } | null): "saved" | "unsent" {
  if (!error) return "saved";
  if (error.name === "TimeoutError" || error.status == null) return "unsent";
  return "saved";
}
