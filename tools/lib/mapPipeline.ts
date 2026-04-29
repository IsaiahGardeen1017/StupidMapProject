import type {
    BoundingBox,
    LonLat,
    ProjectedPoint,
    ProjectionDefinition,
} from "../../src/DataTypes.js";

export const EUROPE_AUTHORING_PROJECTION: ProjectionDefinition = {
    id: "europe-lcc",
    label: "Europe Lambert Conformal Conic",
    projection: {
        kind: "lambert-conformal-conic",
        centralMeridian: 13,
        latitudeOfOrigin: 50,
        standardParallel1: 42.5,
        standardParallel2: 19.5,
    },
    bounds: {
        minLongitude: -8,
        maxLongitude: 37.5,
        minLatitude: 29,
        maxLatitude: 59,
    },
    width: 4096,
    height: 3072,
    padding: 120,
};

const EARTH_RADIUS_METERS = 6378137;

function degreesToRadians(value: number): number {
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

    const n = Math.log(Math.cos(phi1) / Math.cos(phi2)) /
        Math.log(
            Math.tan(Math.PI / 4 + phi2 / 2) /
                Math.tan(Math.PI / 4 + phi1 / 2),
        );
    const f = (Math.cos(phi1) * Math.pow(Math.tan(Math.PI / 4 + phi1 / 2), n)) /
        n;
    const rho0 = EARTH_RADIUS_METERS *
        f *
        Math.pow(Math.tan(Math.PI / 4 + phi0 / 2), -n);

    return { lambda0, n, f, rho0 };
}

function buildEquirectangularConstants(definition: ProjectionDefinition) {
    const projection = definition.projection;

    if (projection.kind !== "equirectangular") {
        throw new Error(`Unsupported projection kind: ${projection.kind}`);
    }

    return {
        lambda0: degreesToRadians(projection.centralMeridian),
        phi1: degreesToRadians(projection.standardParallel ?? 0),
    };
}

function projectRawPoint(
    coordinates: LonLat,
    definition: ProjectionDefinition,
): ProjectedPoint {
    const projection = definition.projection;
    if (projection.kind === "lambert-conformal-conic") {
        const { lambda0, n, f, rho0 } = buildLambertConstants(definition);
        const phi = degreesToRadians(coordinates.latitude);
        const lambda = degreesToRadians(coordinates.longitude);
        const rho = EARTH_RADIUS_METERS *
            f *
            Math.pow(Math.tan(Math.PI / 4 + phi / 2), -n);
        const theta = n * (lambda - lambda0);

        return {
            x: rho * Math.sin(theta),
            y: rho0 - rho * Math.cos(theta),
        };
    }

    if (projection.kind === "equirectangular") {
        const { lambda0, phi1 } = buildEquirectangularConstants(definition);
        const phi = degreesToRadians(coordinates.latitude);
        const lambda = degreesToRadians(coordinates.longitude);

        return {
            x: EARTH_RADIUS_METERS * (lambda - lambda0) * Math.cos(phi1),
            y: EARTH_RADIUS_METERS * phi,
        };
    }

    const unsupportedProjection: never = projection;
    throw new Error(
        `Unsupported projection kind: ${String(unsupportedProjection)}`,
    );
}

export function getProjectionExtent(definition: ProjectionDefinition) {
    const corners: LonLat[] = [
        {
            longitude: definition.bounds.minLongitude,
            latitude: definition.bounds.minLatitude,
        },
        {
            longitude: definition.bounds.maxLongitude,
            latitude: definition.bounds.minLatitude,
        },
        {
            longitude: definition.bounds.maxLongitude,
            latitude: definition.bounds.maxLatitude,
        },
        {
            longitude: definition.bounds.minLongitude,
            latitude: definition.bounds.maxLatitude,
        },
    ];

    const projected = corners.map((coordinates) =>
        projectRawPoint(coordinates, definition)
    );

    return {
        minX: Math.min(...projected.map((point) => point.x)),
        minY: Math.min(...projected.map((point) => point.y)),
        maxX: Math.max(...projected.map((point) => point.x)),
        maxY: Math.max(...projected.map((point) => point.y)),
    };
}

export function projectLonLat(
    coordinates: LonLat,
    definition: ProjectionDefinition,
): ProjectedPoint {
    const projected = projectRawPoint(coordinates, definition);
    const extent = getProjectionExtent(definition);
    const usableWidth = definition.width - definition.padding * 2;
    const usableHeight = definition.height - definition.padding * 2;

    const normalizedX = (projected.x - extent.minX) /
        (extent.maxX - extent.minX);
    const normalizedY = (projected.y - extent.minY) /
        (extent.maxY - extent.minY);

    return {
        x: definition.padding + normalizedX * usableWidth,
        y: definition.height -
            (definition.padding + normalizedY * usableHeight),
    };
}

export function isInsideBounds(
    coordinates: LonLat,
    bounds: BoundingBox,
): boolean {
    return (
        coordinates.longitude >= bounds.minLongitude &&
        coordinates.longitude <= bounds.maxLongitude &&
        coordinates.latitude >= bounds.minLatitude &&
        coordinates.latitude <= bounds.maxLatitude
    );
}

export function getSvgHeader(
    definition: ProjectionDefinition,
    backgroundColor = "transparent",
): string {
    return [
        `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${definition.width} ${definition.height}" width="${definition.width}" height="${definition.height}">`,
        `<rect x="0" y="0" width="${definition.width}" height="${definition.height}" fill="${backgroundColor}" />`,
    ].join("");
}

export function getSvgFooter(): string {
    return "</svg>";
}
