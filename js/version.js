export const VERSION = '1.0.1';

function encodeVersion(v) {
  const parts = v.split('.').map(Number);
  if (parts.some(isNaN)) return 0;
  const [major = 0, minor = 0, patch = 0, hotfix = 0] = parts;
  return major * 1000000 + minor * 10000 + patch * 100 + hotfix;
}

export const VERSION_INT = encodeVersion(VERSION);

export const DISPLAY_VERSION = /^\d/.test(VERSION) ? `v${VERSION}` : VERSION;
