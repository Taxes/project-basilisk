// js/ui/signals.js
// Cross-module signalling to break circular dependencies.
// economics.js (and other UI modules) call requestFullUpdate();
// ui.js calls consumeFullUpdate() in the main render loop.

let _needsFullUpdate = true;

export function requestFullUpdate() { _needsFullUpdate = true; }

export function consumeFullUpdate() {
  if (_needsFullUpdate) { _needsFullUpdate = false; return true; }
  return false;
}
