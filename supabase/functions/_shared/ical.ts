// iCalendar helpers, for when the Workspace blocks API access to the booking calendar:
//   parseIcs    read its secret iCal feed (Google bookings → app), shaped like Calendar API events
//   inviteIcs   the invitation emailed to the calendar owner for calls booked in the app (app → Google:
//               Gmail adds it to the calendar, so the booking page no longer offers that time)

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

export interface FeedEvent {
  id: string;
  summary: string;
  description: string;
  status: string;
  start: { dateTime: string | null; timeZone?: string };
  attendees: { email: string; displayName?: string; self: boolean; organizer: boolean }[];
  hangoutLink: string | null;
  recurring: boolean;
}

const unfold = (body: string) => body.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
const escapeText = (v: string) => v.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM="b:c":value — the first colon outside quotes ends the parameters.
  let i = 0;
  for (let quoted = false; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) break;
  }
  if (i >= line.length) return null;
  const [name, ...params] = line.slice(0, i).split(";");
  return {
    name: name.toUpperCase(),
    params: Object.fromEntries(params.map((p) => [p.slice(0, p.indexOf("=")).toUpperCase(), p.slice(p.indexOf("=") + 1).replace(/^"|"$/g, "")])),
    value: line.slice(i + 1),
  };
}

/** Wall-clock time in `tz` → UTC milliseconds. */
function zonedToUtc(parts: number[], tz: string) {
  const [y, mo, d, h, mi, s] = parts;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  const first = wall - offset(wall);
  return wall - offset(first);
}

function dateOf(p: Prop | undefined) {
  const m = p && /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(p.value);
  if (!m) return null; // all-day event
  const parts = m.slice(1, 7).map(Number);
  if (m[7]) return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])).toISOString();
  try {
    return new Date(zonedToUtc(parts, p!.params.TZID || "UTC")).toISOString();
  } catch {
    return null;
  }
}

function toEvent(props: Prop[], owner: string): FeedEvent {
  const get = (name: string) => props.find((p) => p.name === name);
  const description = unescape(get("DESCRIPTION")?.value ?? "");
  const organizer = get("ORGANIZER")?.value.replace(/^mailto:/i, "").toLowerCase();
  const rid = get("RECURRENCE-ID")?.value;
  return {
    id: `${get("UID")?.value ?? crypto.randomUUID()}${rid ? `_${rid}` : ""}`,
    summary: unescape(get("SUMMARY")?.value ?? ""),
    description,
    status: (get("STATUS")?.value ?? "CONFIRMED").toLowerCase(),
    start: { dateTime: dateOf(get("DTSTART")), timeZone: get("DTSTART")?.params.TZID },
    attendees: props
      .filter((p) => p.name === "ATTENDEE")
      .map((p) => {
        const email = p.value.replace(/^mailto:/i, "").toLowerCase();
        const cn = p.params.CN;
        return { email, displayName: cn && !cn.includes("@") ? cn : undefined, self: email === owner.toLowerCase(), organizer: email === organizer };
      }),
    hangoutLink: get("X-GOOGLE-CONFERENCE")?.value ?? /https:\/\/meet\.google\.com\/[a-z-]+/i.exec(description)?.[0] ?? null,
    recurring: !!get("RRULE"),
  };
}

/** Events of an iCal feed (alarms and other nested blocks skipped). */
export function parseIcs(body: string, owner: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  let current: Prop[] | null = null;
  let nested = 0;
  for (const line of unfold(body)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      if (current) events.push(toEvent(current, owner));
      current = null;
    } else if (current) {
      if (line.startsWith("BEGIN:")) nested++;
      else if (line.startsWith("END:")) nested--;
      else if (!nested) {
        const p = parseLine(line);
        if (p) current.push(p);
      }
    }
  }
  return events;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** METHOD:REQUEST invitation for the calendar owner; same UID per candidate, so a new time updates the event. */
export function inviteIcs(c: Row, o: { at: string; minutes: number; organizer: string; attendee: string; hold?: boolean; appUrl: string }) {
  const start = new Date(o.at);
  const end = new Date(start.getTime() + o.minutes * 60_000);
  const summary = `${o.hold ? "HOLD (waiting for confirmation) — " : ""}Outreach call — ${c.full_name}`;
  const description = [`Candidate: ${c.full_name} (${c.email})`, c.whatsapp ? `WhatsApp: ${c.whatsapp}` : "", `Course: ${c.desired_course ?? "-"}`, `Lead: ${o.appUrl}/admin?lead=${c.id}`]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outreach//Consultation//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:call-${c.id}@consultation.outreachstudy.eu`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `ORGANIZER;CN=Outreach Consultation:mailto:${o.organizer}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${o.attendee}`,
    `STATUS:${o.hold ? "TENTATIVE" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
