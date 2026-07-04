"use client";

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

type TripConvoyProps = {
  trip: SurfTrip;
  cars: TripCarWithPassengers[];
  memberProfiles: PublicMemberProfile[];
  currentUserId: string | undefined;
  currentProfile: Profile | null;
  canInteract: boolean;
  joiningKey: string | null;
  addingCarTripId: string | null;
  newCarCapacity: string;
  isAddingCar: boolean;
  onNewCarCapacityChange: (value: string) => void;
  onToggleAddCarForm: (tripId: string) => void;
  onConfirmAddCar: (tripId: string) => void;
  onJoinSlot: (carId: string, slotIndex: number) => void;
  onLeaveSlot: (passengerId: string) => void;
  leavingPassengerId: string | null;
};

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

export function TripConvoy({
  trip,
  cars,
  memberProfiles,
  currentUserId,
  currentProfile,
  canInteract,
  joiningKey,
  addingCarTripId,
  newCarCapacity,
  isAddingCar,
  onNewCarCapacityChange,
  onToggleAddCarForm,
  onConfirmAddCar,
  onJoinSlot,
  onLeaveSlot,
  leavingPassengerId,
}: TripConvoyProps) {
  const meetsLevel = userMeetsSurfLevel(currentProfile, trip.min_surf_level);
  const isTripLeader = cars.some((car) => car.leader_id === currentUserId);
  const myPassenger = cars
    .flatMap((car) => car.passengers)
    .find((passenger) => passenger.user_id === currentUserId);
  const isPassenger = Boolean(myPassenger);

  const totalCapacity = cars.reduce((sum, car) => sum + car.capacity, 0);
  const totalPassengers = cars.reduce(
    (sum, car) => sum + car.passengers.length,
    0
  );

  const getJoinDisabledReason = (slotTaken: boolean) => {
    if (!canInteract) return "僅正式成員可跟車";
    if (!meetsLevel) return "程度不足";
    if (isTripLeader) return "你是車長";
    if (isPassenger) return "已跟車";
    if (slotTaken) return "已有人";
    return null;
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
            const passengersBySlot = new Map(
              car.passengers.map((passenger) => [
                passenger.slot_index,
                passenger,
              ])
            );

            return (
              <div
                key={car.id}
                className="rounded-xl border border-line bg-surface p-3"
              >
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max items-start gap-1">
                    <div className="flex w-16 shrink-0 flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-2xl">
                        🏄
                      </div>
                      <p className="mt-1 max-w-16 truncate text-center text-xs font-medium text-text-primary">
                        {leaderName}
                      </p>
                      <p className="text-[10px] text-text-secondary">車長</p>
                    </div>

                    {Array.from({ length: car.capacity }, (_, index) => {
                      const slotIndex = index + 1;
                      const passenger = passengersBySlot.get(slotIndex);
                      const passengerProfile = passenger
                        ? getMember(memberProfiles, passenger.user_id)
                        : null;
                      const isMine =
                        passenger?.user_id === currentUserId &&
                        Boolean(passenger);
                      const slotTaken = Boolean(passenger);
                      const disabledReason = getJoinDisabledReason(slotTaken);
                      const joinKey = `${car.id}-${slotIndex}`;
                      const isJoining = joiningKey === joinKey;

                      return (
                        <div
                          key={slotIndex}
                          className="flex items-start gap-1"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-6 h-0.5 w-3 shrink-0 rounded-full bg-border"
                          />
                          <div className="flex w-[4.5rem] shrink-0 flex-col items-center sm:w-20">
                            <div
                              className={`relative flex h-14 w-full flex-col items-center justify-center rounded-lg border shadow-sm ${
                                passenger
                                  ? "border-primary/30 bg-primary-light/40"
                                  : "border-border bg-appBg"
                              }`}
                            >
                              {passenger ? (
                                <span className="text-lg leading-none">👤</span>
                              ) : (
                                <span className="text-[10px] text-text-secondary">
                                  {slotIndex}
                                </span>
                              )}

                              {!passenger && (
                                <button
                                  type="button"
                                  className="absolute bottom-1 right-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                                  disabled={
                                    Boolean(disabledReason) || isJoining
                                  }
                                  onClick={() =>
                                    onJoinSlot(car.id, slotIndex)
                                  }
                                  title={disabledReason ?? "跟車"}
                                >
                                  {isJoining ? "..." : "跟車"}
                                </button>
                              )}
                            </div>

                            {passenger ? (
                              <div className="mt-1 flex w-full flex-col items-center gap-0.5">
                                <p className="max-w-full truncate text-center text-[11px] font-medium text-text-primary">
                                  {passengerProfile?.full_name || "未填姓名"}
                                </p>
                                <SurfLevelBadge
                                  level={passengerProfile?.surf_level}
                                />
                                {isMine && (
                                  <button
                                    type="button"
                                    className="mt-0.5 text-[10px] text-danger hover:underline disabled:opacity-40"
                                    disabled={
                                      leavingPassengerId === passenger.id
                                    }
                                    onClick={() => onLeaveSlot(passenger.id)}
                                  >
                                    {leavingPassengerId === passenger.id
                                      ? "取消中..."
                                      : "取消跟車"}
                                  </button>
                                )}
                              </div>
                            ) : (
                              disabledReason && (
                                <p className="mt-1 text-center text-[10px] text-text-secondary">
                                  {disabledReason}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
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
