// Personalised A4 presentation PDF, emailed after an "Interviewed" outcome.
import { jsPDF } from "jspdf";
import { AREAS, BRAND, DISCOVER, LEVEL_STYLE, OTHER_INFO, PARTNERS, PROGRAMMES, VISA_STEPS, type InfoCard, type Level, type Programme } from "./data";

const NAVY = "#092553";
const VIOLET = "#5424c7";
const SLATE = "#64748b";
const PAGE_W = 210;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 280;

// The built-in Helvetica only draws WinAnsi characters (and spaces "€" badly); map or drop the rest.
const clean = (s: string) =>
  s
    .replace(/€\s?/g, "EUR ")
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/★/g, "*")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export function presentationFilename(name: string) {
  const slug = clean(name).trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Student";
  return `Malta-Study-Presentation-${slug}.pdf`;
}

export function buildPresentationPdf(student: { name: string; email: string }, programme: Programme | undefined) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let page = 0;
  let y = 0;

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(SLATE);
    doc.text(BRAND, MARGIN, 290);
    doc.text(`Page ${page}`, PAGE_W - MARGIN, 290, { align: "right" });
  };

  const newPage = (eyebrow: string, title: string) => {
    if (page > 0) doc.addPage();
    page += 1;
    doc.setFillColor(NAVY);
    doc.rect(0, 0, PAGE_W, 27, "F");
    doc.setFillColor(VIOLET);
    doc.rect(0, 27, PAGE_W, 2, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(clean(eyebrow.toUpperCase()), MARGIN, 10, { charSpace: 0.6 });
    doc.setFontSize(20);
    doc.text(clean(title), MARGIN, 21);
    footer();
    y = 40;
  };

  const write = (text: string, opts: { size?: number; bold?: boolean; color?: string; gap?: number; width?: number; x?: number } = {}) => {
    const { size = 10, bold = false, color = "#1e293b", gap = 2, width = CONTENT_W, x = MARGIN } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(clean(text), width) as string[];
    doc.text(lines, x, y);
    y += lines.length * size * 0.42 + gap;
  };

  // 1. Introduction
  newPage("Personalised presentation", "Malta Study Session");
  write(`Prepared for ${student.name}`, { size: 16, bold: true, color: VIOLET, gap: 1 });
  write(student.email, { size: 10, color: SLATE, gap: 8 });
  write("STUDY and eventually WORK in MALTA", { size: 14, bold: true, color: NAVY, gap: 3 });
  write(
    "All you need to know about study programs in Malta at accredited institutions and the processes to work while studying.",
    { bold: true, color: VIOLET, gap: 4 },
  );
  write(
    `${BRAND} guides international students from their first course conversation through programme selection, school applications, document preparation and the Malta study journey. We make each step clear, personal and manageable.`,
    { gap: 4 },
  );

  // 2. Chosen programme
  newPage("Your study path", "Your chosen programme");
  if (programme) {
    const details: [string, string][] = [
      ["School", programme.school],
      ["Level", programme.qualification],
      ["Credits", programme.credits ?? "-"],
      ["Duration", programme.duration],
      ["Fee", programme.totalFee ?? "Confirm with school"],
      ["English", programme.english ?? "Confirm with school"],
      ["Requirement", programme.requirement ?? "School assessment"],
    ];
    const boxH = 22 + details.length * 7;
    doc.setFillColor("#ecfdf5");
    doc.setDrawColor("#6ee7b7");
    doc.roundedRect(MARGIN, y - 6, CONTENT_W, boxH, 3, 3, "FD");
    y += 2;
    write(programme.course, { size: 14, bold: true, color: "#065f46", gap: 4, x: MARGIN + 6, width: CONTENT_W - 12 });
    for (const [k, v] of details) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(SLATE);
      doc.text(k, MARGIN + 6, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor("#0f172a");
      doc.text(clean(v), MARGIN + 40, y);
      y += 7;
    }
    y += 8;
    write("Fees and entry requirements are guidance only. Final admission, intake dates and any scholarship are confirmed by the school.", {
      size: 8,
      color: "#92400e",
    });
  } else {
    write("Your adviser will confirm your programme with you.", { color: SLATE });
  }

  // 3. Programme tables
  const COLS = [
    { label: "School", w: 42 },
    { label: "Course", w: 62 },
    { label: "Qualification", w: 24 },
    { label: "Duration", w: 18 },
    { label: "Fees (Y1 / Y2 / Y3)", w: 34 },
  ];
  const ensure = (h: number, eyebrow: string, title: string) => {
    if (y + h > BOTTOM) newPage(`${eyebrow} - continued`, title);
  };

  newPage("Available programmes", "Available programmes");
  for (const area of AREAS.filter((a) => a.key !== "english")) {
    ensure(20, "Available programmes", "Available programmes");
    write(area.name, { size: 13, bold: true, color: NAVY, gap: 3 });
    for (const level of ["diploma", "bachelor", "master"] as Level[]) {
      const rows = PROGRAMMES.filter((p) => p.area === area.key && p.level === level);
      if (!rows.length) continue;
      ensure(24, "Available programmes", "Available programmes");
      const style = LEVEL_STYLE[level];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(style.color);
      doc.text(style.label, MARGIN, y);
      y += 7;
      const tableHeader = () => {
        doc.setFillColor(style.color);
        doc.rect(MARGIN, y - 4, CONTENT_W, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor("#ffffff");
        let x = MARGIN + 2;
        for (const col of COLS) {
          doc.text(col.label, x, y);
          x += col.w;
        }
        y += 6;
      };
      tableHeader();
      rows.forEach((p, i) => {
        const cells = [p.school, p.course, p.qualification, p.duration, p.fees.filter((f) => f && f !== "-").join(" / ")];
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const wrapped = cells.map((c, j) => doc.splitTextToSize(clean(c), COLS[j].w - 3) as string[]);
        const h = Math.max(...wrapped.map((w) => w.length)) * 3.6 + 3;
        if (y + h > BOTTOM) {
          newPage("Available programmes - continued", "Available programmes");
          tableHeader();
        }
        if (i % 2 === 0) {
          doc.setFillColor("#f8fafc");
          doc.rect(MARGIN, y - 3.5, CONTENT_W, h, "F");
        }
        if (programme?.id === p.id) {
          doc.setDrawColor("#f59e0b");
          doc.rect(MARGIN, y - 3.5, CONTENT_W, h, "S");
        }
        doc.setTextColor("#0f172a");
        let cx = MARGIN + 2;
        wrapped.forEach((w, j) => {
          doc.setFont("helvetica", j === 4 ? "bold" : "normal");
          doc.text(w, cx, y);
          cx += COLS[j].w;
        });
        y += h;
      });
      y += 5;
    }
  }

  // 4+. Card pages
  const cardGrid = (eyebrow: string, title: string, cards: { title: string; text: string; points?: string[] }[]) => {
    newPage(eyebrow, title);
    const colW = (CONTENT_W - 6) / 2;
    const measure = (c: { title: string; text: string; points?: string[] }) => {
      doc.setFontSize(10);
      const t = doc.splitTextToSize(clean(c.title), colW - 8) as string[];
      doc.setFontSize(8.5);
      const body = doc.splitTextToSize(clean(c.text), colW - 8) as string[];
      const pts = (c.points ?? []).map((p) => doc.splitTextToSize(clean(`- ${p}`), colW - 10) as string[]);
      const h = 8 + t.length * 4.5 + body.length * 3.7 + pts.reduce((n, p) => n + p.length * 3.6, 0) + (pts.length ? 3 : 0);
      return { t, body, pts, h };
    };
    for (let i = 0; i < cards.length; i += 2) {
      const pair = cards.slice(i, i + 2).map(measure);
      const rowH = Math.max(...pair.map((p) => p.h));
      if (y + rowH > BOTTOM) newPage(`${eyebrow} - continued`, title);
      pair.forEach((m, j) => {
        const x = MARGIN + j * (colW + 6);
        doc.setFillColor("#f4f5fb");
        doc.setDrawColor("#e2e8f0");
        doc.roundedRect(x, y - 5, colW, rowH, 3, 3, "FD");
        let cy = y + 1;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(NAVY);
        doc.text(m.t, x + 4, cy);
        cy += m.t.length * 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor("#334155");
        doc.text(m.body, x + 4, cy);
        cy += m.body.length * 3.7 + (m.pts.length ? 2 : 0);
        doc.setTextColor("#047857");
        for (const p of m.pts) {
          doc.text(p, x + 5, cy);
          cy += p.length * 3.6;
        }
      });
      y += rowH + 5;
    }
  };

  const plain = (cards: InfoCard[]) => cards.map(({ title, text, points }) => ({ title, text, points }));
  cardGrid("Malta study session", "Discover Malta", plain(DISCOVER));
  cardGrid("Malta study session", "Visa Application Process", plain(VISA_STEPS));
  cardGrid("Malta study session", "School Partners", PARTNERS.map((p) => ({ title: p.name, text: p.website })));
  cardGrid(
    "Malta study session",
    "Other Information to Know",
    OTHER_INFO.flatMap((s) => plain(s.cards)),
  );

  return doc;
}

export function pdfBase64(doc: jsPDF) {
  return (doc.output("datauristring") as string).split(",")[1];
}
