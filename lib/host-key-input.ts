// Client-side shaping of the host-key field. The server (lib/host-key.ts)
// remains the only authority; this just keeps what the host types tidy.
export const HOST_KEY_LENGTH = 16;
const KEY_CHARACTER = /[2-9A-HJ-NP-Z]/;

/**
 * The key characters in `typed`: upper-cased, without hyphens, spaces or the
 * look-alikes 0/1/I/O, capped at 16. A pasted full key's "AVL" prefix is
 * dropped, since the field only holds the 16 characters after it.
 */
export function hostKeyBody(typed: string): string {
  return hostKeyCharacters(typed).slice(0, HOST_KEY_LENGTH);
}

/** Like hostKeyBody, but without the 16-character cap. */
export function hostKeyCharacters(typed: string): string {
  const upper = typed.toUpperCase().replace(/^\s*AVL[\s-]+/, "");
  const body = [...upper].filter(character => KEY_CHARACTER.test(character)).join("");
  return body.length === HOST_KEY_LENGTH + 3 && body.startsWith("AVL") ? body.slice(3) : body;
}

/** Groups of four for display: "ABCD-EFGH-JK". */
export function formatHostKey(body: string): string {
  return body.match(/.{1,4}/g)?.join("-") ?? "";
}

/** Caret index in the formatted text after `count` key characters. */
export function formattedCaret(count: number): number {
  return count + Math.floor(Math.max(count - 1, 0) / 4);
}

/** The value sent to the server, in the canonical AVL-XXXX-XXXX-XXXX-XXXX form. */
export function hostKeyForSubmit(body: string): string {
  return `AVL-${formatHostKey(body)}`;
}
