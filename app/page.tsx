"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AdminPanel from "@/components/AdminPanel";
import { employeeEmail, isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = { user_id?: string; employee_no: string; name: string; role: "employee" | "admin" };
type Attendance = { user_id?: string; work_date: string; clock_in: string | null; clock_out: string | null };
type Announcement = { id: number; title: string; body: string; published_at: string };
type RecordRow = Attendance & { employee_no: string; name: string };
type Tab = "attendance" | "records" | "announcements" | "profile" | "admin";

const formatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
const shortDateFormatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });
function formatTime(value: string | null) { return value ? formatter.format(new Date(value)) : "--:--"; }
function taipeiDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tab, setTab] = useState<Tab>("attendance");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"in" | "out" | null>(null);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return;

    const [{ data: profileData }, { data: attendanceData }, { data: announcementData }] = await Promise.all([
      supabase.from("profiles").select("user_id,employee_no,name,role").eq("user_id", uid).maybeSingle(),
      supabase.from("attendance_records").select("user_id,work_date,clock_in,clock_out").eq("user_id", uid).eq("work_date", taipeiDateKey()).maybeSingle(),
      supabase.from("announcements").select("id,title,body,published_at").order("published_at", { ascending: false }),
    ]);

    setProfile(profileData ?? null);
    setAttendance(attendanceData ?? null);
    setAnnouncements(announcementData ?? []);

    if (profileData?.role === "admin") {
      const [{ data: allProfiles }, { data: allAttendance }] = await Promise.all([
        supabase.from("profiles").select("user_id,employee_no,name").order("employee_no"),
        supabase.from("attendance_records").select("user_id,work_date,clock_in,clock_out").order("work_date", { ascending: false }).order("clock_in", { ascending: false }).limit(200),
      ]);
      const people = new Map((allProfiles ?? []).map((p) => [p.user_id, p]));
      setRecords((allAttendance ?? []).map((r) => ({ ...r, employee_no: people.get(r.user_id)?.employee_no ?? "—", name: people.get(r.user_id)?.name ?? "未知" })));
    } else {
      setRecords([]);
      setTab((current) => current === "records" || current === "admin" ? "attendance" : current);
    }
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => { const currentUser = data.session?.user ?? null; setUser(currentUser); if (currentUser) await loadData(); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const todayLabel = useMemo(() => dateFormatter.format(new Date()), []);
  async function clock(action: "in" | "out") { if (!supabase) return; setActionLoading(action); setMessage(""); const { error } = await supabase.rpc("clock_attendance", { p_action: action }); if (error) setMessage(error.message); else { setMessage(action === "in" ? "上班打卡成功" : "下班打卡成功"); await loadData(); } setActionLoading(null); }

  if (loading) return <main className="center-screen"><div className="loader" /></main>;
  if (!isSupabaseConfigured) return <SetupScreen />;
  if (!user) return <LoginScreen onLogin={async () => { if (supabase) { const { data } = await supabase.auth.getUser(); setUser(data.user); await loadData(); } }} />;
  const isAdmin = profile?.role === "admin";

  return <main className="app-shell">
    <header className="topbar"><div className="brand-wrap"><div className="logo-slot">S</div><div><div className="brand">sharkAttend</div><div className="hello">嗨，{profile?.name ?? "Team"}{isAdmin ? " · 管理員" : ""}</div></div></div><div className="date-pill">{todayLabel}</div></header>
    <section className="content">
      {tab === "attendance" && <div className="attendance-page"><div className="intro"><span className="eyebrow">TODAY</span><h1>今天也別忘了打卡</h1><p>員工編號 {profile?.employee_no ?? "—"}</p></div><div className="clock-grid"><button className="clock-circle clock-in" onClick={() => clock("in")} disabled={Boolean(attendance?.clock_in) || actionLoading !== null}><span className="clock-label">上班</span><strong>{actionLoading === "in" ? "..." : formatTime(attendance?.clock_in ?? null)}</strong><small>{attendance?.clock_in ? "已打卡" : "點一下打卡"}</small></button><button className="clock-circle clock-out" onClick={() => clock("out")} disabled={!attendance?.clock_in || Boolean(attendance?.clock_out) || actionLoading !== null}><span className="clock-label">下班</span><strong>{actionLoading === "out" ? "..." : formatTime(attendance?.clock_out ?? null)}</strong><small>{attendance?.clock_out ? "已打卡" : attendance?.clock_in ? "點一下打卡" : "上班後可使用"}</small></button></div>{message && <div className="toast-inline">{message}</div>}</div>}
      {tab === "records" && isAdmin && <div className="list-page"><div className="section-title"><span className="eyebrow">RECORDS</span><h1>打卡紀錄</h1><p>僅管理員可查看全員打卡紀錄。</p></div><div className="record-list">{records.map((r, i) => <article className="record-card" key={`${r.user_id}-${r.work_date}-${i}`}><div className="record-head"><div><strong>{r.name}</strong><span>#{r.employee_no}</span></div><time>{shortDateFormatter.format(new Date(`${r.work_date}T12:00:00+08:00`))}</time></div><div className="record-times"><div><small>上班</small><b>{formatTime(r.clock_in)}</b></div><div><small>下班</small><b>{formatTime(r.clock_out)}</b></div></div></article>)}{!records.length && <div className="empty-card">目前沒有打卡紀錄</div>}</div></div>}
      {tab === "announcements" && <div className="list-page"><div className="section-title"><span className="eyebrow">NEWS</span><h1>公告</h1></div><div className="announcement-list">{announcements.map((item) => <article className="announcement-card" key={item.id}><time>{shortDateFormatter.format(new Date(item.published_at))}</time><h2>{item.title}</h2><p>{item.body}</p></article>)}{!announcements.length && <div className="empty-card">目前沒有公告</div>}</div></div>}
      {tab === "profile" && <ProfilePage profile={profile} isAdmin={isAdmin} onLogout={async () => { await supabase?.auth.signOut(); setUser(null); setProfile(null); setAttendance(null); setRecords([]); setTab("attendance"); }} />}
      {tab === "admin" && isAdmin && <AdminPanel />}
    </section>
    <nav className="bottom-nav" style={{gridTemplateColumns:`repeat(${isAdmin ? 5 : 3}, minmax(0, 1fr))`}}>
      <NavButton active={tab === "attendance"} label="打卡" icon="◉" onClick={() => setTab("attendance")} />
      {isAdmin && <NavButton active={tab === "records"} label="紀錄" icon="≡" onClick={() => setTab("records")} />}
      <NavButton active={tab === "announcements"} label="公告" icon="▤" onClick={() => setTab("announcements")} />
      <NavButton active={tab === "profile"} label="我的" icon="●" onClick={() => setTab("profile")} />
      {isAdmin && <NavButton active={tab === "admin"} label="管理" icon="⌘" onClick={() => setTab("admin")} />}
    </nav>
  </main>;
}

function ProfilePage({ profile, isAdmin, onLogout }: { profile: Profile | null; isAdmin: boolean; onLogout: () => Promise<void> }) {
  const [pw, setPw] = useState(""); const [confirm, setConfirm] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function changePassword() { if (!supabase) return; if (pw.length < 6) { setMsg("密碼至少 6 碼"); return; } if (pw !== confirm) { setMsg("兩次密碼不一致"); return; } setBusy(true); setMsg(""); const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error ? error.message : "密碼已更新"); if (!error) { setPw(""); setConfirm(""); } setBusy(false); }
  return <div className="list-page"><div className="section-title"><span className="eyebrow">PROFILE</span><h1>我的</h1></div><div className="profile-card"><div className="avatar">{profile?.name?.slice(0,1) ?? "S"}</div><h2>{profile?.name}</h2><p>員工編號 {profile?.employee_no}</p>{isAdmin && <span className="profile-role">管理員</span>}</div><section className="password-card"><h2>修改密碼</h2><p>所有員工都可以修改自己的登入密碼。</p><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密碼（至少 6 碼）" /><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次輸入新密碼" />{msg && <div className="password-message">{msg}</div>}<button className="primary-btn" disabled={busy} onClick={changePassword}>{busy ? "更新中…" : "更新密碼"}</button></section><button className="logout" onClick={onLogout}>登出</button></div>;
}

function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) { const [employeeNo,setEmployeeNo]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); async function submit(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const{error:loginError}=await supabase.auth.signInWithPassword({email:employeeEmail(employeeNo),password});if(loginError)setError("員工編號或密碼不正確");else await onLogin();setBusy(false);} return <main className="login-screen"><div className="login-card"><div className="login-logo">S</div><h1>sharkAttend</h1><p className="login-subtitle">打卡，簡單一點。</p><form onSubmit={submit}><label>員工編號<input inputMode="numeric" autoComplete="username" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} placeholder="例如 001" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="輸入密碼" required /></label>{error&&<div className="form-error">{error}</div>}<button className="primary-btn" disabled={busy}>{busy?"登入中...":"登入"}</button></form></div></main>; }
function SetupScreen(){return <main className="login-screen"><div className="login-card"><div className="login-logo">S</div><h1>sharkAttend</h1><p className="login-subtitle">等待 Supabase 設定。</p></div></main>}
function NavButton({active,label,icon,onClick}:{active:boolean;label:string;icon:string;onClick:()=>void}){return <button className={active?"nav-item active":"nav-item"} onClick={onClick}><span>{icon}</span><small>{label}</small></button>}
