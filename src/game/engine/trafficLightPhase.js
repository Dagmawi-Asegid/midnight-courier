import { TRAFFIC_LIGHT_CONFIG } from './constants.js';

const LIGHT_CYCLE =
  TRAFFIC_LIGHT_CONFIG.greenDuration + TRAFFIC_LIGHT_CONFIG.yellowDuration + TRAFFIC_LIGHT_CONFIG.redDuration;

/**
 * A traffic light's phase is derived purely from world time and its position (no stored
 * state), so the renderer and NPC driving AI can both ask "what color is this light right
 * now" and always agree. Each light gets a small per-position offset so a city block's
 * lights don't all switch in lockstep.
 */
export function getTrafficLightPhase(time, light) {
  const cyclePos = (time + (light.x * 0.013 + light.y * 0.017)) % LIGHT_CYCLE;
  if (cyclePos < TRAFFIC_LIGHT_CONFIG.greenDuration) return 'green';
  if (cyclePos < TRAFFIC_LIGHT_CONFIG.greenDuration + TRAFFIC_LIGHT_CONFIG.yellowDuration) return 'yellow';
  return 'red';
}
