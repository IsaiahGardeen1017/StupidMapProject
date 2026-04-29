import type {
  MapData,
  OwnershipChangesByProvince,
  Participant,
  ProvinceData,
  ProvinceGeometry,
  ProvinceId,
  ProvinceOwnerRecord
} from "../DataTypes";
import { getProvincePolygons } from "./mapMath";
import factionsData from "../../data/derived/factions.json";
import generatedProvinceData from "../../data/derived/generated-provinces.json";
import ownershipChangesData from "../../data/derived/ownership-changes.json";
import worldData from "../../data/derived/world-data.json";

type RawProvinceGeometry = ProvinceGeometry & {
  name?: string;
  ownerTimeline?: ProvinceOwnerRecord[];
};

type RawProvinceData = Omit<ProvinceData, "geometry" | "ownerTimeline"> & {
  geometry: ProvinceGeometry;
  ownerTimeline?: ProvinceOwnerRecord[];
};

type RawProvinceLike = RawProvinceData | RawProvinceGeometry;

type RawMapData = Omit<MapData, "participants" | "ownershipChanges" | "provinces"> & {
  participants?: Record<string, Participant>;
  ownershipChanges?: OwnershipChangesByProvince;
  provinces: RawProvinceLike[];
};

function isProvinceGeometry(value: unknown): value is ProvinceGeometry {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Array.isArray((value as ProvinceGeometry).exteriorRing);
}

function hasGeometryProperty(
  province: RawProvinceLike
): province is RawProvinceData {
  return "geometry" in province && isProvinceGeometry(province.geometry);
}

function normalizeProvince(province: RawProvinceLike, index: number) {
  if (hasGeometryProperty(province)) {
    return {
      id: province.id ?? province.geometry.id,
      name: province.name ?? `Province ${index + 1}`,
      geometry: province.geometry,
      ownerTimeline: province.ownerTimeline ?? []
    };
  }

  if (isProvinceGeometry(province)) {
    return {
      id: province.id,
      name: province.name ?? `Province ${index + 1}`,
      geometry: province,
      ownerTimeline: province.ownerTimeline ?? []
    };
  }

  return undefined;
}

function normalizeOwnershipChanges(
  ownershipChanges: OwnershipChangesByProvince
): OwnershipChangesByProvince {
  const normalizedEntries = Object.entries(ownershipChanges).map(
    ([provinceId, changes]) => [
      provinceId,
      [...changes].sort((left, right) =>
        left.startDate.localeCompare(right.startDate)
      )
    ]
  );

  return Object.fromEntries(normalizedEntries) as OwnershipChangesByProvince;
}

function hydrateProvinceTimelines(
  provinces: ProvinceData[],
  ownershipChanges: OwnershipChangesByProvince
) {
  return provinces.map((province) => ({
    ...province,
    ownerTimeline: ownershipChanges[province.id] ?? []
  }));
}

function normalizeMapData(rawMapData: RawMapData): MapData {
  const normalizedOwnershipChanges = normalizeOwnershipChanges(
    rawMapData.ownershipChanges ?? {}
  );

  return {
    ...rawMapData,
    participants: rawMapData.participants ?? {},
    ownershipChanges: normalizedOwnershipChanges,
    provinces: hydrateProvinceTimelines(
      rawMapData.provinces
        .map((province, index) =>
          normalizeProvince(province as RawProvinceLike, index)
        )
        .filter((province): province is ProvinceData => Boolean(province)),
      normalizedOwnershipChanges
    )
  };
}

function buildProvinceMetadataMap(provinces: ProvinceData[]) {
  const provinceMap = new Map<ProvinceId, Pick<ProvinceData, "name">>();

  for (const province of provinces) {
    if (!provinceMap.has(province.id)) {
      provinceMap.set(province.id, {
        name: province.name
      });
    }
  }

  return provinceMap;
}

function mergeProvinceGeometriesById(provinces: ProvinceData[]): ProvinceData[] {
  const mergedById = new Map<ProvinceId, ProvinceData>();

  for (const province of provinces) {
    const existing = mergedById.get(province.id);
    if (!existing) {
      mergedById.set(province.id, {
        ...province,
        geometry: {
          ...province.geometry,
          polygons: getProvincePolygons(province.geometry)
        }
      });
      continue;
    }

    const existingPolygons = getProvincePolygons(existing.geometry);
    const nextPolygons = getProvincePolygons(province.geometry);
    const nextArea = existing.geometry.area + province.geometry.area;
    const nextPixelCount = existing.geometry.pixelCount + province.geometry.pixelCount;
    const existingWeight = existing.geometry.area;
    const nextWeight = province.geometry.area;
    const weightTotal = existingWeight + nextWeight;

    existing.geometry = {
      ...existing.geometry,
      polygons: [...existingPolygons, ...nextPolygons],
      area: nextArea,
      pixelCount: nextPixelCount,
      centroid:
        weightTotal > 0
          ? {
              x:
                (existing.geometry.centroid.x * existingWeight +
                  province.geometry.centroid.x * nextWeight) /
                weightTotal,
              y:
                (existing.geometry.centroid.y * existingWeight +
                  province.geometry.centroid.y * nextWeight) /
                weightTotal
            }
          : existing.geometry.centroid,
      boundingBox: {
        minX: Math.min(existing.geometry.boundingBox.minX, province.geometry.boundingBox.minX),
        minY: Math.min(existing.geometry.boundingBox.minY, province.geometry.boundingBox.minY),
        maxX: Math.max(existing.geometry.boundingBox.maxX, province.geometry.boundingBox.maxX),
        maxY: Math.max(existing.geometry.boundingBox.maxY, province.geometry.boundingBox.maxY)
      }
    };
  }

  return [...mergedById.values()];
}

function mergeMapData(
  rawWorldData: RawMapData,
  rawGeneratedProvinceData: RawProvinceLike[],
  rawParticipants: Record<string, Participant>,
  rawOwnershipChanges: OwnershipChangesByProvince
): MapData {
  const normalizedWorldData = normalizeMapData(rawWorldData);
  const normalizedGeneratedProvinces = rawGeneratedProvinceData
    .map((province, index) => normalizeProvince(province, index))
    .filter((province): province is ProvinceData => Boolean(province));
  const mergedGeneratedProvinces = mergeProvinceGeometriesById(
    normalizedGeneratedProvinces
  );
  const provinceMetadata = buildProvinceMetadataMap(normalizedWorldData.provinces);

  const participants =
    Object.keys(rawParticipants).length > 0
      ? rawParticipants
      : normalizedWorldData.participants;
  const ownershipChanges = normalizeOwnershipChanges(
    Object.keys(rawOwnershipChanges).length > 0
      ? rawOwnershipChanges
      : normalizedWorldData.ownershipChanges
  );

  const provinces =
    mergedGeneratedProvinces.length > 0
      ? mergedGeneratedProvinces.map((province, index) => ({
          ...province,
          name:
            provinceMetadata.get(province.id)?.name ??
            province.name ??
            `Province ${index + 1}`
        }))
      : normalizedWorldData.provinces;

  return {
    ...normalizedWorldData,
    participants,
    ownershipChanges,
    provinces: hydrateProvinceTimelines(provinces, ownershipChanges)
  };
}

export function createInitialWorldMapData() {
  return mergeMapData(
    worldData as RawMapData,
    generatedProvinceData as RawProvinceLike[],
    factionsData as Record<string, Participant>,
    ownershipChangesData as OwnershipChangesByProvince
  );
}

export function syncProvinceTimelines(mapData: MapData): MapData {
  const ownershipChanges = normalizeOwnershipChanges(mapData.ownershipChanges);
  return {
    ...mapData,
    ownershipChanges,
    provinces: hydrateProvinceTimelines(mapData.provinces, ownershipChanges)
  };
}

export function applyOwnershipChange(
  mapData: MapData,
  provinceId: ProvinceId,
  change: ProvinceOwnerRecord
) {
  return syncProvinceTimelines({
    ...mapData,
    ownershipChanges: {
      ...mapData.ownershipChanges,
      [provinceId]: [
        ...(mapData.ownershipChanges[provinceId] ?? []).filter(
          (entry) => entry.startDate !== change.startDate
        ),
        change
      ]
    }
  });
}

export function deleteOwnershipChangeAtDate(
  mapData: MapData,
  provinceId: ProvinceId,
  startDate: string
) {
  return syncProvinceTimelines({
    ...mapData,
    ownershipChanges: {
      ...mapData.ownershipChanges,
      [provinceId]: (mapData.ownershipChanges[provinceId] ?? []).filter(
        (entry) => entry.startDate !== startDate
      )
    }
  });
}
