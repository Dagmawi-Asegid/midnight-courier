import {
  BLOCK_SIZE,
  CELL_SIZE,
  CITY_COLS,
  CITY_ROWS,
  DISTRICT_IDS,
  DISTRICTS,
  NEON_COLORS,
  PARKED_CAR_COLORS,
  ROAD_WIDTH,
  SHORTCUT_CONFIG,
  SPECIAL_DISTRICT_ZONE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../engine/constants.js';
import { createRng, pick, range, chance } from '../utils/random.js';
import { Obstacle } from '../entities/Obstacle.js';

const SIDES = ['n', 's', 'e', 'w'];

// Top-left/top-right/bottom-left/bottom-right quadrants of the grid.
const QUADRANTS = [
  ['downtown', 'nightlife'],
  ['residential', 'industrial'],
];

/**
 * Procedurally generates a static night-city layout: five distinct
 * districts (downtown, nightlife, residential, industrial, and the Bole
 * pocket neighborhood), a road network, building blocks, shortcut alleys,
 * curbside parked cars, streetlights, traffic lights and crowd anchor
 * points. Everything is derived from a single seed so the same city
 * regenerates deterministically between nights.
 */
export class City {
  constructor(seed = 1) {
    this.seed = seed;
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.buildings = [];
    this.buildingsByDistrict = Object.fromEntries(DISTRICT_IDS.map((id) => [id, []]));
    this.streetlights = [];
    this.trafficLights = [];
    this.roadDecor = [];
    this.plazas = [];
    this.alleys = [];
    this.parkedVehicles = [];
    this.ambientAnchors = [];
    this.roadCenters = { cols: [], rows: [] };
    this._generate();
  }

  _generate() {
    const rng = createRng(this.seed);

    for (let cx = 0; cx <= CITY_COLS; cx++) {
      this.roadCenters.cols.push(cx * CELL_SIZE + ROAD_WIDTH / 2);
    }
    for (let cy = 0; cy <= CITY_ROWS; cy++) {
      this.roadCenters.rows.push(cy * CELL_SIZE + ROAD_WIDTH / 2);
    }

    this._assignDistricts(rng);
    this._carveSpecialDistrict(rng);
    this._computeTrafficWeights();
    this._boostSpecialDistrictTraffic();

    const centerCx = Math.floor(CITY_COLS / 2);
    const centerCy = Math.floor(CITY_ROWS / 2);

    for (let cy = 0; cy < CITY_ROWS; cy++) {
      for (let cx = 0; cx < CITY_COLS; cx++) {
        const originX = cx * CELL_SIZE + ROAD_WIDTH;
        const originY = cy * CELL_SIZE + ROAD_WIDTH;
        const isCentral = cx === centerCx && cy === centerCy;
        const districtId = this.districtGrid[cy][cx];
        const district = DISTRICTS[districtId];

        if (isCentral || chance(rng, district.treeChance > 0.3 ? 0.1 : 0.06)) {
          this.plazas.push({ x: originX, y: originY, size: BLOCK_SIZE, isCentral });
          this._scatterPlazaDecor(rng, originX, originY, isCentral, districtId);
          continue;
        }

        if (chance(rng, SHORTCUT_CONFIG.chance)) {
          this._generateAlleyBlock(rng, cx, cy, originX, originY, district, districtId);
        } else {
          const margin = range(rng, district.marginRange[0], district.marginRange[1]);
          const rect = {
            x: originX + margin,
            y: originY + margin,
            w: BLOCK_SIZE - margin * 2,
            h: BLOCK_SIZE - margin * 2,
          };
          const building = this._generateBuilding(rng, `${cx}-${cy}`, rect, originX, originY, district, districtId);
          this._scatterBuildingExtras(rng, building, district);
        }
      }
    }

    this._scatterStreetlights(rng);
    this._scatterTrafficLights(rng);
    this._ensureSpecialDistrictFlavor(rng);
  }

  /** Per-building rolls can unluckily leave the special district feeling empty on some seeds —
   * top it up so Bole always reads as a lively, populated neighborhood. */
  _ensureSpecialDistrictFlavor(rng) {
    const zoneId = SPECIAL_DISTRICT_ZONE.id;
    const buildings = this.buildingsByDistrict[zoneId].filter((b) => !b.isAlleySegment);
    if (buildings.length === 0) return;

    const MIN_ANCHORS = 4;
    let anchorCount = this.ambientAnchors.filter((a) => a.district === zoneId).length;
    let guard = 0;
    while (anchorCount < MIN_ANCHORS && guard < 20) {
      this._placeAmbientAnchor(rng, pick(rng, buildings));
      anchorCount++;
      guard++;
    }

    if (!this._hasNearbyDecor('vendorCart', buildings)) this._placeVendorCart(rng, pick(rng, buildings));
    if (!this._hasNearbyDecor('entranceGlow', buildings)) this._placeEntranceGlow(rng, pick(rng, buildings));
  }

  _hasNearbyDecor(type, buildings) {
    return this.roadDecor.some(
      (d) => d.type === type && buildings.some((b) => Math.hypot(b.x + b.w / 2 - d.x, b.y + b.h / 2 - d.y) < BLOCK_SIZE)
    );
  }

  /** Splits the grid into four quadrant districts with a softly blended seam. */
  _assignDistricts(rng) {
    const halfCols = (CITY_COLS - 1) / 2;
    const halfRows = (CITY_ROWS - 1) / 2;
    this.districtGrid = [];

    for (let cy = 0; cy < CITY_ROWS; cy++) {
      const row = [];
      const distToRowMid = Math.abs(cy - halfRows);
      for (let cx = 0; cx < CITY_COLS; cx++) {
        const distToColMid = Math.abs(cx - halfCols);
        let colHalf = cx < halfCols ? 0 : 1;
        let rowHalf = cy < halfRows ? 0 : 1;
        if (distToColMid < 1.5 && chance(rng, 0.35)) colHalf = 1 - colHalf;
        if (distToRowMid < 1.5 && chance(rng, 0.35)) rowHalf = 1 - rowHalf;
        row.push(QUADRANTS[rowHalf][colHalf]);
      }
      this.districtGrid.push(row);
    }
  }

  /** Overrides a pocket of cells inside the nightlife quadrant with the special Bole district. */
  _carveSpecialDistrict(rng) {
    const zone = SPECIAL_DISTRICT_ZONE;
    for (let cy = zone.cy[0]; cy <= zone.cy[1]; cy++) {
      for (let cx = zone.cx[0]; cx <= zone.cx[1]; cx++) {
        const isCorner = (cx === zone.cx[0] || cx === zone.cx[1]) && (cy === zone.cy[0] || cy === zone.cy[1]);
        // Leave a chance for corners to keep the surrounding district, so the pocket's edge looks organic.
        if (isCorner && chance(rng, 0.4)) continue;
        this.districtGrid[cy][cx] = zone.id;
      }
    }
  }

  /** Precomputes a traffic-density weight per lane so busier districts see more NPC cars. */
  _computeTrafficWeights() {
    this.rowWeights = [];
    for (let ri = 0; ri <= CITY_ROWS; ri++) {
      const cy = Math.min(CITY_ROWS - 1, ri);
      const left = DISTRICTS[this.districtGrid[cy][0]].trafficWeight;
      const right = DISTRICTS[this.districtGrid[cy][CITY_COLS - 1]].trafficWeight;
      this.rowWeights.push((left + right) / 2);
    }
    this.colWeights = [];
    for (let ci = 0; ci <= CITY_COLS; ci++) {
      const cx = Math.min(CITY_COLS - 1, ci);
      const top = DISTRICTS[this.districtGrid[0][cx]].trafficWeight;
      const bottom = DISTRICTS[this.districtGrid[CITY_ROWS - 1][cx]].trafficWeight;
      this.colWeights.push((top + bottom) / 2);
    }
  }

  /** The row/col weight sampling above only looks at the grid's outer edge, which the interior
   * Bole pocket never touches — so its own traffic weight is folded in directly here. */
  _boostSpecialDistrictTraffic() {
    const zone = SPECIAL_DISTRICT_ZONE;
    const weight = DISTRICTS[zone.id].trafficWeight;
    for (let ci = zone.cx[0]; ci <= zone.cx[1] + 1; ci++) {
      this.colWeights[ci] = Math.max(this.colWeights[ci], weight);
    }
    for (let ri = zone.cy[0]; ri <= zone.cy[1] + 1; ri++) {
      this.rowWeights[ri] = Math.max(this.rowWeights[ri], weight);
    }
  }

  districtAt(cx, cy) {
    const clampedCx = Math.max(0, Math.min(CITY_COLS - 1, cx));
    const clampedCy = Math.max(0, Math.min(CITY_ROWS - 1, cy));
    return this.districtGrid[clampedCy][clampedCx];
  }

  _generateBuilding(rng, id, rect, blockOriginX, blockOriginY, district, districtId) {
    const color = pick(rng, district.palette);
    const floors = Math.round(range(rng, district.floorRange[0], district.floorRange[1]));
    const neonPalette = district.neonPalette || NEON_COLORS;

    const signs = [];
    if (chance(rng, district.signChance)) {
      const signCount = Math.round(range(rng, district.signCountRange[0], district.signCountRange[1]));
      const usedSides = new Set();
      for (let i = 0; i < signCount; i++) {
        let side = pick(rng, SIDES);
        let guard = 0;
        while (usedSides.has(side) && guard < 4) {
          side = pick(rng, SIDES);
          guard++;
        }
        usedSides.add(side);
        const style = district.signStyle || 'bar';
        const icon = style === 'arch' && chance(rng, district.jebenaSignChance || 0) ? 'jebena' : null;
        signs.push({ side, color: pick(rng, neonPalette), style, icon });
      }
    }

    const cols = Math.max(2, Math.round(rect.w / 30));
    const rowsCount = Math.max(2, floors);
    const windows = [];
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < cols; c++) {
        if (chance(rng, district.windowFillChance)) {
          windows.push({
            cx: (c + 0.5) / cols,
            cy: (r + 0.5) / rowsCount,
            color: chance(rng, district.neonWindowChance) ? pick(rng, neonPalette) : '#ffd88a',
            flickerSpeed: range(rng, 0.4, 2.2),
            flickerSeed: rng() * Math.PI * 2,
            lit: chance(rng, district.litWindowChance),
          });
        }
      }
    }

    const building = {
      id,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      color,
      windows,
      cols,
      rows: rowsCount,
      signs,
      roofDetail: chance(rng, 0.5),
      district: districtId,
      blockX: blockOriginX,
      blockY: blockOriginY,
      blockSize: BLOCK_SIZE,
    };
    this.buildings.push(building);
    this.buildingsByDistrict[districtId].push(building);
    return building;
  }

  /** Carves a drivable alley through a block, splitting it into two smaller facades either side of the gap. */
  _generateAlleyBlock(rng, cx, cy, originX, originY, district, districtId) {
    const margin = range(rng, district.marginRange[0], district.marginRange[1]);
    const lotX = originX + margin;
    const lotY = originY + margin;
    const lotW = BLOCK_SIZE - margin * 2;
    const lotH = BLOCK_SIZE - margin * 2;
    const gapWidth = SHORTCUT_CONFIG.width;
    const horizontal = chance(rng, 0.5);

    let rectA, rectB, gapRect;
    if (horizontal) {
      const halfH = (lotH - gapWidth) / 2;
      rectA = { x: lotX, y: lotY, w: lotW, h: halfH };
      rectB = { x: lotX, y: lotY + halfH + gapWidth, w: lotW, h: halfH };
      gapRect = { x: lotX, y: lotY + halfH, w: lotW, h: gapWidth };
    } else {
      const halfW = (lotW - gapWidth) / 2;
      rectA = { x: lotX, y: lotY, w: halfW, h: lotH };
      rectB = { x: lotX + halfW + gapWidth, y: lotY, w: halfW, h: lotH };
      gapRect = { x: lotX + halfW, y: lotY, w: gapWidth, h: lotH };
    }

    const bA = this._generateBuilding(rng, `${cx}-${cy}-a`, rectA, originX, originY, district, districtId);
    const bB = this._generateBuilding(rng, `${cx}-${cy}-b`, rectB, originX, originY, district, districtId);
    bA.isAlleySegment = true;
    bB.isAlleySegment = true;

    this.alleys.push({ ...gapRect, orientation: horizontal ? 'h' : 'v' });
  }

  _scatterBuildingExtras(rng, building, district) {
    if (chance(rng, district.treeChance)) this._placeTree(rng, building);
    if (chance(rng, district.parkedVehicleChance)) this._placeParkedCar(rng, building);
    if (chance(rng, district.vendorChance || 0)) this._placeVendorCart(rng, building);
    if (chance(rng, district.entranceGlowChance || 0)) this._placeEntranceGlow(rng, building);
    if (chance(rng, district.ambientPedestrianDensity * 0.45)) {
      this._placeAmbientAnchor(rng, building);
      // Busy fronts (clubs, plazas, cafés) often draw a small knot of people, not just one.
      if (chance(rng, district.ambientPedestrianDensity * 0.4)) this._placeAmbientAnchor(rng, building);
    }
  }

  _edgePoint(building, side, t, offset) {
    switch (side) {
      case 'n':
        return { x: building.x + t * building.w, y: building.y - offset };
      case 's':
        return { x: building.x + t * building.w, y: building.y + building.h + offset };
      case 'e':
        return { x: building.x + building.w + offset, y: building.y + t * building.h };
      default:
        return { x: building.x - offset, y: building.y + t * building.h };
    }
  }

  _placeTree(rng, building) {
    const side = pick(rng, SIDES);
    const { x, y } = this._edgePoint(building, side, range(rng, 0.15, 0.85), 10);
    this.roadDecor.push({ type: 'tree', x, y });
  }

  _placeAmbientAnchor(rng, building) {
    const side = pick(rng, SIDES);
    const { x, y } = this._edgePoint(building, side, range(rng, 0.2, 0.8), 22);
    // A pedestrian anchored on a building's n/s edge walks the sidewalk along x (parallel to
    // that edge); e/w edges walk along y — so ambient walkers stay parallel to the building
    // instead of wandering in place.
    const axis = side === 'n' || side === 's' ? 'x' : 'y';
    this.ambientAnchors.push({ x, y, district: building.district, axis });
  }

  /** A small sidewalk food/coffee cart — one of a handful of street-vendor touches, not on every block. */
  _placeVendorCart(rng, building) {
    const side = pick(rng, SIDES);
    const { x, y } = this._edgePoint(building, side, range(rng, 0.2, 0.8), 14);
    this.roadDecor.push({ type: 'vendorCart', x, y });
  }

  /** A soft warm light pool on the sidewalk in front of a club/restaurant doorway. */
  _placeEntranceGlow(rng, building) {
    const side = pick(rng, SIDES);
    const { x, y } = this._edgePoint(building, side, range(rng, 0.3, 0.7), 12);
    this.roadDecor.push({ type: 'entranceGlow', x, y });
  }

  _placeParkedCar(rng, building) {
    const side = pick(rng, SIDES);
    const along = range(rng, 0.15, 0.85);
    const curbOffset = 18;
    let x, y, angle;
    if (side === 'n') {
      x = building.x + along * building.w;
      y = building.blockY - curbOffset;
      angle = 0;
    } else if (side === 's') {
      x = building.x + along * building.w;
      y = building.blockY + building.blockSize + curbOffset;
      angle = 0;
    } else if (side === 'e') {
      x = building.blockX + building.blockSize + curbOffset;
      y = building.y + along * building.h;
      angle = Math.PI / 2;
    } else {
      x = building.blockX - curbOffset;
      y = building.y + along * building.h;
      angle = Math.PI / 2;
    }
    const color = pick(rng, PARKED_CAR_COLORS);
    this.parkedVehicles.push(new Obstacle('parkedCar', x, y, { color, angle }));
  }

  _scatterPlazaDecor(rng, originX, originY, isCentral, districtId) {
    const count = Math.round(range(rng, isCentral ? 4 : 2, isCentral ? 8 : 5));
    for (let i = 0; i < count; i++) {
      this.roadDecor.push({
        type: 'tree',
        x: originX + range(rng, 20, BLOCK_SIZE - 20),
        y: originY + range(rng, 20, BLOCK_SIZE - 20),
      });
    }
    if (isCentral || chance(rng, 0.6)) {
      this.roadDecor.push({
        type: 'fountain',
        x: originX + BLOCK_SIZE / 2,
        y: originY + BLOCK_SIZE / 2,
      });
    }

    const strollerCount = isCentral ? 4 : Math.round(range(rng, 0, 2));
    for (let i = 0; i < strollerCount; i++) {
      this.ambientAnchors.push({
        x: originX + range(rng, 30, BLOCK_SIZE - 30),
        y: originY + range(rng, 30, BLOCK_SIZE - 30),
        district: districtId,
      });
    }
  }

  _scatterStreetlights(rng) {
    for (let ci = 0; ci < this.roadCenters.cols.length; ci++) {
      const colX = this.roadCenters.cols[ci];
      for (let cy = 0; cy < CITY_ROWS; cy++) {
        const district = DISTRICTS[this.districtAt(ci, cy)];
        if (chance(rng, district.streetlightChance)) {
          const y = cy * CELL_SIZE + ROAD_WIDTH + BLOCK_SIZE * range(rng, 0.15, 0.85);
          this.streetlights.push({ x: colX + ROAD_WIDTH / 2 + 6, y });
        }
      }
    }
  }

  _scatterTrafficLights(rng) {
    for (let ri = 0; ri <= CITY_ROWS; ri++) {
      for (let ci = 0; ci <= CITY_COLS; ci++) {
        const district = DISTRICTS[this.districtAt(ci, ri)];
        if (chance(rng, district.trafficLightChance * 0.4)) {
          this.trafficLights.push({ x: this.roadCenters.cols[ci], y: this.roadCenters.rows[ri] });
        }
      }
    }
  }

  /** Returns true if the world-space point lies on a road (drivable). */
  isOnRoad(x, y) {
    if (x < 0 || y < 0 || x > this.width || y > this.height) return false;
    const cellX = x % CELL_SIZE;
    const cellY = y % CELL_SIZE;
    const onRoadX = cellX < ROAD_WIDTH;
    const onRoadY = cellY < ROAD_WIDTH;
    return onRoadX || onRoadY;
  }
}
