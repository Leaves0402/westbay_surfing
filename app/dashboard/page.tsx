"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Minus, Plus, RefreshCw, Search, Waves } from "lucide-react";
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

function Gauge({ value, step, title, unit, subtitle }: { value: number; step: number; title: string; unit: string; subtitle: string }) {
  const level = value <= 0 ? 0 : Math.min(5, Math.ceil(value / step));
  const fraction = value <= 0 ? 0 : Math.min(1, (value - (level - 1) * step) / step);
  const color = swatches[Math.max(0, level - 1)];
  return (
    <div className="db-gauge-wrap">
      <div className="db-gauge" style={{ "--gauge-color": color, "--gauge-deg": String(fraction * 270) + "deg" } as React.CSSProperties}>
        <div className="db-gauge-inner">
          <span className="db-eyebrow">{title}</span>
          <strong>{value.toLocaleString("zh-TW")}</strong>
          <span className="db-muted">{unit}</span>
        </div>
      </div>
      <div className="db-gauge-scale">
        {swatches.map((shade, i) => <span key={shade} style={{ background: shade }} title={String((i + 1) * step)} />)}
      </div>
      <p className="db-note">{subtitle}</p>
    </div>
  );
}

function Ring({ value, total, label, tone = 0, large = false }: { value: number; total: number; label: string; tone?: number; large?: boolean }) {
  const fraction = total ? Math.min(1, value / total) : 0;
  const percent = Math.round(fraction * 100);
  return (
    <div className={large ? "db-ring-block db-ring-large" : "db-ring-block"}>
      <div className="db-ring" style={{ "--ring-color": swatches[tone % 5], "--ring-percent": String(percent) + "%" } as React.CSSProperties}
        role="img" aria-label={label + " " + percent + "%"}>
        <div><strong>{percent}%</strong><small>{value.toLocaleString("zh-TW")} / {total.toLocaleString("zh-TW")}</small></div>
      </div>
      <span className="db-ring-label">{label}</span>
    </div>
  );
}

function TrendChart({ days }: { days: Daily[] }) {
  const width = 690, height = 170, left = 38, right = 12, top = 12, bottom = 28;
  const max = Math.max(1, ...days.map(d => d.count)) + 1;
  const y = (n: number) => top + (height - top - bottom) * (1 - n / max);
  const x = (i: number) => left + (width - left - right) * (days.length < 2 ? 0.5 : i / (days.length - 1));
  const points = days.map((d, i) => x(i) + "," + y(d.count)).join(" ");
  const area = points ? left + "," + (height - bottom) + " " + points + " " + x(days.length - 1) + "," + (height - bottom) : "";
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  return (
    <div className="db-chart-scroll">
      <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="每日租板登記人次折線圖；縱軸最高為當月單日最高人次加一" className="db-trend">
        <defs><linearGradient id="db-line-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4de6d2" stopOpacity=".25" /><stop offset="1" stopColor="#4de6d2" stopOpacity="0" /></linearGradient></defs>
        {ticks.map(n => <g key={n}><line x1={left} x2={width - right} y1={y(n)} y2={y(n)} stroke="#254452" strokeDasharray="3 6" /><text x="26" y={y(n) + 4} textAnchor="end" fill="#88a5b5" fontSize="11">{n}</text></g>)}
        {area && <polygon points={area} fill="url(#db-line-fill)" />}
        {points && <polyline points={points} fill="none" stroke="#72ead0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {days.map((d, i) => d.count > 0 && <circle key={d.day} cx={x(i)} cy={y(d.count)} r="3" fill="#a4fff0"><title>{d.day}：{d.count} 人次</title></circle>)}
        {days.filter((_, i) => i === 0 || (i + 1) % 5 === 0 || i === days.length - 1).map(d => <text key={d.day} x={x(days.indexOf(d))} y={height - 7} textAnchor="middle" fill="#88a5b5" fontSize="11">{Number(d.day.slice(-2))}</text>)}
      </svg>
    </div>
  );
}

function Panel({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: React.ReactNode; className?: string }) {
  return <section className={"db-panel " + className}><div className="db-panel-heading"><div>{kicker && <span className="db-eyebrow">{kicker}</span>}<h2>{title}</h2></div><span className="db-panel-dot" /></div>{children}</section>;
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
  const [open, setOpen] = useState({ add: true, list: true, unpaid: true });
  const [removeMode, setRemoveMode] = useState(false);

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
    <main className="min-h-screen">
      <Navbar user={user} profile={profile} isLoading={isLoading} onLogin={handleGoogleLogin} onLogout={handleLogout} />
      <div className="db-page">
        <div className="db-content">
          <header className="db-header">
            <div><span className="db-eyebrow db-overline"><Waves size={15} /> WESTBAY SURF CLUB · OPERATIONS</span>
              <h1>營運儀錶板<span className="db-heading-accent">.</span></h1>
              <p>租板金流與板位狀態，一眼掌握。</p>
            </div>
            {allowed && <button className="db-refresh" type="button" disabled={busy || actionBusy} onClick={() => void reload(month)}><RefreshCw size={15} className={busy ? "db-spin" : ""} /> 更新資料</button>}
          </header>
          {isLoading ? <p className="db-access">正在確認登入身分…</p>
          : !user ? <p className="db-access">請登入後查看營運儀錶板。</p>
          : !allowed ? <p className="db-access">此頁僅供幹部與管理員查看。</p>
          : <>
            {statusMessage && <p className="db-alert" role="alert">{statusMessage}</p>}
            {error && <p className="db-alert" role="alert">{error}</p>}
            {notice && <p className="db-success" role="status">{notice}</p>}
            <div className="db-section-title"><div><span className="db-section-index">01 / RENTALS</span><h2>租板營運</h2></div>
              <div className="db-month"><button aria-label="上個月" type="button" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong>{formatMonth}</strong><button aria-label="下個月" type="button" disabled={month >= currentMonth} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div>
            </div>
            {!data ? <Panel title="租板資料">{busy ? <p className="db-empty">正在載入…</p> : empty}</Panel> : <>
              <div className="db-rent-grid">
                <Panel kicker="ALL-TIME REVENUE" title="租板累計收入" className="db-income-panel">
                  <Gauge value={data.income} step={2000} title="已收款" unit="元" subtitle="每 NT$ 2,000 升一級 · 超過 NT$ 10,000 維持紅色" />
                  <div className="db-income-foot"><CircleDollarSign size={17} /><span>僅計入已標記繳費的租板紀錄；舊紀錄若金額為 0，依社員 50／非社員 200 元推算</span></div>
                </Panel>
                <Panel kicker="DAILY ACTIVITY" title="每日租板人次" className="db-daily-panel">
                  <p className="db-note">依租板日期統計 · {dates(data.month)} — {dates(data.through)}</p>
                  <TrendChart days={data.daily} />
                  <div className="db-daily-footer"><span>本月截至目前</span><strong>{data.monthly.total} <small>人次</small></strong></div>
                </Panel>
                <Panel kicker="THIS MONTH" title="租板組成" className="db-month-panel">
                  <div className="db-vertical-chart" role="img" aria-label={"當月租板：社員 " + data.monthly.members + " 人次，非社員 " + data.monthly.guests + " 人次"}>
                    <div className="db-chart-axis"><span>{Math.max(1, data.monthly.members, data.monthly.guests) + 1}</span><span>0</span></div>
                    <div className="db-vertical-bars">
                      <div className="db-bar-column"><div className="db-bar-track"><span className="db-bar-value">{data.monthly.members}</span><div className="db-bar-member" style={{ height: (data.monthly.members / (Math.max(1, data.monthly.members, data.monthly.guests) + 1) * 100) + "%" }} /></div><span>社員</span></div>
                      <div className="db-bar-column"><div className="db-bar-track"><span className="db-bar-value">{data.monthly.guests}</span><div className="db-bar-guest" style={{ height: (data.monthly.guests / (Math.max(1, data.monthly.members, data.monthly.guests) + 1) * 100) + "%" }} /></div><span>非社員</span></div>
                    </div>
                  </div>
                  <div className="db-month-total"><strong>{data.monthly.total}</strong><span>本月租板人次</span></div>
                  <div className="db-stat-list"><p><span>社員租板</span><strong>{data.monthly.members}</strong></p><p><span>非社員租板</span><strong>{data.monthly.guests}</strong></p><p><span>尚未繳費</span><strong className="db-warn">{data.monthly.unpaid}</strong></p></div>
                </Panel>
                <Panel kicker="COLLECTION BREAKDOWN" title="各人員收款" className="db-collector-panel">
                  <p className="db-note">依租板繳費紀錄的收款人計算，圓環比例為總收入占比。</p>
                  <div className="db-collector-grid">{data.collectors.length ? data.collectors.map((c, i) => <div className="db-collector" key={c.id ?? "unknown"}><Ring value={c.amount} total={data.income} label={c.name} tone={i} /><strong>{currency(c.amount)}</strong></div>) : empty}</div>
                </Panel>
              </div>
              <div className="db-section-title db-storage-title"><div><span className="db-section-index">02 / BOARD STORAGE</span><h2>板位管理</h2></div><span className="db-live"><span /> 即時容量</span></div>
              <div className="db-storage-grid">
                <Panel kicker="BOARD STORAGE" title="板位使用狀況" className="db-storage-overview">
                  <Gauge value={occupied} step={4} title="租用人數" unit="人" subtitle="每 4 人升一級 · 超過 20 人維持紅色" />
                  <p className="db-capacity-note">目前容量 {capacity} 格 · 使用率 {capacity ? Math.round(occupied / capacity * 100) : 0}%</p>
                </Panel>
                <Panel kicker="CAPACITY CONTROL" title="容量與租用" className="db-control-panel">
                  <div className="db-control-row"><Ring value={occupied} total={capacity} label="已租出版位" tone={boardTone} large /><div className="db-control-actions"><button type="button" aria-label="新增板位租用者" disabled={actionBusy || remaining === 0} onClick={() => { setOpen(o => ({ ...o, add: true })); document.getElementById("db-add-lease")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Plus size={17} /></button><button type="button" aria-label="從名單選擇退租" disabled={actionBusy || occupied === 0} onClick={() => { setRemoveMode(true); setOpen(o => ({ ...o, list: true })); document.getElementById("db-lease-list")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Minus size={17} /></button></div></div>
                  <div className="db-control-row"><Ring value={remaining} total={capacity} label="剩餘板位" tone={1} large /><div className="db-control-actions"><button type="button" aria-label="增加一格總板位" disabled={actionBusy || capacity >= 10000} onClick={() => void mutate({ action: "capacity", delta: 1 }, "已增加一格板位。")}><Plus size={17} /></button><button type="button" aria-label="減少一格總板位" disabled={actionBusy || remaining === 0} onClick={() => void mutate({ action: "capacity", delta: -1 }, "已減少一格板位。")}><Minus size={17} /></button></div></div>
                </Panel>
                <div className="db-storage-details">
                  <section className="db-panel db-fold" id="db-add-lease"><button className="db-fold-toggle" type="button" aria-expanded={open.add} onClick={() => setOpen(o => ({ ...o, add: !o.add }))}><span><span className="db-eyebrow">NEW TENANT</span><strong>新增租用者</strong></span><ChevronDown size={19} /></button>
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
                  <section className="db-panel db-fold" id="db-lease-list"><button className="db-fold-toggle" type="button" aria-expanded={open.list} onClick={() => setOpen(o => ({ ...o, list: !o.list }))}><span><span className="db-eyebrow">CURRENT TENANTS · {occupied}</span><strong>板位名單</strong></span><ChevronDown size={19} /></button>
                    {open.list && <div className="db-fold-body">{removeMode && <p className="db-hint">選擇要退租的人。<button type="button" onClick={() => setRemoveMode(false)}>取消</button></p>}{activeLeases.length ? <ul className="db-list">{activeLeases.map(l => <li key={l.id}><div><strong>{l.name}</strong><small>{l.type === "member" ? "社員" : "非社員"} · {dates(l.start_on)} — {dates(l.end_on)}{l.end_on <= data.today ? " · 已到期" : ""}</small></div>{removeMode ? <button type="button" className="db-danger-button" disabled={actionBusy} onClick={() => { if (window.confirm("確認為 " + l.name + " 辦理退租？紀錄會保留。")) void mutate({ action: "end", target_id: l.id }, "已辦理退租。").then(ok => { if (ok) setRemoveMode(false); }); }}>退租</button> : <span className={l.is_paid ? "db-paid" : "db-unpaid"}>{l.is_paid ? "已繳" : "未繳"}</span>}</li>)}</ul> : empty}</div>}
                  </section>
                  <section className="db-panel db-fold"><button className="db-fold-toggle" type="button" aria-expanded={open.unpaid} onClick={() => setOpen(o => ({ ...o, unpaid: !o.unpaid }))}><span><span className="db-eyebrow">PAYMENT PENDING · {unpaidLeases.length}</span><strong>未繳費資訊</strong></span><ChevronDown size={19} /></button>
                    {open.unpaid && <div className="db-fold-body">{unpaidLeases.length ? <ul className="db-list">{unpaidLeases.map(l => <li key={l.id}><div><strong>{l.name}</strong><small>{l.type === "member" ? "社員" : "非社員"} · {dates(l.start_on)}{l.ended_at ? " · 已退租" : ""}</small></div><label className="db-check"><input type="checkbox" disabled={actionBusy} checked={false} onChange={() => void mutate({ action: "payment", target_id: l.id, paid: true }, "已標記繳費。")} /><span>已繳費</span></label></li>)}</ul> : <p className="db-empty">所有板位租用者都已繳費。</p>}</div>}
                  </section>
                </div>
              </div>
              <p className="db-footnote">租板收入為歷來已收總額；人次依租板登記紀錄計算。板位租期為起租日起一年，繳費資訊僅供內部管理。</p>
            </>}
          </>}
        </div>
      </div>
    </main>
  );
}
