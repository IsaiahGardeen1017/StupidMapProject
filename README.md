# Stupid Map Project

A TypeScript-first prototype for building historical war maps with a strong focus on manual authoring, timeline playback, and reusable data.

The current milestone is a proof of concept for the map workflow:

- choose a stable projection
- render a Europe basemap overlay for tracing
- render projected settlement labels from real coordinates
- convert a painted province ID bitmap into polygon JSON
- render colored provinces in a browser app

This is meant to answer the question: can we build a practical authoring pipeline for a Paradox-style historical viewer/editor?

## Current status

The repo currently includes:

- a `React + Vite + TypeScript` prototype app
- shared historical map data types
- a Europe-focused Lambert Conformal Conic projection
- downloaded `Natural Earth` physical basemap source files
- downloaded `GeoNames` settlement source files
- scripts to generate overlay SVGs and PNGs for multiple tracing layers
- a script to convert a province ID bitmap into generated province geometry JSON
- an in-memory editor for ownership changes and factions

## Requirements

- `Node.js` 24+
- `npm` 11+

## Install

```powershell
npm install
```

## Run the app

Start the dev server:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

## Map pipeline

### 1. Download source data

Natural Earth basemap data:

```powershell
npm run tool:download-basemap
```

GeoNames settlements data:

```powershell
npm run tool:download-settlements
Expand-Archive -LiteralPath data\raw\geonames\cities500.zip -DestinationPath data\raw\geonames -Force
```

### 2. Generate authoring overlays

Render the Europe basemap overlay:

```powershell
npm run tool:render-basemap
```

Render the Europe settlements overlay:

```powershell
npm run tool:render-settlements
```

Render a denser France/Germany settlements overlay:

```powershell
npm run tool:render-france-germany-settlements
```

Render the rivers overlay:

```powershell
npm run tool:render-rivers
```

Render the modern international border overlay:

```powershell
npm run tool:render-modern-borders
```

Render the modern admin-1 or provincial border overlay:

```powershell
npm run tool:render-admin1-borders
```

These outputs are written to [data/derived](/C:/MyProjectsC/StupidMapProject/data/derived).
Each render script now produces both:

- an `SVG` for inspection and re-rasterization
- a `PNG` for use in Krita or other bitmap editors

For actual province painting, prefer the PNG outputs.

The current tracing overlays are:

- `europe-basemap-overlay`: coastlines, land, and lakes
- `europe-settlements-overlay`: general Europe settlements from `GeoNames cities500`
- `france-germany-settlements-overlay`: denser France/Germany settlement labels
- `europe-rivers-overlay`: rivers and lake centerlines
- `europe-modern-borders-overlay`: modern international borders
- `europe-admin1-borders-overlay`: modern internal state and provincial borders where available

### 3. Paint a province ID map

In Krita or another image editor:

- create a new bitmap aligned to the projection overlay
- paint each province with one unique flat color
- use hard edges
- do not use anti-aliasing
- do not use partial transparency on province pixels
- save as PNG

The current converter expects a file at:
[data/derived/province-id-map.png](/C:/MyProjectsC/StupidMapProject/data/derived/province-id-map.png)

### 4. Convert the bitmap into geometry

```powershell
npm run tool:convert-provinces
```

This writes:
[data/derived/generated-provinces.json](/C:/MyProjectsC/StupidMapProject/data/derived/generated-provinces.json)

### 5. World data and generated geometry

The app now combines two files automatically:

- [data/derived/world-data.json](/C:/MyProjectsC/StupidMapProject/data/derived/world-data.json)
- [data/derived/generated-provinces.json](/C:/MyProjectsC/StupidMapProject/data/derived/generated-provinces.json)
- [data/derived/factions.json](/C:/MyProjectsC/StupidMapProject/data/derived/factions.json)
- [data/derived/ownership-changes.json](/C:/MyProjectsC/StupidMapProject/data/derived/ownership-changes.json)

`world-data.json` is the base world object.

`generated-provinces.json` is the geometry output from the converter.

`factions.json` is merged into the `participants` section at runtime.

`ownership-changes.json` is merged into the `ownershipChanges` section at runtime.

You no longer need to paste converted province geometry into the world data file manually.

## Editor workflow

The app now edits an in-memory merged world object only. There is no persistence layer yet.

- Use the `Ownership` tab to select a faction or `No owner`, then click provinces on the map.
- Use the `Copy Ownership` button to copy just the `ownershipChanges` section.
- Use the `Factions` tab to add, delete, rename, and recolor participants.
- Use the `Copy Factions` button to copy just the `participants` section.

You can then paste those copied sections into the derived JSON files yourself.

## Key files

- App entry: [src/App.tsx](/C:/MyProjectsC/StupidMapProject/src/App.tsx)
- Shared types: [src/DataTypes.ts](/C:/MyProjectsC/StupidMapProject/src/DataTypes.ts)
- World data loader: [src/lib/mapData.ts](/C:/MyProjectsC/StupidMapProject/src/lib/mapData.ts)
- Projection helpers: [tools/lib/mapPipeline.ts](/C:/MyProjectsC/StupidMapProject/tools/lib/mapPipeline.ts)
- Basemap renderer: [tools/render-basemap-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-basemap-overlay.ts)
- Rivers renderer: [tools/render-rivers-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-rivers-overlay.ts)
- Modern border renderer: [tools/render-modern-borders-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-modern-borders-overlay.ts)
- Admin-1 border renderer: [tools/render-admin1-borders-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-admin1-borders-overlay.ts)
- Settlement renderer: [tools/render-settlement-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-settlement-overlay.ts)
- Dense France/Germany settlement renderer: [tools/render-france-germany-settlements-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-france-germany-settlements-overlay.ts)
- Province converter: [tools/convert-province-bitmap.ts](/C:/MyProjectsC/StupidMapProject/tools/convert-province-bitmap.ts)
- Pipeline notes: [MAP_PIPELINE.md](/C:/MyProjectsC/StupidMapProject/MAP_PIPELINE.md)

## Current limitations

- The settlement sources are still modern-first overlays rather than deeply historical gazetteers.
- The province converter is a first-pass bitmap contour extractor, not a full GIS polygonization pipeline.
- River geometry is available as an overlay, but rivers are not yet part of the editable map data model.
- Edits are in-memory only and must be copied out manually.

## Next good steps

- support configurable crop regions and output sizes from the command line
- render PNG overlays in addition to SVG
- load converted province geometry directly into the app
- add pan and zoom controls
- add province selection and editing tools
- replace sample data with real traced Europe province data
