import { useMemo, useState } from "react";
import type { DateString } from "./DataTypes";
import { MapCanvas } from "./components/MapCanvas";
import { worldMapData } from "./lib/mapData";
import "./styles/app.css";

const DATES: DateString[] = ["1805-09-01", "1805-12-01", "1806-01-15"];

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedDate = useMemo(
    () => DATES[selectedIndex] ?? DATES[0],
    [selectedIndex]
  );

  return (
    <main className="app-shell">
      <section className="sidebar">
        <p className="eyebrow">Prototype</p>
        <h1>Historical Map Proof of Concept</h1>
        <p className="lede">
          This first slice proves province rendering, owner changes over time,
          and the projection-first authoring pipeline.
        </p>
        <label className="slider-label" htmlFor="timeline">
          Timeline: <strong>{selectedDate}</strong>
        </label>
        <input
          id="timeline"
          type="range"
          min={0}
          max={DATES.length - 1}
          step={1}
          value={selectedIndex}
          onChange={(event) => {
            setSelectedIndex(Number(event.target.value));
          }}
        />
        <div className="legend">
          {Object.values(worldMapData.participants).map((participant) => (
            <div className="legend-row" key={participant.id}>
              <span
                className="legend-swatch"
                style={{ backgroundColor: participant.color }}
              />
              <span>{participant.name}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="map-panel">
        <MapCanvas mapData={worldMapData} selectedDate={selectedDate} />
      </section>
    </main>
  );
}
