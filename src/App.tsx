import { useEffect, useMemo, useState } from "react";
import type {
  DateString,
  MapData,
  Participant,
  ProvinceId
} from "./DataTypes";
import { MapCanvas } from "./components/MapCanvas";
import { PLAYBACK_CONFIG } from "./global-configs";
import {
  addDays,
  addMonths,
  clampDayOffset,
  daysBetween,
  formatDisplayDate,
  getDayOffsetFromStart
} from "./lib/dateMath";
import {
  applyOwnershipChange,
  createInitialWorldMapData,
  deleteOwnershipChangeAtDate
} from "./lib/mapData";
import { getProvinceOwnerIdAtDate } from "./lib/mapMath";
import "./styles/app.css";

type EditorTab = "view" | "ownership" | "participants";

const NO_OWNER_SENTINEL = "__no_owner__";

function copyJsonToClipboard(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

function normalizeHexColorInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "#";
  }

  const stripped = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const hexOnly = stripped.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${hexOnly.toLowerCase()}`;
}

export default function App() {
  const [mapData, setMapData] = useState<MapData>(() => createInitialWorldMapData());
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedProvinceId, setSelectedProvinceId] = useState<
    ProvinceId | undefined
  >();
  const [selectedOwnerId, setSelectedOwnerId] = useState(NO_OWNER_SENTINEL);
  const [activeTab, setActiveTab] = useState<EditorTab>("view");
  const [copyStatus, setCopyStatus] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMultiplier, setPlaybackMultiplier] = useState(1);

  const totalDays = useMemo(
    () => daysBetween(mapData.startDate, mapData.endDate),
    [mapData.endDate, mapData.startDate]
  );

  const selectedDate = useMemo(
    () =>
      addDays(
        mapData.startDate,
        clampDayOffset(selectedDayOffset, mapData.startDate, mapData.endDate)
      ),
    [mapData.endDate, mapData.startDate, selectedDayOffset]
  );

  const selectedProvince = useMemo(
    () => mapData.provinces.find((province) => province.id === selectedProvinceId),
    [mapData.provinces, selectedProvinceId]
  );

  const selectedProvinceChanges = useMemo(
    () =>
      selectedProvinceId ? mapData.ownershipChanges[selectedProvinceId] ?? [] : [],
    [mapData.ownershipChanges, selectedProvinceId]
  );

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setSelectedDayOffset((currentOffset) => {
        if (currentOffset >= totalDays) {
          setIsPlaying(false);
          return totalDays;
        }

        return Math.min(totalDays, currentOffset + 1);
      });
    }, Math.max(
      PLAYBACK_CONFIG.minimumIntervalMilliseconds,
      PLAYBACK_CONFIG.defaultMillisecondsPerDay / playbackMultiplier
    ));

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, playbackMultiplier, totalDays]);

  async function handleCopy(value: unknown, label: string) {
    await copyJsonToClipboard(value);
    setCopyStatus(`Copied ${label}.`);
    window.setTimeout(() => {
      setCopyStatus("");
    }, 2000);
  }

  function setOffsetFromDate(nextDate: DateString) {
    setSelectedDayOffset(
      clampDayOffset(
        getDayOffsetFromStart(mapData.startDate, nextDate),
        mapData.startDate,
        mapData.endDate
      )
    );
  }

  function stepTimelineByDays(dayDelta: number) {
    setSelectedDayOffset((currentOffset) =>
      clampDayOffset(
        currentOffset + dayDelta,
        mapData.startDate,
        mapData.endDate
      )
    );
  }

  function stepTimelineByMonths(monthDelta: number) {
    setOffsetFromDate(addMonths(selectedDate, monthDelta));
  }

  function handleProvinceClick(provinceId: ProvinceId) {
    setSelectedProvinceId(provinceId);
    if (activeTab !== "ownership") {
      return;
    }

    const ownerId =
      selectedOwnerId === NO_OWNER_SENTINEL ? undefined : selectedOwnerId;

    setMapData((currentMapData) =>
      applyOwnershipChange(currentMapData, provinceId, {
        startDate: selectedDate,
        ownerId
      })
    );
  }

  function handleParticipantFieldChange(
    participantId: string,
    field: keyof Pick<Participant, "color" | "name">,
    value: string
  ) {
    setMapData((currentMapData) => ({
      ...currentMapData,
      participants: {
        ...currentMapData.participants,
        [participantId]: {
          ...currentMapData.participants[participantId],
          [field]:
            field === "color" ? normalizeHexColorInput(value) : value
        }
      }
    }));
  }

  function handleAddParticipant() {
    let nextIndex = 1;
    while (mapData.participants[`faction-${nextIndex}`]) {
      nextIndex += 1;
    }

    const nextId = `faction-${nextIndex}`;
    setMapData((currentMapData) => ({
      ...currentMapData,
      participants: {
        ...currentMapData.participants,
        [nextId]: {
          id: nextId,
          name: `Faction ${nextIndex}`,
          color: "#787878"
        }
      }
    }));
  }

  function handleDeleteParticipant(participantId: string) {
    setMapData((currentMapData) => {
      const nextParticipants = { ...currentMapData.participants };
      delete nextParticipants[participantId];
      return {
        ...currentMapData,
        participants: nextParticipants
      };
    });

    if (selectedOwnerId === participantId) {
      setSelectedOwnerId(NO_OWNER_SENTINEL);
    }
  }

  return (
    <main className="app-shell">
      <section className="sidebar">
        <p className="eyebrow">Prototype</p>
        <h1>Historical Map Editor</h1>
        <p className="lede">
          Edit the in-memory world object, then copy only the sections you want
          back into the derived JSON files.
        </p>

        <div className="tab-row tab-row--three">
          <button
            className={activeTab === "view" ? "tab-button is-active" : "tab-button"}
            onClick={() => {
              setActiveTab("view");
            }}
            type="button"
          >
            View
          </button>
          <button
            className={activeTab === "ownership" ? "tab-button is-active" : "tab-button"}
            onClick={() => {
              setActiveTab("ownership");
            }}
            type="button"
          >
            Ownership
          </button>
          <button
            className={activeTab === "participants" ? "tab-button is-active" : "tab-button"}
            onClick={() => {
              setActiveTab("participants");
            }}
            type="button"
          >
            Factions
          </button>
        </div>

        {activeTab === "view" ? (
          <section className="panel-block">
            <div className="panel-header">
              <h2>Playback</h2>
            </div>
            <div className="button-row">
              <button
                className="mini-button"
                onClick={() => {
                  setIsPlaying((current) => !current);
                }}
                type="button"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                className="mini-button"
                onClick={() => {
                  setIsPlaying(false);
                  setSelectedDayOffset(0);
                }}
                type="button"
              >
                Restart
              </button>
            </div>
            <label className="slider-label" htmlFor="playback-speed">
              Playback speed: <strong>{playbackMultiplier.toFixed(2)}x</strong>
            </label>
            <input
              id="playback-speed"
              max={PLAYBACK_CONFIG.maxMultiplier}
              min={PLAYBACK_CONFIG.minMultiplier}
              step={PLAYBACK_CONFIG.sliderStep}
              type="range"
              value={playbackMultiplier}
              onChange={(event) => {
                setPlaybackMultiplier(Number(event.target.value));
              }}
            />
            <p className="hint">
              Base timing: {PLAYBACK_CONFIG.defaultMillisecondsPerDay} ms per
              day at 1.00x.
            </p>
            <p className="hint">
              Use the timeline under the map for manual stepping, or play
              through the campaign from this tab.
            </p>
          </section>
        ) : null}

        {activeTab === "ownership" ? (
          <section className="panel-block">
            <div className="panel-header">
              <h2>Province Ownership</h2>
              <button
                className="copy-button"
                onClick={() => {
                  void handleCopy(mapData.ownershipChanges, "ownership changes");
                }}
                type="button"
              >
                Copy Ownership
              </button>
            </div>
            <p className="hint">
              Select an owner, then click provinces on the map to create or
              replace an ownership change at the selected date.
            </p>
            <div className="ownership-palette">
              <button
                className={
                  selectedOwnerId === NO_OWNER_SENTINEL
                    ? "owner-chip is-active"
                    : "owner-chip"
                }
                onClick={() => {
                  setSelectedOwnerId(NO_OWNER_SENTINEL);
                }}
                type="button"
              >
                <span className="legend-swatch" />
                No owner
              </button>
              {Object.values(mapData.participants).map((participant) => (
                <button
                  className={
                    selectedOwnerId === participant.id
                      ? "owner-chip is-active"
                      : "owner-chip"
                  }
                  key={participant.id}
                  onClick={() => {
                    setSelectedOwnerId(participant.id);
                  }}
                  type="button"
                >
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: participant.color || "#d8ccb4" }}
                  />
                  {participant.name}
                </button>
              ))}
            </div>

            <div className="selected-province-card">
              <h3>{selectedProvince?.name ?? "No Province Selected"}</h3>
              {selectedProvince ? (
                <>
                  <p className="meta-line">
                    Province id: <code>{selectedProvince.id}</code>
                  </p>
                  <p className="meta-line">
                    Owner on {formatDisplayDate(selectedDate)}:{" "}
                    <strong>
                      {(() => {
                        const ownerId = getProvinceOwnerIdAtDate(
                          selectedProvince.id,
                          mapData,
                          selectedDate
                        );
                        return ownerId
                          ? mapData.participants[ownerId]?.name ?? ownerId
                          : "No owner";
                      })()}
                    </strong>
                  </p>
                  <div className="change-list">
                    {selectedProvinceChanges.length === 0 ? (
                      <p className="hint">No ownership changes recorded yet.</p>
                    ) : null}
                    {selectedProvinceChanges.map((change) => (
                      <div
                        className="change-row"
                        key={`${selectedProvince.id}-${change.startDate}`}
                      >
                        <span>
                          {formatDisplayDate(change.startDate)}:{" "}
                          {change.ownerId
                            ? mapData.participants[change.ownerId]?.name ?? change.ownerId
                            : "No owner"}
                        </span>
                        <button
                          className="mini-button"
                          onClick={() => {
                            setMapData((currentMapData) =>
                              deleteOwnershipChangeAtDate(
                                currentMapData,
                                selectedProvince.id,
                                change.startDate
                              )
                            );
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="hint">Click a province to inspect or edit it.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "participants" ? (
          <section className="panel-block">
            <div className="panel-header">
              <h2>Factions</h2>
              <div className="button-row">
                <button
                  className="mini-button"
                  onClick={handleAddParticipant}
                  type="button"
                >
                  Add Faction
                </button>
                <button
                  className="copy-button"
                  onClick={() => {
                    void handleCopy(mapData.participants, "participants");
                  }}
                  type="button"
                >
                  Copy Factions
                </button>
              </div>
            </div>
            <div className="participant-list">
              {Object.values(mapData.participants).map((participant) => (
                <div className="participant-card" key={participant.id}>
                  <div className="participant-row">
                    <label className="participant-inline-label">
                      <span>Name</span>
                      <input
                        type="text"
                        value={participant.name}
                        onChange={(event) => {
                          handleParticipantFieldChange(
                            participant.id,
                            "name",
                            event.target.value
                          );
                        }}
                      />
                    </label>
                  </div>
                  <div className="participant-row">
                    <label className="participant-inline-label">
                      <span>Color</span>
                      <input
                        type="text"
                        value={participant.color}
                        onChange={(event) => {
                          handleParticipantFieldChange(
                            participant.id,
                            "color",
                            event.target.value
                          );
                        }}
                      />
                    </label>
                  </div>
                  <div className="participant-footer">
                    <span className="participant-id">{participant.id}</span>
                    <button
                      className="mini-button danger"
                      onClick={() => {
                        handleDeleteParticipant(participant.id);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
      </section>

      <section className="map-panel">
        <MapCanvas
          mapData={mapData}
          onProvinceClick={handleProvinceClick}
          selectedDate={selectedDate}
          selectedProvinceId={selectedProvinceId}
        />
        <section className="timeline-panel">
          <div className="timeline-date-row">
            <div className="timeline-step-group">
              <button className="mini-button" onClick={() => stepTimelineByMonths(-1)} type="button">
                -1M
              </button>
              <button className="mini-button" onClick={() => stepTimelineByDays(-7)} type="button">
                -1W
              </button>
              <button className="mini-button" onClick={() => stepTimelineByDays(-1)} type="button">
                -1D
              </button>
            </div>
            <div className="timeline-date-display">{formatDisplayDate(selectedDate)}</div>
            <div className="timeline-step-group">
              <button className="mini-button" onClick={() => stepTimelineByDays(1)} type="button">
                +1D
              </button>
              <button className="mini-button" onClick={() => stepTimelineByDays(7)} type="button">
                +1W
              </button>
              <button className="mini-button" onClick={() => stepTimelineByMonths(1)} type="button">
                +1M
              </button>
            </div>
          </div>
          <input
            className="timeline-slider"
            max={totalDays}
            min={0}
            step={1}
            type="range"
            value={selectedDayOffset}
            onChange={(event) => {
              setSelectedDayOffset(Number(event.target.value));
            }}
          />
        </section>
      </section>
    </main>
  );
}
