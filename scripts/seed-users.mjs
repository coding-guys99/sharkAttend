import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const raw = process.env.INITIAL_EMPLOYEES_JSON;
if (!url || !serviceKey || !raw) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or INITIAL_EMPLOYEES_JSON");

const employees = JSON.parse(raw);
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

for (const employee of employees) {
  if (!employee.employeeNo || !employee.name || !employee.password) throw new Error("Invalid employee seed data");
  const email = `${employee.employeeNo}@sharkattend.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: employee.password, email_confirm: true });
  if (error && !error.message.toLowerCase().includes("already")) throw error;
  let userId = data?.user?.id;
  if (!userId) {
    const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    userId = page.users.find((u) => u.email === email)?.id;
  }
  if (!userId) throw new Error(`Could not resolve ${email}`);
  const role = employee.role === "admin" ? "admin" : "employee";
  const { error: profileError } = await admin.from("profiles").upsert({ user_id: userId, employee_no: employee.employeeNo, name: employee.name, role }, { onConflict: "user_id" });
  if (profileError) throw profileError;
  console.log(`Seeded ${employee.employeeNo} / ${employee.name}`);
}
