"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { resolveSafeNextPath } from "@/lib/authRedirect";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { profileSelectColumns } from "@/lib/types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "發生未知錯誤";
}

export function useAuthProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const loadOrCreateProfile = useCallback(async (currentUser: User) => {
    const supabase = createClient();

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select(profileSelectColumns)
      .eq("id", currentUser.id)
      .maybeSingle();

    if (selectError) {
      setStatusMessage(`讀取社員資料失敗：${selectError.message}`);
      return null;
    }

    if (existingProfile) {
      const typedProfile = existingProfile as Profile;
      setProfile(typedProfile);
      return typedProfile;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: currentUser.id,
      email: currentUser.email ?? "",
      full_name: currentUser.user_metadata?.full_name ?? null,
      student_id: null,
      surf_level: "初階",
    });

    if (insertError) {
      setStatusMessage(`建立社員資料失敗：${insertError.message}`);
      return null;
    }

    const { data: newProfile, error: newProfileError } = await supabase
      .from("profiles")
      .select(profileSelectColumns)
      .eq("id", currentUser.id)
      .single();

    if (newProfileError) {
      setStatusMessage(`讀取新社員資料失敗：${newProfileError.message}`);
      return null;
    }

    const typedProfile = newProfile as Profile;
    setProfile(typedProfile);
    return typedProfile;
  }, []);

  const reloadProfile = useCallback(async () => {
    if (!user) return null;
    return loadOrCreateProfile(user);
  }, [loadOrCreateProfile, user]);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initUser = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          setStatusMessage(`讀取登入狀態失敗：${error.message}`);
          setIsLoading(false);
          return;
        }

        setUser(data.user);

        if (data.user) {
          await loadOrCreateProfile(data.user);
        }

        const authListener = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;

          const sessionUser = session?.user ?? null;
          setUser(sessionUser);

          if (sessionUser) {
            void loadOrCreateProfile(sessionUser);
          } else {
            setProfile(null);
            setStatusMessage("");
          }
        });

        subscription = authListener.data.subscription;
      } catch (error) {
        if (isMounted) {
          setStatusMessage(`初始化登入狀態失敗：${getErrorMessage(error)}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initUser();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [loadOrCreateProfile]);

  /**
   * 登入後要返回的頁面。預設回到目前頁面，
   * 也可以指定原本想前往但被導回首頁的路徑。
   */
  const handleGoogleLogin = useCallback(async (nextPath?: string) => {
    const supabase = createClient();

    const currentPath = `${window.location.pathname}${window.location.search}`;
    const requestedPath = resolveSafeNextPath(nextPath ?? currentPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          requestedPath
        )}`,
      },
    });

    if (error) {
      setStatusMessage(`Google 登入失敗：${error.message}`);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setStatusMessage("");
  }, []);

  return {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    reloadProfile,
    handleGoogleLogin,
    handleLogout,
  };
}
