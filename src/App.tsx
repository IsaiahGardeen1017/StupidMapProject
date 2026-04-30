import { useEffect, useMemo, useState } from "react";
import type {
  DateString,
  Faction,
  FactionMembershipRecord,
  MapData,
  Participant,
  ProvinceId
} from "./DataTypes";
import { MapCanvas } from "./components/MapCanvas";
import { PLAYBACK_CONFIG } from "./global-configs";
import { flagAssetOptions, flagAssetSourceByFileName } from "./lib/flagAssets";
import {
  addDays,
  addMonths,
  clampDayOffset,
  daysBetween,
  formatDisplayDate,
  getDayOffsetFromStart
} from "./lib/dateMath";
import {
  applyProvinceChange,
  createInitialWorldMapData,
  deleteProvinceChangeAtDate
} from "./lib/mapData";
import {
  getProvinceParticipantIdAtDate,
  projectDateToNumber
} from "./lib/mapMath";
import "./styles/app.css";

type EditorTab = "view" | "ownership" | "participants" | "factions";

const NO_PARTICIPANT_SENTINEL = "__no_participant__";

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

function toDateInputValue(date: DateString | undefined) {
  if (!date) {
    return "";
  }

  const [year, month, day] = date.split("-");
  return [
    year.padStart(4, "0"),
    month.padStart(2, "0"),
    day.padStart(2, "0")
  ].join("-");
}

function fromDateInputValue(value: string): DateString {
  const [year, month, day] = value.split("-");
  return `${Number(year)}-${Number(month)}-${Number(day)}` as DateString;
}

function sortFactionMemberTimeline(memberTimeline: FactionMembershipRecord[]) {
  return [...memberTimeline].sort((left, right) =>
    left.joinDate.localeCompare(right.joinDate)
  );
}

function getActiveFactionMembers(
  faction: Faction,
  selectedDate: DateString,
  participants: Record<string, Participant>
) {
  const selectedTime = projectDateToNumber(selectedDate);

  return faction.memberTimeline
    .filter((membership) => {
      const joined = projectDateToNumber(membership.joinDate);
      const left = membership.leaveDate
        ? projectDateToNumber(membership.leaveDate)
        : Number.POSITIVE_INFINITY;
      return joined <= selectedTime && selectedTime <= left;
    })
    .map((membership) => ({
      membership,
      participant: participants[membership.participantId]
    }))
    .filter(
      (
        entry
      ): entry is {
        membership: FactionMembershipRecord;
        participant: Participant;
      } => Boolean(entry.participant)
    )
    .sort((left, right) => left.participant.name.localeCompare(right.participant.name));
}

export default function App() {
  const [mapData, setMapData] = useState<MapData>(() => createInitialWorldMapData());
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedProvinceId, setSelectedProvinceId] = useState<
    ProvinceId | undefined
  >();
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    NO_PARTICIPANT_SENTINEL
  );
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

  const sortedParticipants = useMemo(
    () =>
      Object.values(mapData.participants).sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [mapData.participants]
  );

  const sortedFactions = useMemo(
    () =>
      Object.values(mapData.factions).sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [mapData.factions]
  );

  const selectedProvince = useMemo(
    () => mapData.provinces.find((province) => province.id === selectedProvinceId),
    [mapData.provinces, selectedProvinceId]
  );

  const selectedProvinceChanges = useMemo(
    () =>
      selectedProvinceId ? mapData.provinceChanges[selectedProvinceId] ?? [] : [],
    [mapData.provinceChanges, selectedProvinceId]
  );

  const activeFactionEntries = useMemo(
    () =>
      sortedFactions
        .map((faction) => ({
          faction,
          members: getActiveFactionMembers(
            faction,
            selectedDate,
            mapData.participants
          )
        }))
        .filter((entry) => entry.members.length > 0),
    [mapData.participants, selectedDate, sortedFactions]
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

    const participantId =
      selectedParticipantId === NO_PARTICIPANT_SENTINEL
        ? undefined
        : selectedParticipantId;

    setMapData((currentMapData) =>
      applyProvinceChange(currentMapData, provinceId, {
        startDate: selectedDate,
        participantId
      })
    );
  }

  function handleParticipantFieldChange(
    participantId: string,
    field: keyof Pick<Participant, "color" | "flagAsset" | "name">,
    value: string
  ) {
    setMapData((currentMapData) => ({
      ...currentMapData,
      participants: {
        ...currentMapData.participants,
        [participantId]: {
          ...currentMapData.participants[participantId],
          [field]:
            field === "color"
              ? normalizeHexColorInput(value)
              : field === "flagAsset"
                ? value || undefined
                : value
        }
      }
    }));
  }

  function handleAddParticipant() {
    let nextIndex = 1;
    while (mapData.participants[`participant-${nextIndex}`]) {
      nextIndex += 1;
    }

    const nextId = `participant-${nextIndex}`;
    setMapData((currentMapData) => ({
      ...currentMapData,
      participants: {
        ...currentMapData.participants,
        [nextId]: {
          id: nextId,
          name: `Participant ${nextIndex}`,
          color: "#787878"
        }
      }
    }));
  }

  function handleDeleteParticipant(participantId: string) {
    setMapData((currentMapData) => {
      const nextParticipants = { ...currentMapData.participants };
      delete nextParticipants[participantId];

      const nextProvinceChanges = Object.fromEntries(
        Object.entries(currentMapData.provinceChanges).map(([provinceId, changes]) => [
          provinceId,
          changes.map((change) => ({
            ...change,
            participantId:
              change.participantId === participantId
                ? undefined
                : change.participantId,
            occupyingParticipantId:
              change.occupyingParticipantId === participantId
                ? undefined
                : change.occupyingParticipantId
          }))
        ])
      );

      const nextFactions = Object.fromEntries(
        Object.entries(currentMapData.factions).map(([factionId, faction]) => [
          factionId,
          {
            ...faction,
            memberTimeline: faction.memberTimeline.filter(
              (membership) => membership.participantId !== participantId
            )
          }
        ])
      );

      return {
        ...currentMapData,
        participants: nextParticipants,
        provinceChanges: nextProvinceChanges,
        factions: nextFactions
      };
    });

    if (selectedParticipantId === participantId) {
      setSelectedParticipantId(NO_PARTICIPANT_SENTINEL);
    }
  }

  function handleAddFaction() {
    let nextIndex = 1;
    while (mapData.factions[`faction-${nextIndex}`]) {
      nextIndex += 1;
    }

    const nextId = `faction-${nextIndex}`;
    setMapData((currentMapData) => ({
      ...currentMapData,
      factions: {
        ...currentMapData.factions,
        [nextId]: {
          id: nextId,
          name: `Faction ${nextIndex}`,
          memberTimeline: []
        }
      }
    }));
  }

  function handleFactionFieldChange(
    factionId: string,
    field: keyof Pick<Faction, "name">,
    value: string
  ) {
    setMapData((currentMapData) => ({
      ...currentMapData,
      factions: {
        ...currentMapData.factions,
        [factionId]: {
          ...currentMapData.factions[factionId],
          [field]: value
        }
      }
    }));
  }

  function handleDeleteFaction(factionId: string) {
    setMapData((currentMapData) => {
      const nextFactions = { ...currentMapData.factions };
      delete nextFactions[factionId];
      return {
        ...currentMapData,
        factions: nextFactions
      };
    });
  }

  function handleAddFactionMembership(factionId: string) {
    if (sortedParticipants.length === 0) {
      return;
    }

    setMapData((currentMapData) => {
      const faction = currentMapData.factions[factionId];
      if (!faction) {
        return currentMapData;
      }

      return {
        ...currentMapData,
        factions: {
          ...currentMapData.factions,
          [factionId]: {
            ...faction,
            memberTimeline: sortFactionMemberTimeline([
              ...faction.memberTimeline,
              {
                participantId: sortedParticipants[0].id,
                joinDate: selectedDate
              }
            ])
          }
        }
      };
    });
  }

  function handleFactionMembershipChange(
    factionId: string,
    membershipIndex: number,
    field: keyof FactionMembershipRecord,
    value: string
  ) {
    setMapData((currentMapData) => {
      const faction = currentMapData.factions[factionId];
      if (!faction) {
        return currentMapData;
      }

      const nextMemberTimeline = faction.memberTimeline.map((membership, index) => {
        if (index !== membershipIndex) {
          return membership;
        }

        if (field === "joinDate" || field === "leaveDate") {
          return {
            ...membership,
            [field]: value ? fromDateInputValue(value) : undefined
          };
        }

        return {
          ...membership,
          [field]: value
        };
      });

      return {
        ...currentMapData,
        factions: {
          ...currentMapData.factions,
          [factionId]: {
            ...faction,
            memberTimeline: sortFactionMemberTimeline(nextMemberTimeline)
          }
        }
      };
    });
  }

  function handleDeleteFactionMembership(factionId: string, membershipIndex: number) {
    setMapData((currentMapData) => {
      const faction = currentMapData.factions[factionId];
      if (!faction) {
        return currentMapData;
      }

      return {
        ...currentMapData,
        factions: {
          ...currentMapData.factions,
          [factionId]: {
            ...faction,
            memberTimeline: faction.memberTimeline.filter(
              (_, index) => index !== membershipIndex
            )
          }
        }
      };
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <h1>{mapData.title}</h1>
        </div>
        <div className="tab-row tab-row--four">
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
            Participants
          </button>
          <button
            className={activeTab === "factions" ? "tab-button is-active" : "tab-button"}
            onClick={() => {
              setActiveTab("factions");
            }}
            type="button"
          >
            Factions
          </button>
        </div>
      </header>

      <div className="app-workspace">
        <section className="sidebar">
          <div className="sidebar-content">
          {activeTab === "view" ? (
            <section className="panel-block panel-block--scroll">
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
            <section className="panel-block panel-block--scroll">
              <div className="panel-header">
                <h2>Province Ownership</h2>
                <button
                  className="copy-button"
                  onClick={() => {
                    void handleCopy(mapData.provinceChanges, "province changes");
                  }}
                  type="button"
                >
                  Copy Province Changes
                </button>
              </div>
              <p className="hint">
                Select a participant, then click provinces on the map to create or
                replace a province change at the selected date.
              </p>
              <div className="ownership-palette">
                <button
                  className={
                    selectedParticipantId === NO_PARTICIPANT_SENTINEL
                      ? "participant-chip is-active"
                      : "participant-chip"
                  }
                  onClick={() => {
                    setSelectedParticipantId(NO_PARTICIPANT_SENTINEL);
                  }}
                  type="button"
                >
                  <span className="legend-swatch" />
                  No participant
                </button>
                {sortedParticipants.map((participant) => (
                  <button
                    className={
                      selectedParticipantId === participant.id
                        ? "participant-chip is-active"
                        : "participant-chip"
                    }
                    key={participant.id}
                    onClick={() => {
                      setSelectedParticipantId(participant.id);
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
                      Participant on {formatDisplayDate(selectedDate)}:{" "}
                      <strong>
                        {(() => {
                          const participantId = getProvinceParticipantIdAtDate(
                            selectedProvince.id,
                            mapData,
                            selectedDate
                          );
                          return participantId
                            ? mapData.participants[participantId]?.name ?? participantId
                            : "No participant";
                        })()}
                      </strong>
                    </p>
                    <div className="change-list">
                      {selectedProvinceChanges.length === 0 ? (
                        <p className="hint">No province changes recorded yet.</p>
                      ) : null}
                      {selectedProvinceChanges.map((change) => (
                        <div
                          className="change-row"
                          key={`${selectedProvince.id}-${change.startDate}`}
                        >
                          <span>
                            {formatDisplayDate(change.startDate)}:{" "}
                            {change.participantId
                              ? mapData.participants[change.participantId]?.name ??
                                change.participantId
                              : "No participant"}
                          </span>
                          <button
                            className="mini-button"
                            onClick={() => {
                              setMapData((currentMapData) =>
                                deleteProvinceChangeAtDate(
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
            <section className="panel-block panel-block--scroll">
              <div className="panel-header">
                <h2>Participants</h2>
                <div className="button-row">
                  <button
                    className="mini-button"
                    onClick={handleAddParticipant}
                    type="button"
                  >
                    Add Participant
                  </button>
                  <button
                    className="copy-button"
                    onClick={() => {
                      void handleCopy(mapData.participants, "participants");
                    }}
                    type="button"
                  >
                    Copy Participants
                  </button>
                </div>
              </div>
              <div className="participant-list">
                {sortedParticipants.map((participant) => {
                  const flagPreview = participant.flagAsset
                    ? flagAssetSourceByFileName[participant.flagAsset]
                    : undefined;

                  return (
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
                      <div className="participant-row">
                        <label className="participant-inline-label participant-inline-label--stacked">
                          <span>Flag</span>
                          <select
                            value={participant.flagAsset ?? ""}
                            onChange={(event) => {
                              handleParticipantFieldChange(
                                participant.id,
                                "flagAsset",
                                event.target.value
                              );
                            }}
                          >
                            <option value="">No flag</option>
                            {flagAssetOptions.map((flagAsset) => (
                              <option key={flagAsset.fileName} value={flagAsset.fileName}>
                                {flagAsset.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {flagPreview ? (
                          <div className="flag-preview">
                            <img
                              alt={`${participant.name} flag`}
                              className="flag-preview-image"
                              src={flagPreview}
                            />
                            <span className="participant-id">{participant.flagAsset}</span>
                          </div>
                        ) : participant.flagAsset ? (
                          <p className="hint">Selected flag file is missing from `src/assets/flags`.</p>
                        ) : null}
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
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeTab === "factions" ? (
            <section className="panel-block panel-block--scroll">
              <div className="panel-header">
                <h2>Factions</h2>
                <div className="button-row">
                  <button
                    className="mini-button"
                    onClick={handleAddFaction}
                    type="button"
                  >
                    Add Faction
                  </button>
                  <button
                    className="copy-button"
                    onClick={() => {
                      void handleCopy(mapData.factions, "factions");
                    }}
                    type="button"
                  >
                    Copy Factions
                  </button>
                </div>
              </div>
              <p className="hint">
                Faction memberships are date-based. A participant is considered a
                member from the join date through the leave date, or indefinitely
                if no leave date is set.
              </p>
              <div className="participant-list">
                {sortedFactions.map((faction) => (
                  <div className="participant-card" key={faction.id}>
                    <div className="participant-row">
                      <label className="participant-inline-label">
                        <span>Name</span>
                        <input
                          type="text"
                          value={faction.name}
                          onChange={(event) => {
                            handleFactionFieldChange(
                              faction.id,
                              "name",
                              event.target.value
                            );
                          }}
                        />
                      </label>
                    </div>
                    <div className="panel-header panel-header--subsection">
                      <h3>Members</h3>
                      <button
                        className="mini-button"
                        onClick={() => {
                          handleAddFactionMembership(faction.id);
                        }}
                        type="button"
                      >
                        Add Member
                      </button>
                    </div>
                    <div className="faction-memberships">
                      {faction.memberTimeline.length === 0 ? (
                        <p className="hint">No membership rows yet.</p>
                      ) : null}
                      {faction.memberTimeline.map((membership, index) => (
                        <div className="membership-card" key={`${faction.id}-${index}`}>
                          <label className="membership-field">
                            <span>Participant</span>
                            <select
                              value={membership.participantId}
                              onChange={(event) => {
                                handleFactionMembershipChange(
                                  faction.id,
                                  index,
                                  "participantId",
                                  event.target.value
                                );
                              }}
                            >
                              {sortedParticipants.map((participant) => (
                                <option key={participant.id} value={participant.id}>
                                  {participant.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="membership-field">
                            <span>Join</span>
                            <input
                              type="date"
                              value={toDateInputValue(membership.joinDate)}
                              onChange={(event) => {
                                handleFactionMembershipChange(
                                  faction.id,
                                  index,
                                  "joinDate",
                                  event.target.value
                                );
                              }}
                            />
                          </label>
                          <label className="membership-field">
                            <span>Leave</span>
                            <input
                              type="date"
                              value={toDateInputValue(membership.leaveDate)}
                              onChange={(event) => {
                                handleFactionMembershipChange(
                                  faction.id,
                                  index,
                                  "leaveDate",
                                  event.target.value
                                );
                              }}
                            />
                          </label>
                          <button
                            className="mini-button mini-button--icon danger"
                            onClick={() => {
                              handleDeleteFactionMembership(faction.id, index);
                            }}
                            type="button"
                            aria-label="Remove membership"
                            title="Remove membership"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="participant-footer">
                      <span className="participant-id">{faction.id}</span>
                      <button
                        className="mini-button danger"
                        onClick={() => {
                          handleDeleteFaction(faction.id);
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
        </div>

        {copyStatus ? <p className="copy-status sidebar-status">{copyStatus}</p> : null}
        </section>

        <section className="map-panel">
          <div className="map-stage">
            <MapCanvas
              mapData={mapData}
              onProvinceClick={handleProvinceClick}
              selectedDate={selectedDate}
              selectedProvinceId={selectedProvinceId}
            />
            <aside className="faction-legend">
              {activeFactionEntries.length === 0 ? (
                <p className="hint">No factions have active members on this date.</p>
              ) : (
                <div className="legend-faction-list">
                  {activeFactionEntries.map(({ faction, members }) => (
                    <section className="legend-faction-card" key={faction.id}>
                      <div className="legend-faction-header">
                        <div>
                          <strong>{faction.name}</strong>
                          <p className="hint">{members.length} members</p>
                        </div>
                      </div>
                      <div className="legend-member-list">
                        {members.map(({ membership, participant }) => {
                          const flagPreview = participant.flagAsset
                            ? flagAssetSourceByFileName[participant.flagAsset]
                            : undefined;

                          return (
                            <div
                              className="legend-member-row"
                              key={`${faction.id}-${participant.id}-${membership.joinDate}`}
                            >
                              {flagPreview ? (
                                <img
                                  alt={`${participant.name} flag`}
                                  className="legend-flag"
                                  src={flagPreview}
                                />
                              ) : (
                                <span
                                  className="legend-swatch"
                                  style={{ backgroundColor: participant.color || "#d8ccb4" }}
                                />
                              )}
                              <span>{participant.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </aside>
          </div>
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
      </div>
    </main>
  );
}
