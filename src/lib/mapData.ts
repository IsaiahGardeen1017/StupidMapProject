import type { MapData, ProvinceData, ProvinceGeometry } from "../DataTypes";
import generatedProvinceData from "../../data/derived/generated-provinces.json";
import worldData from "../../data/derived/world-data.json";

type RawProvinceGeometry = ProvinceGeometry & {
  name?: string;
  ownerTimeline?: ProvinceData["ownerTimeline"];
};

type RawProvinceData = Omit<ProvinceData, "geometry"> & {
  geometry: ProvinceGeometry;
};

type RawProvinceLike = RawProvinceData | RawProvinceGeometry;

type RawMapData = Omit<MapData, "provinces"> & {
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

function normalizeMapData(rawMapData: RawMapData): MapData {
  return {
    ...rawMapData,
    provinces: rawMapData.provinces
      .map((province, index) =>
        normalizeProvince(province as RawProvinceLike, index)
      )
      .filter((province): province is ProvinceData => Boolean(province))
  };
}

function buildProvinceMetadataMap(provinces: ProvinceData[]) {
  const provinceMap = new Map<
    string,
    Pick<ProvinceData, "name" | "ownerTimeline">
  >();

  for (const province of provinces) {
    if (!provinceMap.has(province.id)) {
      provinceMap.set(province.id, {
        name: province.name,
        ownerTimeline: province.ownerTimeline
      });
    }
  }

  return provinceMap;
}

function mergeMapData(
  rawWorldData: RawMapData,
  rawGeneratedProvinceData: RawProvinceLike[]
): MapData {
  const normalizedWorldData = normalizeMapData(rawWorldData);
  const normalizedGeneratedProvinces = rawGeneratedProvinceData
    .map((province, index) => normalizeProvince(province, index))
    .filter((province): province is ProvinceData => Boolean(province));
  const metadataByProvinceId = buildProvinceMetadataMap(
    normalizedWorldData.provinces
  );

  const mergedProvinces =
    normalizedGeneratedProvinces.length > 0
      ? normalizedGeneratedProvinces.map((province, index) => {
          const metadata = metadataByProvinceId.get(province.id);
          return {
            ...province,
            name: metadata?.name ?? province.name ?? `Province ${index + 1}`,
            ownerTimeline: metadata?.ownerTimeline ?? province.ownerTimeline
          };
        })
      : normalizedWorldData.provinces;

  return {
    ...normalizedWorldData,
    provinces: mergedProvinces
  };
}

export const worldMapData = mergeMapData(
  worldData as RawMapData,
  generatedProvinceData as RawProvinceLike[]
);
