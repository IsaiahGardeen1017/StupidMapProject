import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ProvinceGeometry, ProvinceId, ProjectedPoint } from "../src/DataTypes.js";
import { MAP_IMPORT_CONFIG } from "../src/global-configs.js";
import { resolveRepoPath } from "./lib/nodeUtils.js";

type PixelPoint = {
  x: number;
  y: number;
};

type RegionAccumulator = {
  id: ProvinceId;
  pixels: PixelPoint[];
  pixelSet: Set<string>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type BoundaryStep = {
  start: ProjectedPoint;
  end: ProjectedPoint;
  neighborId: ProvinceId | null;
};

type BoundaryChain = {
  provinceId: ProvinceId;
  neighborId: ProvinceId | null;
  steps: BoundaryStep[];
  signature: string;
  isClosed: boolean;
  startKey: string;
  endKey: string;
};

type SimplifiedChainRecord = {
  points: ProjectedPoint[];
  startKey: string;
  endKey: string;
  isClosed: boolean;
};

function toProvinceId(red: number, green: number, blue: number): ProvinceId {
  const color = `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
  return color as ProvinceId;
}

function getPixelOffset(x: number, y: number, width: number) {
  return (y * width + x) * 4;
}

function isOpaqueAlpha(alpha: number) {
  return alpha >= 250;
}

function toPointKey(point: PixelPoint) {
  return `${point.x},${point.y}`;
}

function toVertexKey(x: number, y: number) {
  return `${x},${y}`;
}

function simplifyOrthogonalRing(ring: ProjectedPoint[]) {
  if (ring.length < 3) {
    return ring;
  }

  const simplified: ProjectedPoint[] = [];
  const points = [...ring, ring[0], ring[1]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    const isCollinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!isCollinear) {
      simplified.push(current);
    }
  }

  return simplified;
}

function getDistanceFromLine(
  point: ProjectedPoint,
  start: ProjectedPoint,
  end: ProjectedPoint
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;

  if (squaredLength === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  return Math.abs(
    deltaY * point.x -
      deltaX * point.y +
      end.x * start.y -
      end.y * start.x
  ) / Math.sqrt(squaredLength);
}

function pushIfDistinct(target: ProjectedPoint[], point: ProjectedPoint) {
  const previous = target.at(-1);
  if (!previous || previous.x !== point.x || previous.y !== point.y) {
    target.push(point);
  }
}

function reversePoints(points: ProjectedPoint[]) {
  return [...points].reverse();
}

function simplifyPolyline(points: ProjectedPoint[]): ProjectedPoint[] {
  const tolerance = MAP_IMPORT_CONFIG.provinceSimplifyTolerance;
  if (points.length <= 2 || tolerance <= 0) {
    return points;
  }

  let maxDistance = -1;
  let splitIndex = -1;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getDistanceFromLine(
      points[index],
      points[0],
      points[points.length - 1]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance || splitIndex === -1) {
    return [points[0], points[points.length - 1]];
  }

  const left: ProjectedPoint[] = simplifyPolyline(
    points.slice(0, splitIndex + 1)
  );
  const right: ProjectedPoint[] = simplifyPolyline(points.slice(splitIndex));
  return [...left.slice(0, -1), ...right];
}

function buildChainPoints(steps: BoundaryStep[]) {
  const points = [steps[0].start];
  for (const step of steps) {
    points.push(step.end);
  }

  return points;
}

function toUndirectedEdgeKey(start: ProjectedPoint, end: ProjectedPoint) {
  const startKey = toVertexKey(start.x, start.y);
  const endKey = toVertexKey(end.x, end.y);
  return startKey < endKey
    ? `${startKey}|${endKey}`
    : `${endKey}|${startKey}`;
}

function buildChainSignature(
  provinceId: ProvinceId,
  neighborId: ProvinceId | null,
  steps: BoundaryStep[]
) {
  const sortedPair = [provinceId, neighborId ?? "void"].sort().join("::");
  const edgeSignature = steps
    .map((step) => toUndirectedEdgeKey(step.start, step.end))
    .sort()
    .join(";");
  return `${sortedPair}::${edgeSignature}`;
}

function rotateStepsToNeighborBoundary(steps: BoundaryStep[]) {
  for (let index = 0; index < steps.length; index += 1) {
    const previous = steps[(index - 1 + steps.length) % steps.length];
    const current = steps[index];
    if (previous.neighborId !== current.neighborId) {
      return [...steps.slice(index), ...steps.slice(0, index)];
    }
  }

  return steps;
}

function splitStepsIntoNeighborChains(
  provinceId: ProvinceId,
  steps: BoundaryStep[]
): BoundaryChain[] {
  if (steps.length === 0) {
    return [];
  }

  const rotatedSteps = rotateStepsToNeighborBoundary(steps);
  const hasNeighborChanges = rotatedSteps.some(
    (step, index) =>
      step.neighborId !==
      rotatedSteps[(index - 1 + rotatedSteps.length) % rotatedSteps.length]
        .neighborId
  );

  if (!hasNeighborChanges) {
    return [
      {
        provinceId,
        neighborId: rotatedSteps[0].neighborId,
        steps: rotatedSteps,
        signature: buildChainSignature(
          provinceId,
          rotatedSteps[0].neighborId,
          rotatedSteps
        ),
        isClosed: true,
        startKey: toVertexKey(rotatedSteps[0].start.x, rotatedSteps[0].start.y),
        endKey: toVertexKey(
          rotatedSteps[rotatedSteps.length - 1].end.x,
          rotatedSteps[rotatedSteps.length - 1].end.y
        )
      }
    ];
  }

  const chains: BoundaryChain[] = [];
  let chainStart = 0;

  while (chainStart < rotatedSteps.length) {
    let chainEnd = chainStart + 1;
    while (
      chainEnd < rotatedSteps.length &&
      rotatedSteps[chainEnd].neighborId === rotatedSteps[chainStart].neighborId
    ) {
      chainEnd += 1;
    }

    const chainSteps = rotatedSteps.slice(chainStart, chainEnd);
    chains.push({
      provinceId,
      neighborId: chainSteps[0].neighborId,
      steps: chainSteps,
      signature: buildChainSignature(provinceId, chainSteps[0].neighborId, chainSteps),
      isClosed: false,
      startKey: toVertexKey(chainSteps[0].start.x, chainSteps[0].start.y),
      endKey: toVertexKey(
        chainSteps[chainSteps.length - 1].end.x,
        chainSteps[chainSteps.length - 1].end.y
      )
    });

    chainStart = chainEnd;
  }

  return chains;
}

function simplifyClosedUniformNeighborRing(points: ProjectedPoint[]) {
  if (points.length <= 3) {
    return points;
  }

  let pivotA = 0;
  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index];
    const current = points[pivotA];
    if (
      candidate.x < current.x ||
      (candidate.x === current.x && candidate.y < current.y)
    ) {
      pivotA = index;
    }
  }

  let pivotB = (pivotA + Math.floor(points.length / 2)) % points.length;
  let maxSquaredDistance = -1;
  for (let index = 0; index < points.length; index += 1) {
    if (index === pivotA) {
      continue;
    }

    const deltaX = points[index].x - points[pivotA].x;
    const deltaY = points[index].y - points[pivotA].y;
    const squaredDistance = deltaX * deltaX + deltaY * deltaY;
    if (squaredDistance > maxSquaredDistance) {
      maxSquaredDistance = squaredDistance;
      pivotB = index;
    }
  }

  const forward: ProjectedPoint[] = [];
  for (let index = pivotA; ; index = (index + 1) % points.length) {
    forward.push(points[index]);
    if (index === pivotB) {
      break;
    }
  }

  const backward: ProjectedPoint[] = [];
  for (let index = pivotB; ; index = (index + 1) % points.length) {
    backward.push(points[index]);
    if (index === pivotA) {
      break;
    }
  }

  const simplifiedForward = simplifyPolyline(forward);
  const simplifiedBackward = simplifyPolyline(backward);
  return [...simplifiedForward, ...simplifiedBackward.slice(1, -1)];
}

function getNeighborId(
  x: number,
  y: number,
  width: number,
  height: number,
  data: Buffer<ArrayBufferLike>
) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return null;
  }

  const offset = getPixelOffset(x, y, width);
  if (!isOpaqueAlpha(data[offset + 3])) {
    return null;
  }

  return toProvinceId(data[offset], data[offset + 1], data[offset + 2]);
}

function traceExteriorSteps(
  region: RegionAccumulator,
  width: number,
  height: number,
  data: Buffer<ArrayBufferLike>
): BoundaryStep[] {
  const stepsByStartVertex = new Map<string, BoundaryStep>();

  for (const pixel of region.pixels) {
    const left = pixel.x - 1;
    const right = pixel.x + 1;
    const top = pixel.y - 1;
    const bottom = pixel.y + 1;

    if (!region.pixelSet.has(`${pixel.x},${top}`)) {
      stepsByStartVertex.set(toVertexKey(pixel.x, pixel.y), {
        start: { x: pixel.x, y: pixel.y },
        end: { x: pixel.x + 1, y: pixel.y },
        neighborId: getNeighborId(pixel.x, top, width, height, data)
      });
    }

    if (!region.pixelSet.has(`${right},${pixel.y}`)) {
      stepsByStartVertex.set(toVertexKey(pixel.x + 1, pixel.y), {
        start: { x: pixel.x + 1, y: pixel.y },
        end: { x: pixel.x + 1, y: pixel.y + 1 },
        neighborId: getNeighborId(right, pixel.y, width, height, data)
      });
    }

    if (!region.pixelSet.has(`${pixel.x},${bottom}`)) {
      stepsByStartVertex.set(toVertexKey(pixel.x + 1, pixel.y + 1), {
        start: { x: pixel.x + 1, y: pixel.y + 1 },
        end: { x: pixel.x, y: pixel.y + 1 },
        neighborId: getNeighborId(pixel.x, bottom, width, height, data)
      });
    }

    if (!region.pixelSet.has(`${left},${pixel.y}`)) {
      stepsByStartVertex.set(toVertexKey(pixel.x, pixel.y + 1), {
        start: { x: pixel.x, y: pixel.y + 1 },
        end: { x: pixel.x, y: pixel.y },
        neighborId: getNeighborId(left, pixel.y, width, height, data)
      });
    }
  }

  const firstVertex = stepsByStartVertex.keys().next().value as
    | string
    | undefined;
  if (!firstVertex) {
    return [];
  }

  const steps: BoundaryStep[] = [];
  let currentVertex = firstVertex;
  const guard = stepsByStartVertex.size + 5;

  for (let index = 0; index < guard; index += 1) {
    const step = stepsByStartVertex.get(currentVertex);
    if (!step) {
      break;
    }

    steps.push(step);
    currentVertex = toVertexKey(step.end.x, step.end.y);
    if (currentVertex === firstVertex) {
      break;
    }
  }

  return steps;
}

function computeCentroid(points: PixelPoint[]): ProjectedPoint {
  const sum = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function simplifyChain(chain: BoundaryChain): SimplifiedChainRecord {
  const rawPoints = buildChainPoints(chain.steps);
  const simplifiedPoints = chain.isClosed
    ? simplifyClosedUniformNeighborRing(rawPoints.slice(0, -1))
    : simplifyPolyline(rawPoints);
  const points =
    (chain.isClosed && simplifiedPoints.length < 3) ||
    (!chain.isClosed && simplifiedPoints.length < 2)
      ? chain.isClosed
        ? rawPoints.slice(0, -1)
        : rawPoints
      : simplifiedPoints;

  return {
    points,
    startKey: chain.startKey,
    endKey: chain.endKey,
    isClosed: chain.isClosed
  };
}

function orientChainPoints(
  chain: BoundaryChain,
  record: SimplifiedChainRecord
): ProjectedPoint[] {
  if (record.isClosed) {
    return record.points;
  }

  if (chain.startKey === record.startKey && chain.endKey === record.endKey) {
    return record.points;
  }

  if (chain.startKey === record.endKey && chain.endKey === record.startKey) {
    return reversePoints(record.points);
  }

  return record.points;
}

function buildChainCache(chains: BoundaryChain[]) {
  const cache = new Map<string, SimplifiedChainRecord>();

  for (const chain of chains) {
    if (!cache.has(chain.signature)) {
      cache.set(chain.signature, simplifyChain(chain));
    }
  }

  return cache;
}

function assembleProvinceRing(
  provinceId: ProvinceId,
  steps: BoundaryStep[],
  chainCache: Map<string, SimplifiedChainRecord>
) {
  const rawRing = simplifyOrthogonalRing(
    buildChainPoints(steps).slice(0, -1)
  );

  const chains = splitStepsIntoNeighborChains(provinceId, steps);
  if (chains.length === 1 && chains[0].isClosed) {
    const chain = chains[0];
    const record = chainCache.get(chain.signature);
    if (!record) {
      return rawRing;
    }

    const ring = simplifyOrthogonalRing(orientChainPoints(chain, record));
    return ring.length >= 3 ? ring : rawRing;
  }

  const ring: ProjectedPoint[] = [];
  for (const chain of chains) {
    const record = chainCache.get(chain.signature);
    if (!record) {
      continue;
    }

    const points = orientChainPoints(chain, record);
    for (const point of points) {
      pushIfDistinct(ring, point);
    }
  }

  if (
    ring.length > 1 &&
    ring[0].x === ring[ring.length - 1].x &&
    ring[0].y === ring[ring.length - 1].y
  ) {
    ring.pop();
  }

  const simplifiedRing = simplifyOrthogonalRing(ring);
  return simplifiedRing.length >= 3 ? simplifiedRing : rawRing;
}

function toProvinceGeometry(
  region: RegionAccumulator,
  exteriorRing: ProjectedPoint[]
): ProvinceGeometry {
  const centroid = computeCentroid(region.pixels);

  return {
    id: region.id,
    exteriorRing,
    holes: [],
    centroid,
    area: region.pixels.length,
    pixelCount: region.pixels.length,
    boundingBox: {
      minX: region.minX,
      minY: region.minY,
      maxX: region.maxX + 1,
      maxY: region.maxY + 1
    }
  };
}

function collectRegions(imagePath: string) {
  const png = PNG.sync.read(fs.readFileSync(imagePath));
  const { width, height, data } = png;
  const visited = new Uint8Array(width * height);
  const regions: RegionAccumulator[] = [];

  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const startIndex = startY * width + startX;
      if (visited[startIndex] === 1) {
        continue;
      }

      const startOffset = getPixelOffset(startX, startY, width);
      const alpha = data[startOffset + 3];
      if (!isOpaqueAlpha(alpha)) {
        visited[startIndex] = 1;
        continue;
      }

      const id = toProvinceId(
        data[startOffset],
        data[startOffset + 1],
        data[startOffset + 2]
      );
      const queue: PixelPoint[] = [{ x: startX, y: startY }];
      const queued = new Set<string>([toPointKey({ x: startX, y: startY })]);
      const region: RegionAccumulator = {
        id,
        pixels: [],
        pixelSet: new Set<string>(),
        minX: startX,
        minY: startY,
        maxX: startX,
        maxY: startY
      };

      while (queue.length > 0) {
        const current = queue.pop()!;
        const currentIndex = current.y * width + current.x;
        const currentOffset = getPixelOffset(current.x, current.y, width);
        const currentColor = toProvinceId(
          data[currentOffset],
          data[currentOffset + 1],
          data[currentOffset + 2]
        );
        const currentAlpha = data[currentOffset + 3];

        if (!isOpaqueAlpha(currentAlpha) || currentColor !== id) {
          continue;
        }

        if (visited[currentIndex] === 1) {
          continue;
        }

        visited[currentIndex] = 1;

        region.pixels.push(current);
        region.minX = Math.min(region.minX, current.x);
        region.minY = Math.min(region.minY, current.y);
        region.maxX = Math.max(region.maxX, current.x);
        region.maxY = Math.max(region.maxY, current.y);
        region.pixelSet.add(toPointKey(current));

        const neighbors: PixelPoint[] = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 }
        ];

        for (const neighbor of neighbors) {
          if (
            neighbor.x < 0 ||
            neighbor.x >= width ||
            neighbor.y < 0 ||
            neighbor.y >= height
          ) {
            continue;
          }

          const neighborIndex = neighbor.y * width + neighbor.x;
          if (visited[neighborIndex] === 1) {
            continue;
          }

          const neighborKey = toPointKey(neighbor);
          if (queued.has(neighborKey)) {
            continue;
          }

          queued.add(neighborKey);
          queue.push(neighbor);
        }
      }

      if (region.pixels.length > 0) {
        regions.push(region);
      }
    }
  }

  return regions;
}

async function main() {
  const inputPath =
    process.argv[2] ??
    resolveRepoPath("data", "derived", "province-id-map.png");
  const outputPath =
    process.argv[3] ??
    resolveRepoPath("data", "derived", "generated-provinces.json");

  const png = PNG.sync.read(fs.readFileSync(inputPath));
  const regions = collectRegions(inputPath);
  const boundaryStepsByProvince = new Map<ProvinceId, BoundaryStep[]>();
  const allChains: BoundaryChain[] = [];

  for (const region of regions) {
    const steps = traceExteriorSteps(region, png.width, png.height, png.data);
    boundaryStepsByProvince.set(region.id, steps);
    allChains.push(...splitStepsIntoNeighborChains(region.id, steps));
  }

  const chainCache = buildChainCache(allChains);
  const provinces = regions.map((region) =>
    toProvinceGeometry(
      region,
      assembleProvinceRing(
        region.id,
        boundaryStepsByProvince.get(region.id) ?? [],
        chainCache
      )
    )
  );
  fs.writeFileSync(outputPath, JSON.stringify(provinces, null, 2), "utf8");
  console.log(`Wrote ${path.resolve(outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
