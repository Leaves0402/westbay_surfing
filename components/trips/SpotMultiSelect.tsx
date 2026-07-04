"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldControlClasses } from "@/components/ui/FormField";
import type { SurfSpot } from "@/lib/types";

export function formatSpotLabel(spot: Pick<SurfSpot, "name" | "county">) {
  return `${spot.name}（${spot.county}）`;
}

type SpotMultiSelectProps = {
  spots: SurfSpot[];
  selectedSpotIds: string[];
  onChange: (spotIds: string[]) => void;
  onCreateSpot: (input: {
    name: string;
    county: string;
  }) => Promise<SurfSpot | null>;
  disabled?: boolean;
};

export function SpotMultiSelect({
  spots,
  selectedSpotIds,
  onChange,
  onCreateSpot,
  disabled = false,
}: SpotMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpotName, setNewSpotName] = useState("");
  const [newSpotCounty, setNewSpotCounty] = useState("");
  const [createError, setCreateError] = useState("");

  const selectedSpots = useMemo(
    () =>
      selectedSpotIds
        .map((id) => spots.find((spot) => spot.id === id))
        .filter((spot): spot is SurfSpot => Boolean(spot)),
    [selectedSpotIds, spots]
  );

  const filteredSpots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return spots;

    return spots.filter((spot) => {
      const label = formatSpotLabel(spot).toLowerCase();
      return (
        spot.name.toLowerCase().includes(normalized) ||
        spot.county.toLowerCase().includes(normalized) ||
        label.includes(normalized)
      );
    });
  }, [query, spots]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const toggleSpot = (spotId: string) => {
    if (disabled) return;
    if (selectedSpotIds.includes(spotId)) {
      onChange(selectedSpotIds.filter((id) => id !== spotId));
      return;
    }
    onChange([...selectedSpotIds, spotId]);
  };

  const removeSpot = (spotId: string) => {
    if (disabled) return;
    onChange(selectedSpotIds.filter((id) => id !== spotId));
  };

  const handleCreateSpot = async () => {
    const name = newSpotName.trim();
    const county = newSpotCounty.trim();

    if (!name || !county) {
      setCreateError("請填寫浪點名稱與縣市。");
      return;
    }

    setIsCreating(true);
    setCreateError("");

    const created = await onCreateSpot({ name, county });

    setIsCreating(false);

    if (!created) return;

    if (!selectedSpotIds.includes(created.id)) {
      onChange([...selectedSpotIds, created.id]);
    }

    setNewSpotName("");
    setNewSpotCounty("");
    setShowCreateForm(false);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {selectedSpots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSpots.map((spot) => (
            <span
              key={spot.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary"
            >
              {formatSpotLabel(spot)}
              <button
                type="button"
                aria-label={`移除 ${formatSpotLabel(spot)}`}
                className="rounded-full p-0.5 hover:bg-primary/15 disabled:opacity-40"
                onClick={() => removeSpot(spot.id)}
                disabled={disabled}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="搜尋浪點名稱或縣市"
          className={`${fieldControlClasses} pl-9`}
          disabled={disabled}
        />

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <div className="max-h-[132px] overflow-y-auto">
              {filteredSpots.length === 0 ? (
                <p className="px-3 py-2 text-sm text-text-secondary">
                  找不到符合的浪點。
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {filteredSpots.map((spot) => {
                    const checked = selectedSpotIds.includes(spot.id);
                    return (
                      <li key={spot.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-appBg">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSpot(spot.id)}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-text-primary">
                            {formatSpotLabel(spot)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-line p-2">
              <Button
                type="button"
                variant="outline"
                fullWidth
                className="!min-h-9 !text-xs"
                icon={<Plus size={14} />}
                onClick={() => {
                  setShowCreateForm(true);
                  setIsOpen(false);
                  if (query.trim()) {
                    setNewSpotName(query.trim());
                  }
                }}
                disabled={disabled}
              >
                新增浪點
              </Button>
            </div>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-line bg-appBg p-3">
          <p className="mb-2 text-sm font-medium text-text-primary">新增浪點</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newSpotName}
              onChange={(event) => setNewSpotName(event.target.value)}
              placeholder="浪點名稱，例如：西子灣"
              className={fieldControlClasses}
              disabled={disabled || isCreating}
            />
            <input
              type="text"
              value={newSpotCounty}
              onChange={(event) => setNewSpotCounty(event.target.value)}
              placeholder="縣市，例如：高雄"
              className={fieldControlClasses}
              disabled={disabled || isCreating}
            />
          </div>
          {createError && (
            <p className="mt-2 text-xs text-danger">{createError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="primary"
              className="!min-h-9 !text-xs"
              onClick={() => void handleCreateSpot()}
              disabled={disabled || isCreating}
            >
              {isCreating ? "新增中..." : "確認新增"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="!min-h-9 !text-xs"
              onClick={() => {
                setShowCreateForm(false);
                setCreateError("");
              }}
              disabled={isCreating}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
