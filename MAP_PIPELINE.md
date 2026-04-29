# Map Pipeline

This repository now includes a first-pass authoring pipeline for a Europe-focused historical map workflow.

## Projection

The current authoring projection is Lambert Conformal Conic, configured for Europe in [tools/lib/mapPipeline.ts](/C:/MyProjectsC/StupidMapProject/tools/lib/mapPipeline.ts).

## Raw sources

Natural Earth downloads are stored in [data/raw/natural-earth](/C:/MyProjectsC/StupidMapProject/data/raw/natural-earth).

GeoNames settlement data is stored in [data/raw/geonames](/C:/MyProjectsC/StupidMapProject/data/raw/geonames).

## Commands

Install dependencies:

```powershell
npm install
```

Download basemap sources:

```powershell
npm run tool:download-basemap
```

Download settlement source:

```powershell
npm run tool:download-settlements
Expand-Archive -LiteralPath data\raw\geonames\cities500.zip -DestinationPath data\raw\geonames -Force
```

Render the Europe basemap overlay:

```powershell
npm run tool:render-basemap
```

Render the Europe settlement overlay:

```powershell
npm run tool:render-settlements
```

Convert a province ID bitmap into JSON polygons:

```powershell
npm run tool:convert-provinces
```

Run the app:

```powershell
npm run dev
```

## Outputs

Basemap overlay SVG:
[data/derived/europe-basemap-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/europe-basemap-overlay.svg)

Basemap overlay PNG:
[data/derived/europe-basemap-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/europe-basemap-overlay.png)

Settlement overlay SVG:
[data/derived/europe-settlements-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/europe-settlements-overlay.svg)

Settlement overlay PNG:
[data/derived/europe-settlements-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/europe-settlements-overlay.png)

Filtered settlement JSON:
[data/derived/europe-settlements.json](/C:/MyProjectsC/StupidMapProject/data/derived/europe-settlements.json)

Converted province geometry JSON:
[data/derived/generated-provinces.json](/C:/MyProjectsC/StupidMapProject/data/derived/generated-provinces.json)

World metadata JSON:
[data/derived/world-data.json](/C:/MyProjectsC/StupidMapProject/data/derived/world-data.json)

The app merges `world-data.json` with `generated-provinces.json` automatically at runtime.

## Current limitations

The province conversion script currently traces orthogonal province edges from a PNG province ID map. It works best when provinces are painted with hard edges, flat colors, and no anti-aliasing.

The settlement source is GeoNames `cities500`, which is a practical modern fallback rather than a specialized historical gazetteer.
