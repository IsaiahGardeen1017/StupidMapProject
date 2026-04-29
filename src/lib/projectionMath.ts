import type { LonLat, ProjectionDefinition, ProjectedPoint } from "../DataTypes";

const EARTH_RADIUS_METERS = 6378137;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function buildLambertConstants(definition: ProjectionDefinition) {
  const projection = definition.projection;

  if (projection.kind !== "lambert-conformal-conic") {
    throw new Error(`Unsupported projection kind: ${projection.kind}`);
  }

  const phi1 = degreesToRadians(projection.standardParallel1);
  const phi2 = degreesToRadians(projection.standardParallel2);
  const phi0 = degreesToRadians(projection.latitudeOfOrigin);
  const lambda0 = degreesToRadians(projection.centralMeridian);

  const n = Math.log(Math.cos(phi1) / Math.cos(phi2)) / Math.log(Math.tan(Math.PI / 4 + phi2 / 2) / Math.tan(Math.PI / 4 + phi1 / 2));
  const f = (Math.cos(phi1) * Math.pow(Math.tan(Math.PI / 4 + phi1 / 2), n)) / n;
  const rho0 = EARTH_RADIUS_METERS * f * Math.pow(Math.tan(Math.PI / 4 + phi0 / 2), -n);

  return { lambda0, n, f, rho0 };
}

function projectRawPoint(coordinates: LonLat, definition: ProjectionDefinition): ProjectedPoint {
  const projection = definition.projection;
  if (projection.kind !== "lambert-conformal-conic") {
    throw new Error(`Unsupported projection kind: ${projection.kind}`);
  }

  const { lambda0, n, f, rho0 } = buildLambertConstants(definition);
  const phi = degreesToRadians(coordinates.latitude);
  const lambda = degreesToRadians(coordinates.longitude);
  const rho = EARTH_RADIUS_METERS * f * Math.pow(Math.tan(Math.PI / 4 + phi / 2), -n);
  const theta = n * (lambda - lambda0);

  return {
    x: rho * Math.sin(theta),
    y: rho0 - rho * Math.cos(theta)
  };
}

export function getProjectionExtent(definition: ProjectionDefinition) {
  const corners: LonLat[] = [
    {
      longitude: definition.bounds.minLongitude,
      latitude: definition.bounds.minLatitude
    },
    {
      longitude: definition.bounds.maxLongitude,
      latitude: definition.bounds.minLatitude
    },
    {
      longitude: definition.bounds.maxLongitude,
      latitude: definition.bounds.maxLatitude
    },
    {
      longitude: definition.bounds.minLongitude,
      latitude: definition.bounds.maxLatitude
    }
  ];

  const projected = corners.map((coordinates) => projectRawPoint(coordinates, definition));

  return {
    minX: Math.min(...projected.map((point) => point.x)),
    minY: Math.min(...projected.map((point) => point.y)),
    maxX: Math.max(...projected.map((point) => point.x)),
    maxY: Math.max(...projected.map((point) => point.y))
  };
}

export function projectLonLat(coordinates: LonLat, definition: ProjectionDefinition): ProjectedPoint {
  const projected = projectRawPoint(coordinates, definition);
  const extent = getProjectionExtent(definition);
  const usableWidth = definition.width - definition.padding * 2;
  const usableHeight = definition.height - definition.padding * 2;

  const normalizedX = (projected.x - extent.minX) / (extent.maxX - extent.minX);
  const normalizedY = (projected.y - extent.minY) / (extent.maxY - extent.minY);

  return {
    x: definition.padding + normalizedX * usableWidth,
    y: definition.height - (definition.padding + normalizedY * usableHeight)
  };
}
