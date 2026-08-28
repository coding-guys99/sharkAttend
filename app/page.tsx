"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { employeeEmail, isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = { employee_no: string; name: string };
type Attendance = { work_date: string; clock_in: string | null; clock_out: string | null };
type Announcement = { id: number; title: string; body: string; published_at: string };
type Tab = "attendance" | "announcements" | "profile";

const formatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

function formatTime(value: string | null) {
  return value ? formatter.format(new Date(value)) : "--:--";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tab, setTab] = useState<Tab>("attendance");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"in" | "out" | null>(null);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const [{ data: profileData }, { data: attendanceData }, { data: announcementData }] = await Promise.all([
      supabase.from("profiles").select("employee_no,name").maybeSingle(),
      supabase.from("attendance_records").select("work_date,clock_in,clock_out").order("work_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("announcements").select("id,title,body,published_at").order("published_at", { ascending: false }),
    ]);
    setProfile(profileData ?? null);
    setAttendance(attendanceData ?? null);
    setAnnouncements(announcementData ?? []);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await loadData();
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const todayLabel = useMemo(() => dateFormatter.format(new Date()), []);

  async function clock(action: "in" | "out") {
    if (!supabase) return;
    setActionLoading(action);
    setMessage("");
    const { error } = await supabase.rpc("clock_attendance", { p_action: action });
    if (error) setMessage(error.message);
    else {
      setMessage(action === "in" ? "上班打卡成功" : "下班打卡成功");
      await loadData();
    }
    setActionLoading(null);
  }

  if (loading) return <main className="center-screen"><div className="loader" /></main>;
  if (!isSupabaseConfigured) return <SetupScreen />;
  if (!user) return <LoginScreen onLogin={async () => { if (supabase) { const { data } = await supabase.auth.getUser(); setUser(data.user); await loadData(); } }} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="logo-slot" aria-label="Logo placeholder">S</div>
          <div><div className="brand">sharkAttend</div><div className="hello">嗨，{profile?.name ?? "Team"}</div></div>
        </div>
        <div className="date-pill">{todayLabel}</div>
      </header>

      <section className="content">
        {tab === "attendance" && (
          <div className="attendance-page">
            <div className="intro"><span className="eyebrow">TODAY</span><h1>今天也別忘了打卡</h1><p>員工編號 {profile?.employee_no ?? "—"}</p></div>
            <div className="clock-grid">
              <button className="clock-circle clock-in" onClick={() => clock("in")} disabled={Boolean(attendance?.clock_in) || actionLoading !== null}>
                <span className="clock-label">上班</span><strong>{actionLoading === "in" ? "..." : formatTime(attendance?.clock_in ?? null)}</strong><small>{attendance?.clock_in ? "已打卡" : "點一下打卡"}</small>
              </button>
              <button className="clock-circle clock-out" onClick={() => clock("out")} disabled={!attendance?.clock_in || Boolean(attendance?.clock_out) || actionLoading !== null}>
                <span className="clock-label">下班</span><strong>{actionLoading === "out" ? "..." : formatTime(attendance?.clock_out ?? null)}</strong><small>{attendance?.clock_out ? "已打卡" : attendance?.clock_in ? "點一下打卡" : "上班後可使用"}</small>
              </button>
            </div>
            {message && <div className="toast-inline">{message}</div>}
          </div>
        )}

        {tab === "announcements" && (
          <div className="list-page"><div className="section-title"><span className="eyebrow">NEWS</span><h1>公告</h1></div>
            <div className="announcement-list">
              {announcements.map((item) => <article className="announcement-card" key={item.id}><time>{new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.published_at))}</time><h2>{item.title}</h2><p>{item.body}</p></article>)}
              {!announcements.length && <div className="empty-card">目前沒有公告</div>}
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="list-page"><div className="section-title"><span className="eyebrow">PROFILE</span><h1>我的</h1></div>
            <div className="profile-card"><div className="avatar">{profile?.name?.slice(0,1) ?? "S"}</div><h2>{profile?.name}</h2><p>員工編號 {profile?.employee_no}</p></div>
            <button className="logout" onClick={async () => { await supabase?.auth.signOut(); setUser(null); setProfile(null); setAttendance(null); }}>登出</button>
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label="主要選單">
        <NavButton active={tab === "attendance"} label="打卡" icon="◉" onClick={() => setTab("attendance")} />
        <NavButton active={tab === "announcements"} label="公告" icon="▤" onClick={() => setTab("announcements")} />
        <NavButton active={tab === "profile"} label="我的" icon="●" onClick={() => setTab("profile")} />
      </nav>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) {
  const [employeeNo, setEmployeeNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: employeeEmail(employeeNo), password });
    if (loginError) setError("員工編號或密碼不正確"); else await onLogin();
    setBusy(false);
  }

  return <main className="login-screen"><div className="login-card"><div className="login-logo">S</div><h1>sharkAttend</h1><p className="login-subtitle">打卡，簡單一點。</p><form onSubmit={submit}><label>員工編號<input inputMode="numeric" autoComplete="username" value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} placeholder="例如 001" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="輸入密碼" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-btn" disabled={busy}>{busy ? "登入中..." : "登入"}</button></form></div></main>;
}

function SetupScreen() {
  return <main className="login-screen"><div className="login-card"><div className="login-logo">S</div><h1>sharkAttend</h1><p className="login-subtitle">前端已就緒，等待 Supabase 環境變數。</p><div className="setup-note">設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 後即可登入。</div></div></main>;
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}
