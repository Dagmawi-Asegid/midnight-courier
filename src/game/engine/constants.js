// Central tuning values for the world and simulation.

export const BLOCK_SIZE = 260; // one building block, including its road frontage
export const ROAD_WIDTH = 96;
export const CITY_COLS = 9;
export const CITY_ROWS = 9;
export const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
export const WORLD_WIDTH = CELL_SIZE * CITY_COLS;
export const WORLD_HEIGHT = CELL_SIZE * CITY_ROWS;

export const NIGHT_BASE_DURATION = 100; // seconds
export const CITY_SEED = 90210; // fixed so the city layout stays familiar run to run

export const NEON_COLORS = [
  '#ff2fd6', // magenta
  '#2fe8ff', // cyan
  '#ffd23f', // amber
  '#7dff5c', // lime
  '#ff6a2f', // orange
  '#b26bff', // violet
];

export const PLAYER_BASE_STATS = {
  maxSpeed: 260,
  acceleration: 620,
  brakePower: 820,
  friction: 340,
  turnSpeed: 3.4,
  radius: 12,
};

// ---------- progression / upgrades ----------
// Every def exposes a uniform `benefit(nextLevel)` describing what buying
// that level grants (shown in the UI as "next-level benefit"), and an
// `apply(stats, level)` that derives the player's runtime stats from a level
// count. Costs grow geometrically per category so maxing everything out
// isn't affordable after one or two nights — the player has to prioritize.

export const UPGRADE_CATEGORIES = ['bike', 'courier', 'navigation'];

export const UPGRADE_CATEGORY_META = {
  bike: { label: 'Bike', icon: '🏍️', blurb: 'Speed, handling and boost.' },
  courier: { label: 'Courier', icon: '📦', blurb: 'Bigger paychecks, longer nights.' },
  navigation: { label: 'Navigation', icon: '🧭', blurb: 'Situational awareness on the road.' },
};

export const UPGRADE_DEFS = [
  // ---- BIKE ----
  {
    id: 'topSpeed',
    category: 'bike',
    label: 'Top Speed',
    icon: '💨',
    description: "Raises your bike's maximum speed.",
    maxLevel: 5,
    baseCost: 45,
    costGrowth: 1.42,
    benefit: () => '+35 top speed',
    apply: (stats, level) => {
      stats.maxSpeed = PLAYER_BASE_STATS.maxSpeed + level * 35;
    },
  },
  {
    id: 'acceleration',
    category: 'bike',
    label: 'Acceleration',
    icon: '🏎️',
    description: 'Reach top speed faster off the line.',
    maxLevel: 5,
    baseCost: 42,
    costGrowth: 1.4,
    benefit: () => '+90 acceleration',
    apply: (stats, level) => {
      stats.acceleration = PLAYER_BASE_STATS.acceleration + level * 90;
    },
  },
  {
    id: 'handling',
    category: 'bike',
    label: 'Handling',
    icon: '🛞',
    description: 'Tighter, more responsive steering.',
    maxLevel: 5,
    baseCost: 42,
    costGrowth: 1.38,
    benefit: () => '+0.3 turn rate',
    apply: (stats, level) => {
      stats.turnSpeed = PLAYER_BASE_STATS.turnSpeed + level * 0.3;
    },
  },
  {
    id: 'braking',
    category: 'bike',
    label: 'Braking',
    icon: '🛑',
    description: 'Stop and reverse out of trouble faster.',
    maxLevel: 5,
    baseCost: 38,
    costGrowth: 1.36,
    benefit: () => '+140 brake power',
    apply: (stats, level) => {
      stats.brakePower = PLAYER_BASE_STATS.brakePower + level * 140;
    },
  },
  {
    id: 'boostCapacity',
    category: 'bike',
    label: 'Boost Capacity',
    icon: '🔋',
    description: 'Boost drains slower and refills faster.',
    maxLevel: 5,
    baseCost: 55,
    costGrowth: 1.46,
    benefit: () => '-12% boost drain, +15% regen',
    apply: (stats, level) => {
      stats.boostDrainPerSecond = BOOST_CONFIG.drainPerSecond * (1 - level * 0.12);
      stats.boostRegenPerSecond = BOOST_CONFIG.regenPerSecond * (1 + level * 0.15);
    },
  },

  // ---- COURIER ----
  {
    id: 'rewardBonus',
    category: 'courier',
    label: 'Delivery Reward',
    icon: '💰',
    description: 'Earn a bigger cut on every delivery.',
    maxLevel: 5,
    baseCost: 75,
    costGrowth: 1.5,
    benefit: () => '+8% payout on every delivery',
    apply: (stats, level) => {
      stats.rewardMultiplier = 1 + level * 0.08;
    },
  },
  {
    id: 'nightLength',
    category: 'courier',
    label: 'Night Length',
    icon: '⏱️',
    description: 'Extends how long each night runs.',
    maxLevel: 5,
    baseCost: 62,
    costGrowth: 1.46,
    benefit: () => '+12s per night',
    apply: (stats, level) => {
      stats.extraTime = level * 12;
    },
  },
  {
    id: 'comboMastery',
    category: 'courier',
    label: 'Combo Mastery',
    icon: '🔥',
    description: 'Each streak level pays out more.',
    maxLevel: 5,
    baseCost: 65,
    costGrowth: 1.46,
    benefit: () => '+3% bonus per combo stack',
    apply: (stats, level) => {
      stats.comboPerStackBonus = level * 0.03;
    },
  },

  // ---- NAVIGATION ----
  {
    id: 'destinationIndicator',
    category: 'navigation',
    label: 'Destination Indicator',
    icon: '🧭',
    description: 'Sharper distance readouts and a bigger auto-deliver radius.',
    maxLevel: 3,
    baseCost: 32,
    costGrowth: 1.38,
    benefit: (nextLevel) =>
      [
        '+8 auto-deliver radius · exact distance readout',
        '+8 auto-deliver radius · pulses when you’re close',
        '+8 auto-deliver radius · full route district intel',
      ][nextLevel - 1],
    apply: (stats, level) => {
      stats.interactRadius = 42 + level * 8;
      stats.navPrecision = level;
    },
  },
  {
    id: 'shortcutRadar',
    category: 'navigation',
    label: 'Shortcut Radar',
    icon: '🔀',
    description: 'Detect nearby shortcut alleys before you see them.',
    maxLevel: 3,
    baseCost: 48,
    costGrowth: 1.43,
    benefit: (nextLevel) => `${Math.round((nextLevel * 450) / 8)}m shortcut detection radius`,
    apply: (stats, level) => {
      stats.shortcutDetectionRadius = level > 0 ? level * 450 : 0;
    },
  },
  {
    id: 'mapInfo',
    category: 'navigation',
    label: 'Map Intel',
    icon: '🗺️',
    description: 'Reveals district names along your delivery route.',
    maxLevel: 2,
    baseCost: 28,
    costGrowth: 1.3,
    benefit: (nextLevel) =>
      nextLevel >= 2 ? 'Shows pickup + destination neighborhood' : 'Shows destination neighborhood',
    apply: (stats, level) => {
      stats.mapInfoLevel = level;
    },
  },
];

export const DEFAULT_UPGRADE_LEVELS = UPGRADE_DEFS.reduce((acc, u) => {
  acc[u.id] = 0;
  return acc;
}, {});

export function computeStatsFromUpgrades(levels) {
  const stats = {
    ...PLAYER_BASE_STATS,
    extraTime: 0,
    interactRadius: 42,
    rewardMultiplier: 1,
    comboPerStackBonus: 0,
    boostDrainPerSecond: BOOST_CONFIG.drainPerSecond,
    boostRegenPerSecond: BOOST_CONFIG.regenPerSecond,
    navPrecision: 0,
    shortcutDetectionRadius: 0,
    mapInfoLevel: 0,
  };
  for (const def of UPGRADE_DEFS) {
    def.apply(stats, levels[def.id] || 0);
  }
  return stats;
}

export function upgradeCost(def, currentLevel, costMultiplier = 1) {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel) * costMultiplier);
}

// ---------- delivery gameplay tuning ----------

export const DELIVERY_TYPES = {
  normal: {
    id: 'normal',
    label: 'STANDARD',
    icon: '📦',
    weight: 0.55,
    basePay: 18,
    payPerDistance: 0.05,
    riskMultiplier: 1,
    timeFactor: 0.014, // seconds of time limit per pixel of distance (~70px/s asymptotic pace — very reachable on a stock bike)
    timeBuffer: 10, // flat seconds added so short hops are still comfortably makeable
    color: '#7dff5c',
  },
  rush: {
    id: 'rush',
    label: 'RUSH',
    icon: '⚡',
    weight: 0.28,
    basePay: 25,
    payPerDistance: 0.055,
    riskMultiplier: 1.15,
    timeFactor: 0.011, // tighter than normal, but still a moderate pace, not a top-speed sprint
    timeBuffer: 8,
    color: '#2fe8ff',
  },
  danger: {
    id: 'danger',
    label: 'DANGER',
    icon: '☠️',
    weight: 0.17,
    basePay: 33,
    payPerDistance: 0.065,
    riskMultiplier: 1.5,
    timeFactor: 0.012,
    timeBuffer: 9,
    color: '#ff2f6e',
  },
};

export const COMBO_CONFIG = {
  window: 16, // seconds after a delivery before the streak decays
  perStack: 0.15, // +15% payout multiplier per streak level
  maxStacks: 10,
};

export const BOOST_CONFIG = {
  drainPerSecond: 0.45, // fraction of the meter per second while boosting
  regenPerSecond: 0.16, // fraction of the meter per second while idle
  speedMultiplier: 1.5,
  accelMultiplier: 1.35,
};

export const EVENT_DEFS = {
  roadBlocked: { id: 'roadBlocked', label: 'Road Blocked', icon: '🚧', weight: 0.22, minDuration: 10, maxDuration: 16 },
  construction: { id: 'construction', label: 'Construction Zone', icon: '👷', weight: 0.15, minDuration: 12, maxDuration: 18 },
  traffic: { id: 'traffic', label: 'Heavy Traffic', icon: '🚗', weight: 0.2, minDuration: 10, maxDuration: 15 },
  shortcut: { id: 'shortcut', label: 'Shortcut Available', icon: '✨', weight: 0.15, minDuration: 10, maxDuration: 14 },
  checkpoint: { id: 'checkpoint', label: 'Police Checkpoint', icon: '🚔', weight: 0.16, minDuration: 12, maxDuration: 18 },
  pedestrian: { id: 'pedestrian', label: 'Pedestrians Crossing', icon: '🚶', weight: 0.12, minDuration: 7, maxDuration: 11 },
};

export const EVENT_SPAWN_INTERVAL = [16, 26]; // seconds of calm between events

// ---------- city districts ----------
// Each district drives building generation, decoration density and traffic
// feel for the blocks assigned to it. City.js decides which cells belong to
// which district; everything downstream (rendering, traffic, deliveries)
// just reads these tables.

export const DISTRICT_IDS = ['downtown', 'nightlife', 'residential', 'industrial', 'bole'];

export const DISTRICTS = {
  downtown: {
    id: 'downtown',
    label: 'Downtown',
    palette: ['#161a2c', '#1b2036', '#141728', '#1e2340'],
    marginRange: [10, 20], // small setback -> big, dense towers
    floorRange: [7, 13],
    windowFillChance: 0.68,
    litWindowChance: 0.68,
    neonWindowChance: 0.3,
    signChance: 0.4,
    signCountRange: [1, 1],
    streetlightChance: 0.85,
    treeChance: 0.04,
    parkedVehicleChance: 0.3,
    vendorChance: 0,
    entranceGlowChance: 0,
    trafficWeight: 1.7,
    trafficLightChance: 0.55,
    ambientPedestrianDensity: 0.5,
    groundTint: 'rgba(90, 130, 210, 0.05)',
    musicTheme: 'downtown-synthwave', // reserved for a future district-aware audio manager
  },
  nightlife: {
    id: 'nightlife',
    label: 'Nightlife District',
    palette: ['#221230', '#2a1533', '#1c1128', '#26142c'],
    marginRange: [14, 22],
    floorRange: [3, 6],
    windowFillChance: 0.6,
    litWindowChance: 0.82,
    neonWindowChance: 0.55,
    signChance: 0.85,
    signCountRange: [1, 3],
    streetlightChance: 0.6,
    treeChance: 0.06,
    parkedVehicleChance: 0.28,
    vendorChance: 0.06,
    entranceGlowChance: 0.22,
    trafficWeight: 1.3,
    trafficLightChance: 0.5,
    ambientPedestrianDensity: 1,
    groundTint: 'rgba(255, 47, 214, 0.05)',
    musicTheme: 'nightlife-electro',
  },
  residential: {
    id: 'residential',
    label: 'Residential',
    palette: ['#181c22', '#1b2027', '#171b20', '#1a1f26'],
    marginRange: [24, 36],
    floorRange: [2, 4],
    windowFillChance: 0.58,
    litWindowChance: 0.55,
    neonWindowChance: 0.04,
    signChance: 0.03,
    signCountRange: [1, 1],
    streetlightChance: 0.55,
    treeChance: 0.42,
    parkedVehicleChance: 0.45,
    vendorChance: 0,
    entranceGlowChance: 0,
    trafficWeight: 0.5,
    trafficLightChance: 0.15,
    ambientPedestrianDensity: 0.25,
    groundTint: 'rgba(255, 210, 140, 0.03)',
    musicTheme: 'residential-ambient',
  },
  industrial: {
    id: 'industrial',
    label: 'Industrial',
    palette: ['#14171a', '#171a1c', '#121416', '#191c1e'],
    marginRange: [6, 14],
    floorRange: [1, 3],
    windowFillChance: 0.35,
    litWindowChance: 0.3,
    neonWindowChance: 0.06,
    signChance: 0.08,
    signCountRange: [1, 1],
    streetlightChance: 0.28,
    treeChance: 0.02,
    parkedVehicleChance: 0.08,
    vendorChance: 0,
    entranceGlowChance: 0,
    trafficWeight: 0.55,
    trafficLightChance: 0.08,
    ambientPedestrianDensity: 0.05,
    groundTint: 'rgba(255, 170, 60, 0.035)',
    musicTheme: 'industrial-drone',
  },
  // A pocket neighborhood tucked into the nightlife quadrant, modeled respectfully on Bole —
  // Addis Ababa's modern restaurant/café/nightlife district — rather than any generic "ethnic"
  // stereotype. Warm café-gold instead of club-magenta, arched restaurant/coffee-shop signage,
  // street vendor carts and a busy, diverse evening crowd.
  bole: {
    id: 'bole',
    label: 'Bole',
    palette: ['#241a14', '#2a2018', '#1f160f', '#2c2116'],
    marginRange: [12, 20],
    floorRange: [3, 7],
    windowFillChance: 0.62,
    litWindowChance: 0.78,
    neonWindowChance: 0.28,
    neonPalette: ['#ffd23f', '#ff9a3f', '#ff6a2f', '#7dff5c'], // warm gold/amber/terracotta, no magenta/cyan club colors
    signChance: 0.7,
    signCountRange: [1, 2],
    signStyle: 'arch', // rounded café/restaurant signboard instead of the plain neon bar shape
    jebenaSignChance: 0.35, // fraction of arched signs that read as a coffee house (jebena icon)
    streetlightChance: 0.65,
    treeChance: 0.12,
    parkedVehicleChance: 0.3,
    vendorChance: 0.24,
    entranceGlowChance: 0.28,
    trafficWeight: 1.4,
    trafficLightChance: 0.4,
    ambientPedestrianDensity: 0.95,
    pedestrianPalette: ['#ffe9b0', '#e8935a', '#7dbf7d', '#d9a5e8', '#f0d264', '#8ecbe0'],
    groundTint: 'rgba(230, 160, 60, 0.06)',
    musicTheme: 'bole-contemporary-ethiopian',
  },
};

/** A compact pocket of cells carved out of the nightlife quadrant for the Bole district. */
export const SPECIAL_DISTRICT_ZONE = { id: 'bole', cx: [CITY_COLS - 4, CITY_COLS - 2], cy: [0, 2] };

export const SHORTCUT_CONFIG = {
  chance: 0.12, // probability a non-plaza block becomes an alley cut-through
  width: 56,
};

export const TRAFFIC_LIGHT_CONFIG = {
  greenDuration: 5.5,
  yellowDuration: 1.2,
  redDuration: 5.5,
};

export const AMBIENT_PEDESTRIAN_MAX = 34;

export const PARKED_CAR_COLORS = ['#8a8f9a', '#5c6470', '#9a5c5c', '#5c7a9a', '#7a7050', '#4a4e58'];

// ---------- NPC traffic ----------
// Most traffic is plain background cars; a small weighted slice is one of a few special
// types with their own color, size and pace so the streets read as a real mixed city fleet
// rather than palette-swapped clones. `speedRange` is in px/s (the cruise speed NPCVehicle
// eases toward); `lightBar` types flash a roof light and get right-of-way visual flair only
// (no gameplay exemption — they still stop for red lights and traffic like everyone else).
export const VEHICLE_TYPES = {
  car: { id: 'car', weight: 0.66, colors: ['#c94b4b', '#4b8cc9', '#e0e0e0', '#c9a84b', '#7a4bc9'], speedRange: [70, 130], length: 30, lightBar: null },
  taxi: { id: 'taxi', weight: 0.14, colors: ['#f2c94c'], speedRange: [85, 145], length: 30, lightBar: null, roofSign: true },
  delivery: { id: 'delivery', weight: 0.1, colors: ['#e7e2d6', '#9a8768'], speedRange: [50, 90], length: 38, lightBar: null },
  police: { id: 'police', weight: 0.06, colors: ['#1c2230'], speedRange: [100, 160], length: 32, lightBar: ['#ff3b3b', '#2fa1ff'] },
  ambulance: { id: 'ambulance', weight: 0.04, colors: ['#eef0f2'], speedRange: [110, 170], length: 36, lightBar: ['#ff3b3b', '#ffffff'] },
};
