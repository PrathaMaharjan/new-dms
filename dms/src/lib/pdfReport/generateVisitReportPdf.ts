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
  clinicLogoUrl: string | null;
};

// Design System Tokens
const MARGIN = 48;
const COLOR = {
  primary: "#1E293B",    // Slate 800 (Primary text/accents)
  brand: "#0F766E",      // Teal 700 (Brand secondary)
  body: "#334155",       // Slate 700 (Body text)
  muted: "#64748B",      // Slate 500 (Labels/metadata)
  faint: "#94A3B8",      // Slate 400 (Dividers/borders)
  border: "#E2E8F0",     // Slate 200 (Card strokes)
  cardBg: "#F8FAFC",     // Slate 50 (Card fill)
};

async function fetchImageBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number) {
  const bottomThreshold = doc.page.height - 60;
  if (doc.y + requiredSpace > bottomThreshold) {
    doc.addPage();
  }
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  clinic: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  },
  logoBuffer: Buffer | null
) {
  const topY = 40;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN, topY, {
        fit: [48, 48],
        valign: "center",
      });
    } catch {
      drawLogoPlaceholder(doc, topY);
    }
  } else {
    drawLogoPlaceholder(doc, topY);
  }

  const textStartX = MARGIN + 60;
  const contentWidth = doc.page.width - MARGIN * 2 - 60;

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor(COLOR.primary)
    .text(clinic.name, textStartX, topY + 2, { width: contentWidth });

  const contactItems = [clinic.address, clinic.phone, clinic.email].filter(Boolean);
  if (contactItems.length > 0) {
    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor(COLOR.muted)
      .text(contactItems.join("  •  "), textStartX, topY + 22, {
        width: contentWidth,
        lineGap: 2,
      });
  }

  const dividerY = Math.max(topY + 54, doc.y + 10);
  doc
    .moveTo(MARGIN, dividerY)
    .lineTo(doc.page.width - MARGIN, dividerY)
    .strokeColor(COLOR.border)
    .lineWidth(1)
    .stroke();

  doc.y = dividerY + 20;
}

function drawLogoPlaceholder(doc: PDFKit.PDFDocument, y: number) {
  doc
    .roundedRect(MARGIN, y, 48, 48, 6)
    .fillAndStroke("#F1F5F9", COLOR.border);
  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(COLOR.faint)
    .text("CLINIC", MARGIN, y + 18, { width: 48, align: "center" });
}

function drawDocumentMeta(
  doc: PDFKit.PDFDocument,
  appointmentId: string,
  generatedAt: Date
) {
  const startY = doc.y;
  
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(COLOR.primary)
    .text("Medical Visit Summary", MARGIN, startY);

  const shortId = appointmentId.split("-")[0].toUpperCase();
  const dateStr = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  doc
    .fontSize(8.5)
    .font("Helvetica")
    .fillColor(COLOR.muted)
    .text(`Ref: ${shortId}  |  Issued: ${dateStr}`, MARGIN, startY + 4, {
      align: "right",
    });

  doc.y = startY + 30;
}

function drawDataGrid(
  doc: PDFKit.PDFDocument,
  title: string,
  data: Array<{ label: string; value: string }>
) {
  const cardWidth = doc.page.width - MARGIN * 2;
  const colWidth = cardWidth / 2;
  const rowHeight = 24;
  const numRows = Math.ceil(data.length / 2);
  const cardHeight = 32 + numRows * rowHeight + 8;

  checkPageBreak(doc, cardHeight + 15);

  const startY = doc.y;

  // Background Container
  doc
    .roundedRect(MARGIN, startY, cardWidth, cardHeight, 6)
    .fillAndStroke(COLOR.cardBg, COLOR.border);

  // Accent Line on Header
  doc
    .rect(MARGIN, startY, 4, cardHeight)
    .fill(COLOR.brand);

  // Section Header
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(COLOR.primary)
    .text(title.toUpperCase(), MARGIN + 16, startY + 12);

  // Grid Contents
  data.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = MARGIN + 16 + col * colWidth;
    const y = startY + 34 + row * rowHeight;

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(COLOR.muted)
      .text(item.label, x, y);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(COLOR.body)
      .text(item.value || "—", x, y + 10, {
        width: colWidth - 24,
        ellipsis: true,
      });
  });

  doc.y = startY + cardHeight + 16;
}

function drawClinicalSection(
  doc: PDFKit.PDFDocument,
  title: string,
  content: string | null
) {
  checkPageBreak(doc, 70);

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(COLOR.primary)
    .text(title, MARGIN, doc.y);

  doc.moveDown(0.4);

  const bodyText = content && content.trim() !== "" ? content : "No records provided.";
  const isPlaceholder = !content || content.trim() === "";

  doc
    .fontSize(9.5)
    .font(isPlaceholder ? "Helvetica-Oblique" : "Helvetica")
    .fillColor(isPlaceholder ? COLOR.muted : COLOR.body)
    .text(bodyText, MARGIN, doc.y, {
      width: doc.page.width - MARGIN * 2,
      lineGap: 3,
    });

  doc.moveDown(1.2);
}

function drawSignatureBlock(
  doc: PDFKit.PDFDocument,
  doctorName: string,
  qualification: string | null
) {
  checkPageBreak(doc, 90);

  doc.moveDown(1);
  const startY = doc.y;
  const blockWidth = 180;
  const x = doc.page.width - MARGIN - blockWidth;

  doc
    .moveTo(x, startY)
    .lineTo(x + blockWidth, startY)
    .strokeColor(COLOR.faint)
    .lineWidth(0.75)
    .stroke();

  doc
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(COLOR.primary)
    .text(doctorName, x, startY + 8, { width: blockWidth, align: "center" });

  if (qualification) {
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(COLOR.muted)
      .text(qualification, x, doc.y + 2, { width: blockWidth, align: "center" });
  }

  doc
    .fontSize(7.5)
    .font("Helvetica")
    .fillColor(COLOR.faint)
    .text("Authorized Signature", x, doc.y + 2, { width: blockWidth, align: "center" });

  doc.moveDown(1);
}

function applyPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 32;

    doc
      .moveTo(MARGIN, footerY - 8)
      .lineTo(doc.page.width - MARGIN, footerY - 8)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7.5)
      .font("Helvetica")
      .fillColor(COLOR.faint)
      .text("Confidential Medical Record", MARGIN, footerY);

    doc
      .fontSize(7.5)
      .font("Helvetica")
      .fillColor(COLOR.faint)
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, footerY, {
        align: "right",
        width: doc.page.width - MARGIN * 2,
      });
  }
}

export async function generateVisitReportPdf(data: VisitReportData): Promise<Buffer> {
  const logoBuffer = await fetchImageBuffer(data.clinicLogoUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      bufferPages: true,
      size: "A4",
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const generatedAt = new Date();

      drawHeader(
        doc,
        {
          name: data.clinicName,
          address: data.clinicAddress,
          phone: data.clinicPhone,
          email: data.clinicEmail,
        },
        logoBuffer
      );

      drawDocumentMeta(doc, data.appointmentId, generatedAt);

      drawDataGrid(doc, "Patient Details", [
        { label: "Patient Name", value: data.patientName },
        { label: "Phone", value: data.patientPhone ?? "—" },
        { label: "Date of Birth", value: data.patientDob ?? "—" },
        { label: "Gender", value: data.patientGender ?? "—" },
      ]);

      drawDataGrid(doc, "Appointment Context", [
        { label: "Attending Practitioner", value: data.doctorName },
        { label: "Treatment / Service", value: data.treatmentName },
        {
          label: "Date & Time",
          value: data.startTime.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        },
      ]);

      drawClinicalSection(doc, "Clinical Notes", data.noteText);
      drawClinicalSection(doc, "Prescription Details", data.prescription);

      drawSignatureBlock(doc, data.doctorName, data.doctorQualification);

      applyPageFooters(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}