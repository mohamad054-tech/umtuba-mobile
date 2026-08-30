const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const CC_RE = /^\+[1-9][0-9]{0,3}$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCountryCode(value: string): string | null {
  const trimmed = value.trim();
  if (CC_RE.test(trimmed)) {
    return trimmed;
  }
  const digits = digitsOnly(trimmed);
  if (!digits || digits.startsWith("0") || digits.length > 4) {
    return null;
  }
  const code = `+${digits}`;
  return CC_RE.test(code) ? code : null;
}

export function composeE164(
  countryCode: string,
  nationalNumber: string
): string | null {
  const cc = normalizeCountryCode(countryCode);
  const national = digitsOnly(nationalNumber).replace(/^0+/, "");
  if (!cc || !national) {
    return null;
  }
  const e164 = `${cc}${national}`;
  return E164_RE.test(e164) ? e164 : null;
}

export function normalizeE164Input(value: string): string | null {
  const trimmed = value.trim();
  if (E164_RE.test(trimmed)) {
    return trimmed;
  }
  const compact = trimmed.replace(/[\s()-]/g, "");
  if (E164_RE.test(compact)) {
    return compact;
  }
  const digits = digitsOnly(trimmed);
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) {
    const e164 = `+${digits}`;
    return E164_RE.test(e164) ? e164 : null;
  }
  return null;
}

export function isE164(value: string): boolean {
  return E164_RE.test(value);
}

export function inferCountryCodeFromE164(e164: string): string | null {
  if (!E164_RE.test(e164)) {
    return null;
  }
  const rest = e164.slice(1);
  if (rest.startsWith("1") || rest.startsWith("7")) {
    return `+${rest[0]}`;
  }
  if (rest.length >= 11) {
    return `+${rest.slice(0, 3)}`;
  }
  if (rest.length >= 10) {
    return `+${rest.slice(0, 2)}`;
  }
  return `+${rest.slice(0, 1)}`;
}
