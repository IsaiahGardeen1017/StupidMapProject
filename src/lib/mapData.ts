import type {
  Faction,
  MapData,
  ProvinceChangesByProvince,
  Participant,
  ProvinceData,
  ProvinceGeometry,
  ProvinceId,
  ProvinceParticipantRecord
} from "../DataTypes";
import { getProvincePolygons } from "./mapMath";
import factionsData from "../../data/derived/factions.json";
import participantsData from "../../data/derived/participants.json";
import generatedProvinceData from "../../data/derived/generated-provinces.json";
import provinceChangesData from "../../data/derived/province-changes.json";
import worldData from "../../data/derived/world-data.json";

type RawProvinceGeometry = ProvinceGeometry & {
  name?: string;
  participantTimeline?: ProvinceParticipantRecord[];
};

type RawProvinceData = Omit<ProvinceData, "geometry" | "participantTimeline"> & {
  geometry: ProvinceGeometry;
  participantTimeline?: ProvinceParticipantRecord[];
};

type RawProvinceLike = RawProvinceData | RawProvinceGeometry;

type RawMapData = Omit<MapData, "participants" | "factions" | "provinceChanges" | "provinces"> & {
  participants?: Record<string, Participant>;
  factions?: Record<string, Faction>;
  provinceChanges?: ProvinceChangesByProvince;
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
      participantTimeline: province.participantTimeline ?? []
    };
  }

  if (isProvinceGeometry(province)) {
    return {
      id: province.id,
      name: province.name ?? `Province ${index + 1}`,
      geometry: province,
      participantTimeline: province.participantTimeline ?? []
    };
  }

  return undefined;
}

function normalizeProvinceChanges(
  provinceChanges: ProvinceChangesByProvince
): ProvinceChangesByProvince {
  const normalizedEntries = Object.entries(provinceChanges).map(
    ([provinceId, changes]) => [
      provinceId,
      [...changes].sort((left, right) =>
        left.startDate.localeCompare(right.startDate)
      )
    ]
  );

  return Object.fromEntries(normalizedEntries) as ProvinceChangesByProvince;
}

function normalizeFactions(factions: Record<string, Faction>): Record<string, Faction> {
  return Object.fromEntries(
    Object.entries(factions).map(([factionId, faction]) => [
      factionId,
      {
        ...faction,
        memberTimeline: [...(faction.memberTimeline ?? [])].sort((left, right) =>
          left.joinDate.localeCompare(right.joinDate)
        )
      }
    ])
  );
}

function hydrateProvinceTimelines(
  provinces: ProvinceData[],
  provinceChanges: ProvinceChangesByProvince
) {
  return provinces.map((province) => ({
    ...province,
    participantTimeline: provinceChanges[province.id] ?? []
  }));
}

function normalizeMapData(rawMapData: RawMapData): MapData {
  const normalizedProvinceChanges = normalizeProvinceChanges(
    rawMapData.provinceChanges ?? {}
  );

  return {
    ...rawMapData,
    participants: rawMapData.participants ?? {},
    factions: normalizeFactions(rawMapData.factions ?? {}),
    provinceChanges: normalizedProvinceChanges,
    provinces: hydrateProvinceTimelines(
      rawMapData.provinces
        .map((province, index) =>
          normalizeProvince(province as RawProvinceLike, index)
        )
        .filter((province): province is ProvinceData => Boolean(province)),
      normalizedProvinceChanges
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
  rawFactions: Record<string, Faction>,
  rawProvinceChanges: ProvinceChangesByProvince
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
  const factions =
    Object.keys(rawFactions).length > 0
      ? normalizeFactions(rawFactions)
      : normalizedWorldData.factions;
  const provinceChanges = normalizeProvinceChanges(
    Object.keys(rawProvinceChanges).length > 0
      ? rawProvinceChanges
      : normalizedWorldData.provinceChanges
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
    factions,
    provinceChanges,
    provinces: hydrateProvinceTimelines(provinces, provinceChanges)
  };
}

export function createInitialWorldMapData() {
  return mergeMapData(
    worldData as RawMapData,
    generatedProvinceData as RawProvinceLike[],
    participantsData as Record<string, Participant>,
    factionsData as Record<string, Faction>,
    provinceChangesData as ProvinceChangesByProvince
  );
}

export function syncProvinceTimelines(mapData: MapData): MapData {
  const provinceChanges = normalizeProvinceChanges(mapData.provinceChanges);
  return {
    ...mapData,
    factions: normalizeFactions(mapData.factions),
    provinceChanges,
    provinces: hydrateProvinceTimelines(mapData.provinces, provinceChanges)
  };
}

export function applyProvinceChange(
  mapData: MapData,
  provinceId: ProvinceId,
  change: ProvinceParticipantRecord
) {
  return syncProvinceTimelines({
    ...mapData,
    provinceChanges: {
      ...mapData.provinceChanges,
      [provinceId]: [
        ...(mapData.provinceChanges[provinceId] ?? []).filter(
          (entry) => entry.startDate !== change.startDate
        ),
        change
      ]
    }
  });
}

export function deleteProvinceChangeAtDate(
  mapData: MapData,
  provinceId: ProvinceId,
  startDate: string
) {
  return syncProvinceTimelines({
    ...mapData,
    provinceChanges: {
      ...mapData.provinceChanges,
      [provinceId]: (mapData.provinceChanges[provinceId] ?? []).filter(
        (entry) => entry.startDate !== startDate
      )
    }
  });
}
