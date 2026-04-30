import type {
  DateString,
  MapData,
  Participant,
  ProjectedPoint,
  ProvinceGeometry,
  ProvincePolygon,
  ProvinceId,
  ProvinceParticipantRecord
} from "../DataTypes";
import { MAP_RENDER_CONFIG } from "../global-configs";
import { dateStringToNumber } from "./dateMath";

export function projectDateToNumber(date: DateString): number {
  return dateStringToNumber(date);
}

export function getParticipantRecordAtDate(
  timeline: ProvinceParticipantRecord[],
  selectedDate: DateString
): ProvinceParticipantRecord | undefined {
  const selectedTime = projectDateToNumber(selectedDate);
  let activeRecord: ProvinceParticipantRecord | undefined;

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
  const record = getParticipantRecordAtDate(
    mapData.provinceChanges[provinceId] ?? [],
    selectedDate
  );
  if (!record) {
    return MAP_RENDER_CONFIG.unownedProvinceFill;
  }

  const controllingParticipantId =
    record.occupyingParticipantId ?? record.participantId;
  if (!controllingParticipantId) {
    return MAP_RENDER_CONFIG.unownedProvinceFill;
  }

  const participant = participants[controllingParticipantId];
  return participant?.color ?? MAP_RENDER_CONFIG.unownedProvinceFill;
}

export function getProvinceParticipantIdAtDate(
  provinceId: ProvinceId,
  mapData: MapData,
  selectedDate: DateString
) {
  const record = getParticipantRecordAtDate(
    mapData.provinceChanges[provinceId] ?? [],
    selectedDate
  );
  return record?.occupyingParticipantId ?? record?.participantId;
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
