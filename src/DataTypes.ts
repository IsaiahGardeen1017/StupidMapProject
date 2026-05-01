export type DateString = `${number}-${number}-${number}`;

export type LonLat = {
  longitude: number;
  latitude: number;
};

export type ProjectedPoint = {
  x: number;
  y: number;
};

export type BoundingBox = {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
};

export type LambertConformalConicProjection = {
  kind: "lambert-conformal-conic";
  centralMeridian: number;
  latitudeOfOrigin: number;
  standardParallel1: number;
  standardParallel2: number;
};

export type EquirectangularProjection = {
  kind: "equirectangular";
  centralMeridian: number;
  standardParallel?: number;
};

export type MapProjection =
  | LambertConformalConicProjection
  | EquirectangularProjection;

export type ProjectionDefinition = {
  id: string;
  label: string;
  projection: MapProjection;
  bounds: BoundingBox;
  width: number;
  height: number;
  padding: number;
};

export type ProvinceId = `#${string}`;

export type PolygonRing = ProjectedPoint[];

export type ProvincePolygon = {
  exteriorRing: PolygonRing;
  holes: PolygonRing[];
};

export type ProvinceGeometry = {
  id: ProvinceId;
  polygons?: ProvincePolygon[];
  exteriorRing: PolygonRing;
  holes: PolygonRing[];
  centroid: ProjectedPoint;
  area: number;
  pixelCount: number;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

export type ProvinceParticipantRecord = {
  startDate: DateString;
  participantId?: string;
  occupyingParticipantId?: string;
};

export type ProvinceChangesByProvince = Record<
  ProvinceId,
  ProvinceParticipantRecord[]
>;

export type ProvinceData = {
  id: ProvinceId;
  name: string;
  geometry: ProvinceGeometry;
  participantTimeline: ProvinceParticipantRecord[];
};

export type Participant = {
  id: string;
  name: string;
  color: string;
  flagAsset?: string;
  leader?: string;
};

export type FactionMembershipRecord = {
  participantId: string;
  joinDate: DateString;
  leaveDate?: DateString;
};

export type Faction = {
  id: string;
  name: string;
  memberTimeline: FactionMembershipRecord[];
};

export type SettlementKind = "town" | "city" | "capital" | "fort";

export type SettlementRecord = {
  id: string;
  name: string;
  coordinates: LonLat;
  population?: number;
  countryCode?: string;
  kind: SettlementKind;
};

export type BattleResult = "Victory" | "Defeat" | "Draw";

export type WikipediaLink = string;

export type BattleParticipant = {
  participantId: string;
  generals: string[];
  strength?: number;
  casualties?: number;
  result: BattleResult;
};

export type BattleData = {
  id: string;
  name: string;
  settlementId?: string;
  coordinates?: LonLat;
  startDate: DateString;
  endDate?: DateString;
  participants: BattleParticipant[];
  link?: WikipediaLink;
  type: "naval" | "pitched" | "siege";
};

export type HistoricalEvent = {
  id: string;
  date: DateString;
  type: "treaty" | "wardec" | "other";
  title: string;
  description: string;
};

export type MapData = {
  id: string;
  title: string;
  startDate: DateString;
  endDate: DateString;
  projection: ProjectionDefinition;
  participants: Record<string, Participant>;
  factions: Record<string, Faction>;
  provinceChanges: ProvinceChangesByProvince;
  provinces: ProvinceData[];
  settlements: SettlementRecord[];
  battles: BattleData[];
  events: HistoricalEvent[];
  sourceLinks: WikipediaLink[];
};
