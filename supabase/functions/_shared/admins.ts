// Who gets the staff alerts (new lead, call request, call confirmed): every admin on the Team page,
// plus ADMIN_NOTIFY_EMAIL (default sbarakat@outreachrecruitment.net) so alerts never go nowhere.

// deno-lint-ignore no-explicit-any
export async function adminRecipients(db: any): Promise<string[]> {
  const main = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "sbarakat@outreachrecruitment.net";
  const { data } = await db.from("admins").select("email");
  return [...new Set([main, ...(data ?? []).map((a: { email: string }) => a.email.toLowerCase())])];
}
