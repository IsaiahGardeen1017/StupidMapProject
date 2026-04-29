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
- scripts to generate overlay SVGs
- scripts to generate overlay SVGs and PNGs
- a script to convert a province ID bitmap into generated province geometry JSON
- a minimal browser renderer for provinces and owner colors

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

These outputs are written to [data/derived](/C:/MyProjectsC/StupidMapProject/data/derived).
Each render script now produces both:

- an `SVG` for inspection and re-rasterization
- a `PNG` for use in Krita or other bitmap editors

For actual province painting, prefer the PNG outputs.

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

`world-data.json` is where you keep timeline data, participants, and optional province metadata like names and owner histories.

`generated-provinces.json` is the geometry output from the converter.

You no longer need to paste converted province geometry into the world data file manually.

## Key files

- App entry: [src/App.tsx](/C:/MyProjectsC/StupidMapProject/src/App.tsx)
- Shared types: [src/DataTypes.ts](/C:/MyProjectsC/StupidMapProject/src/DataTypes.ts)
- World data loader: [src/lib/mapData.ts](/C:/MyProjectsC/StupidMapProject/src/lib/mapData.ts)
- Projection helpers: [tools/lib/mapPipeline.ts](/C:/MyProjectsC/StupidMapProject/tools/lib/mapPipeline.ts)
- Basemap renderer: [tools/render-basemap-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-basemap-overlay.ts)
- Settlement renderer: [tools/render-settlement-overlay.ts](/C:/MyProjectsC/StupidMapProject/tools/render-settlement-overlay.ts)
- Province converter: [tools/convert-province-bitmap.ts](/C:/MyProjectsC/StupidMapProject/tools/convert-province-bitmap.ts)
- Pipeline notes: [MAP_PIPELINE.md](/C:/MyProjectsC/StupidMapProject/MAP_PIPELINE.md)

## Current limitations

- The settlement source is `GeoNames cities500`, which is practical but not deeply historical.
- The province converter is a first-pass bitmap contour extractor, not a full GIS polygonization pipeline.
- Rivers are intentionally ignored for now.
- The browser renderer is still a minimal proof of concept, not yet a full editor.

## Next good steps

- support configurable crop regions and output sizes from the command line
- render PNG overlays in addition to SVG
- load converted province geometry directly into the app
- add pan and zoom controls
- add province selection and editing tools
- replace sample data with real traced Europe province data
