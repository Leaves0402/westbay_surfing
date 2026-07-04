"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldControlClasses } from "@/components/ui/FormField";
import { createClient } from "@/lib/supabase/client";
import type { PublicMemberProfile, SurfTripMessage } from "@/lib/types";

type TripChatModalProps = {
  tripId: string;
  title: string;
  currentUserId: string;
  memberProfiles: PublicMemberProfile[];
  canSend: boolean;
  onClose: () => void;
  onError: (message: string) => void;
};

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TripChatModal({
  tripId,
  title,
  currentUserId,
  memberProfiles,
  canSend,
  onClose,
  onError,
}: TripChatModalProps) {
  const [messages, setMessages] = useState<SurfTripMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const getMemberName = useCallback(
    (userId: string) =>
      memberProfiles.find((member) => member.id === userId)?.full_name ||
      "未填姓名",
    [memberProfiles]
  );

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("surf_trip_messages")
      .select("id, trip_id, user_id, message, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    setIsLoading(false);

    if (error) {
      onError(`讀取聊天室失敗：${error.message}`);
      return;
    }

    setMessages((data ?? []) as SurfTripMessage[]);
  }, [onError, tripId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message) {
      onError("訊息不可空白。");
      return;
    }

    if (message.length > 500) {
      onError("訊息最多 500 字。");
      return;
    }

    if (!canSend) {
      onError("只有正式成員可以發送訊息。");
      return;
    }

    setIsSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("surf_trip_messages").insert({
      trip_id: tripId,
      user_id: currentUserId,
      message,
    });

    setIsSending(false);

    if (error) {
      onError(`發送訊息失敗：${error.message}`);
      return;
    }

    setDraft("");
    await loadMessages();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="外衝聊天室"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="shrink-0 text-primary" />
              <h2 className="font-semibold text-text-primary">外衝聊天室</h2>
            </div>
            <p className="mt-1 truncate text-xs text-text-secondary">{title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="重新整理訊息"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-appBg"
              onClick={() => void loadMessages()}
              disabled={isLoading}
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
              aria-label="關閉聊天室"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-appBg"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-text-secondary">讀取訊息中...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-text-secondary">目前還沒有訊息。</p>
          ) : (
            messages.map((item) => {
              const isMine = item.user_id === currentUserId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border border-line px-3 py-2 ${
                    isMine ? "bg-primary-light/40" : "bg-appBg"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {getMemberName(item.user_id)}
                    </p>
                    <p className="shrink-0 text-[10px] text-text-secondary">
                      {formatMessageTime(item.created_at)}
                    </p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
                    {item.message}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-line p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={canSend ? "輸入訊息..." : "僅正式成員可發送"}
              className={fieldControlClasses}
              disabled={!canSend || isSending}
            />
            <Button
              type="button"
              variant="primary"
              className="shrink-0 !min-h-11"
              onClick={() => void handleSend()}
              disabled={!canSend || isSending || !draft.trim()}
            >
              {isSending ? "送出中" : "送出"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
