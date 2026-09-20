"use client";

import type { ReactNode } from "react";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Button } from "@/components/ui/Button";
import { fieldControlClasses } from "@/components/ui/FormField";
import { userMeetsSurfLevel } from "@/lib/permissions";
import type {
  Profile,
  PublicMemberProfile,
  SurfTrip,
  SurfTripCar,
  SurfTripCarPassenger,
} from "@/lib/types";

export type TripCarWithPassengers = SurfTripCar & {
  passengers: SurfTripCarPassenger[];
};

type ConvoyUnit =
  | { type: "leader" }
  | { type: "slot"; slotIndex: number };

type TripConvoyProps = {
  trip: SurfTrip;
  cars: TripCarWithPassengers[];
  memberProfiles: PublicMemberProfile[];
  currentUserId: string | undefined;
  currentProfile: Profile | null;
  canInteract: boolean;
  isTripActivityLeader: boolean;
  joiningKey: string | null;
  removingSlotKey: string | null;
  addingCarTripId: string | null;
  newCarCapacity: string;
  isAddingCar: boolean;
  onNewCarCapacityChange: (value: string) => void;
  onToggleAddCarForm: (tripId: string) => void;
  onConfirmAddCar: (tripId: string) => void;
  onJoinSlot: (carId: string, slotIndex: number) => void;
  onLeaveSlot: (passengerId: string) => void;
  onRemoveSlot: (carId: string, slotIndex: number) => void;
  leavingPassengerId: string | null;
};

const UNITS_PER_ROW = 5;

function getMember(
  memberProfiles: PublicMemberProfile[],
  userId: string
) {
  return memberProfiles.find((member) => member.id === userId) ?? null;
}

function getMemberName(
  memberProfiles: PublicMemberProfile[],
  userId: string
) {
  return getMember(memberProfiles, userId)?.full_name || "未填姓名";
}

function buildUnits(capacity: number): ConvoyUnit[] {
  return [
    { type: "leader" },
    ...Array.from({ length: capacity }, (_, index) => ({
      type: "slot" as const,
      slotIndex: index + 1,
    })),
  ];
}

function buildSShapeRows(capacity: number): ConvoyUnit[][] {
  const units = buildUnits(capacity);
  const rows: ConvoyUnit[][] = [];
  for (let index = 0; index < units.length; index += UNITS_PER_ROW) {
    const row = units.slice(index, index + UNITS_PER_ROW);
    const rowIndex = Math.floor(index / UNITS_PER_ROW);
    rows.push(rowIndex % 2 === 1 ? [...row].reverse() : row);
  }
  return rows;
}

export function TripConvoy({
  trip,
  cars,
  memberProfiles,
  currentUserId,
  currentProfile,
  canInteract,
  isTripActivityLeader,
  joiningKey,
  removingSlotKey,
  addingCarTripId,
  newCarCapacity,
  isAddingCar,
  onNewCarCapacityChange,
  onToggleAddCarForm,
  onConfirmAddCar,
  onJoinSlot,
  onLeaveSlot,
  onRemoveSlot,
  leavingPassengerId,
}: TripConvoyProps) {
  const meetsLevel = userMeetsSurfLevel(currentProfile, trip.min_surf_level);
  const isAnyCarLeader = cars.some((car) => car.leader_id === currentUserId);
  const myPassenger = cars
    .flatMap((car) => car.passengers)
    .find((passenger) => passenger.user_id === currentUserId);
  const isPassenger = Boolean(myPassenger);

  const totalCapacity = cars.reduce((sum, car) => sum + car.capacity, 0);
  const totalPassengers = cars.reduce(
    (sum, car) => sum + car.passengers.length,
    0
  );

  const getStatusLabel = () => {
    if (isPassenger) return "已跟車";
    if (!meetsLevel) return "程度不足";
    return null;
  };

  const statusLabel = getStatusLabel();

  const canJoinSlot = (slotTaken: boolean) =>
    canInteract &&
    meetsLevel &&
    !isAnyCarLeader &&
    !isPassenger &&
    !slotTaken;

  const renderUnit = (
    car: TripCarWithPassengers,
    unit: ConvoyUnit,
    options: { showConnector: boolean; leaderName: string }
  ): ReactNode => {
    const passengersBySlot = new Map(
      car.passengers.map((passenger) => [passenger.slot_index, passenger])
    );

    if (unit.type === "leader") {
      return (
        <div key="leader" className="flex items-start gap-1">
          <div className="flex w-14 shrink-0 flex-col items-center md:w-16">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-xl md:h-12 md:w-12 md:text-2xl">
              🏄
            </div>
            <p className="mt-1 max-w-14 truncate text-center text-[11px] font-medium text-text-primary md:max-w-16 md:text-xs">
              <span translate="no">{options.leaderName}</span>
            </p>
            <p className="text-[10px] text-text-secondary">車長</p>
          </div>
          {options.showConnector && (
            <span
              aria-hidden="true"
              className="mt-5 h-0.5 w-2 shrink-0 rounded-full bg-border md:w-3"
            />
          )}
        </div>
      );
    }

    const slotIndex = unit.slotIndex;
    const passenger = passengersBySlot.get(slotIndex);
    const passengerProfile = passenger
      ? getMember(memberProfiles, passenger.user_id)
      : null;
    const isMine =
      passenger?.user_id === currentUserId && Boolean(passenger);
    const slotTaken = Boolean(passenger);
    const joinable = canJoinSlot(slotTaken);
    const joinKey = `${car.id}-${slotIndex}`;
    const removeKey = `${car.id}-${slotIndex}`;
    const isJoining = joiningKey === joinKey;
    const isRemoving = removingSlotKey === removeKey;
    const isLastSlot = slotIndex === car.capacity;

    return (
      <div key={slotIndex} className="flex items-start gap-1">
        <div className="flex w-14 shrink-0 flex-col items-center md:w-16">
          <div
            className={`relative flex h-12 w-full flex-col items-center justify-center rounded-lg border shadow-sm md:h-14 ${
              passenger
                ? "border-primary/30 bg-primary-light/40"
                : "border-border bg-appBg"
            }`}
          >
            {isTripActivityLeader && (
              <button
                type="button"
                aria-label={`移除車廂 ${slotIndex}`}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-danger/30 bg-danger-light text-[10px] font-bold leading-none text-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40 md:h-5 md:w-5"
                disabled={isRemoving}
                onClick={() => onRemoveSlot(car.id, slotIndex)}
                title={
                  !isLastSlot
                    ? "請先從最後一個空車廂開始移除。"
                    : passenger
                      ? "此車廂已有跟車者，無法移除。"
                      : "移除車廂"
                }
              >
                ×
              </button>
            )}

            {passenger ? (
              <span className="text-base leading-none md:text-lg">👤</span>
            ) : (
              <span className="text-[10px] text-text-secondary">{slotIndex}</span>
            )}

            {!passenger && (
              <button
                type="button"
                className="absolute bottom-1 right-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!joinable || isJoining}
                onClick={() => onJoinSlot(car.id, slotIndex)}
                title={statusLabel ?? "跟車"}
              >
                {isJoining ? "..." : "跟車"}
              </button>
            )}
          </div>

          {passenger ? (
            <div className="mt-1 flex w-full flex-col items-center gap-0.5">
              <p className="max-w-full truncate text-center text-[10px] font-medium text-text-primary md:text-[11px]">
                <span translate="no">
                  {passengerProfile?.full_name || "未填姓名"}
                </span>
              </p>
              <span className="origin-top scale-90">
                <SurfLevelBadge level={passengerProfile?.surf_level} />
              </span>
              {isMine && canInteract && (
                <button
                  type="button"
                  className="mt-0.5 text-[10px] text-danger hover:underline disabled:opacity-40"
                  disabled={leavingPassengerId === passenger.id}
                  onClick={() => onLeaveSlot(passenger.id)}
                >
                  {leavingPassengerId === passenger.id
                    ? "取消中..."
                    : "取消跟車"}
                </button>
              )}
            </div>
          ) : (
            statusLabel && (
              <p className="mt-1 text-center text-[10px] text-text-secondary">
                {statusLabel}
              </p>
            )
          )}
        </div>
        {options.showConnector && (
          <span
            aria-hidden="true"
            className="mt-5 h-0.5 w-2 shrink-0 rounded-full bg-border md:w-3"
          />
        )}
      </div>
    );
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">外衝車隊</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            已跟 {totalPassengers} / {totalCapacity} 人（不含車長）
          </p>
        </div>

        {canInteract && (
          <div className="flex flex-wrap items-center gap-2">
            {addingCarTripId === trip.id ? (
              <>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={newCarCapacity}
                  onChange={(event) =>
                    onNewCarCapacityChange(event.target.value)
                  }
                  placeholder="跟車人數"
                  className={`${fieldControlClasses} !min-h-9 w-28 py-1 text-sm`}
                  disabled={isAddingCar}
                />
                <Button
                  type="button"
                  variant="primary"
                  className="!min-h-9 !px-3 !text-xs"
                  onClick={() => onConfirmAddCar(trip.id)}
                  disabled={isAddingCar}
                >
                  {isAddingCar ? "新增中..." : "確認"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="!min-h-9 !px-3 !text-xs"
                  onClick={() => onToggleAddCarForm(trip.id)}
                  disabled={isAddingCar}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="!min-h-9 !px-3 !text-xs"
                onClick={() => onToggleAddCarForm(trip.id)}
              >
                新增車長
              </Button>
            )}
          </div>
        )}
      </div>

      {cars.length === 0 ? (
        <p className="text-sm text-text-secondary">目前還沒有車隊。</p>
      ) : (
        <div className="grid gap-4">
          {cars.map((car) => {
            const leaderName = getMemberName(memberProfiles, car.leader_id);
            const mobileRows = buildSShapeRows(car.capacity);
            const desktopUnits = buildUnits(car.capacity);

            return (
              <div
                key={car.id}
                className="rounded-xl border border-line bg-surface p-3"
              >
                {/* Mobile: S-shape rows, max 5 units per row */}
                <div className="flex flex-col gap-2 md:hidden">
                  {mobileRows.map((row, rowIndex) => {
                    const isRtl = rowIndex % 2 === 1;
                    const hasNextRow = rowIndex < mobileRows.length - 1;

                    return (
                      <div key={rowIndex} className="relative">
                        <div className="flex items-start gap-1">
                          {row.map((unit, unitIndex) =>
                            renderUnit(car, unit, {
                              leaderName,
                              showConnector:
                                unitIndex < row.length - 1 ||
                                (unitIndex === row.length - 1 && hasNextRow),
                            })
                          )}
                        </div>

                        {hasNextRow && (
                          <div
                            aria-hidden="true"
                            className={`mt-1 flex ${
                              isRtl ? "justify-start" : "justify-end"
                            }`}
                          >
                            <span className="h-3 w-0.5 rounded-full bg-border" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: single horizontal row, no forced wrap */}
                <div className="hidden overflow-x-auto pb-1 md:block">
                  <div className="flex min-w-max flex-nowrap items-start gap-1">
                    {desktopUnits.map((unit, unitIndex) =>
                      renderUnit(car, unit, {
                        leaderName,
                        showConnector: unitIndex < desktopUnits.length - 1,
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
