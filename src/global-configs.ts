export const MAP_VIEW_CONFIG = {
    initialZoom: 0.88,
    minZoom: 0.2,
    maxZoom: 24,
    zoomIntensity: 0.0015,
} as const;

export const PLAYBACK_CONFIG = {
    defaultMillisecondsPerDay: 300,
    minMultiplier: 0.25,
    maxMultiplier: 6,
    sliderStep: 0.05,
    minimumIntervalMilliseconds: 30,
} as const;

export const MAP_IMPORT_CONFIG = {
    provinceSimplifyTolerance: 1.5,
} as const;

export const MAP_RENDER_CONFIG = {
    unownedProvinceFill: "#d8ccb4",
    backgroundFill: "#efe4c9",
    provinceStroke: "#2f2419",
    provinceStrokeWidth: 1,
} as const;
