import { CITY_COLS, CITY_ROWS, ROAD_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../engine/constants.js';
import { NPCVehicle } from '../entities/NPCVehicle.js';
import { Obstacle } from '../entities/Obstacle.js';
import { pick, pickWeightedIndex, range } from '../utils/random.js';

const LANE_OFFSET = ROAD_WIDTH * 0.25;
const OBSTACLE_TYPES = ['cone', 'barrier', 'pothole', 'dumpster', 'crate'];

/** Lanes in busier districts (downtown/nightlife) get picked more often than quiet ones. */
export function spawnTraffic(city, rng, count) {
  const vehicles = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    if (horizontal) {
      const rowIndex = pickWeightedIndex(rng, city.rowWeights);
      const laneCenter = city.roadCenters.rows[rowIndex];
      const goingRight = rng() < 0.5;
      vehicles.push(
        new NPCVehicle({
          axis: 'h',
          lanePos: laneCenter + (goingRight ? LANE_OFFSET : -LANE_OFFSET),
          start: range(rng, 0, WORLD_WIDTH),
          speed: (goingRight ? 1 : -1) * range(rng, 70, 130),
          bound: WORLD_WIDTH,
          colorSeed: i,
        })
      );
    } else {
      const colIndex = pickWeightedIndex(rng, city.colWeights);
      const laneCenter = city.roadCenters.cols[colIndex];
      const goingDown = rng() < 0.5;
      vehicles.push(
        new NPCVehicle({
          axis: 'v',
          lanePos: laneCenter + (goingDown ? LANE_OFFSET : -LANE_OFFSET),
          start: range(rng, 0, WORLD_HEIGHT),
          speed: (goingDown ? 1 : -1) * range(rng, 70, 130),
          bound: WORLD_HEIGHT,
          colorSeed: i,
        })
      );
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
