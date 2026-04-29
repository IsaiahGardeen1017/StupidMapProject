import type {
  DateString,
  MapData,
  Participant,
  ProjectedPoint,
  ProvinceGeometry,
  ProvincePolygon,
  ProvinceId,
  ProvinceOwnerRecord
} from "../DataTypes";
import { MAP_RENDER_CONFIG } from "../global-configs";
import { dateStringToNumber } from "./dateMath";

export function projectDateToNumber(date: DateString): number {
  return dateStringToNumber(date);
}

export function getOwnerRecordAtDate(
  timeline: ProvinceOwnerRecord[],
  selectedDate: DateString
): ProvinceOwnerRecord | undefined {
  const selectedTime = projectDateToNumber(selectedDate);
  let activeRecord: ProvinceOwnerRecord | undefined;

  for (const record of timeline) {
    if (projectDateToNumber(record.startDate) <= selectedTime) {
      activeRecord = record;
    } else {
      break;
    }
  }

  return activeRecord;
}

export function getProvinceFill(
  provinceId: ProvinceId,
  mapData: MapData,
  selectedDate: DateString,
  participants: Record<string, Participant>
): string {
  const record = getOwnerRecordAtDate(
    mapData.ownershipChanges[provinceId] ?? [],
    selectedDate
  );
  if (!record) {
    return MAP_RENDER_CONFIG.unownedProvinceFill;
  }

  const controllingParticipantId = record.occupierId ?? record.ownerId;
  if (!controllingParticipantId) {
    return MAP_RENDER_CONFIG.unownedProvinceFill;
  }

  const participant = participants[controllingParticipantId];
  return participant?.color ?? MAP_RENDER_CONFIG.unownedProvinceFill;
}

export function getProvinceOwnerIdAtDate(
  provinceId: ProvinceId,
  mapData: MapData,
  selectedDate: DateString
) {
  const record = getOwnerRecordAtDate(
    mapData.ownershipChanges[provinceId] ?? [],
    selectedDate
  );
  return record?.occupierId ?? record?.ownerId;
}

export function getPolygonPath(points: ProjectedPoint[]): Path2D {
  const path = new Path2D();
  if (points.length === 0) {
    return path;
  }

  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }
  path.closePath();

  return path;
}

export function getProvincePolygons(
  geometry: ProvinceGeometry
): ProvincePolygon[] {
  if (geometry.polygons && geometry.polygons.length > 0) {
    return geometry.polygons;
  }

  return [
    {
      exteriorRing: geometry.exteriorRing,
      holes: geometry.holes
    }
  ];
}
