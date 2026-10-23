import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, CheckCircle2, Clock3, Eye, ImageIcon, Mail, MousePointerClick, RefreshCw, Send, ShieldCheck, Trash2, UploadCloud, UserPlus } from "lucide-react";
import { Alert, Button, Card, Spinner } from "../../components/ui";
import { PageTitle, StatStrip } from "../../components/dash";
import { supabase } from "../../lib/supabase";

type MarketingStatus = "draft" | "sent" | "opened" | "clicked" | "account_created" | "unsubscribed" | "failed";
interface Contact {
  id: string;
  full_name: string;
  email: string;
  status: MarketingStatus;
  send_count: number;
  open_count: number;
  click_count: number;
  follow_up_count: number;
  last_sent_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  account_created_at: string | null;
  unsubscribed_at: string | null;
  last_error: string | null;
  created_at: string;
}

const statusStyle: Record<MarketingStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  opened: "bg-violet-50 text-violet-700",
  clicked: "bg-amber-50 text-amber-700",
  account_created: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  unsubscribed: "bg-slate-100 text-slate-600",
};
const statusLabel: Record<MarketingStatus, string> = { draft: "Draft", sent: "Sent", opened: "Opened", clicked: "Clicked", account_created: "Account created", unsubscribed: "Unsubscribed", failed: "Failed" };
const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—");
const journey = [
  { key: "sent", label: "Invite sent", icon: Send },
  { key: "opened", label: "Opened", icon: Eye },
  { key: "clicked", label: "Clicked", icon: MousePointerClick },
  { key: "account_created", label: "Account created", icon: CheckCircle2 },
] as const;

function completedStep(contact: Contact) {
  if (contact.status === "account_created") return 3;
  if (contact.click_count > 0 || contact.status === "clicked") return 2;
  if (contact.open_count > 0 || contact.status === "opened") return 1;
  if (contact.send_count > 0 || contact.status === "sent") return 0;
  return -1;
}

export function EmailMarketing() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("{name}, create your free Outreach Study account");
  const [body, setBody] = useState("Your personal account keeps your Malta study consultation, documents and next steps together in one secure place.");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const [{ data, error }, template] = await Promise.all([
      supabase.from("marketing_contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("marketing_email_templates").select("subject, body, image_url").eq("id", "account-invite").maybeSingle(),
    ]);
    if (error) setError(error.message);
    setContacts((data as Contact[]) ?? []);
    if (template.data) { setSubject(template.data.subject); setBody(template.data.body); setImageUrl(template.data.image_url ?? ""); }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("marketing-contacts-admin").on("postgres_changes", { event: "*", schema: "public", table: "marketing_contacts" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const sendInvite = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(""); setSending(true);
    const { data, error } = await supabase.functions.invoke("send-marketing-invite", { body: { full_name: fullName.trim(), email: email.trim().toLowerCase() } });
    setSending(false);
    if (error || data?.error) return setError(data?.error || error?.message || "The invitation could not be sent.");
    setSuccess(`Invitation sent to ${email.trim().toLowerCase()}.`); setFullName(""); setEmail(""); load();
  };

  const saveTemplate = async () => {
    setError(""); setSuccess(""); setSaving(true);
    const { error } = await supabase.from("marketing_email_templates").upsert({ id: "account-invite", subject: subject.trim(), body: body.trim(), image_url: imageUrl || null, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setError(error.message);
    setSuccess("Email template saved.");
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setError("Choose a JPG, PNG, WebP or GIF image smaller than 5 MB.");
    setError(""); setSuccess(""); setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("marketing-assets").upload(path, file, { cacheControl: "31536000", upsert: false });
    setUploading(false);
    if (error) return setError(error.message);
    const { data } = supabase.storage.from("marketing-assets").getPublicUrl(path);
    setImageUrl(data.publicUrl); setSuccess("Image uploaded. Save the template to use it in future emails.");
  };

  const stats = useMemo(() => ({
    sent: contacts?.filter((item) => item.send_count > 0).length ?? 0,
    opened: contacts?.filter((item) => item.open_count > 0).length ?? 0,
    clicked: contacts?.filter((item) => item.click_count > 0).length ?? 0,
    created: contacts?.filter((item) => item.status === "account_created").length ?? 0,
  }), [contacts]);

  if (!contacts) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageTitle>Email marketing</PageTitle>
      <StatStrip items={[
        { icon: Send, label: "Invitations sent", value: stats.sent, tone: "text-blue-600" },
        { icon: Eye, label: "Opened", value: stats.opened, tone: "text-violet-600" },
        { icon: MousePointerClick, label: "Clicked", value: stats.clicked, tone: "text-amber-600" },
        { icon: CheckCircle2, label: "Accounts created", value: stats.created, tone: "text-emerald-600" },
      ]} />

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <Card>
          <form onSubmit={sendInvite} className="space-y-4 px-5 py-6 sm:px-7">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700"><UserPlus className="h-5 w-5" /></span><div><h2 className="text-lg font-black">Send one invitation</h2><p className="text-xs text-slate-500">The candidate receives the email immediately.</p></div></div>
            <label><span className="label">Full name</span><input className="field" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Candidate full name" /></label>
            <label><span className="label">Email address</span><input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="candidate@example.com" /></label>
            <Button type="submit" loading={sending} className="w-full"><Mail className="h-4 w-4" />Send account invitation</Button>
          </form>
        </Card>

        <Card>
          <div className="grid lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,1.18fr)]">
            <div className="space-y-4 border-b border-slate-100 px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r">
              <div><h2 className="text-lg font-black">Invitation template</h2><p className="text-xs text-slate-500">The Outreach logo, CTA, tracking and unsubscribe footer are added automatically.</p></div>
              <label><span className="label">Subject</span><input className="field" value={subject} onChange={(event) => setSubject(event.target.value)} /><span className="mt-1 block text-[11px] text-slate-400">Use <code>{"{name}"}</code> for the candidate’s first name.</span></label>
              <label><span className="label">Message</span><textarea className="field min-h-32 resize-y" value={body} onChange={(event) => setBody(event.target.value)} /></label>
              <div><span className="label">Hero image</span><label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-600 transition hover:border-[#28A77A] hover:bg-emerald-50"><UploadCloud className="h-5 w-5" />{uploading ? "Uploading…" : "Upload image (max 5 MB)"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={uploadImage} /></label>{imageUrl && <button type="button" onClick={() => setImageUrl("")} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-600"><Trash2 className="h-3.5 w-3.5" />Remove image</button>}</div>
              <Button type="button" loading={saving} onClick={saveTemplate} className="w-full">Save email template</Button>
            </div>
            <div className="bg-slate-100/70 p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Live preview</span><span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Unsubscribe included</span></div>
              <div className="mx-auto max-w-[520px] overflow-hidden rounded-[20px] bg-white shadow-xl"><div className="h-1.5 bg-[#28A77A]" /><div className="px-6 py-6 text-center"><img src="/logo.png" alt="Outreach Study" className="mx-auto h-auto w-44 max-w-[70%]" /><p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-[#28A77A]">Your Malta study journey</p><h3 className="mt-2 text-2xl font-black text-slate-900">Welcome, {fullName.trim().split(/\s+/)[0] || "Candidate"}</h3>{imageUrl ? <img src={imageUrl} alt="Email hero" className="mt-5 h-44 w-full rounded-2xl object-cover" /> : <div className="mt-5 grid h-32 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"><ImageIcon className="h-7 w-7" /></div>}<p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-600">{body || "Your message will appear here."}</p><div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-slate-800">One account for your consultation, documents and personalised next steps.</div><span className="mt-5 inline-flex rounded-full bg-[#28A77A] px-7 py-3 text-sm font-extrabold text-white">Create my free account</span><p className="mt-4 text-xs leading-5 text-slate-500">It takes about two minutes. Our team is here if you need help.</p><p className="mt-5 text-[11px] text-slate-400 underline">Unsubscribe</p></div><div className="border-t border-slate-100 bg-slate-50 px-5 py-4 text-center text-[10px] leading-5 text-slate-400"><strong className="text-slate-600">Outreach — Study in Malta</strong><br />outreachstudy.eu · WhatsApp +356 9972 8213</div></div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-6 sm:px-7">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">Candidate journeys</h2><p className="text-xs text-slate-500">One view from first email to account creation. Follow-ups stop automatically when the account is created.</p></div><button type="button" onClick={load} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
          {contacts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No invitations sent yet.</p> : <div className="space-y-4">{contacts.map((contact) => {
            const current = completedStep(contact);
            const progress = current < 0 ? 0 : ((current + 1) / journey.length) * 100;
            const lastActivity = contact.account_created_at || contact.unsubscribed_at || contact.last_clicked_at || contact.last_opened_at || contact.last_follow_up_at || contact.last_sent_at || contact.created_at;
            return <article key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{contact.full_name}</h3><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[contact.status]}`}>{statusLabel[contact.status]}</span></div><p className="mt-1 text-xs text-slate-500">{contact.email}</p></div>
                <div className="text-left text-xs text-slate-500 sm:text-right"><p>Last activity: {formatDate(lastActivity)}</p>{contact.follow_up_count > 0 ? <p className="mt-1 font-semibold text-amber-700">24-hour reminder sent</p> : contact.next_follow_up_at && contact.status !== "account_created" ? <p className="mt-1 inline-flex items-center gap-1 font-semibold text-slate-600"><Clock3 className="h-3.5 w-3.5" />Follow-up {formatDate(contact.next_follow_up_at)}</p> : null}</div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#28A77A] transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 grid grid-cols-4 gap-1">{journey.map((step, index) => { const done = index <= current; const Icon = step.icon; return <div key={step.key} className="text-center"><span className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 ${done ? "border-[#28A77A] bg-[#28A77A] text-white" : "border-slate-200 bg-white text-slate-400"}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}</span><span className={`mt-1.5 block text-[10px] font-bold leading-tight sm:text-xs ${done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</span></div>; })}</div>
              {contact.last_error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{contact.last_error}</p>}
            </article>;
          })}</div>}
        </div>
      </Card>
    </div>
  );
}
