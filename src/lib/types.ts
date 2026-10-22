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
  preferred_call_at: string | null; // confirmed call time
  call_status: "none" | "requested" | "confirmed";
  requested_call_times: string[];
  review_checklist: Record<string, boolean>;
  call_reviewed_at: string | null;
  call_declined_at: string | null;
  suggested_call_at: string | null; // time sent to the candidate, waiting for their confirmation
  call_suggested_at: string | null;
  call_confirm_token: string | null;
  referral_code: string;
  session_outcome: "interviewed" | "no_attendance" | "no_longer_interested" | null;
  session_outcome_at: string | null;
  meeting_url: string | null;
  is_starred: boolean;
  assigned_to: string | null;
  google_event_id: string | null;
  documents_due_at: string | null;
  session_by: string | null;
  session_rating: number | null;
  session_feedback: string | null;
  tracking: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  consultation_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  doc_type: string | null;
  review_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  consultation_id: string;
  title: string;
  due_at: string;
  done_at: string | null;
  created_by: string | null;
}
