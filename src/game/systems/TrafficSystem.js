import { CITY_COLS, CITY_ROWS, ROAD_WIDTH, VEHICLE_TYPES, WORLD_HEIGHT, WORLD_WIDTH } from '../engine/constants.js';
import { NPCVehicle } from '../entities/NPCVehicle.js';
import { Obstacle } from '../entities/Obstacle.js';
import { TimePickup } from '../entities/TimePickup.js';
import { pick, pickWeightedIndex, range } from '../utils/random.js';

const LANE_OFFSET = ROAD_WIDTH * 0.25;
const OBSTACLE_TYPES = ['cone', 'barrier', 'pothole', 'dumpster', 'crate'];

const VEHICLE_TYPE_LIST = Object.values(VEHICLE_TYPES);
const VEHICLE_TYPE_WEIGHT_TOTAL = VEHICLE_TYPE_LIST.reduce((sum, t) => sum + t.weight, 0);

/** Mostly plain cars, with a small weighted chance of a taxi/delivery van/police cruiser/ambulance. */
function pickVehicleType(rng) {
  let r = rng() * VEHICLE_TYPE_WEIGHT_TOTAL;
  for (const type of VEHICLE_TYPE_LIST) {
    if (r < type.weight) return type;
    r -= type.weight;
  }
  return VEHICLE_TYPE_LIST[0];
}

function spawnOneVehicle(city, rng, axis, laneCenter, goingPositive, bound, start) {
  const def = pickVehicleType(rng);
  const speedMag = range(rng, def.speedRange[0], def.speedRange[1]);
  return new NPCVehicle({
    axis,
    lanePos: laneCenter + (goingPositive ? LANE_OFFSET : -LANE_OFFSET),
    start,
    speed: (goingPositive ? 1 : -1) * speedMag,
    bound,
    color: pick(rng, def.colors),
    type: def.id,
    length: def.length,
    lightPhaseSeed: range(rng, 0, Math.PI * 2),
  });
}

/** Lanes in busier districts (downtown/nightlife) get picked more often than quiet ones. */
export function spawnTraffic(city, rng, count) {
  const vehicles = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    if (horizontal) {
      const rowIndex = pickWeightedIndex(rng, city.rowWeights);
      const laneCenter = city.roadCenters.rows[rowIndex];
      vehicles.push(spawnOneVehicle(city, rng, 'h', laneCenter, rng() < 0.5, WORLD_WIDTH, range(rng, 0, WORLD_WIDTH)));
    } else {
      const colIndex = pickWeightedIndex(rng, city.colWeights);
      const laneCenter = city.roadCenters.cols[colIndex];
      vehicles.push(spawnOneVehicle(city, rng, 'v', laneCenter, rng() < 0.5, WORLD_HEIGHT, range(rng, 0, WORLD_HEIGHT)));
    }
  }
  return vehicles;
}

export function spawnObstacles(city, rng, count) {
  const obstacles = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    const type = pick(rng, OBSTACLE_TYPES);
    if (horizontal) {
      const rowIndex = Math.floor(range(rng, 0, CITY_ROWS + 1));
      const laneCenter = city.roadCenters.rows[rowIndex];
      obstacles.push(
        new Obstacle(
          type,
          range(rng, 40, WORLD_WIDTH - 40),
          laneCenter + range(rng, -ROAD_WIDTH * 0.35, ROAD_WIDTH * 0.35)
        )
      );
    } else {
      const colIndex = Math.floor(range(rng, 0, CITY_COLS + 1));
      const laneCenter = city.roadCenters.cols[colIndex];
      obstacles.push(
        new Obstacle(
          type,
          laneCenter + range(rng, -ROAD_WIDTH * 0.35, ROAD_WIDTH * 0.35),
          range(rng, 40, WORLD_HEIGHT - 40)
        )
      );
    }
  }
  return obstacles;
}

/** Scatters collectible time-refill pickups along road lanes, the same way obstacles are placed
 * so they always land somewhere drivable. */
export function spawnTimePickups(city, rng, count) {
  const pickups = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    const pulseSeed = range(rng, 0, Math.PI * 2);
    if (horizontal) {
      const rowIndex = Math.floor(range(rng, 0, CITY_ROWS + 1));
      const laneCenter = city.roadCenters.rows[rowIndex];
      pickups.push(
        new TimePickup(range(rng, 40, WORLD_WIDTH - 40), laneCenter + range(rng, -ROAD_WIDTH * 0.3, ROAD_WIDTH * 0.3), pulseSeed)
      );
    } else {
      const colIndex = Math.floor(range(rng, 0, CITY_COLS + 1));
      const laneCenter = city.roadCenters.cols[colIndex];
      pickups.push(
        new TimePickup(laneCenter + range(rng, -ROAD_WIDTH * 0.3, ROAD_WIDTH * 0.3), range(rng, 40, WORLD_HEIGHT - 40), pulseSeed)
      );
    }
  }
  return pickups;
}
