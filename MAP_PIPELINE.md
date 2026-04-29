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

Render the denser France/Germany settlement overlay:

```powershell
npm run tool:render-france-germany-settlements
```

Render the Europe rivers overlay:

```powershell
npm run tool:render-rivers
```

Render the Europe modern international borders overlay:

```powershell
npm run tool:render-modern-borders
```

Render the Europe admin-1 or provincial borders overlay:

```powershell
npm run tool:render-admin1-borders
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

France/Germany settlement overlay SVG:
[data/derived/france-germany-settlements-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/france-germany-settlements-overlay.svg)

France/Germany settlement overlay PNG:
[data/derived/france-germany-settlements-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/france-germany-settlements-overlay.png)

France/Germany settlement JSON:
[data/derived/france-germany-settlements.json](/C:/MyProjectsC/StupidMapProject/data/derived/france-germany-settlements.json)

Rivers overlay SVG:
[data/derived/europe-rivers-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/europe-rivers-overlay.svg)

Rivers overlay PNG:
[data/derived/europe-rivers-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/europe-rivers-overlay.png)

Modern borders overlay SVG:
[data/derived/europe-modern-borders-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/europe-modern-borders-overlay.svg)

Modern borders overlay PNG:
[data/derived/europe-modern-borders-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/europe-modern-borders-overlay.png)

Admin-1 borders overlay SVG:
[data/derived/europe-admin1-borders-overlay.svg](/C:/MyProjectsC/StupidMapProject/data/derived/europe-admin1-borders-overlay.svg)

Admin-1 borders overlay PNG:
[data/derived/europe-admin1-borders-overlay.png](/C:/MyProjectsC/StupidMapProject/data/derived/europe-admin1-borders-overlay.png)

Converted province geometry JSON:
[data/derived/generated-provinces.json](/C:/MyProjectsC/StupidMapProject/data/derived/generated-provinces.json)

World metadata JSON:
[data/derived/world-data.json](/C:/MyProjectsC/StupidMapProject/data/derived/world-data.json)

Factions JSON:
[data/derived/factions.json](/C:/MyProjectsC/StupidMapProject/data/derived/factions.json)

Ownership changes JSON:
[data/derived/ownership-changes.json](/C:/MyProjectsC/StupidMapProject/data/derived/ownership-changes.json)

The app merges `world-data.json`, `generated-provinces.json`, `factions.json`, and `ownership-changes.json` automatically at runtime.

## Current limitations

The province conversion script currently traces orthogonal province edges from a PNG province ID map. It works best when provinces are painted with hard edges, flat colors, and no anti-aliasing.

The settlement sources are still practical modern overlays rather than specialized historical gazetteers.
