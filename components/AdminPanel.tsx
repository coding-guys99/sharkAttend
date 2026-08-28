"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Perms = {
  can_manage_employees: boolean;
  can_manage_permissions: boolean;
  can_reset_passwords: boolean;
};

type Employee = {
  user_id: string;
  employee_no: string;
  name: string;
  role: "employee" | "admin";
  employee_permissions?: Perms[] | Perms | null;
};

const emptyPerms: Perms = {
  can_manage_employees: false,
  can_manage_permissions: false,
  can_reset_passwords: false,
};

function normalizePerms(value: Employee["employee_permissions"]): Perms {
  if (Array.isArray(value)) return value[0] ?? emptyPerms;
  return value ?? emptyPerms;
}

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + nums + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let out = pick(upper) + pick(lower) + pick(nums) + pick(symbols);
  while (out.length < 12) out += pick(all);
  return out.split("").sort(() => Math.random() - 0.5).join("");
}

export default function AdminPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newNo, setNewNo] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"employee" | "admin">("employee");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!supabase) throw new Error("Supabase unavailable");
    const { data, error } = await supabase.functions.invoke("admin-employees", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await invoke({ action: "list" });
      setEmployees(data?.employees ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "讀取員工失敗");
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { load(); }, [load]);

  async function addEmployee() {
    if (!newNo.trim() || !newName.trim() || newPassword.length < 8) {
      setMessage("請輸入員工編號、姓名，以及至少 8 碼密碼");
      return;
    }
    setBusy("create"); setMessage("");
    try {
      await invoke({ action: "create", employeeNo: newNo, name: newName, password: newPassword, role: newRole });
      setMessage(`已新增 ${newNo} / ${newName}`);
      setNewNo(""); setNewName(""); setNewPassword(""); setNewRole("employee");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "新增失敗"); }
    setBusy(null);
  }

  async function savePermissions(emp: Employee, role: "employee" | "admin", permissions: Perms) {
    setBusy(emp.user_id); setMessage("");
    try {
      await invoke({ action: "update_permissions", userId: emp.user_id, role, permissions });
      setEmployees((prev) => prev.map((x) => x.user_id === emp.user_id ? { ...x, role, employee_permissions: permissions } : x));
      setMessage(`已更新 ${emp.name} 的權限`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "更新失敗"); }
    setBusy(null);
  }

  async function resetPassword(emp: Employee) {
    const password = resetPasswords[emp.user_id] ?? "";
    if (password.length < 8) { setMessage("新密碼至少 8 碼"); return; }
    setBusy(`pw-${emp.user_id}`); setMessage("");
    try {
      await invoke({ action: "reset_password", userId: emp.user_id, password });
      setMessage(`已重設 ${emp.name} 的密碼`);
      setResetPasswords((prev) => ({ ...prev, [emp.user_id]: "" }));
    } catch (e) { setMessage(e instanceof Error ? e.message : "重設密碼失敗"); }
    setBusy(null);
  }

  return (
    <div className="admin-page">
      <div className="section-title"><span className="eyebrow">ADMIN</span><h1>員工管理</h1><p>新增員工、設定角色與管理權限。</p></div>

      <section className="admin-card add-employee-card">
        <div className="admin-card-title"><div><h2>新增員工</h2><p>員工建立後即可用編號＋密碼登入。</p></div></div>
        <div className="admin-form-grid">
          <label>員工編號<input inputMode="numeric" value={newNo} onChange={(e) => setNewNo(e.target.value)} placeholder="例如 005" /></label>
          <label>姓名<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="員工姓名" /></label>
          <label className="password-field">初始密碼<div className="inline-input"><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 8 碼" /><button type="button" onClick={() => setNewPassword(generatePassword())}>產生</button></div></label>
          <label>角色<select value={newRole} onChange={(e) => setNewRole(e.target.value as "employee" | "admin")}><option value="employee">一般員工</option><option value="admin">管理員</option></select></label>
        </div>
        <button className="admin-primary" disabled={busy === "create"} onClick={addEmployee}>{busy === "create" ? "新增中…" : "新增員工"}</button>
      </section>

      {message && <div className="admin-message">{message}</div>}

      <div className="employee-list">
        {loading && <div className="empty-card">讀取員工中…</div>}
        {!loading && employees.map((emp) => {
          const perms = normalizePerms(emp.employee_permissions);
          return <EmployeeCard key={emp.user_id} emp={emp} perms={perms} busy={busy} resetPasswordValue={resetPasswords[emp.user_id] ?? ""}
            onResetValue={(v) => setResetPasswords((prev) => ({ ...prev, [emp.user_id]: v }))}
            onGenerate={() => setResetPasswords((prev) => ({ ...prev, [emp.user_id]: generatePassword() }))}
            onReset={() => resetPassword(emp)}
            onSave={(role, nextPerms) => savePermissions(emp, role, nextPerms)} />;
        })}
      </div>
    </div>
  );
}

function EmployeeCard({ emp, perms, busy, resetPasswordValue, onResetValue, onGenerate, onReset, onSave }: {
  emp: Employee; perms: Perms; busy: string | null; resetPasswordValue: string;
  onResetValue: (value: string) => void; onGenerate: () => void; onReset: () => void;
  onSave: (role: "employee" | "admin", perms: Perms) => void;
}) {
  const [role, setRole] = useState(emp.role);
  const [localPerms, setLocalPerms] = useState(perms);
  useEffect(() => { setRole(emp.role); setLocalPerms(perms); }, [emp.role, perms.can_manage_employees, perms.can_manage_permissions, perms.can_reset_passwords]);
  const setPerm = (key: keyof Perms, value: boolean) => setLocalPerms((p) => ({ ...p, [key]: value }));

  return <section className="admin-card employee-card">
    <div className="employee-head"><div className="employee-avatar">{emp.name.slice(0, 1).toUpperCase()}</div><div className="employee-ident"><strong>{emp.name}</strong><span>#{emp.employee_no}</span></div><span className={role === "admin" ? "role-badge admin" : "role-badge"}>{role === "admin" ? "管理員" : "員工"}</span></div>
    <div className="role-row"><label>角色<select value={role} onChange={(e) => { const r = e.target.value as "employee" | "admin"; setRole(r); if (r === "employee") setLocalPerms(emptyPerms); }}><option value="employee">一般員工</option><option value="admin">管理員</option></select></label></div>
    <div className="permission-grid">
      <label><input type="checkbox" disabled={role !== "admin"} checked={localPerms.can_manage_employees} onChange={(e) => setPerm("can_manage_employees", e.target.checked)} /><span><b>員工管理</b><small>查看與新增員工</small></span></label>
      <label><input type="checkbox" disabled={role !== "admin"} checked={localPerms.can_manage_permissions} onChange={(e) => setPerm("can_manage_permissions", e.target.checked)} /><span><b>權限管理</b><small>變更角色與權限</small></span></label>
      <label><input type="checkbox" disabled={role !== "admin"} checked={localPerms.can_reset_passwords} onChange={(e) => setPerm("can_reset_passwords", e.target.checked)} /><span><b>密碼管理</b><small>替員工重設密碼</small></span></label>
    </div>
    <button className="admin-secondary" disabled={busy === emp.user_id} onClick={() => onSave(role, localPerms)}>{busy === emp.user_id ? "儲存中…" : "儲存權限"}</button>
    <div className="password-reset"><div><strong>重設密碼</strong><small>至少 8 碼，儲存後立即生效。</small></div><div className="inline-input"><input value={resetPasswordValue} onChange={(e) => onResetValue(e.target.value)} placeholder="新密碼" /><button type="button" onClick={onGenerate}>產生</button></div><button className="reset-btn" disabled={busy === `pw-${emp.user_id}`} onClick={onReset}>{busy === `pw-${emp.user_id}` ? "處理中…" : "更新密碼"}</button></div>
  </section>;
}
