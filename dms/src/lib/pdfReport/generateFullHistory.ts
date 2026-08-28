import PDFDocument from "pdfkit";

const MARGIN = 45;

const BRAND = "#1e3a8a";
const BRAND_LIGHT = "#eff6ff";
const BRAND_MID = "#dbeafe";

const HEADING = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";

const BORDER = "#e2e8f0";
const CARD_BG = "#f8fafc";
const WHITE = "#ffffff";

const FOOTER_Y = 35;

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

export type ClinicInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

function checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number): void {
  const bottomMargin = 55;
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

function generateReportId(patientEmail: string | null, date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const seed = (patientEmail ?? "patient")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();

  return `HIST-${datePart}-${seed || "XXXXXX"}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function drawHeader(doc: PDFKit.PDFDocument, clinic: ClinicInfo): void {
  const contentWidth = doc.page.width - MARGIN * 2;

  doc.rect(0, 0, doc.page.width, 5).fill(BRAND);
  doc.roundedRect(MARGIN, 32, 5, 46, 2).fill(BRAND);

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor(HEADING)
    .text(clinic.name, MARGIN + 15, 32, {
      width: contentWidth - 15,
    });

  const contactLine = [clinic.address, clinic.phone, clinic.email]
    .filter(Boolean)
    .join("  •  ");

  if (contactLine) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(contactLine, MARGIN + 15, 58, {
        width: contentWidth - 15,
      });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(BRAND)
    .text("PATIENT MEDICAL RECORD", MARGIN + 15, 73, {
      characterSpacing: 1,
    });

  doc
    .moveTo(MARGIN, 96)
    .lineTo(doc.page.width - MARGIN, 96)
    .strokeColor(BORDER)
    .lineWidth(1)
    .stroke();

  doc.y = 112;
}

function drawTitleAndMeta(
  doc: PDFKit.PDFDocument,
  reportId: string,
  visitCount: number,
  generatedAt: Date
): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(21)
    .fillColor(HEADING)
    .text("Full Medical History", MARGIN, doc.y);

  doc.moveDown(0.25);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text("Complete patient medical and visit history", MARGIN, doc.y);

  doc.moveDown(0.8);

  const contentWidth = doc.page.width - MARGIN * 2;
  const boxY = doc.y;
  const boxHeight = 46;

  doc
    .roundedRect(MARGIN, boxY, contentWidth, boxHeight, 6)
    .fillAndStroke(BRAND_LIGHT, BRAND_MID);

  const columns = [
    { label: "REPORT ID", value: reportId },
    { label: "TOTAL VISITS", value: String(visitCount) },
    {
      label: "GENERATED",
      value: generatedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
  ];

  const columnWidth = contentWidth / columns.length;

  columns.forEach((item, index) => {
    const x = MARGIN + index * columnWidth + 12;

    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(BRAND)
      .text(item.label, x, boxY + 9, {
        width: columnWidth - 24,
      });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(HEADING)
      .text(item.value, x, boxY + 23, {
        width: columnWidth - 24,
      });
  });

  doc.y = boxY + boxHeight + 18;
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  checkPageBreak(doc, 40);

  const y = doc.y;

  doc.roundedRect(MARGIN, y + 1, 4, 16, 2).fill(BRAND);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(HEADING)
    .text(title, MARGIN + 11, y);

  doc.moveDown(0.65);
}

function drawPatientGrid(
  doc: PDFKit.PDFDocument,
  data: FullHistoryData
): void {
  const contentWidth = doc.page.width - MARGIN * 2;
  const cardHeight = 125;

  checkPageBreak(doc, cardHeight + 10);

  const startY = doc.y;

  doc
    .roundedRect(MARGIN, startY, contentWidth, cardHeight, 7)
    .fillAndStroke(CARD_BG, BORDER);

  doc.roundedRect(MARGIN, startY, contentWidth, 29, 7).fill(BRAND_LIGHT);
  doc.rect(MARGIN, startY + 22, contentWidth, 7).fill(BRAND_LIGHT);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND)
    .text("PATIENT DETAILS", MARGIN + 13, startY + 10, {
      characterSpacing: 0.7,
    });

  const fields = [
    { label: "Full Name", value: data.patientName },
    { label: "Date of Birth", value: data.dob ?? "—" },
    { label: "Gender", value: data.gender ?? "—" },
    { label: "Blood Group", value: data.bloodGroup ?? "—" },
    { label: "Email", value: data.patientEmail ?? "—" },
  ];

  const gridTop = startY + 38;
  const leftX = MARGIN + 14;
  const rightX = MARGIN + contentWidth / 2 + 5;
  const halfWidth = contentWidth / 2 - 20;

  // Row 1: Full Name & DOB
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(MUTED)
    .text(fields[0].label.toUpperCase(), leftX, gridTop, { width: halfWidth });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(HEADING)
    .text(fields[0].value, leftX, gridTop + 9, { width: halfWidth });

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(MUTED)
    .text(fields[1].label.toUpperCase(), rightX, gridTop, { width: halfWidth });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(HEADING)
    .text(fields[1].value, rightX, gridTop + 9, { width: halfWidth });

  // Row 2: Gender & Blood Group
  const row2Top = gridTop + 28;

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(MUTED)
    .text(fields[2].label.toUpperCase(), leftX, row2Top, { width: halfWidth });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(HEADING)
    .text(fields[2].value, leftX, row2Top + 9, { width: halfWidth });

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(MUTED)
    .text(fields[3].label.toUpperCase(), rightX, row2Top, { width: halfWidth });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(HEADING)
    .text(fields[3].value, rightX, row2Top + 9, { width: halfWidth });

  // Row 3: Email (Full Width)
  const row3Top = row2Top + 28;

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(MUTED)
    .text(fields[4].label.toUpperCase(), leftX, row3Top, {
      width: contentWidth - 28,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(HEADING)
    .text(fields[4].value, leftX, row3Top + 9, {
      width: contentWidth - 28,
    });

  doc.y = startY + cardHeight + 16;
}

function drawTagSection(
  doc: PDFKit.PDFDocument,
  title: string,
  items: string[]
): void {
  checkPageBreak(doc, 55);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(HEADING)
    .text(title, MARGIN, doc.y);

  doc.moveDown(0.4);

  if (!items || items.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(FAINT)
      .text("None recorded", MARGIN, doc.y);

    doc.moveDown(0.8);
    return;
  }

  const maxX = doc.page.width - MARGIN;
  const tagHeight = 19;
  const gap = 6;
  const paddingH = 9;

  let currentX = MARGIN;
  let currentY = doc.y;

  doc.font("Helvetica-Bold").fontSize(8.5);

  for (const item of items) {
    const textWidth = doc.widthOfString(item);
    const tagWidth = textWidth + paddingH * 2;
    const finalTagWidth = Math.min(tagWidth, maxX - MARGIN);

    if (currentX + finalTagWidth > maxX) {
      currentX = MARGIN;
      currentY += tagHeight + gap;

      if (currentY + tagHeight > doc.page.height - 55) {
        doc.addPage();
        currentY = MARGIN;
        doc.y = currentY;
      }
    }

    doc
      .roundedRect(currentX, currentY, finalTagWidth, tagHeight, 4)
      .fillAndStroke(BRAND_LIGHT, BORDER);

    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(BRAND)
      .text(item, currentX + paddingH, currentY + 5, {
        width: finalTagWidth - paddingH * 2,
        height: tagHeight - 4,
        lineBreak: false,
      });

    currentX += finalTagWidth + gap;
  }

  doc.y = currentY + tagHeight + 14;
}

function drawVisitEntry(
  doc: PDFKit.PDFDocument,
  visit: FullHistoryData["visits"][number],
  index: number
): void {
  const contentWidth = doc.page.width - MARGIN * 2;
  const innerWidth = contentWidth - 28;
  const dateLabel = formatDate(visit.date);

  doc.font("Helvetica").fontSize(8.5);

  const noteHeight = visit.noteText
    ? doc.heightOfString(`Notes: ${visit.noteText}`, {
        width: innerWidth,
        lineGap: 2,
      })
    : 0;

  const prescriptionHeight = visit.prescription
    ? doc.heightOfString(`Prescription: ${visit.prescription}`, {
        width: innerWidth,
        lineGap: 2,
      })
    : 0;

  let detailsHeight = 0;
  if (noteHeight > 0) detailsHeight += noteHeight + 8;
  if (prescriptionHeight > 0) detailsHeight += prescriptionHeight + 8;

  const headerHeight = 52;
  const totalCardHeight =
    headerHeight + detailsHeight + (detailsHeight > 0 ? 10 : 0);

  checkPageBreak(doc, totalCardHeight + 12);

  const startY = doc.y;

  doc
    .roundedRect(MARGIN, startY, contentWidth, totalCardHeight, 7)
    .fillAndStroke(WHITE, BORDER);

  doc.roundedRect(MARGIN, startY, 4, totalCardHeight, 2).fill(BRAND);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(HEADING)
    .text(`${index + 1}. ${visit.treatmentName}`, MARGIN + 15, startY + 10, {
      width: contentWidth - 120,
    });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`Dr. ${visit.doctorName}   •   ${dateLabel}`, MARGIN + 15, startY + 27);

  const normalizedStatus = visit.status.toLowerCase().replace(/_/g, " ");
  const isCompleted =
    normalizedStatus === "completed" || normalizedStatus === "complete";
  const isCancelled = normalizedStatus.includes("cancel");

  const badgeColor = isCompleted
    ? "#059669"
    : isCancelled
    ? "#dc2626"
    : "#d97706";

  const badgeBg = isCompleted
    ? "#ecfdf5"
    : isCancelled
    ? "#fef2f2"
    : "#fffbeb";

  const statusText = normalizedStatus.toUpperCase();

  doc.font("Helvetica-Bold").fontSize(7.5);

  const badgeWidth = doc.widthOfString(statusText) + 16;
  const badgeX = MARGIN + contentWidth - badgeWidth - 12;

  doc
    .roundedRect(badgeX, startY + 10, badgeWidth, 17, 4)
    .fillAndStroke(badgeBg, badgeColor);

  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(badgeColor)
    .text(statusText, badgeX, startY + 15, {
      width: badgeWidth,
      align: "center",
      lineBreak: false,
    });

  let currentY = startY + headerHeight;

  if (visit.noteText) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(BODY)
      .text("Notes: ", MARGIN + 15, currentY, { continued: true });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(BODY)
      .text(visit.noteText, {
        width: innerWidth,
        lineGap: 2,
      });

    currentY = doc.y + 6;
  }

  if (visit.prescription) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(BRAND)
      .text("Prescription: ", MARGIN + 15, currentY, { continued: true });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(BODY)
      .text(visit.prescription, {
        width: innerWidth,
        lineGap: 2,
      });
  }

  doc.y = startY + totalCardHeight + 10;
}

function drawConfidentialityNotice(doc: PDFKit.PDFDocument): void {
  checkPageBreak(doc, 55);

  doc.moveDown(0.5);

  const width = doc.page.width - MARGIN * 2;

  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

  doc.moveDown(0.55);

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(FAINT)
    .text("CONFIDENTIAL MEDICAL RECORD", MARGIN, doc.y, {
      width,
      align: "center",
      characterSpacing: 0.8,
    });

  doc.moveDown(0.25);

  doc
    .font("Helvetica-Oblique")
    .fontSize(7.2)
    .fillColor(FAINT)
    .text(
      "The information contained in this document is intended solely for the named individual. " +
        "Unauthorized distribution, copying, or disclosure is strictly prohibited.",
      MARGIN,
      doc.y,
      {
        width,
        align: "center",
        lineGap: 2,
      }
    );
}

function addFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    const width = doc.page.width - MARGIN * 2;

    doc
      .moveTo(MARGIN, doc.page.height - FOOTER_Y)
      .lineTo(doc.page.width - MARGIN, doc.page.height - FOOTER_Y)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(FAINT)
      .text("Confidential Medical Document", MARGIN, doc.page.height - 26, {
        width: width / 2,
        align: "left",
      });

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(FAINT)
      .text(`Page ${i + 1} of ${range.count}`, MARGIN + width / 2, doc.page.height - 26, {
        width: width / 2,
        align: "right",
      });
  }
}

export function generateFullHistoryPdf(
  data: FullHistoryData,
  clinic: ClinicInfo
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const generatedAt = new Date();
    const reportId = generateReportId(data.patientEmail, generatedAt);

    drawHeader(doc, clinic);
    drawTitleAndMeta(doc, reportId, data.visits.length, generatedAt);

    drawSectionHeader(doc, "Patient Profile");
    drawPatientGrid(doc, data);

    drawSectionHeader(doc, "Medical Summary");
    drawTagSection(doc, "Allergies", data.allergies);
    drawTagSection(doc, "Existing Conditions", data.conditions);
    drawTagSection(doc, "Current Medications", data.medications);

    drawSectionHeader(doc, "Visit History");

    if (data.visits.length === 0) {
      doc
        .roundedRect(MARGIN, doc.y, doc.page.width - MARGIN * 2, 45, 6)
        .fillAndStroke(CARD_BG, BORDER);

      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(MUTED)

        .text("No visits on record.", MARGIN + 14, doc.y + 15);

      doc.y += 60;
    } else {
      data.visits.forEach((visit, index) => {
        drawVisitEntry(doc, visit, index);
      });
    }

    drawConfidentialityNotice(doc);
    addFooters(doc);

    doc.end();
  });
}