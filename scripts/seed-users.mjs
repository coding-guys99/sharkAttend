import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const employees = [
  { employeeNo: "001", name: "Penny", password: "Shark001!" },
  { employeeNo: "002", name: "Amy", password: "Shark002!" },
  { employeeNo: "003", name: "Angus", password: "Shark003!" },
];

for (const employee of employees) {
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
  const { error: profileError } = await admin.from("profiles").upsert({ user_id: userId, employee_no: employee.employeeNo, name: employee.name }, { onConflict: "user_id" });
  if (profileError) throw profileError;
  console.log(`Seeded ${employee.employeeNo} / ${employee.name}`);
}
