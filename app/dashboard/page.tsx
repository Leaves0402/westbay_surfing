"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Minus, Plus, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/components/LanguageProvider";
import { canViewBoardStorage, canViewOperationsDashboard } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import { useAuthProfile } from "@/lib/useAuthProfile";
import "./dashboard.css";

type Collector = { id: string | null; name: string; role: string | null; amount: number };
type Attendance = { id: string; name: string; count: number };
type StorageTab = "add" | "list" | "unpaid";
const storageTabs: { id: StorageTab; label: string }[] = [{ id: "add", label: "新增租用者" }, { id: "list", label: "板位名單" }, { id: "unpaid", label: "未繳費資訊" }];
type Daily = { day: string; count: number };
type MonthlyTotal = { month: string; count: number | null };
type Lease = {
  id: string; member_id: string | null; name: string; type: "member" | "guest";
  start_on: string; end_on: string; is_paid: boolean; ended_at: string | null;
};
type Dashboard = {
  today: string; month: string; through: string; income: number;
  collectors: Collector[]; daily: Daily[]; attendance: Attendance[]; academic_months: MonthlyTotal[];
  monthly: { total: number; members: number; guests: number; unpaid: number };
  storage: { capacity: number; leases: Lease[] } | null;
};
type MemberResult = { id: string; full_name: string; student_id: string | null };
const swatches = ["#00c8ff", "#69d7c1", "#fff500", "#ff7900", "#ff123f"];
const attendanceSwatches = ["#24b8e6", "#43d9aa", "#f0d85d", "#ed9a57", "#e9759f"];
const gaugeSwatches = ["#00dcff", "#19ff67", "#fff900", "#ff8a00", "#ff1744"];
const currency = (value: number) => "NT$ " + Math.round(value).toLocaleString("zh-TW");
const dates = (value: string) => value.replaceAll("-", "/");

function SemicircleGauge({ value, step, unit, label }: { value: number; step: number; unit: string; label: string }) {
  const { isEnglish, t } = useLanguage();
  const limit = step * 5;
  const activeColor = gaugeSwatches[Math.max(0, Math.min(4, Math.ceil(value / step) - 1))];
  const fraction = Math.max(0, Math.min(1, value / limit));
  const position = (fraction: number, radius: number) => ({
    x: 200 - radius * Math.cos(fraction * Math.PI),
    y: 190 - radius * Math.sin(fraction * Math.PI),
  });
  const arc = (start: number, end: number) => {
    const a = position(start, 145), b = position(end, 145);
    return `M ${a.x} ${a.y} A 145 145 0 0 1 ${b.x} ${b.y}`;
  };
  return <div className="db-semicircle-gauge">
    <svg viewBox="0 -20 400 250" role="img" aria-label={isEnglish ? `${t(label)}: ${value.toLocaleString("en-US")} ${t(unit)}. Each color represents ${step}; scale maximum ${limit}.` : `${label} ${value.toLocaleString("zh-TW")} ${unit}，每 ${step.toLocaleString("zh-TW")} ${unit}一色，刻度上限 ${limit.toLocaleString("zh-TW")} ${unit}`}>
      {gaugeSwatches.map((color, i) => <path className="db-gauge-band" key={color} d={arc(i / 5, (i + 1) / 5)} fill="none" stroke={color} strokeWidth="12" style={{ color }} />)}
      {Array.from({ length: 21 }, (_, i) => {
        const major = i % 4 === 0, a = position(i / 20, 162), b = position(i / 20, major ? 177 : 170);
        const tickLabel = position(i / 20, 195);
        const endpoint = i === 0 || i === 20;
        return <g key={i}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? "#ffffff" : "#39ff14"} strokeWidth={major ? 2 : 1} />
          {major && <text x={endpoint ? (i === 0 ? 14 : 386) : tickLabel.x} y={endpoint ? 218 : tickLabel.y + 6} textAnchor={endpoint ? (i === 0 ? "start" : "end") : "middle"} fill="#ffffff" fontSize="18">{(i * step / 4).toLocaleString("zh-TW")}</text>}
        </g>;
      })}
      <g transform={`rotate(${fraction * 180} 200 190)`} className="db-needle"><path d="M 76 190 L 200 184 L 211 190 L 200 196 Z" fill="#e1f5fb" /></g>
      <circle cx="200" cy="190" r="9" fill="#d4e9f0" stroke="#7b9eab" strokeWidth="3" />
      <circle cx="200" cy="190" r="3" fill="#456776" />
    </svg>
    <div className="db-gauge-total"><strong style={{ color: activeColor }}>{value.toLocaleString("zh-TW")}</strong><span>{t(unit)}</span></div>
  </div>;
}

function Ring({ value, total, label, tone = 0, large = false, compact = false, showBoard = false }: { value: number; total: number; label: string; tone?: number; large?: boolean; compact?: boolean; showBoard?: boolean }) {
  const { t } = useLanguage();
  const fraction = total ? Math.min(1, value / total) : 0;
  const percent = Math.round(fraction * 100);
  return (
    <div className={large ? "db-ring-block db-ring-large" : "db-ring-block"}>
      <div className="db-ring" style={{ "--ring-color": swatches[tone % 5], "--ring-percent": String(percent) + "%" } as React.CSSProperties}
        role="img" aria-label={t(label) + " " + percent + "%"}>
        <div>{showBoard ? <svg className="db-surfboard-icon" viewBox="0 0 40 64" aria-hidden="true" focusable="false">
          <path d="M20 2C13 12 8 25 9 39c.6 10 3.5 17 7 22h8c3.5-5 6.4-12 7-22C32 25 27 12 20 2Z" fill="#69d7c1" fillOpacity=".14" stroke="currentColor" strokeWidth="2.5" />
          <path d="M20 7v49" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
          <path d="m20 43 8 9-8-3" fill="currentColor" opacity=".75" />
        </svg> : <strong>{percent}%</strong>}{!compact && <small>{value.toLocaleString("zh-TW")} / {total.toLocaleString("zh-TW")}</small>}</div>
      </div>
      {!compact && <span className="db-ring-label">{t(label)}</span>}
    </div>
  );
}

function TrendChart({ days, month, monthly }: { days: Daily[]; month: string; monthly?: MonthlyTotal[] }) {
  const { isEnglish, t } = useLanguage();
  const isMonthly = monthly !== undefined;
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: isMonthly ? 300 : 760, height: isMonthly ? 150 : 240 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(200, entry.contentRect.width), height: Math.max(isMonthly ? 100 : 125, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isMonthly]);
  const [year, numericMonth] = month.slice(0, 7).split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, numericMonth, 0)).getUTCDate();
  const counts = new Map(days.map(day => [day.day, day.count]));
  const calendar = isMonthly ? monthly!.map(item => ({ day: item.month, count: item.count })) : Array.from({ length: dayCount }, (_, index) => {
    const day = month.slice(0, 7) + "-" + String(index + 1).padStart(2, "0");
    return { day, count: counts.get(day) ?? null };
  });
  const { width, height } = size, left = isEnglish ? 53 : (isMonthly ? 33 : 40), right = isEnglish ? 39 : (isMonthly ? 28 : 23), top = 23, bottom = 28;
  const highest = Math.max(0, ...calendar.map(day => day.count ?? 0));
  const tickStep = isMonthly ? 15 : highest > 12 ? Math.ceil((highest + 1) / 12) * 3 : 3;
  const max = isMonthly ? Math.max(15, Math.ceil(highest / 15) * 15) : highest > 12 ? Math.ceil((highest + 1) / tickStep) * tickStep : 12;
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const x = (index: number) => left + (width - left - right) * index / Math.max(1, calendar.length - 1);
  const actual = calendar.flatMap((day, index) => day.count === null ? [] : [{ ...day, index, count: day.count }]);
  const points = actual.map(day => x(day.index) + "," + y(day.count)).join(" ");
  const area = actual.length ? x(actual[0].index) + "," + y(0) + " " + points + " " + x(actual[actual.length - 1].index) + "," + y(0) : "";
  const ticks = Array.from({ length: max / tickStep + 1 }, (_, index) => index * tickStep);
  const hovered = hoverIndex === null ? null : calendar[hoverIndex];
  const hasHover = hovered?.count !== null && hovered?.count !== undefined;
  const tooltipWidth = isMonthly ? 124 : 140, tooltipHeight = isMonthly ? 42 : 48;
  const tooltipX = hoverIndex === null ? 0 : Math.max(left - 8, Math.min(width - tooltipWidth - 2, x(hoverIndex) - tooltipWidth / 2));
  const tooltipY = hasHover ? y(hovered!.count!) - tooltipHeight - 10 : 0;
  const lineColor = isMonthly ? "#69d7c1" : "#ff7900";
  const gradientId = isMonthly ? "db-monthly-fill" : "db-daily-fill";
  const fontSize = isMonthly ? 12 : 14;
  const pointAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientX - rect.left) * width / rect.width;
    if (offset < left || offset > width - right) { setHoverIndex(null); return; }
    const index = Math.max(0, Math.min(calendar.length - 1, Math.round((offset - left) / (width - left - right) * (calendar.length - 1))));
    setHoverIndex(calendar[index]?.count === null ? null : index);
  };
  const moveKeyboard = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") { setHoverIndex(null); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !actual.length) return;
    event.preventDefault();
    const last = actual[actual.length - 1].index;
    setHoverIndex(current => event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
  };
  const chartLabel = isMonthly
    ? (isEnglish ? "Monthly board rentals from September to June. Use arrow keys to inspect monthly totals." : "9月至隔年6月租板人次，可用左右方向鍵查看月份與人次")
    : (isEnglish ? `Daily board rentals for ${year}/${numericMonth}, ${dayCount} days. Use arrow keys to inspect dates and counts.` : `每日租板人次，${year} 年 ${numericMonth} 月，共 ${dayCount} 天；可用左右方向鍵查看日期與人次`);
  return <div className="db-chart-scroll" ref={chartRef}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0} aria-label={chartLabel}
      onPointerMove={pointAt} onPointerLeave={() => setHoverIndex(null)}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setHoverIndex(current => current ?? (actual.length ? 0 : null)); }}
      onBlur={() => setHoverIndex(null)} onKeyDown={moveKeyboard} className={isMonthly ? "db-trend db-monthly-trend" : "db-trend"}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop stopColor={lineColor} stopOpacity=".25" /><stop offset="1" stopColor={lineColor} stopOpacity="0" /></linearGradient></defs>
      <text x="1" y="14" fill="#d0edff" fontSize={fontSize}>{t("人次")}</text>
      {ticks.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#1b497c" strokeDasharray="3 6" /><text x={left - 10} y={y(value) + 4} textAnchor="end" fill="#c9e4ff" fontSize={fontSize}>{value}</text></g>)}
      {calendar.map((day, index) => (isMonthly ? index % 3 === 0 : (index + 1) % 5 === 0) && <g key={day.day}>
        <line x1={x(index)} x2={x(index)} y1={top} y2={y(0)} stroke="#12345d" strokeDasharray="3 6" />
        <text x={x(index)} y={height - 6} textAnchor="middle" fill="#c9e4ff" fontSize={fontSize}>{isMonthly ? Number(day.day.slice(5, 7)) : index + 1}</text>
      </g>)}
      <line x1={left} x2={left} y1={top} y2={y(0)} stroke="#568fc2" />
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#568fc2" />
      {area && <polygon points={area} fill={`url(#${gradientId})`} />}
      {points && <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
      {actual.map(day => day.count > 0 && <circle key={day.day} cx={x(day.index)} cy={y(day.count)} r={isMonthly ? 3.5 : 3} fill={lineColor} />)}
      <text x={width - 1} y={height - 6} textAnchor="end" fill="#d0edff" fontSize={fontSize}>{isEnglish ? (isMonthly ? "Mo." : "Day") : (isMonthly ? "月" : "日")}</text>
      {hasHover && hoverIndex !== null && <g className="db-chart-tooltip" pointerEvents="none">
        <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={top} y2={y(0)} stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle cx={x(hoverIndex)} cy={y(hovered!.count!)} r="5" fill={lineColor} stroke="#ffffff" strokeWidth="1.5" />
        <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="6" fill="#00162f" stroke={lineColor} />
        <text x={tooltipX + 10} y={tooltipY + (isMonthly ? 16 : 19)} fill="#ffffff" fontSize="13">{dates(isMonthly ? hovered!.day.slice(0, 7) : hovered!.day)}</text>
        <text x={tooltipX + 10} y={tooltipY + (isMonthly ? 33 : 38)} fill={lineColor} fontSize="14" fontWeight="700">{hovered!.count} {t("人次")}</text>
      </g>}
    </svg>
  </div>;
}

function AttendanceChart({ entries, colors }: { entries: Attendance[]; colors: Record<string, string> }) {
  const { isEnglish, t } = useLanguage();
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const displayName = (entry: Attendance) => entry.id === "staff" ? (isEnglish ? "Staff" : "幹部") : entry.id === "unassigned" ? t("未指定") : entry.name;
  const countUnit = (count: number) => isEnglish ? (count === 1 ? "session" : "sessions") : "次";
  const shade = (hex: string, amount: number) => "#" + [1, 3, 5].map(index => Math.round(parseInt(hex.slice(index, index + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
  const activeEntries = entries.filter(entry => entry.count > 0);
  const slices = activeEntries.map((entry, index) => {
    const start = -Math.PI / 2 + activeEntries.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) / total * Math.PI * 2;
    const end = start + entry.count / total * Math.PI * 2;
    return { entry, color: colors[entry.id] ?? "#8295a5", path: `M 120 68 L ${120 + 102 * Math.cos(start)} ${68 + 55 * Math.sin(start)} A 102 55 0 ${end - start > Math.PI ? 1 : 0} 1 ${120 + 102 * Math.cos(end)} ${68 + 55 * Math.sin(end)} Z` };
  });
  const summary = entries.map(entry => displayName(entry) + " " + entry.count + " " + countUnit(entry.count)).join(", ");
  return <div className="db-attendance-body">
    <svg className="db-attendance-pie" viewBox="0 0 240 160" role="img" aria-label={(isEnglish ? `Attendance this month: ${total} sessions. ` : `本月板務出勤，共 ${total} 次；`) + summary}>
      <defs><filter id="db-pie-shadow" x="-30%" y="-50%" width="160%" height="220%"><feGaussianBlur stdDeviation="5" /></filter></defs>
      <ellipse cx="120" cy="95" rx="102" ry="52" fill="#000000" opacity=".8" filter="url(#db-pie-shadow)" />
      {!total && <ellipse cx="120" cy="76" rx="102" ry="55" fill="#163b6b" />}
      {Array.from({ length: 15 }, (_, index) => 15 - index).map(depth => <g key={depth} transform={`translate(0 ${depth})`}>
        {slices.map(({ entry, color, path }) => entry.count === total
          ? <ellipse key={entry.id} cx="120" cy="68" rx="102" ry="55" fill={shade(color, .62 + (15 - depth) * .014)} />
          : <path key={entry.id} d={path} fill={shade(color, .62 + (15 - depth) * .014)} />)}
      </g>)}
      {slices.map(({ entry, color, path }) => {
        const title = displayName(entry) + ": " + entry.count + " " + countUnit(entry.count) + " (" + Math.round(entry.count / total * 100) + "%)";
        return entry.count === total
          ? <ellipse key={entry.id} cx="120" cy="68" rx="102" ry="55" fill={color} stroke="#00101f" strokeWidth="1.5"><title>{title}</title></ellipse>
          : <path key={entry.id} d={path} fill={color} stroke="#00101f" strokeWidth="1.5"><title>{title}</title></path>;
      })}
    </svg>
    <ul className="db-attendance-legend">{entries.map(entry => <li key={entry.id}><span><i style={{ background: colors[entry.id] ?? "#8295a5" }} /><span translate="no">{displayName(entry)}</span></span><strong>{entry.count}<small>{isEnglish ? "×" : "次"}</small></strong></li>)}</ul>
  </div>;
}

function Panel({ title, children, className = "", actions }: { title: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  const { t } = useLanguage();
  return <section className={"db-panel " + className}><div className="db-panel-heading"><h2>{t(title)}</h2>{actions ?? <span className="db-panel-dot" />}</div>{children}</section>;
}

function StorageAccessDenied() {
  const { t } = useLanguage();
  return <section className="db-storage-locked" aria-labelledby="db-storage-denied-title">
    <div className="db-storage-grid db-storage-ghost" aria-hidden="true" inert>
      <div className="db-panel db-storage-overview"><div className="db-panel-heading"><h2>{t("板位使用狀況")}</h2></div><div className="db-ghost-gauge" /><div className="db-ghost-bar db-ghost-number" /></div>
      <div className="db-panel db-control-panel">{["已租出板位", "剩餘板位"].map(label => <div className="db-capacity-row" key={label}><div className="db-capacity-ring"><span>{t(label)}</span><div className="db-ghost-ring" /></div><div className="db-ghost-bar" /></div>)}</div>
      <div className="db-panel db-storage-tabs"><div className="db-ghost-tabs">{storageTabs.map(tab => <span key={tab.id}>{t(tab.label)}</span>)}</div><div className="db-ghost-rows">{[0, 1, 2, 3].map(index => <div key={index}><span className="db-ghost-bar" /><span className="db-ghost-bar" /></div>)}</div></div>
    </div>
    <div className="db-storage-mask"><EyeOff size={48} strokeWidth={1.6} aria-hidden="true" /><h2 id="db-storage-denied-title">{t("沒有權限")}</h2><p>{t("板位資訊僅限幹部與管理員查看")}</p></div>
  </section>;
}

export default function DashboardPage() {
  const { isEnglish, t } = useLanguage();
  const { user, profile, isLoading, statusMessage, handleGoogleLogin, handleLogout } = useAuthProfile();
  const allowed = canViewOperationsDashboard(profile);
  const storageAllowed = canViewBoardStorage(profile);
  const [month, setMonth] = useState(() => getTaipeiDate().slice(0, 7));
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<MemberResult[]>([]);
  const [selected, setSelected] = useState<MemberResult | null>(null);
  const [renterType, setRenterType] = useState<"member" | "guest">("member");
  const [guestName, setGuestName] = useState("");
  const [startOn, setStartOn] = useState(getTaipeiDate());
  const [storageTab, setStorageTab] = useState<StorageTab>("list");
  
  const reload = useCallback(async (target: string) => {
    setBusy(true); setError("");
    const { data: payload, error: requestError } = await createClient().rpc("get_operations_dashboard", { target_month: target + "-01" });
    if (requestError) setError(requestError.message);
    else setData(payload as Dashboard);
    setBusy(false);
  }, []);

  useEffect(() => { if (!allowed) return; const timer = window.setTimeout(() => void reload(month), 0); return () => window.clearTimeout(timer); }, [allowed, month, profile?.role, reload]);

  useEffect(() => {
    if (!storageAllowed || renterType !== "member" || !search.trim() || selected) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const { data: result, error: requestError } = await createClient().rpc("search_board_storage_members", { search_term: search.trim() });
      if (active) { setMatches(requestError ? [] : (result as MemberResult[])); if (requestError) setError(requestError.message); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storageAllowed, renterType, search, selected]);

  const mutate = async (args: Record<string, unknown>, done: string) => {
    if (!storageAllowed) { setError("沒有權限"); return false; }
    setActionBusy(true); setError(""); setNotice("");
    const { error: requestError } = await createClient().rpc("manage_board_storage", args);
    if (requestError) setError(requestError.message);
    else {
      setNotice(done);
      await reload(month);
    }
    setActionBusy(false);
    return !requestError;
  };

  const addLease = async (event: React.FormEvent) => {
    event.preventDefault();
    if (renterType === "member" && !selected) { setError("請從搜尋結果選擇社員。"); return; }
    if (renterType === "guest" && !guestName.trim()) { setError("請輸入非社員姓名。"); return; }
    const ok = await mutate({
      action: "add", member_id: renterType === "member" ? selected?.id : null,
      guest_name: renterType === "guest" ? guestName.trim() : null, start_on: startOn
    }, "已新增板位租用紀錄。");
    if (ok) { setSelected(null); setSearch(""); setGuestName(""); setMatches([]); setStorageTab("list"); }
  };

  const changeMonth = (delta: number) => {
    const [year, numericMonth] = month.split("-").map(Number);
    const d = new Date(Date.UTC(year, numericMonth - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const activeLeases = data?.storage?.leases.filter(l => !l.ended_at) ?? [];
  const unpaidLeases = data?.storage?.leases.filter(l => !l.is_paid) ?? [];
  const capacity = data?.storage?.capacity ?? 0;
  const occupied = activeLeases.length;
  const remaining = Math.max(0, capacity - occupied);
  const currentMonth = getTaipeiDate().slice(0, 7);
  const boardTone = Math.max(0, Math.min(4, Math.ceil(occupied / 4) - 1));
  const empty = <p className="db-empty">{t("目前沒有資料")}</p>;
  const formatMonth = useMemo(() => month.replace("-", " / "), [month]);

  const collectors = useMemo(() => [...(data?.collectors ?? [])].sort((a, b) => Number(b.role === "board_manager") - Number(a.role === "board_manager") || b.amount - a.amount || a.name.localeCompare(b.name, "zh-TW")), [data]);
  const attendanceColors = useMemo(() => {
    const colors: Record<string, string> = { staff: "#8b929c", unassigned: "#8295a5" };
    collectors.filter(collector => collector.role === "board_manager").forEach((collector, index) => { if (collector.id) colors[collector.id] = attendanceSwatches[index % attendanceSwatches.length]; });
    return colors;
  }, [collectors]);
  const collectorName = (collector: Collector) => collector.id === null ? t("未記錄收款人") : collector.name === "未填姓名" ? t("未填姓名") : collector.name;
  const attendanceTotal = (data?.attendance ?? []).reduce((sum, entry) => sum + entry.count, 0);
  const academicTotal = (data?.academic_months ?? []).reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  const switchStorageTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? storageTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + storageTabs.length) % storageTabs.length;
    setStorageTab(storageTabs[next].id);
    document.getElementById("db-tab-" + storageTabs[next].id)?.focus();
  };

  return (
    <main className="db-shell">
      <Navbar user={user} profile={profile} isLoading={isLoading} onLogin={handleGoogleLogin} onLogout={handleLogout} />
      <div className="db-page" data-i18n-ignore><div className="db-content">
        {isLoading ? <p className="db-access">{t("正在確認登入身分…")}</p>
        : !user ? <p className="db-access">{t("請登入後查看營運儀錶板。")}</p>
        : !allowed ? <p className="db-access">{t("此頁僅供板務、幹部與管理員查看。")}</p>
        : <>
          {statusMessage && <p className="db-alert" role="alert">{t(statusMessage)}</p>}
          {error && <p className="db-alert" role="alert">{t(error)}</p>}
          {notice && <p className="db-success" role="status">{t(notice)}</p>}
          <div className="db-workspace">
            {!data ? <Panel title={t("租板資料")}>{busy ? <p className="db-empty">{t("正在載入…")}</p> : empty}</Panel> : <>
              <div className="db-rent-grid" aria-busy={busy}>
                <Panel title={t("租板累積收入")} className="db-income-panel"><SemicircleGauge value={data.income} step={2000} unit="元" label={t("租板累積已收款")} /></Panel>
                <Panel title={t("每日租板人次")} className="db-daily-panel" actions={<div className="db-daily-actions"><div className="db-month"><button aria-label={t("上個月")} type="button" disabled={busy} onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong>{formatMonth}</strong><button aria-label={t("下個月")} type="button" disabled={busy || month >= currentMonth} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div><span className="db-chart-total">{data.monthly.total}<small>{t("人次")}</small></span></div>}><TrendChart days={data.daily} month={data.month} /></Panel>
                <section className="db-panel db-collector-panel" aria-label={t("各人員收款")}>
                  <div className="db-collector-grid" tabIndex={0} role="region" aria-label={t("收款人員，板務在前，可左右捲動")}>
                    {collectors.length ? collectors.map((collector, index) => <div className="db-collector" key={collector.id ?? "unknown"} title={collectorName(collector) + ": " + currency(collector.amount)}>
                      <Ring value={collector.amount} total={data.income} label={collectorName(collector)} tone={index} compact />
                      <div className="db-collector-info"><span translate="no">{collectorName(collector)}</span><strong>{currency(collector.amount)}</strong></div>
                    </div>) : empty}
                  </div>
                </section>
                <div className="db-right-column"><section className="db-panel db-academic-panel" aria-label={t("學年度各月租板人次")}><div className="db-academic-heading"><h2>{t("每月租板人次")}</h2><span className="db-chart-total db-academic-total">{academicTotal}<small>{t("人次")}</small></span></div><TrendChart days={[]} month={data.month} monthly={data.academic_months ?? []} /></section><Panel title={t("板務出勤次數")} className="db-attendance-panel" actions={<span className="db-attendance-total">{attendanceTotal}<small>{isEnglish ? "sessions" : "次"}</small></span>}><AttendanceChart entries={data.attendance ?? []} colors={attendanceColors} /></Panel></div>
              </div>
              {storageAllowed && data.storage ? <div className="db-storage-grid">
                <Panel title={t("板位使用狀況")} className="db-storage-overview">
                  <SemicircleGauge value={occupied} step={4} unit="人" label={t("板位租用人數")} />
                  <p className="db-capacity-note">{isEnglish ? `Capacity ${capacity} spaces · Utilization ${capacity ? Math.round(occupied / capacity * 100) : 0}%` : `目前容量 ${capacity} 格 · 使用率 ${capacity ? Math.round(occupied / capacity * 100) : 0}%`}</p>
                </Panel>
                <section className="db-panel db-control-panel" aria-label={t("已租出與剩餘板位")}>
                  <div className="db-capacity-row">
                    <div className="db-capacity-ring"><span>{t("已租出板位")}</span><Ring value={occupied} total={capacity} label={t("已租出板位")} tone={boardTone} large compact showBoard /></div>
                    <div className="db-capacity-value"><strong>{occupied}<small>{t("人")}</small></strong></div>
                  </div>
                  <div className="db-capacity-row">
                    <div className="db-capacity-ring"><span>{t("剩餘板位")}</span><Ring value={remaining} total={capacity} label={t("剩餘板位")} tone={1} large compact showBoard /></div>
                    <div className="db-capacity-value"><strong>{remaining}<small>{t("格")}</small></strong>
                      <div className="db-control-actions">
                        <button type="button" aria-label={t("減少一格總板位")} disabled={actionBusy || remaining === 0} onClick={() => void mutate({ action: "capacity", delta: -1 }, "已減少一格板位。")}><Minus size={17} /></button>
                        <button type="button" aria-label={t("增加一格總板位")} disabled={actionBusy || capacity >= 10000} onClick={() => void mutate({ action: "capacity", delta: 1 }, "已增加一格板位。")}><Plus size={17} /></button>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="db-panel db-storage-tabs" aria-label={t("板位資訊")}>
                  <div className="db-storage-tab-list" role="tablist" aria-label={t("板位管理功能")}>
                    {storageTabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={"db-tab-" + tab.id} aria-controls={"db-panel-" + tab.id} aria-selected={storageTab === tab.id} tabIndex={storageTab === tab.id ? 0 : -1} onKeyDown={event => switchStorageTab(event, index)} onClick={() => setStorageTab(tab.id)}>
                      {t(tab.label)}{tab.id !== "add" && <span className="db-count">{tab.id === "list" ? occupied : unpaidLeases.length}</span>}
                    </button>)}
                  </div>
                  <div className="db-storage-tab-body" role="tabpanel" id={"db-panel-" + storageTab} aria-labelledby={"db-tab-" + storageTab} tabIndex={0}>
                    {storageTab === "add" && <form onSubmit={event => void addLease(event)}>
                      <div className="db-choice"><label><input type="radio" checked={renterType === "member"} onChange={() => { setRenterType("member"); setGuestName(""); }} />{" "}{t("社員")}</label><label><input type="radio" checked={renterType === "guest"} onChange={() => { setRenterType("guest"); setSelected(null); setSearch(""); setMatches([]); }} />{" "}{t("非社員")}</label></div>
                      {renterType === "member" ? <div className="db-search"><label htmlFor="db-member-search">{t("搜尋社員姓名")}</label><div className="db-input-icon"><Search size={16} /><input id="db-member-search" value={search} onChange={event => { setSearch(event.target.value); setSelected(null); }} placeholder={t("輸入姓名，從結果選擇")} autoComplete="off" /></div>
                        {selected ? <p className="db-selected">{t("已選取：")}{selected.full_name} {selected.student_id && "· " + selected.student_id}</p> : search.trim() && <div className="db-results" role="listbox" aria-label={t("社員搜尋結果")}>{matches.length ? matches.map(member => <button type="button" role="option" aria-selected={false} key={member.id} onClick={() => { setSelected(member); setSearch(member.full_name); setMatches([]); }}>{member.full_name}<span>{member.student_id}</span></button>) : <p>{t("沒有符合的社員")}</p>}</div>}</div>
                      : <div className="db-search"><label htmlFor="db-guest-name">{t("非社員姓名")}</label><input id="db-guest-name" value={guestName} maxLength={100} onChange={event => setGuestName(event.target.value)} placeholder={t("請填寫可辨識的姓名")} required /></div>}
                      <div className="db-search"><label htmlFor="db-start-date">{t("起租日期")}</label><input id="db-start-date" type="date" max={getTaipeiDate()} value={startOn} onChange={event => setStartOn(event.target.value)} required /></div>
                      <button className="db-primary-button" type="submit" disabled={actionBusy || remaining === 0}><Plus size={17} />{t("新增板位租用")}</button>
                      {remaining === 0 && <p className="db-note">{t("板位已滿，請先增加總板位。")}</p>}
                    </form>}
                    {storageTab === "list" && (activeLeases.length ? <ul className="db-list">{activeLeases.map(lease => <li key={lease.id}><div><strong translate="no">{lease.name}</strong><small>{lease.type === "member" ? t("社員") : t("非社員")} · {dates(lease.start_on)} — {dates(lease.end_on)}{lease.end_on <= data.today ? " · " + t("已到期") : ""}</small></div><div className="db-lease-actions"><span className={lease.is_paid ? "db-paid" : "db-unpaid"}>{lease.is_paid ? t("已繳") : t("未繳")}</span><button type="button" className="db-danger-button" disabled={actionBusy} onClick={() => { if (window.confirm(isEnglish ? "End the storage lease for " + lease.name + "? The record will be retained." : "確認為 " + lease.name + " 辦理退租？紀錄會保留。")) void mutate({ action: "end", target_id: lease.id }, "已辦理退租。"); }}>{t("退租")}</button></div></li>)}</ul> : empty)}
                    {storageTab === "unpaid" && (unpaidLeases.length ? <ul className="db-list">{unpaidLeases.map(lease => <li key={lease.id}><div><strong translate="no">{lease.name}</strong><small>{lease.type === "member" ? t("社員") : t("非社員")} · {dates(lease.start_on)}{lease.ended_at ? " · " + t("已退租") : ""}</small></div><label className="db-check"><input type="checkbox" disabled={actionBusy} checked={false} onChange={() => void mutate({ action: "payment", target_id: lease.id, paid: true }, "已標記繳費。")} /><span>{t("已繳費")}</span></label></li>)}</ul> : <p className="db-empty">{t("目前沒有未繳費紀錄。")}</p>)}
                  </div>
                </section>
              </div> : <StorageAccessDenied />}
            </>}
          </div>
        </>}
      </div></div>
    </main>
  );
}
