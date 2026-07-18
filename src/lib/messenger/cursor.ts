/** Cursor encoding without Node Buffer (works in RN + Vitest). */

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const remaining = bytes.length - i;
    const a = bytes[i++]!;
    const b = remaining > 1 ? bytes[i++]! : 0;
    const c = remaining > 2 ? bytes[i++]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63];
    out += B64[(triple >> 12) & 63];
    out += remaining > 1 ? B64[(triple >> 6) & 63] : "=";
    out += remaining > 2 ? B64[triple & 63] : "=";
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const lookup = new Map<string, number>();
  for (let i = 0; i < B64.length; i += 1) {
    lookup.set(B64[i]!, i);
  }

  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const c1 = cleaned[i] ?? "=";
    const c2 = cleaned[i + 1] ?? "=";
    const c3 = cleaned[i + 2] ?? "=";
    const c4 = cleaned[i + 3] ?? "=";
    const n1 = lookup.get(c1) ?? 0;
    const n2 = lookup.get(c2) ?? 0;
    const n3 = c3 === "=" ? 0 : (lookup.get(c3) ?? 0);
    const n4 = c4 === "=" ? 0 : (lookup.get(c4) ?? 0);
    const triple = (n1 << 18) | (n2 << 12) | (n3 << 6) | n4;
    output.push((triple >> 16) & 255);
    if (c3 !== "=") output.push((triple >> 8) & 255);
    if (c4 !== "=") output.push(triple & 255);
  }
  return Uint8Array.from(output);
}

function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(cursor: string): Uint8Array {
  const padded = cursor.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return base64ToBytes(padded + pad);
}

export function encodeMessagesCursor(createdAt: string, id: string): string {
  const json = JSON.stringify({ createdAt, id });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeMessagesCursor(
  cursor: string
): { createdAt: string; id: string } | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(cursor));
    const parsed = JSON.parse(json) as { createdAt?: string; id?: string };
    if (!parsed.createdAt || !parsed.id) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
