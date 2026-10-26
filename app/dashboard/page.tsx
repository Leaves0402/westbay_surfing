"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, RefreshCw, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { canViewOperationsDashboard } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import { useAuthProfile } from "@/lib/useAuthProfile";
import "./dashboard.css";

type Collector = { id: string | null; name: string; amount: number };
type Daily = { day: string; count: number };
type Lease = {
  id: string; member_id: string | null; name: string; type: "member" | "guest";
  start_on: string; end_on: string; is_paid: boolean; ended_at: string | null;
};
type Dashboard = {
  today: string; month: string; through: string; income: number;
  collectors: Collector[]; daily: Daily[];
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

function TrendChart({ days }: { days: Daily[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height: 200 });
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(280, entry.contentRect.width), height: Math.max(80, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { width, height } = size, left = 40, right = 26, top = 25, bottom = 29;
  const max = Math.max(0, ...days.map(d => d.count)) + 1;
  const y = (n: number) => top + (height - top - bottom) * (1 - n / max);
  const x = (i: number) => left + (width - left - right) * (days.length < 2 ? .5 : i / (days.length - 1));
  const points = days.map((d, i) => x(i) + "," + y(d.count)).join(" ");
  const area = points ? x(0) + "," + y(0) + " " + points + " " + x(days.length - 1) + "," + y(0) : "";
  const ticks = Array.from(new Set(height < 180 ? [0, Math.ceil(max / 2), max] : [0, Math.ceil(max / 4), Math.ceil(max / 2), Math.ceil(max * 3 / 4), max]));
  const tickCount = Math.min(days.length, Math.max(2, Math.floor(width / 95)));
  const dayTicks = Array.from(new Set(Array.from({ length: tickCount }, (_, i) => Math.round(i * (days.length - 1) / Math.max(1, tickCount - 1)))));
  return <div className="db-chart-scroll" ref={chartRef}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日租板登記人次折線圖；縱軸最高為當月單日最高人次加一" className="db-trend">
      <defs><linearGradient id="db-line-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4de6d2" stopOpacity=".22" /><stop offset="1" stopColor="#4de6d2" stopOpacity="0" /></linearGradient></defs>
      <text x="1" y="15" fill="#b4d5df" fontSize="14">人次</text>
      {ticks.map(n => <g key={n}><line x1={left} x2={width - right} y1={y(n)} y2={y(n)} stroke="#35525f" strokeDasharray="3 6" /><text x={left - 12} y={y(n) + 5} textAnchor="end" fill="#accbd6" fontSize="14">{n}</text></g>)}
      <line x1={left} x2={left} y1={top} y2={y(0)} stroke="#587580" />
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#587580" />
      {area && <polygon points={area} fill="url(#db-line-fill)" />}
      {points && <polyline points={points} fill="none" stroke="#72ead0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {days.map((d, i) => d.count > 0 && <circle key={d.day} cx={x(i)} cy={y(d.count)} r="3.5" fill="#a4fff0"><title>{d.day}：{d.count} 人次</title></circle>)}
      {dayTicks.map(i => days[i] && <text key={days[i].day} x={x(i)} y={height - 7} textAnchor="middle" fill="#accbd6" fontSize="14">{Number(days[i].day.slice(-2))}</text>)}
      <text x={width - 2} y={height - 7} textAnchor="end" fill="#b4d5df" fontSize="14">日</text>
    </svg>
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
  const [open, setOpen] = useState({ add: false, list: true, unpaid: true });
  const [removeMode, setRemoveMode] = useState(false);
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
    if (ok) { setSelected(null); setSearch(""); setGuestName(""); setMatches([]); }
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

  return (
    <main className="db-shell">
      <Navbar user={user} profile={profile} isLoading={isLoading} onLogin={handleGoogleLogin} onLogout={handleLogout} />
      <div className="db-page">
        <div className="db-content">
          {isLoading ? <p className="db-access">正在確認登入身分…</p>
          : !user ? <p className="db-access">請登入後查看營運儀錶板。</p>
          : !allowed ? <p className="db-access">此頁僅供幹部與管理員查看。</p>
          : <>
            {statusMessage && <p className="db-alert" role="alert">{statusMessage}</p>}
            {error && <p className="db-alert" role="alert">{error}</p>}
            {notice && <p className="db-success" role="status">{notice}</p>}
            <div className="db-toolbar" role="group" aria-label="月份與資料更新">
              <div className="db-month"><button aria-label="上個月" type="button" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong>{formatMonth}</strong><button aria-label="下個月" type="button" disabled={month >= currentMonth} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div>
              <button className="db-refresh" type="button" aria-label="更新資料" title="更新資料" disabled={busy || actionBusy} onClick={() => void reload(month)}><RefreshCw size={16} className={busy ? "db-spin" : ""} /><span>更新</span></button>
            </div>
            <div className="db-workspace">
            {!data ? <Panel title="租板資料">{busy ? <p className="db-empty">正在載入…</p> : empty}</Panel> : <>
              <div className="db-rent-grid" aria-busy={busy}>
                <Panel title="租板累積收入" className="db-income-panel">
                  <SemicircleGauge value={data.income} step={2000} unit="元" label="租板累積已收款" />
                </Panel>
                <Panel title="每日租板人次" className="db-daily-panel" actions={<span className="db-chart-total">{data.monthly.total}<small>人次</small></span>}>
                  <TrendChart days={data.daily} />
                </Panel>
                <Panel title="各人員收款" className="db-collector-panel" actions={<div className="db-carousel-actions">
                  <button type="button" aria-label="向左查看收款人員" onClick={() => collectorsRef.current?.scrollBy({ left: -420, behavior: "smooth" })}><ChevronLeft size={18} /></button>
                  <button type="button" aria-label="向右查看收款人員" onClick={() => collectorsRef.current?.scrollBy({ left: 420, behavior: "smooth" })}><ChevronRight size={18} /></button>
                </div>}>
                  <div className="db-collector-grid" ref={collectorsRef} tabIndex={0} role="region" aria-label="收款人員，可左右捲動">
                    {data.collectors.length ? data.collectors.map((c, i) => <div className="db-collector" key={c.id ?? "unknown"} title={c.name + "：" + currency(c.amount)}>
                      <Ring value={c.amount} total={data.income} label={c.name} tone={i} compact />
                      <div className="db-collector-info"><span translate="no">{c.name}</span><strong style={{ color: swatches[i % 5] }}>{currency(c.amount)}</strong></div>
                    </div>) : empty}
                  </div>
                </Panel>
              </div>
              <div className="db-storage-grid">
                <Panel title="板位使用狀況" className="db-storage-overview">
                  <SemicircleGauge value={occupied} step={4} unit="人" label="板位租用人數" />
                  <p className="db-capacity-note">目前容量 {capacity} 格 · 使用率 {capacity ? Math.round(occupied / capacity * 100) : 0}%</p>
                </Panel>
                <Panel title="容量與租用" className="db-control-panel">
                  <div className="db-control-row"><Ring value={occupied} total={capacity} label="已租出版位" tone={boardTone} large /><div className="db-control-actions"><button type="button" aria-label="新增板位租用者" disabled={actionBusy || remaining === 0} onClick={() => { setOpen(o => ({ ...o, add: true })); document.getElementById("db-add-lease")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Plus size={17} /></button><button type="button" aria-label="從名單選擇退租" disabled={actionBusy || occupied === 0} onClick={() => { setRemoveMode(true); setOpen(o => ({ ...o, list: true })); document.getElementById("db-lease-list")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Minus size={17} /></button></div></div>
                  <div className="db-control-row"><Ring value={remaining} total={capacity} label="剩餘板位" tone={1} large /><div className="db-control-actions"><button type="button" aria-label="增加一格總板位" disabled={actionBusy || capacity >= 10000} onClick={() => void mutate({ action: "capacity", delta: 1 }, "已增加一格板位。")}><Plus size={17} /></button><button type="button" aria-label="減少一格總板位" disabled={actionBusy || remaining === 0} onClick={() => void mutate({ action: "capacity", delta: -1 }, "已減少一格板位。")}><Minus size={17} /></button></div></div>
                </Panel>
                <div className="db-storage-details">
                  <section className="db-panel db-fold" id="db-add-lease"><button className="db-fold-toggle" type="button" aria-expanded={open.add} onClick={() => setOpen(o => ({ ...o, add: !o.add }))}><span><strong>新增租用者</strong></span><ChevronDown size={19} /></button>
                    {open.add && <form className="db-fold-body" onSubmit={e => void addLease(e)}>
                      <div className="db-choice"><label><input type="radio" checked={renterType === "member"} onChange={() => { setRenterType("member"); setGuestName(""); }} /> 社員</label><label><input type="radio" checked={renterType === "guest"} onChange={() => { setRenterType("guest"); setSelected(null); setSearch(""); setMatches([]); }} /> 非社員</label></div>
                      {renterType === "member" ? <div className="db-search"><label htmlFor="db-member-search">搜尋社員姓名</label><div className="db-input-icon"><Search size={16} /><input id="db-member-search" value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} placeholder="輸入姓名，從結果選擇" autoComplete="off" /></div>
                        {selected ? <p className="db-selected">已選取：{selected.full_name} {selected.student_id && "· " + selected.student_id}</p> : search.trim() && <div className="db-results" role="listbox" aria-label="社員搜尋結果">{matches.length ? matches.map(m => <button type="button" role="option" aria-selected={false} key={m.id} onClick={() => { setSelected(m); setSearch(m.full_name); setMatches([]); }}>{m.full_name} <span>{m.student_id}</span></button>) : <p>沒有符合的社員</p>}</div>}</div>
                      : <div className="db-search"><label htmlFor="db-guest-name">非社員姓名</label><input id="db-guest-name" value={guestName} maxLength={100} onChange={e => setGuestName(e.target.value)} placeholder="請填寫可辨識的姓名" required /></div>}
                      <div className="db-search"><label htmlFor="db-start-date">起租日期</label><input id="db-start-date" type="date" max={getTaipeiDate()} value={startOn} onChange={e => setStartOn(e.target.value)} required /></div>
                      <button className="db-primary-button" type="submit" disabled={actionBusy || remaining === 0}><Plus size={17} /> 新增板位租用</button>
                      {remaining === 0 && <p className="db-note">板位已滿，請先增加總板位。</p>}
                    </form>}
                  </section>
                  <section className="db-panel db-fold" id="db-lease-list"><button className="db-fold-toggle" type="button" aria-expanded={open.list} onClick={() => setOpen(o => ({ ...o, list: !o.list }))}><span><strong>板位名單 <span className="db-count">{occupied}</span></strong></span><ChevronDown size={19} /></button>
                    {open.list && <div className="db-fold-body">{removeMode && <p className="db-hint">選擇要退租的人。<button type="button" onClick={() => setRemoveMode(false)}>取消</button></p>}{activeLeases.length ? <ul className="db-list">{activeLeases.map(l => <li key={l.id}><div><strong>{l.name}</strong><small>{l.type === "member" ? "社員" : "非社員"} · {dates(l.start_on)} — {dates(l.end_on)}{l.end_on <= data.today ? " · 已到期" : ""}</small></div>{removeMode ? <button type="button" className="db-danger-button" disabled={actionBusy} onClick={() => { if (window.confirm("確認為 " + l.name + " 辦理退租？紀錄會保留。")) void mutate({ action: "end", target_id: l.id }, "已辦理退租。").then(ok => { if (ok) setRemoveMode(false); }); }}>退租</button> : <span className={l.is_paid ? "db-paid" : "db-unpaid"}>{l.is_paid ? "已繳" : "未繳"}</span>}</li>)}</ul> : empty}</div>}
                  </section>
                  <section className="db-panel db-fold"><button className="db-fold-toggle" type="button" aria-expanded={open.unpaid} onClick={() => setOpen(o => ({ ...o, unpaid: !o.unpaid }))}><span><strong>未繳費資訊 <span className="db-count">{unpaidLeases.length}</span></strong></span><ChevronDown size={19} /></button>
                    {open.unpaid && <div className="db-fold-body">{unpaidLeases.length ? <ul className="db-list">{unpaidLeases.map(l => <li key={l.id}><div><strong>{l.name}</strong><small>{l.type === "member" ? "社員" : "非社員"} · {dates(l.start_on)}{l.ended_at ? " · 已退租" : ""}</small></div><label className="db-check"><input type="checkbox" disabled={actionBusy} checked={false} onChange={() => void mutate({ action: "payment", target_id: l.id, paid: true }, "已標記繳費。")} /><span>已繳費</span></label></li>)}</ul> : <p className="db-empty">所有板位租用者都已繳費。</p>}</div>}
                  </section>
                </div>
              </div>
            </>}
            </div>
          </>}
        </div>
      </div>
    </main>
  );
}

