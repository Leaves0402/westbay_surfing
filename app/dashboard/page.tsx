"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RefreshCw, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { canViewOperationsDashboard } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import { useAuthProfile } from "@/lib/useAuthProfile";
import "./dashboard.css";

type Collector = { id: string | null; name: string; role: string | null; amount: number };
type Attendance = { id: string; name: string; count: number };
type StorageTab = "add" | "list" | "unpaid";
const storageTabs: { id: StorageTab; label: string }[] = [{ id: "add", label: "新增租用者" }, { id: "list", label: "板位名單" }, { id: "unpaid", label: "未繳費資訊" }];
type Daily = { day: string; count: number };
type Lease = {
  id: string; member_id: string | null; name: string; type: "member" | "guest";
  start_on: string; end_on: string; is_paid: boolean; ended_at: string | null;
};
type Dashboard = {
  today: string; month: string; through: string; income: number;
  collectors: Collector[]; daily: Daily[]; attendance: Attendance[];
  monthly: { total: number; members: number; guests: number; unpaid: number };
  storage: { capacity: number; leases: Lease[] };
};
type MemberResult = { id: string; full_name: string; student_id: string | null };
const swatches = ["#43bafa", "#73eac8", "#e8df7b", "#ffad65", "#fc7288"];
const currency = (value: number) => "NT$ " + Math.round(value).toLocaleString("zh-TW");
const dates = (value: string) => value.replaceAll("-", "/");

function SemicircleGauge({ value, step, unit, label }: { value: number; step: number; unit: string; label: string }) {
  const limit = step * 5;
  const fraction = Math.max(0, Math.min(1, value / limit));
  const position = (fraction: number, radius: number) => ({
    x: 200 - radius * Math.cos(fraction * Math.PI),
    y: 190 - radius * Math.sin(fraction * Math.PI),
  });
  const arc = (start: number, end: number) => {
    const a = position(start, 166), b = position(end, 166);
    return `M ${a.x} ${a.y} A 166 166 0 0 1 ${b.x} ${b.y}`;
  };
  return <div className="db-semicircle-gauge">
    <svg viewBox="0 0 400 210" role="img" aria-label={`${label} ${value.toLocaleString("zh-TW")} ${unit}，每 ${step.toLocaleString("zh-TW")} ${unit}一色，刻度上限 ${limit.toLocaleString("zh-TW")} ${unit}`}>
      <path d={arc(0, 1)} fill="none" stroke="#294451" strokeWidth="16" />
      {swatches.map((color, i) => <path key={color} d={arc(i / 5 + .003, (i + 1) / 5 - .003)} fill="none" stroke={color} strokeWidth="12" />)}
      {Array.from({ length: 21 }, (_, i) => {
        const major = i % 4 === 0, a = position(i / 20, major ? 143 : 150), b = position(i / 20, 158);
        const label = position(i / 20, 124);
        return <g key={i}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? "#d0e7ee" : "#64848f"} strokeWidth={major ? 2 : 1} />
          {major && <text x={label.x} y={label.y + 6} textAnchor="middle" fill="#bdd8e1" fontSize="18">{(i * step / 4).toLocaleString("zh-TW")}</text>}
        </g>;
      })}
      <g transform={`rotate(${fraction * 180} 200 190)`} className="db-needle"><path d="M 76 190 L 200 184 L 211 190 L 200 196 Z" fill="#e1f5fb" /></g>
      <circle cx="200" cy="190" r="9" fill="#d4e9f0" stroke="#7b9eab" strokeWidth="3" />
      <circle cx="200" cy="190" r="3" fill="#456776" />
    </svg>
    <div className="db-gauge-total"><strong>{value.toLocaleString("zh-TW")}</strong><span>{unit}</span></div>
  </div>;
}

function Ring({ value, total, label, tone = 0, large = false, compact = false }: { value: number; total: number; label: string; tone?: number; large?: boolean; compact?: boolean }) {
  const fraction = total ? Math.min(1, value / total) : 0;
  const percent = Math.round(fraction * 100);
  return (
    <div className={large ? "db-ring-block db-ring-large" : "db-ring-block"}>
      <div className="db-ring" style={{ "--ring-color": swatches[tone % 5], "--ring-percent": String(percent) + "%" } as React.CSSProperties}
        role="img" aria-label={label + " " + percent + "%"}>
        <div><strong>{percent}%</strong>{!compact && <small>{value.toLocaleString("zh-TW")} / {total.toLocaleString("zh-TW")}</small>}</div>
      </div>
      {!compact && <span className="db-ring-label">{label}</span>}
    </div>
  );
}

function TrendChart({ days, month }: { days: Daily[]; month: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height: 240 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(280, entry.contentRect.width), height: Math.max(125, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [year, numericMonth] = month.slice(0, 7).split("-").map(Number);
  const count = new Date(Date.UTC(year, numericMonth, 0)).getUTCDate();
  const counts = new Map(days.map(day => [day.day, day.count]));
  const calendar = Array.from({ length: count }, (_, index) => {
    const day = month.slice(0, 7) + "-" + String(index + 1).padStart(2, "0");
    return { day, count: counts.get(day) ?? null };
  });
  const { width, height } = size, left = 40, right = 20, top = 23, bottom = 30;
  const highest = Math.max(0, ...days.map(day => day.count));
  const tickStep = highest > 12 ? Math.ceil((highest + 1) / 12) * 3 : 3;
  const max = highest > 12 ? Math.ceil((highest + 1) / tickStep) * tickStep : 12;
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const x = (index: number) => left + (width - left - right) * index / Math.max(1, calendar.length - 1);
  const actual = calendar.flatMap((day, index) => day.count === null ? [] : [{ ...day, index, count: day.count }]);
  const points = actual.map(day => x(day.index) + "," + y(day.count)).join(" ");
  const area = actual.length ? x(actual[0].index) + "," + y(0) + " " + points + " " + x(actual[actual.length - 1].index) + "," + y(0) : "";
  const ticks = Array.from({ length: max / tickStep + 1 }, (_, index) => index * tickStep);
  const hovered = hoverIndex === null ? null : calendar[hoverIndex];
  const hasHover = hovered?.count !== null && hovered?.count !== undefined;
  const tooltipX = hoverIndex === null ? 0 : Math.max(left, Math.min(width - 151, x(hoverIndex) - 69));
  const tooltipY = hasHover ? y(hovered!.count!) - 58 : 0;
  const pointAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientX - rect.left) * width / rect.width;
    if (offset < left || offset > width - right) { setHoverIndex(null); return; }
    const index = Math.max(0, Math.min(calendar.length - 1, Math.round((offset - left) / (width - left - right) * (calendar.length - 1))));
    setHoverIndex(calendar[index].count === null ? null : index);
  };
  const moveKeyboard = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") { setHoverIndex(null); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !actual.length) return;
    event.preventDefault();
    const last = actual[actual.length - 1].index;
    setHoverIndex(current => event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
  };
  return <div className="db-chart-scroll" ref={chartRef}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0}
      aria-label={`每日租板人次，${year} 年 ${numericMonth} 月，共 ${count} 天；可用左右方向鍵查看日期與人次`}
      onPointerMove={pointAt} onPointerLeave={() => setHoverIndex(null)}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setHoverIndex(current => current ?? (actual.length ? 0 : null)); }}
      onBlur={() => setHoverIndex(null)} onKeyDown={moveKeyboard} className="db-trend">
      <defs><linearGradient id="db-line-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4de6d2" stopOpacity=".2" /><stop offset="1" stopColor="#4de6d2" stopOpacity="0" /></linearGradient></defs>
      <text x="1" y="15" fill="#b4d5df" fontSize="14">人次</text>
      {ticks.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#35525f" strokeDasharray="3 6" /><text x={left - 12} y={y(value) + 5} textAnchor="end" fill="#accbd6" fontSize="14">{value}</text></g>)}
      {calendar.map((day, index) => (index + 1) % 5 === 0 && <g key={day.day}>
        <line x1={x(index)} x2={x(index)} y1={top} y2={y(0)} stroke="#284957" strokeDasharray="3 6" />
        <text x={x(index)} y={height - 7} textAnchor="middle" fill="#accbd6" fontSize="14">{index + 1}</text>
      </g>)}
      <line x1={left} x2={left} y1={top} y2={y(0)} stroke="#587580" />
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#587580" />
      {area && <polygon points={area} fill="url(#db-line-fill)" />}
      {points && <polyline points={points} fill="none" stroke="#72ead0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {actual.map(day => day.count > 0 && <circle key={day.day} cx={x(day.index)} cy={y(day.count)} r="3" fill="#a4fff0" />)}
      <text x={width - 1} y={height - 7} textAnchor="end" fill="#b4d5df" fontSize="14">日</text>
      {hasHover && hoverIndex !== null && <g className="db-chart-tooltip" pointerEvents="none">
        <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={top} y2={y(0)} stroke="#c9f7ee" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle cx={x(hoverIndex)} cy={y(hovered!.count!)} r="5" fill="#b0ffef" stroke="#0e2836" strokeWidth="2" />
        <rect x={tooltipX} y={tooltipY} width="140" height="48" rx="7" fill="#153c4c" stroke="#69cdb8" />
        <text x={tooltipX + 11} y={tooltipY + 19} fill="#ddf6f9" fontSize="13">{dates(hovered!.day)}</text>
        <text x={tooltipX + 11} y={tooltipY + 38} fill="#86f2d6" fontSize="14" fontWeight="700">{hovered!.count} 人次</text>
      </g>}
    </svg>
  </div>;
}

function AttendanceChart({ entries, colors }: { entries: Attendance[]; colors: Record<string, string> }) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const activeEntries = entries.filter(entry => entry.count > 0);
  return <div className="db-attendance-body">
    <svg className="db-attendance-pie" viewBox="0 0 200 200" role="img" aria-label={"本月板務出勤，共 " + total + " 次；" + entries.map(entry => entry.name + " " + entry.count + " 次").join("，")}>
      {!total && <circle cx="100" cy="100" r="84" fill="#2c4655" />}
      {activeEntries.map((entry, index) => {
        const start = -Math.PI / 2 + activeEntries.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) / total * Math.PI * 2;
        const end = start + entry.count / total * Math.PI * 2;
        const color = colors[entry.id] ?? "#99b6c6";
        if (entry.count === total) return <circle key={entry.id} cx="100" cy="100" r="84" fill={color}><title>{entry.name}：{entry.count} 次</title></circle>;
        const path = `M 100 100 L ${100 + 84 * Math.cos(start)} ${100 + 84 * Math.sin(start)} A 84 84 0 ${end - start > Math.PI ? 1 : 0} 1 ${100 + 84 * Math.cos(end)} ${100 + 84 * Math.sin(end)} Z`;
        return <path key={entry.id} d={path} fill={color} stroke="#102635" strokeWidth="2"><title>{entry.name}：{entry.count} 次（{Math.round(entry.count / total * 100)}%）</title></path>;
      })}
    </svg>
    <ul className="db-attendance-legend">{entries.map(entry => <li key={entry.id}><span><i style={{ background: colors[entry.id] ?? "#99b6c6" }} /><span translate="no">{entry.name}</span></span><strong>{entry.count}<small>次</small></strong></li>)}</ul>
  </div>;
}

function Panel({ title, children, className = "", actions }: { title: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return <section className={"db-panel " + className}><div className="db-panel-heading"><h2>{title}</h2>{actions ?? <span className="db-panel-dot" />}</div>{children}</section>;
}

export default function DashboardPage() {
  const { user, profile, isLoading, statusMessage, handleGoogleLogin, handleLogout } = useAuthProfile();
  const allowed = canViewOperationsDashboard(profile);
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
  const collectorsRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async (target: string) => {
    setBusy(true); setError("");
    const { data: payload, error: requestError } = await createClient().rpc("get_operations_dashboard", { target_month: target + "-01" });
    if (requestError) setError(requestError.message);
    else setData(payload as Dashboard);
    setBusy(false);
  }, []);

  useEffect(() => { if (!allowed) return; const timer = window.setTimeout(() => void reload(month), 0); return () => window.clearTimeout(timer); }, [allowed, month, reload]);

  useEffect(() => {
    if (!allowed || renterType !== "member" || !search.trim() || selected) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const { data: result, error: requestError } = await createClient().rpc("search_board_storage_members", { search_term: search.trim() });
      if (active) { setMatches(requestError ? [] : (result as MemberResult[])); if (requestError) setError(requestError.message); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [allowed, renterType, search, selected]);

  const mutate = async (args: Record<string, unknown>, done: string) => {
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
  const activeLeases = data?.storage.leases.filter(l => !l.ended_at) ?? [];
  const unpaidLeases = data?.storage.leases.filter(l => !l.is_paid) ?? [];
  const capacity = data?.storage.capacity ?? 0;
  const occupied = activeLeases.length;
  const remaining = Math.max(0, capacity - occupied);
  const currentMonth = getTaipeiDate().slice(0, 7);
  const boardTone = Math.max(0, Math.min(4, Math.ceil(occupied / 4) - 1));
  const empty = <p className="db-empty">目前沒有資料</p>;
  const formatMonth = useMemo(() => month.replace("-", " / "), [month]);

  const collectors = useMemo(() => [...(data?.collectors ?? [])].sort((a, b) => Number(b.role === "board_manager") - Number(a.role === "board_manager") || b.amount - a.amount || a.name.localeCompare(b.name, "zh-TW")), [data]);
  const attendanceColors = useMemo(() => {
    const colors: Record<string, string> = { staff: "#bc9dfb", unassigned: "#99b6c6" };
    collectors.filter(collector => collector.role === "board_manager").forEach((collector, index) => { if (collector.id) colors[collector.id] = swatches[index % 5]; });
    return colors;
  }, [collectors]);
  const attendanceTotal = (data?.attendance ?? []).reduce((sum, entry) => sum + entry.count, 0);
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
      <div className="db-page"><div className="db-content">
        {isLoading ? <p className="db-access">正在確認登入身分…</p>
        : !user ? <p className="db-access">請登入後查看營運儀錶板。</p>
        : !allowed ? <p className="db-access">此頁僅供幹部與管理員查看。</p>
        : <>
          {statusMessage && <p className="db-alert" role="alert">{statusMessage}</p>}
          {error && <p className="db-alert" role="alert">{error}</p>}
          {notice && <p className="db-success" role="status">{notice}</p>}
          <div className="db-toolbar" role="group" aria-label="月份與資料更新">
            <div className="db-month"><button aria-label="上個月" type="button" disabled={busy} onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong>{formatMonth}</strong><button aria-label="下個月" type="button" disabled={busy || month >= currentMonth} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div>
            <button className="db-refresh" type="button" aria-label="更新資料" title="更新資料" disabled={busy || actionBusy} onClick={() => void reload(month)}><RefreshCw size={16} className={busy ? "db-spin" : ""} /><span>更新</span></button>
          </div>
          <div className="db-workspace">
            {!data ? <Panel title="租板資料">{busy ? <p className="db-empty">正在載入…</p> : empty}</Panel> : <>
              <div className="db-rent-grid" aria-busy={busy}>
                <Panel title="租板累積收入" className="db-income-panel"><SemicircleGauge value={data.income} step={2000} unit="元" label="租板累積已收款" /></Panel>
                <Panel title="每日租板人次" className="db-daily-panel" actions={<span className="db-chart-total">{data.monthly.total}<small>人次</small></span>}><TrendChart days={data.daily} month={data.month} /></Panel>
                <section className="db-panel db-collector-panel" aria-label="各人員收款">
                  <button className="db-carousel-edge" type="button" aria-label="向左查看收款人員" onClick={() => collectorsRef.current?.scrollBy({ left: -420, behavior: "smooth" })}><ChevronLeft size={18} /></button>
                  <div className="db-collector-grid" ref={collectorsRef} tabIndex={0} role="region" aria-label="收款人員，板務在前，可左右捲動">
                    {collectors.length ? collectors.map((collector, index) => <div className="db-collector" key={collector.id ?? "unknown"} title={collector.name + "：" + currency(collector.amount)}>
                      <Ring value={collector.amount} total={data.income} label={collector.name} tone={index} compact />
                      <div className="db-collector-info"><span translate="no">{collector.name}</span><strong style={{ color: swatches[index % 5] }}>{currency(collector.amount)}</strong></div>
                    </div>) : empty}
                  </div>
                  <button className="db-carousel-edge" type="button" aria-label="向右查看收款人員" onClick={() => collectorsRef.current?.scrollBy({ left: 420, behavior: "smooth" })}><ChevronRight size={18} /></button>
                </section>
                <Panel title="板務出勤次數" className="db-attendance-panel" actions={<span className="db-attendance-total">{attendanceTotal}<small>次</small></span>}><AttendanceChart entries={data.attendance ?? []} colors={attendanceColors} /></Panel>
              </div>
              <div className="db-storage-grid">
                <Panel title="板位使用狀況" className="db-storage-overview">
                  <SemicircleGauge value={occupied} step={4} unit="人" label="板位租用人數" />
                  <p className="db-capacity-note">目前容量 {capacity} 格 · 使用率 {capacity ? Math.round(occupied / capacity * 100) : 0}%</p>
                </Panel>
                <section className="db-panel db-control-panel" aria-label="已租出與剩餘板位">
                  <div className="db-capacity-row">
                    <div className="db-capacity-ring"><span>已租出板位</span><Ring value={occupied} total={capacity} label="已租出板位" tone={boardTone} large compact /></div>
                    <div className="db-capacity-value"><strong>{occupied}<small>人</small></strong></div>
                  </div>
                  <div className="db-capacity-row">
                    <div className="db-capacity-ring"><span>剩餘板位</span><Ring value={remaining} total={capacity} label="剩餘板位" tone={1} large compact /></div>
                    <div className="db-capacity-value"><strong>{remaining}<small>格</small></strong>
                      <div className="db-control-actions">
                        <button type="button" aria-label="減少一格總板位" disabled={actionBusy || remaining === 0} onClick={() => void mutate({ action: "capacity", delta: -1 }, "已減少一格板位。")}><Minus size={17} /></button>
                        <button type="button" aria-label="增加一格總板位" disabled={actionBusy || capacity >= 10000} onClick={() => void mutate({ action: "capacity", delta: 1 }, "已增加一格板位。")}><Plus size={17} /></button>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="db-panel db-storage-tabs" aria-label="板位資訊">
                  <div className="db-storage-tab-list" role="tablist" aria-label="板位管理功能">
                    {storageTabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={"db-tab-" + tab.id} aria-controls={"db-panel-" + tab.id} aria-selected={storageTab === tab.id} tabIndex={storageTab === tab.id ? 0 : -1} onKeyDown={event => switchStorageTab(event, index)} onClick={() => setStorageTab(tab.id)}>
                      {tab.label}{tab.id !== "add" && <span className="db-count">{tab.id === "list" ? occupied : unpaidLeases.length}</span>}
                    </button>)}
                  </div>
                  <div className="db-storage-tab-body" role="tabpanel" id={"db-panel-" + storageTab} aria-labelledby={"db-tab-" + storageTab} tabIndex={0}>
                    {storageTab === "add" && <form onSubmit={event => void addLease(event)}>
                      <div className="db-choice"><label><input type="radio" checked={renterType === "member"} onChange={() => { setRenterType("member"); setGuestName(""); }} /> 社員</label><label><input type="radio" checked={renterType === "guest"} onChange={() => { setRenterType("guest"); setSelected(null); setSearch(""); setMatches([]); }} /> 非社員</label></div>
                      {renterType === "member" ? <div className="db-search"><label htmlFor="db-member-search">搜尋社員姓名</label><div className="db-input-icon"><Search size={16} /><input id="db-member-search" value={search} onChange={event => { setSearch(event.target.value); setSelected(null); }} placeholder="輸入姓名，從結果選擇" autoComplete="off" /></div>
                        {selected ? <p className="db-selected">已選取：{selected.full_name} {selected.student_id && "· " + selected.student_id}</p> : search.trim() && <div className="db-results" role="listbox" aria-label="社員搜尋結果">{matches.length ? matches.map(member => <button type="button" role="option" aria-selected={false} key={member.id} onClick={() => { setSelected(member); setSearch(member.full_name); setMatches([]); }}>{member.full_name}<span>{member.student_id}</span></button>) : <p>沒有符合的社員</p>}</div>}</div>
                      : <div className="db-search"><label htmlFor="db-guest-name">非社員姓名</label><input id="db-guest-name" value={guestName} maxLength={100} onChange={event => setGuestName(event.target.value)} placeholder="請填寫可辨識的姓名" required /></div>}
                      <div className="db-search"><label htmlFor="db-start-date">起租日期</label><input id="db-start-date" type="date" max={getTaipeiDate()} value={startOn} onChange={event => setStartOn(event.target.value)} required /></div>
                      <button className="db-primary-button" type="submit" disabled={actionBusy || remaining === 0}><Plus size={17} />新增板位租用</button>
                      {remaining === 0 && <p className="db-note">板位已滿，請先增加總板位。</p>}
                    </form>}
                    {storageTab === "list" && (activeLeases.length ? <ul className="db-list">{activeLeases.map(lease => <li key={lease.id}><div><strong>{lease.name}</strong><small>{lease.type === "member" ? "社員" : "非社員"} · {dates(lease.start_on)} — {dates(lease.end_on)}{lease.end_on <= data.today ? " · 已到期" : ""}</small></div><div className="db-lease-actions"><span className={lease.is_paid ? "db-paid" : "db-unpaid"}>{lease.is_paid ? "已繳" : "未繳"}</span><button type="button" className="db-danger-button" disabled={actionBusy} onClick={() => { if (window.confirm("確認為 " + lease.name + " 辦理退租？紀錄會保留。")) void mutate({ action: "end", target_id: lease.id }, "已辦理退租。"); }}>退租</button></div></li>)}</ul> : empty)}
                    {storageTab === "unpaid" && (unpaidLeases.length ? <ul className="db-list">{unpaidLeases.map(lease => <li key={lease.id}><div><strong>{lease.name}</strong><small>{lease.type === "member" ? "社員" : "非社員"} · {dates(lease.start_on)}{lease.ended_at ? " · 已退租" : ""}</small></div><label className="db-check"><input type="checkbox" disabled={actionBusy} checked={false} onChange={() => void mutate({ action: "payment", target_id: lease.id, paid: true }, "已標記繳費。")} /><span>已繳費</span></label></li>)}</ul> : <p className="db-empty">目前沒有未繳費紀錄。</p>)}
                  </div>
                </section>
              </div>
            </>}
          </div>
        </>}
      </div></div>
    </main>
  );
}
