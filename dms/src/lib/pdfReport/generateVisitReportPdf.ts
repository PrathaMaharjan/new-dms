import PDFDocument from "pdfkit";

export type VisitReportData = {
  appointmentId: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  patientDob: string | null;
  patientGender: string | null;
  doctorName: string;
  doctorQualification: string | null;
  treatmentName: string;
  startTime: Date;
  noteText: string | null;
  prescription: string | null;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicEmail: string | null;
};

// src/lib/reports/generateVisitReportPdf.ts

const MARGIN = 50;
const BRAND = "#3f6274";
const HEADING = "#111827";
const BODY = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const BORDER = "#e5e7eb";
const CARD_BG = "#f9fafb";

function checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottomMargin = 70; // leaves room for the footer on every page
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
  }
}

function generateReportId(appointmentId: string, date: Date): string {
  // Generated fresh each send, not persisted anywhere - if a real audit
  // trail of every report ever sent matters later, that's a genuine new
  // table (a sent_reports log), a separate feature from this one.
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = appointmentId.split("-")[0].toUpperCase();
  return `RPT-${datePart}-${shortId}`;
}

// Professional clinic header (logo placeholder + clinic details)
function drawHeader(
  doc: PDFKit.PDFDocument,
  clinic: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  },
) {
  doc.roundedRect(MARGIN, 45, 50, 50, 4).fillAndStroke("#e5e7eb", "#d1d5db");
  doc
    .fontSize(7)
    .fillColor(FAINT)
    .text("LOGO", MARGIN, 66, { width: 50, align: "center" });

  doc
    .fontSize(16)
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .text(clinic.name, 112, 48);
  const contactLine = [clinic.address, clinic.phone, clinic.email]
    .filter(Boolean)
    .join("   •   ");
  if (contactLine) {
    doc
      .fontSize(8.5)
      .fillColor(MUTED)
      .font("Helvetica")
      .text(contactLine, 112, 70, { width: doc.page.width - MARGIN - 112 });
  }

  doc
    .moveTo(MARGIN, 110)
    .lineTo(doc.page.width - MARGIN, 110)
    .strokeColor(BORDER)
    .lineWidth(1)
    .stroke();
  doc.y = 125;
}

function drawTitle(doc: PDFKit.PDFDocument) {
  doc
    .fontSize(18)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text("Visit Report", MARGIN, doc.y, { align: "center" });
  doc.moveDown(0.6);
}

// Report metadata (Report ID, Appointment ID, Generated Date)
function drawMetadata(
  doc: PDFKit.PDFDocument,
  reportId: string,
  appointmentId: string,
  generatedAt: Date,
) {
  const line = `Report ID: ${reportId}   |   Appointment ID: ${appointmentId.slice(0, 8).toUpperCase()}   |   Generated: ${generatedAt.toLocaleString(
    "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  )}`;
  doc
    .fontSize(8.5)
    .fillColor(MUTED)
    .font("Helvetica")
    .text(line, MARGIN, doc.y, {
      width: doc.page.width - MARGIN * 2,
      align: "center",
    });
  doc.moveDown(1.2);
}

// Reusable helper: drawKeyValue
function drawKeyValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  valueWidth: number,
) {
  doc
    .fontSize(9)
    .fillColor(MUTED)
    .font("Helvetica")
    .text(label, x, y, { width: labelWidth });
  doc
    .fontSize(9)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text(value || "—", x + labelWidth, y, { width: valueWidth });
}

// Reusable helper: drawCard - used for Patient Information + Visit Information
function drawCard(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: [string, string][],
) {
  const rowHeight = 18;
  const cardHeight = 32 + rows.length * rowHeight + 14;
  checkPageBreak(doc, cardHeight + 12);

  const startY = doc.y;
  const cardWidth = doc.page.width - MARGIN * 2;

  doc
    .roundedRect(MARGIN, startY, cardWidth, cardHeight, 4)
    .fillAndStroke(CARD_BG, BORDER);
  doc
    .fontSize(11)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text(title, MARGIN + 12, startY + 10);

  let y = startY + 32;
  for (const [label, value] of rows) {
    drawKeyValue(doc, label, value, MARGIN + 12, y, 130, cardWidth - 160);
    y += rowHeight;
  }

  doc.y = startY + cardHeight + 16;
}

// Reusable helper: drawSection - used for Clinical Notes + Follow-up Instructions
function drawSection(doc: PDFKit.PDFDocument, title: string, body: string) {
  checkPageBreak(doc, 60);
  doc
    .fontSize(12)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text(title, MARGIN, doc.y);
  doc.moveDown(0.35);
  doc
    .fontSize(10)
    .fillColor(BODY)
    .font("Helvetica")
    .text(body, MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });
  doc.moveDown(1);
}

// Prescription section with bullet formatting
function drawPrescription(
  doc: PDFKit.PDFDocument,
  prescription: string | null,
) {
  checkPageBreak(doc, 50);
  doc
    .fontSize(12)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text("Prescription", MARGIN, doc.y);
  doc.moveDown(0.4);

  if (!prescription || prescription.trim() === "") {
    doc
      .fontSize(10)
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .text("No prescription issued for this visit.", MARGIN, doc.y);
    doc.moveDown(1);
    return;
  }

  // Split on newlines - respects however the doctor actually formatted it,
  // rather than guessing at a comma/semicolon delimiter that could mangle
  // free text. A single-line prescription still renders as one bullet.
  const lines = prescription
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    checkPageBreak(doc, 20);
    doc
      .fontSize(10)
      .fillColor(BODY)
      .font("Helvetica")
      .text(`•  ${line}`, MARGIN + 8, doc.y, {
        width: doc.page.width - MARGIN * 2 - 8,
      });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.85);
}

// Doctor signature block
function drawSignatureBlock(
  doc: PDFKit.PDFDocument,
  doctorName: string,
  qualification: string | null,
) {
  checkPageBreak(doc, 80);
  doc.moveDown(1.5);
  const y = doc.y;
  const lineX = doc.page.width - MARGIN - 200;

  doc
    .moveTo(lineX, y)
    .lineTo(doc.page.width - MARGIN, y)
    .strokeColor(FAINT)
    .lineWidth(0.5)
    .stroke();
  doc
    .fontSize(10)
    .fillColor(HEADING)
    .font("Helvetica-Bold")
    .text(doctorName, lineX, y + 6, { width: 200, align: "center" });
  if (qualification) {
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .font("Helvetica")
      .text(qualification, lineX, doc.y, { width: 200, align: "center" });
  }
  doc
    .fontSize(8)
    .fillColor(FAINT)
    .font("Helvetica")
    .text("Attending Doctor", lineX, doc.y, { width: 200, align: "center" });
  doc.moveDown(1);
}

// Confidentiality notice
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
      { width: doc.page.width - MARGIN * 2 },
    );
}

// Professional footer with page numbers - drawn on every buffered page,
// requires { bufferPages: true } so pages aren't flushed before this runs.
function addFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(FAINT)
      .font("Helvetica")
      .text(
        `Confidential Medical Document — Page ${i + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - 40,
        {
          align: "center",
          width: doc.page.width - MARGIN * 2,
        },
      );
  }
}

export function generateVisitReportPdf(data: VisitReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages: true is required for the "Page X of Y" footer trick -
    // without it, earlier pages flush to the output stream before we can
    // go back and add the total page count to them.
    const doc = new PDFDocument({
      margin: MARGIN,
      bufferPages: true,
      size: "A4",
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const generatedAt = new Date();
    const reportId = generateReportId(data.appointmentId, generatedAt);

    drawHeader(doc, {
      name: data.clinicName,
      address: data.clinicAddress,
      phone: data.clinicPhone,
      email: data.clinicEmail,
    });
    drawTitle(doc);
    drawMetadata(doc, reportId, data.appointmentId, generatedAt);

    drawCard(doc, "Patient Information", [
      ["Full Name", data.patientName],
      ["Phone", data.patientPhone ?? "—"],
      ["Date of Birth", data.patientDob ?? "—"],
      ["Gender", data.patientGender ?? "—"],
    ]);

    drawCard(doc, "Visit Information", [
      ["Doctor", data.doctorName],
      ["Treatment", data.treatmentName],
      [
        "Date & Time",
        data.startTime.toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
        }),
      ],
    ]);

    drawSection(
      doc,
      "Clinical Notes",
      data.noteText || "No clinical notes recorded for this visit.",
    );
    drawPrescription(doc, data.prescription);

    drawSignatureBlock(doc, data.doctorName, data.doctorQualification);
    drawConfidentialityNotice(doc);
    // ✅ Automatic page breaks happen throughout via checkPageBreak() calls
    // inside every section/card helper above - never a fixed page count.

    addFooters(doc); // must run right before .end(), after all content is drawn
    doc.end();
  });
}
