export type Status =
  | "new"
  | "contacted"
  | "qualified"
  | "consultation_booked"
  | "documents_requested"
  | "application_submitted"
  | "offer_received"
  | "payment"
  | "visa_process"
  | "enrolled"
  | "lost";

export interface Slot {
  id: string;
  starts_at: string;
  duration_minutes: number;
  consultation_id: string | null;
}

export interface Consultation {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  whatsapp: string | null;
  country: string | null;
  age: number | null;
  study_path: string | null;
  english_level: string | null;
  desired_course: string | null;
  start_date: string | null;
  budget: string | null;
  visa_support: string | null;
  preferred_contact_time: string | null;
  message: string | null;
  status: Status;
  admin_notes: string | null;
  tracking: Record<string, string>;
  created_at: string;
  updated_at: string;
  // One-to-one embed: PostgREST may return an object or a one-item array.
  slots?: BookedSlot | BookedSlot[] | null;
}

export type BookedSlot = Pick<Slot, "id" | "starts_at" | "duration_minutes">;

export const slotOf = (c: Consultation): BookedSlot | undefined =>
  (Array.isArray(c.slots) ? c.slots[0] : c.slots) ?? undefined;

export interface DocumentRow {
  id: string;
  consultation_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}
