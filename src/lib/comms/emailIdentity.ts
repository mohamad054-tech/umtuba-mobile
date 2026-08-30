export function normalizeDiscoveryEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  if (email.length > 254) {
    return null;
  }
  return email;
}
