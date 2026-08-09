"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NavigationBadgeChannel = "announcements" | "lessons";

export type NavigationBadges = Record<NavigationBadgeChannel, boolean>;

const emptyBadges: NavigationBadges = {
  announcements: false,
  lessons: false,
};

const channelReadEvent = "westbay:navigation-channel-read";

type NavigationBadgeRow = {
  has_unread_announcements: boolean;
  has_unread_lessons: boolean;
};

export async function markNavigationChannelRead(
  channel: NavigationBadgeChannel
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_navigation_channel_read", {
    target_channel: channel,
  });

  if (error) return false;

  const row = (data?.[0] ?? null) as NavigationBadgeRow | null;
  const badges = {
    announcements: Boolean(row?.has_unread_announcements),
    lessons: Boolean(row?.has_unread_lessons),
  } satisfies NavigationBadges;

  window.dispatchEvent(
    new CustomEvent(channelReadEvent, { detail: { badges } })
  );
  return true;
}

export function useNavigationBadges({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId?: string;
}) {
  const [badges, setBadges] = useState<NavigationBadges>(emptyBadges);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    if (!enabled || !userId) {
      queueMicrotask(() => {
        if (active) setBadges(emptyBadges);
      });
      return () => {
        active = false;
      };
    }

    const loadBadges = async () => {
      const currentRequestVersion = ++requestVersion;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_navigation_badges");

      if (!active || error || currentRequestVersion !== requestVersion) return;

      const row = (data?.[0] ?? null) as NavigationBadgeRow | null;
      setBadges({
        announcements: Boolean(row?.has_unread_announcements),
        lessons: Boolean(row?.has_unread_lessons),
      });
    };

    const handleChannelRead = (event: Event) => {
      const nextBadges = (
        event as CustomEvent<{ badges?: NavigationBadges }>
      ).detail?.badges;
      if (!nextBadges) return;
      requestVersion += 1;
      setBadges(nextBadges);
    };

    window.addEventListener(channelReadEvent, handleChannelRead);
    void loadBadges();

    return () => {
      active = false;
      window.removeEventListener(channelReadEvent, handleChannelRead);
    };
  }, [enabled, userId]);

  return badges;
}
