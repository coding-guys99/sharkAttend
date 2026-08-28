"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Perms={can_manage_employees:boolean;can_manage_permissions:boolean;can_reset_passwords:boolean};
type Employee={user_id:string;employee_no:string;name:string;role:"employee"|"admin";employee_permissions?:Perms[]|Perms|null};
const emptyPerms:Perms={can_manage_employees:false,can_manage_permissions:false,can_reset_passwords:false};
function normalizePerms(v:Employee["employee_permissions"]):Perms{if(Array.isArray(v))return v[0]??emptyPerms;return v??emptyPerms}

async function edgeErrorMessage(error: unknown){
 const fallback=error instanceof Error?error.message:"Edge Function request failed";
 const context=(error as {context?:unknown}|null)?.context as {clone?:()=>Response;json?:()=>Promise<unknown>}|undefined;
 try{const response=context?.clone?.();const payload=(response?await response.json():context?.json?await context.json():null) as {error?:string}|null;return payload?.error||fallback}catch{return fallback}
}

export default function AdminPanel({onBack}:{onBack?:()=>void}){
 const[employees,setEmployees]=useState<Employee[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[newNo,setNewNo]=useState(""),[newName,setNewName]=useState(""),[newRole,setNewRole]=useState<"employee"|"admin">("employee"),[resetPasswords,setResetPasswords]=useState<Record<string,string>>({}),[busy,setBusy]=useState<string|null>(null),[expanded,setExpanded]=useState<string|null>(null),[showAdd,setShowAdd]=useState(false);
 const invoke=useCallback(async(body:Record<string,unknown>)=>{if(!supabase)throw new Error("Supabase unavailable");const{data,error}=await supabase.functions.invoke("admin-employees",{body});if(error)throw new Error(await edgeErrorMessage(error));if(data?.error)throw new Error(data.error);return data},[]);
 const load=useCallback(async()=>{setLoading(true);setMessage("");try{const data=await invoke({action:"list"});setEmployees(data?.employees??[])}catch(e){setMessage(e instanceof Error?e.message:"讀取員工失敗")}finally{setLoading(false)}},[invoke]);
 useEffect(()=>{load()},[load]);
 async function addEmployee(){if(!newNo.trim()||!newName.trim()){setMessage("請輸入員工編號與姓名");return}setBusy("create");setMessage("");try{await invoke({action:"create",employeeNo:newNo,name:newName,password:"123456",role:newRole});setMessage(`已新增 ${newNo} / ${newName}`);setNewNo("");setNewName("");setNewRole("employee");setShowAdd(false);await load()}catch(e){setMessage(e instanceof Error?e.message:"新增失敗")}setBusy(null)}
 async function savePermissions(emp:Employee,role:"employee"|"admin",permissions:Perms){setBusy(emp.user_id);setMessage("");try{await invoke({action:"update_permissions",userId:emp.user_id,role,permissions});setEmployees(p=>p.map(x=>x.user_id===emp.user_id?{...x,role,employee_permissions:permissions}:x));setMessage(`已更新 ${emp.name} 的權限`)}catch(e){setMessage(e instanceof Error?e.message:"更新失敗")}setBusy(null)}
 async function resetPassword(emp:Employee){const password=resetPasswords[emp.user_id]??"";if(password.length<6){setMessage("新密碼至少 6 碼");return}setBusy(`pw-${emp.user_id}`);setMessage("");try{await invoke({action:"reset_password",userId:emp.user_id,password});setMessage(`已重設 ${emp.name} 的密碼`);setResetPasswords(p=>({...p,[emp.user_id]:""}))}catch(e){setMessage(e instanceof Error?e.message:"重設密碼失敗")}setBusy(null)}
 return <div className="settings-page">
   <div className="subpage-header">{onBack&&<button className="back-button" onClick={onBack}>‹ 我的</button>}<h1>人員管理</h1><button className="text-action" onClick={()=>setShowAdd(v=>!v)}>{showAdd?"取消":"新增"}</button></div>
   {showAdd&&<section className="ios-form"><div className="ios-field"><span>員工編號</span><input inputMode="numeric" value={newNo} onChange={e=>setNewNo(e.target.value)} placeholder="例如 005" /></div><div className="ios-field"><span>姓名</span><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="員工姓名" /></div><div className="ios-field"><span>角色</span><select value={newRole} onChange={e=>setNewRole(e.target.value as "employee"|"admin")}><option value="employee">一般員工</option><option value="admin">管理員</option></select></div><div className="ios-field"><span>預設密碼</span><b>123456</b></div><button className="ios-primary" disabled={busy==="create"} onClick={addEmployee}>{busy==="create"?"新增中…":"新增人員"}</button></section>}
   {message&&<div className="inline-status">{message}</div>}
   <div className="settings-label">所有人員 · {employees.length}</div>
   <section className="settings-group employee-group">
     {loading&&<div className="settings-loading">讀取中…</div>}
     {!loading&&employees.map(emp=><EmployeeRow key={emp.user_id} emp={emp} expanded={expanded===emp.user_id} onToggle={()=>setExpanded(v=>v===emp.user_id?null:emp.user_id)} perms={normalizePerms(emp.employee_permissions)} busy={busy} resetPasswordValue={resetPasswords[emp.user_id]??""} onResetValue={v=>setResetPasswords(p=>({...p,[emp.user_id]:v}))} onResetDefault={()=>setResetPasswords(p=>({...p,[emp.user_id]:"123456"}))} onReset={()=>resetPassword(emp)} onSave={(role,p)=>savePermissions(emp,role,p)} />)}
   </section>
 </div>
}

function EmployeeRow({emp,expanded,onToggle,perms,busy,resetPasswordValue,onResetValue,onResetDefault,onReset,onSave}:{emp:Employee;expanded:boolean;onToggle:()=>void;perms:Perms;busy:string|null;resetPasswordValue:string;onResetValue:(v:string)=>void;onResetDefault:()=>void;onReset:()=>void;onSave:(r:"employee"|"admin",p:Perms)=>void}){
 const[role,setRole]=useState(emp.role),[localPerms,setLocalPerms]=useState(perms);useEffect(()=>{setRole(emp.role);setLocalPerms(perms)},[emp.role,perms.can_manage_employees,perms.can_manage_permissions,perms.can_reset_passwords]);const setPerm=(k:keyof Perms,v:boolean)=>setLocalPerms(p=>({...p,[k]:v}));
 return <div className="employee-row-wrap"><button className="employee-row" onClick={onToggle}><div className="employee-mini-avatar">{emp.name.slice(0,1).toUpperCase()}</div><div className="employee-row-main"><strong>{emp.name}</strong><span>#{emp.employee_no} · {role==="admin"?"管理員":"員工"}</span></div><span className={expanded?"chevron open":"chevron"}>›</span></button>{expanded&&<div className="employee-detail"><div className="ios-field"><span>角色</span><select value={role} onChange={e=>{const r=e.target.value as "employee"|"admin";setRole(r);if(r==="employee")setLocalPerms(emptyPerms)}}><option value="employee">一般員工</option><option value="admin">管理員</option></select></div><div className="switch-list"><Toggle label="員工管理" note="查看與新增員工" disabled={role!=="admin"} checked={localPerms.can_manage_employees} onChange={v=>setPerm("can_manage_employees",v)} /><Toggle label="權限管理" note="變更角色與權限" disabled={role!=="admin"} checked={localPerms.can_manage_permissions} onChange={v=>setPerm("can_manage_permissions",v)} /><Toggle label="密碼管理" note="替員工重設密碼" disabled={role!=="admin"} checked={localPerms.can_reset_passwords} onChange={v=>setPerm("can_reset_passwords",v)} /></div><button className="ios-secondary" disabled={busy===emp.user_id} onClick={()=>onSave(role,localPerms)}>{busy===emp.user_id?"儲存中…":"儲存權限"}</button><div className="reset-section"><div className="reset-heading"><strong>重設密碼</strong><span>至少 6 碼</span></div><div className="reset-inline"><input type="password" value={resetPasswordValue} onChange={e=>onResetValue(e.target.value)} placeholder="輸入新密碼" /><button type="button" onClick={onResetDefault}>123456</button></div><button className="danger-light" disabled={busy===`pw-${emp.user_id}`} onClick={onReset}>{busy===`pw-${emp.user_id}`?"處理中…":"更新密碼"}</button></div></div>}</div>
}

function Toggle({label,note,checked,disabled,onChange}:{label:string;note:string;checked:boolean;disabled:boolean;onChange:(v:boolean)=>void}){return <label className="switch-row"><span><b>{label}</b><small>{note}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} /></label>}
