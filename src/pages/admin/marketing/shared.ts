// Shared types and helpers for the email-marketing admin (builder, library, campaigns).
import { supabase } from "../../../lib/supabase";
import type { Block, BlockType, MarketingSettings } from "../../../../supabase/functions/_shared/marketing-render";

export type { Block, BlockType, MarketingSettings };
export { renderEmail, spamCheck, TAGS } from "../../../../supabase/functions/_shared/marketing-render";

export const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://consultation.outreachstudy.eu";

export interface Template {
  id: string;
  name: string | null;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  topic: "news" | "deadlines";
  is_system: boolean;
  updated_at: string;
}

export interface Asset {
  id: string;
  url: string;
  alt: string;
  name: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const DEFAULT_SETTINGS: MarketingSettings = {
  company_name: "Outreach — Study in Malta",
  address: "",
  website_url: "https://outreachstudy.eu",
  contact_email: "",
  phone: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  linkedin_url: "",
  youtube_url: "",
  whatsapp: "35699728213",
  why_text: "You are receiving this email because you applied or asked about studying in Malta with Outreach.",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  columns: "Two columns",
  divider: "Divider",
  spacer: "Spacer",
  quote: "Quote",
  programme: "Programme card",
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case "heading":
      return { id, type, text: "Hi {name}!" };
    case "text":
      return { id, type, text: "Write your message here. Use **bold** for emphasis." };
    case "image":
      return { id, type, url: "", alt: "", href: "" };
    case "button":
      return { id, type, label: "Open my dashboard", href: "{dashboard_link}" };
    case "columns":
      return { id, type, image: "", alt: "", text: "A short description next to the picture.", href: "", imageRight: false };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, size: 24 };
    case "quote":
      return { id, type, text: "Outreach made studying in Malta easy.", author: "A student" };
    case "programme":
      return { id, type, image: "", alt: "", name: "Bachelor in Business", price: "From €4,500 / year", href: "{dashboard_link}", label: "Apply" };
  }
}

/** Resize to max 1200px and re-encode (WebP, ~80%) so emails stay light. GIFs are kept as they are. */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  if (file.type === "image/gif") return { blob: file, ext: "gif", width, height };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress the image"))), "image/webp", 0.8));
  return { blob, ext: "webp", width, height };
}

/** Compress, upload to the marketing-assets bucket and add to the library. */
export async function uploadAsset(file: File, alt: string): Promise<Asset> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) throw new Error("Choose a JPG, PNG, WebP or GIF image under 15 MB.");
  const { blob, ext, width, height } = await compressImage(file);
  const path = `${Date.now()}-${uid()}.${ext}`;
  const up = await supabase.storage.from("marketing-assets").upload(path, blob, { cacheControl: "31536000", contentType: blob.type || `image/${ext}` });
  if (up.error) throw new Error(up.error.message);
  const url = supabase.storage.from("marketing-assets").getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from("marketing_assets")
    .insert({ url, alt: alt.trim(), name: file.name, width, height })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}

export async function loadSettings(): Promise<MarketingSettings> {
  const { data } = await supabase.from("marketing_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}

/** Sample values for previews. */
export const SAMPLE_VARS = {
  name: "Sara",
  course: "Bachelor in Business",
  country: "Morocco",
  advisor: "Sofyane",
  call_date: "Monday 27 October, 14:00",
};
