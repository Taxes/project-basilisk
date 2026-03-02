export const VERSION = '0.9.1.1';

function encodeVersion(v) {
  const [major = 0, minor = 0, patch = 0, hotfix = 0] = v.split('.').map(Number);
  return major * 1000000 + minor * 10000 + patch * 100 + hotfix;
}

export const VERSION_INT = encodeVersion(VERSION);
