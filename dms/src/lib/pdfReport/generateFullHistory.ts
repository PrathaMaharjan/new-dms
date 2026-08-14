// src/lib/reports/generateFullHistoryPdf.ts
import PDFDocument from "pdfkit";

const MARGIN = 50;
const BRAND = "#3f6274";
const HEADING = "#111827";
const BODY = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const BORDER = "#e5e7eb";
const CARD_BG = "#f9fafb";


export type FullHistoryData = {
  patientName: string;
  patientEmail: string | null;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  visits: {
    date: Date;
    doctorName: string;
    treatmentName: string;
    status: string;
    noteText: string | null;
    prescription: string | null;
  }[];
};


function checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottomMargin = 70;
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
  }
}

function generateReportId(patientEmail: string | null, date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const seed = (patientEmail ?? "patient").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `HIST-${datePart}-${seed || "XXXXXX"}`;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  clinic: { name: string; address: string | null; phone: string | null; email: string | null }
) {
  doc.roundedRect(MARGIN, 45, 50, 50, 4).fillAndStroke("#e5e7eb", "#d1d5db");
  doc.fontSize(7).fillColor(FAINT).text("LOGO", MARGIN, 66, { width: 50, align: "center" });

  doc.fontSize(16).fillColor(BRAND).font("Helvetica-Bold").text(clinic.name, 112, 48);
  const contactLine = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join("   •   ");
  if (contactLine) {
    doc.fontSize(8.5).fillColor(MUTED).font("Helvetica").text(contactLine, 112, 70, {
      width: doc.page.width - MARGIN - 112,
    });
  }

  doc.moveTo(MARGIN, 110).lineTo(doc.page.width - MARGIN, 110).strokeColor(BORDER).lineWidth(1).stroke();
  doc.y = 125;
}

function drawTitle(doc: PDFKit.PDFDocument) {
  doc.fontSize(18).fillColor(HEADING).font("Helvetica-Bold").text("Full Medical History", MARGIN, doc.y, {
    align: "center",
  });
  doc.moveDown(0.6);
}

function drawMetadata(doc: PDFKit.PDFDocument, reportId: string, visitCount: number, generatedAt: Date) {
  const line = `Report ID: ${reportId}   |   Total Visits: ${visitCount}   |   Generated: ${generatedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  doc.fontSize(8.5).fillColor(MUTED).font("Helvetica").text(line, MARGIN, doc.y, {
    width: doc.page.width - MARGIN * 2,
    align: "center",
  });
  doc.moveDown(1.2);
}

function drawKeyValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  valueWidth: number
) {
  doc.fontSize(9).fillColor(MUTED).font("Helvetica").text(label, x, y, { width: labelWidth });
  doc.fontSize(9).fillColor(HEADING).font("Helvetica-Bold").text(value || "—", x + labelWidth, y, { width: valueWidth });
}

function drawCard(doc: PDFKit.PDFDocument, title: string, rows: [string, string][]) {
  const rowHeight = 18;
  const cardHeight = 32 + rows.length * rowHeight + 14;
  checkPageBreak(doc, cardHeight + 12);

  const startY = doc.y;
  const cardWidth = doc.page.width - MARGIN * 2;

  doc.roundedRect(MARGIN, startY, cardWidth, cardHeight, 4).fillAndStroke(CARD_BG, BORDER);
  doc.fontSize(11).fillColor(HEADING).font("Helvetica-Bold").text(title, MARGIN + 12, startY + 10);

  let y = startY + 32;
  for (const [label, value] of rows) {
    drawKeyValue(doc, label, value, MARGIN + 12, y, 130, cardWidth - 160);
    y += rowHeight;
  }

  doc.y = startY + cardHeight + 16;
}

// A tag-style list for allergies/conditions/medications - a plain
// paragraph reads as prose for what's really a short scannable list, so
// this renders each item as its own compact bullet instead.
function drawBulletList(doc: PDFKit.PDFDocument, title: string, items: string[]) {
  checkPageBreak(doc, 45);
  doc.fontSize(11).fillColor(HEADING).font("Helvetica-Bold").text(title, MARGIN, doc.y);
  doc.moveDown(0.3);

  if (items.length === 0) {
    doc.fontSize(9.5).fillColor(MUTED).font("Helvetica-Oblique").text("None recorded.", MARGIN + 8, doc.y);
    doc.moveDown(0.8);
    return;
  }

  for (const item of items) {
    checkPageBreak(doc, 16);
    doc.fontSize(9.5).fillColor(BODY).font("Helvetica").text(`•  ${item}`, MARGIN + 8, doc.y, {
      width: doc.page.width - MARGIN * 2 - 8,
    });
  }
  doc.moveDown(0.8);
}

// One visit's own card - kept visually distinct from a running paragraph,
// since a full history could easily span dozens of visits and needs to
// stay scannable rather than blur into one long block of text.
function drawVisitEntry(
  doc: PDFKit.PDFDocument,
  visit: FullHistoryData["visits"][number],
  index: number
) {
  const dateLabel = visit.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const noteLines = visit.noteText ? Math.ceil(visit.noteText.length / 90) : 0;
  const rxLines = visit.prescription ? Math.ceil(visit.prescription.length / 90) : 0;
  const estimatedHeight = 55 + noteLines * 12 + rxLines * 12;

  checkPageBreak(doc, estimatedHeight);

  const startY = doc.y;
  const cardWidth = doc.page.width - MARGIN * 2;

  doc.fontSize(10.5).fillColor(HEADING).font("Helvetica-Bold").text(`${index + 1}.  ${dateLabel}`, MARGIN, startY);

  const statusColor =
    visit.status === "completed" ? "#059669" : visit.status === "cancelled" ? "#dc2626" : MUTED;
  doc
    .fontSize(8.5)
    .fillColor(statusColor)
    .font("Helvetica-Bold")
    .text(visit.status.replace("_", " ").toUpperCase(), MARGIN, startY, { width: cardWidth, align: "right" });

  doc
    .fontSize(9.5)
    .fillColor(BODY)
    .font("Helvetica")
    .text(`${visit.treatmentName}  —  ${visit.doctorName}`, MARGIN, startY + 16);

  let y = doc.y + 4;

  if (visit.noteText) {
    doc.fontSize(8.5).fillColor(MUTED).font("Helvetica-Oblique").text(`Notes: ${visit.noteText}`, MARGIN + 10, y, {
      width: cardWidth - 10,
    });
    y = doc.y + 2;
  }

  if (visit.prescription) {
    doc.fontSize(8.5).fillColor(MUTED).font("Helvetica-Oblique").text(`Prescription: ${visit.prescription}`, MARGIN + 10, y, {
      width: cardWidth - 10,
    });
    y = doc.y + 2;
  }

  doc.y = y + 6;
  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.moveDown(0.6);
}

function drawConfidentialityNotice(doc: PDFKit.PDFDocument) {
  checkPageBreak(doc, 45);
  doc.moveDown(0.5);
  doc
    .fontSize(7.5)
    .fillColor(FAINT)
    .font("Helvetica-Oblique")
    .text(
      "This document contains confidential medical information intended solely for the named patient. If you have received this in error, please notify the clinic and delete this document. Unauthorized disclosure is prohibited.",
      MARGIN,
      doc.y,
      { width: doc.page.width - MARGIN * 2 }
    );
}

function addFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(FAINT)
      .font("Helvetica")
      .text(`Confidential Medical Document — Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 40, {
        align: "center",
        width: doc.page.width - MARGIN * 2,
      });
  }
}

export function generateFullHistoryPdf(
  data: FullHistoryData,
  clinic: { name: string; address: string | null; phone: string | null; email: string | null }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, bufferPages: true, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const generatedAt = new Date();
    const reportId = generateReportId(data.patientEmail, generatedAt);

    drawHeader(doc, clinic);
    drawTitle(doc);
    drawMetadata(doc, reportId, data.visits.length, generatedAt);

    drawCard(doc, "Patient Information", [
      ["Full Name", data.patientName],
      ["Date of Birth", data.dob ?? "—"],
      ["Gender", data.gender ?? "—"],
      ["Blood Group", data.bloodGroup ?? "—"],
    ]);

    drawBulletList(doc, "Allergies", data.allergies);
    drawBulletList(doc, "Existing Conditions", data.conditions);
    drawBulletList(doc, "Current Medications", data.medications);

    checkPageBreak(doc, 40);
    doc.fontSize(12).fillColor(HEADING).font("Helvetica-Bold").text("Visit History", MARGIN, doc.y);
    doc.moveDown(0.5);

    if (data.visits.length === 0) {
      doc.fontSize(9.5).fillColor(MUTED).font("Helvetica-Oblique").text("No visits on record.", MARGIN, doc.y);
    } else {
      data.visits.forEach((visit: any, i: any) => drawVisitEntry(doc, visit, i));
    }

    drawConfidentialityNotice(doc);

    addFooters(doc);
    doc.end();
  });
}