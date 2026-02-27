// Event System and Triggers
// Now routes events through the message system as action messages

import { gameState } from './game-state.js';
import { addActionMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { getSender } from './content/message-content.js';

// Store all events from content files
let allEvents = [];

// Initialize events from content modules
export function initializeEvents(eventModules) {
  allEvents = [];
  for (let module of eventModules) {
    allEvents = allEvents.concat(module);
  }
}

// Get all events
export function getAllEvents() {
  return allEvents;
}

// Get event by ID
export function getEventById(id) {
  return allEvents.find(event => event.id === id);
}

// Check if event has been triggered
function hasEventBeenTriggered(eventId) {
  return gameState.triggeredEvents.includes(eventId);
}

// Mark event as triggered
function markEventTriggered(eventId) {
  if (!gameState.triggeredEvents.includes(eventId)) {
    gameState.triggeredEvents.push(eventId);
  }
}

// Convert an old-style event to a message system action message
function sendEventAsMessage(event) {
  // Determine sender based on event content
  let sender = getSender('board'); // Default to board for most events
  if (event.text && event.text.includes('safety')) {
    sender = getSender('cso');
  } else if (event.text && (event.text.includes('CFO') || event.text.includes('funding') || event.text.includes('cost'))) {
    sender = getSender('cfo');
  } else if (event.text && (event.text.includes('breakthrough') || event.text.includes('research'))) {
    sender = getSender('cto');
  }

  // Convert event choices to message choices
  const messageChoices = event.choices?.map(choice => ({
    id: choice.id || choice.text.substring(0, 20).replace(/\s+/g, '_').toLowerCase(),
    label: choice.text,
    effects: choice.effects || {},
  })) || [];

  addActionMessage(
    sender,
    event.name,
    event.text,
    null, // no signature
    messageChoices,
    'normal',
    ['event', event.trigger?.type || 'unknown'],
    `event:${event.id}`
  );
}

// Trigger an event based on type and value
export function triggerEvent(trigger) {
  for (let event of allEvents) {
    // Skip if already triggered and is one-time
    if (event.oneTime && hasEventBeenTriggered(event.id)) {
      continue;
    }

    // Also check message system for duplicates
    const messageKey = `event:${event.id}`;
    if (event.oneTime && hasMessageBeenTriggered(messageKey)) {
      continue;
    }

    // Check if trigger matches
    if (event.trigger.type === trigger.type && event.trigger.value === trigger.value) {
      // During fast-forward, auto-choose first option and log
      if (gameState._fastForwarding) {
        if (event.choices && event.choices.length > 0) {
          applyChoiceEffects(event.choices[0].effects);
        }
        if (!gameState._fastForwardEvents) gameState._fastForwardEvents = [];
        gameState._fastForwardEvents.push({ id: event.id, name: event.name, autoResolved: true });
        if (event.oneTime) {
          markEventTriggered(event.id);
          markMessageTriggered(messageKey);
        }
        continue;
      }

      // Send as action message instead of showing modal
      sendEventAsMessage(event);
      markMessageTriggered(messageKey);

      if (event.oneTime) {
        markEventTriggered(event.id);
      }
    }
  }
}

// Check for resource threshold events
export function checkResourceThresholdEvents() {
  for (let event of allEvents) {
    if (event.oneTime && hasEventBeenTriggered(event.id)) {
      continue;
    }

    const messageKey = `event:${event.id}`;
    if (event.oneTime && hasMessageBeenTriggered(messageKey)) {
      continue;
    }

    if (event.trigger.type === 'resource_threshold') {
      let shouldTrigger = true;
      const comparison = event.trigger.comparison || 'above'; // Default to 'above'

      for (let resource in event.trigger.value) {
        const currentValue = gameState.resources[resource];
        const thresholdValue = event.trigger.value[resource];

        if (comparison === 'above') {
          if (currentValue < thresholdValue) {
            shouldTrigger = false;
            break;
          }
        } else if (comparison === 'below') {
          if (currentValue >= thresholdValue) {
            shouldTrigger = false;
            break;
          }
        }
      }

      if (shouldTrigger) {
        // During fast-forward, auto-choose first option and log
        if (gameState._fastForwarding) {
          if (event.choices && event.choices.length > 0) {
            applyChoiceEffects(event.choices[0].effects);
          }
          if (!gameState._fastForwardEvents) gameState._fastForwardEvents = [];
          gameState._fastForwardEvents.push({ id: event.id, name: event.name, autoResolved: true });
          if (event.oneTime) {
            markEventTriggered(event.id);
            markMessageTriggered(messageKey);
          }
          continue;
        }

        // Send as action message instead of showing modal
        sendEventAsMessage(event);
        markMessageTriggered(messageKey);

        if (event.oneTime) {
          markEventTriggered(event.id);
        }
      }
    }
  }
}

// Check for time-based events
export function checkTimeBasedEvents() {
  for (let event of allEvents) {
    if (event.oneTime && hasEventBeenTriggered(event.id)) {
      continue;
    }

    const messageKey = `event:${event.id}`;
    if (event.oneTime && hasMessageBeenTriggered(messageKey)) {
      continue;
    }

    if (event.trigger.type === 'time_elapsed') {
      if (gameState.timeElapsed >= event.trigger.value) {
        // During fast-forward, auto-choose first option and log
        if (gameState._fastForwarding) {
          if (event.choices && event.choices.length > 0) {
            applyChoiceEffects(event.choices[0].effects);
          }
          if (!gameState._fastForwardEvents) gameState._fastForwardEvents = [];
          gameState._fastForwardEvents.push({ id: event.id, name: event.name, autoResolved: true });
          if (event.oneTime) {
            markEventTriggered(event.id);
            markMessageTriggered(messageKey);
          }
          continue;
        }

        // Send as action message instead of showing modal
        sendEventAsMessage(event);
        markMessageTriggered(messageKey);

        if (event.oneTime) {
          markEventTriggered(event.id);
        }
      }
    }
  }
}

// Apply choice effects
export function applyChoiceEffects(effects) {
  // Apply resource changes
  if (effects.resources) {
    for (let resource in effects.resources) {
      gameState.resources[resource] += effects.resources[resource];
    }
  }

  // Apply capability unlocks (targets track system)
  if (effects.capabilities) {
    for (let capId in effects.capabilities) {
      if (effects.capabilities[capId].unlocked) {
        // Add to capabilities track if not already unlocked
        const trackState = gameState.tracks?.capabilities;
        if (trackState && !trackState.unlockedCapabilities.includes(capId)) {
          trackState.unlockedCapabilities.push(capId);
        }
      }
    }
  }

  // Apply research rate multiplier
  if (effects.researchRateMultiplier) {
    gameState.eventMultipliers.researchRate *= effects.researchRateMultiplier;
  }

  // Apply compute rate multiplier
  if (effects.computeRateMultiplier) {
    gameState.eventMultipliers.computeRate *= effects.computeRateMultiplier;
  }

  // Note: computeCostReduction effect is defined in events but not yet implemented
  // TODO: Implement compute cost multipliers if needed

  // Track competitor boost (for future use)
  if (effects.competitorBoost) {
    if (!gameState.competitor) {
      gameState.competitor = { capabilityLevel: 0, position: "behind" };
    }
    gameState.competitor.capabilityLevel += effects.competitorBoost;
  }

  // Track choices
  if (effects.choices) {
    for (let choice in effects.choices) {
      if (!gameState.choices[choice]) {
        gameState.choices[choice] = 0;
      }
      gameState.choices[choice] += effects.choices[choice];
    }
  }
}
