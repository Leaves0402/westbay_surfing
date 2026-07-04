type TripCapacityPreviewProps = {
  capacity: number;
};

export function TripCapacityPreview({ capacity }: TripCapacityPreviewProps) {
  const safeCapacity = Number.isFinite(capacity)
    ? Math.max(0, Math.floor(capacity))
    : 0;

  return (
    <div className="rounded-xl border border-line bg-appBg p-3">
      <p className="text-sm font-medium text-text-primary">
        人數上限：{safeCapacity} 人，不包含負責人
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        衝浪者拉車廂預覽（僅視覺輔助）
      </p>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-2xl">
            🏄
          </div>

          {Array.from({ length: safeCapacity }, (_, index) => (
            <div key={index} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-0.5 w-3 rounded-full bg-border"
              />
              <div className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface shadow-sm">
                <span className="text-sm leading-none">🧍</span>
                <span className="mt-0.5 text-[10px] text-text-secondary">
                  {index + 1}
                </span>
              </div>
            </div>
          ))}

          {safeCapacity === 0 && (
            <p className="ml-2 text-xs text-text-secondary">
              請輸入人數上限以預覽車廂
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
