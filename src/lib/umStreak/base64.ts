/** Base64 -> ArrayBuffer without Node Buffer (Hermes + Vitest). */

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = new Map<string, number>();
for (let i = 0; i < B64.length; i += 1) {
  LOOKUP.set(B64[i]!, i);
}

export function decodeBase64ToArrayBuffer(input: string): ArrayBuffer {
  const cleaned = input.replace(/[^A-Za-z0-9+/]/g, "");
  if (!cleaned) {
    return new ArrayBuffer(0);
  }

  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  const pad = padded.endsWith("==") ? 2 : padded.endsWith("=") ? 1 : 0;
  const byteLength = (padded.length * 3) / 4 - pad;
  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (let i = 0; i < padded.length; i += 4) {
    const n1 = LOOKUP.get(padded[i]!) ?? -1;
    const n2 = LOOKUP.get(padded[i + 1]!) ?? -1;
    const n3 = padded[i + 2] === "=" ? 0 : LOOKUP.get(padded[i + 2]!) ?? -1;
    const n4 = padded[i + 3] === "=" ? 0 : LOOKUP.get(padded[i + 3]!) ?? -1;
    if (n1 < 0 || n2 < 0 || n3 < 0 || n4 < 0) {
      throw new Error("invalid-base64");
    }
    const triple = (n1 << 18) | (n2 << 12) | (n3 << 6) | n4;
    if (offset < byteLength) bytes[offset++] = (triple >> 16) & 255;
    if (offset < byteLength) bytes[offset++] = (triple >> 8) & 255;
    if (offset < byteLength) bytes[offset++] = triple & 255;
  }

  return bytes.buffer;
}
