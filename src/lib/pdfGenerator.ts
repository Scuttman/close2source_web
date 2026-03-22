import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface ProjectPDFData {
  name: string;
  projectId?: string;
  description?: string;
  strapline?: string;
  coverPhotoUrl?: string;
  // Location
  locationName?: string;
  locationTown?: string;
  locationCountry?: string;
  locationIntroduction?: string;
  locationVision?: string;
  locationWhatWeDo?: string;
  vision?: string;
  // Project content
  projectSummary?: string;
  projectImpact?: string;
  impactItems?: string[];
  otherDetails?: string;
  goals?: string[];
  beneficiaries?: string;
  // Compliance
  oversight?: string;
  safeguardingInPlace?: boolean;
  financialAccountabilityInPlace?: boolean;
  // Budget
  totalBudget?: number;
  amountPledged?: number;
  amountRaised?: number;
  currency?: string;
  budgetPhases?: { id: string; name: string; notes?: string; target: number; pledged?: number; raised?: number }[];
  // Timeline
  targetCompletionDate?: string;
  projectDuration?: number;
  projectDurationUnit?: string;
  // Organisation
  organizationName?: string;
  organizationLogoUrl?: string;
}

interface IndividualPDFData {
  name: string;
  individualId?: string;
  bio?: string;
  serviceLocation?: string;
  organization?: string;
  vision?: string;
  story?: string;
  ministryDescription?: string;
  focusAreas?: string[];
  yearsInService?: number;
  isFamily?: boolean;
}

// Helper function to load image and convert to base64 with CORS support
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // Create an image element to load the image
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS
      
      img.onload = () => {
        try {
          // Create a canvas to convert the image to base64
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (error) {
          // Silently fail - PDF will generate without the image
          resolve(null);
        }
      };
      
      img.onerror = () => {
        // Silently fail - likely CORS restriction
        // PDF will generate successfully without the logo
        resolve(null);
      };
      
      // Add timestamp to bypass cache and help with CORS
      const urlWithTimestamp = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      img.src = urlWithTimestamp;
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  } catch (error) {
    // Silently fail - PDF will generate without the image
    return null;
  }
}

export async function generateProjectPDF(project: ProjectPDFData): Promise<void> {
  // ─── Page / style constants ───────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210;       // page width
  const PH = 297;       // page height
  const M  = 13;        // margin
  const CW = PW - M * 2; // content width = 184 mm
  const ORANGE: [number, number, number] = [220, 88, 12];
  const BLACK:  [number, number, number] = [25, 25, 25];
  const GRAY:   [number, number, number] = [110, 110, 110];
  const GREEN:  [number, number, number] = [22, 163, 74];

  // Line-height helpers
  const LH_BODY  = 4.2;  // 9 pt body
  const LH_SMALL = 3.8;  // 8 pt small

  let y = M;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Sanitize text for Helvetica (Latin-1 only).
   * Replaces common Unicode typographic characters with ASCII equivalents
   * so jsPDF doesn't render them with expanded character spacing or overflow.
   */
  const sanitize = (text: string): string => text
    .replace(/[\u2018\u2019\u02bc]/g, "'")        // curly apostrophes / single quotes
    .replace(/[\u201c\u201d]/g, '"')               // curly double quotes
    .replace(/\u2013/g, '-')                       // en dash
    .replace(/\u2014/g, '--')                      // em dash
    .replace(/\u2026/g, '...')                     // ellipsis
    .replace(/\u00a0/g, ' ')                       // non-breaking space
    .replace(/\u00ad/g, '')                        // soft hyphen
    .replace(/[\r\n]+/g, ' ')                      // literal newlines → space
    .replace(/[^\x20-\xFF]/g, '')                  // strip anything outside Latin-1
    .trim();

  /** Safe page-break: if less than `needed` mm remain → new page */
  const needY = (needed: number) => {
    if (y + needed > PH - M - 6) { doc.addPage(); y = M; }
  };

  /** Horizontal rule */
  const rule = (gap = 3) => {
    y += gap;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + CW, y);
    y += gap;
  };

  /** Orange section header with underline */
  const header = (title: string) => {
    needY(10);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ORANGE);
    doc.text(title.toUpperCase(), M, y);
    y += 4;
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.35);
    doc.line(M, y - 0.5, M + CW, y - 0.5);
    y += 2.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
  };

  /** Wrapping body text — returns the number of lines drawn */
  const body = (text: string | undefined, width: number = CW, x: number = M): number => {
    if (!text?.trim()) return 0;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(sanitize(text), width) as string[];
    lines.forEach(line => { needY(LH_BODY + 1); doc.text(sanitize(line), x, y); y += LH_BODY; });
    return lines.length;
  };

  /** Small label text */
  const label = (text: string, x: number = M) => {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(text, x, y);
    y += LH_SMALL;
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
  };

  // ─── QR Code (top-right) ─────────────────────────────────────────────────
  const QR_SIZE = 24;
  const qrX = PW - M - QR_SIZE;
  if (project.projectId) {
    try {
      const url = `https://close2source.com/projects/${project.projectId}/profile`;
      const qrData = await QRCode.toDataURL(url, { width: 200, margin: 1 });
      doc.addImage(qrData, 'PNG', qrX, M, QR_SIZE, QR_SIZE);
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text('Scan to view online', qrX + QR_SIZE / 2, M + QR_SIZE + 3, { align: 'center' });
    } catch { /* no QR — continue */ }
  }

  // ─── Organisation Logo (top-left) ────────────────────────────────────────
  const titleMaxW = CW - QR_SIZE - 6;
  if (project.organizationLogoUrl) {
    try {
      const logoData = await new Promise<string | null>(resolve => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0);
            resolve(c.toDataURL('image/png'));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = project.organizationLogoUrl!;
        setTimeout(() => resolve(null), 3000);
      });
      if (logoData) {
        doc.addImage(logoData, 'PNG', M, y, 12, 12);
        y += 14;
      }
    } catch { /* skip logo */ }
  }

  // ─── Title ───────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ORANGE);
  (doc.splitTextToSize(sanitize(project.name), titleMaxW) as string[]).forEach(line => {
    doc.text(sanitize(line), M, y); y += 7.5;
  });

  // ─── Strapline ───────────────────────────────────────────────────────────
  if (project.strapline) {
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    (doc.splitTextToSize(sanitize(project.strapline), titleMaxW) as string[]).forEach(line => {
      doc.text(sanitize(line), M, y); y += 5;
    });
    doc.setFont('helvetica', 'normal');
  }

  // ─── Meta line: org · location ───────────────────────────────────────────
  const metaParts = [
    project.organizationName ? sanitize(project.organizationName) : undefined,
    [project.locationName, project.locationTown, project.locationCountry]
      .filter(Boolean).map(s => sanitize(s!)).join(', '),
  ].filter(Boolean);
  if (metaParts.length) {
    y += 1;
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(metaParts.join('  \xb7  '), M, y);
    y += 5.5;
    doc.setTextColor(...BLACK);
  }

  rule();

  // ─── Description ─────────────────────────────────────────────────────────
  if (project.description) {
    body(project.description);
    y += 2;
  }

  // ─── Two-column: Vision/What We Do  |  Compliance ────────────────────────
  const visionText = project.locationVision || project.vision;
  const whatWeDoText = project.locationWhatWeDo;
  const hasCompliance = !!(project.oversight || project.safeguardingInPlace !== undefined
    || project.financialAccountabilityInPlace !== undefined);

  if (visionText || whatWeDoText || hasCompliance) {
    rule();
    const colW = (CW - 6) / 2;
    const col2X = M + colW + 6;
    const topY = y;
    let leftEndY = y;
    let rightEndY = y;

    // Left: Vision + What We Do
    if (visionText || whatWeDoText) {
      if (visionText) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ORANGE);
        doc.text('VISION', M, y); y += 4;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK);
        const vLines = (doc.splitTextToSize(sanitize(visionText), colW) as string[]).slice(0, 9);
        vLines.forEach(line => { doc.setFontSize(9); doc.text(sanitize(line), M, y); y += LH_BODY; });
        y += 1;
      }
      if (whatWeDoText) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ORANGE);
        doc.text('WHAT WE DO', M, y); y += 4;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK);
        const wLines = (doc.splitTextToSize(sanitize(whatWeDoText), colW) as string[]).slice(0, 9);
        wLines.forEach(line => { doc.setFontSize(9); doc.text(sanitize(line), M, y); y += LH_BODY; });
      }
      leftEndY = y;
    }

    // Right: Compliance
    if (hasCompliance) {
      y = topY;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ORANGE);
      doc.text('COMPLIANCE', col2X, y); y += 4;
      doc.setFont('helvetica', 'normal');

      if (project.oversight) {
        doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text('Oversight', col2X, y); y += LH_SMALL;
        doc.setFontSize(9); doc.setTextColor(...BLACK);
        const ov = (doc.splitTextToSize(sanitize(project.oversight!), colW) as string[]).slice(0, 3);
        ov.forEach(l => { doc.text(sanitize(l), col2X, y); y += LH_BODY; });
        y += 1;
      }

      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text('Safeguarding', col2X, y); y += LH_SMALL;
      doc.setFontSize(9);
      if (project.safeguardingInPlace) {
        doc.setTextColor(...GREEN); doc.text('✓ In Place', col2X, y);
      } else {
        doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.text('Not confirmed', col2X, y);
      }
      y += LH_BODY + 1; doc.setTextColor(...BLACK);

      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text('Financial Accountability', col2X, y); y += LH_SMALL;
      doc.setFontSize(9);
      if (project.financialAccountabilityInPlace) {
        doc.setTextColor(...GREEN); doc.text('✓ In Place', col2X, y);
      } else {
        doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.text('Not confirmed', col2X, y);
      }
      y += LH_BODY;
      doc.setTextColor(...BLACK);
      rightEndY = y;
    }

    y = Math.max(leftEndY, rightEndY);
  }

  // ─── Project Summary ─────────────────────────────────────────────────────
  if (project.projectSummary) {
    rule();
    header('Project Summary');
    body(project.projectSummary);
    y += 1;
  }

  // ─── Two-column: Goals | Budget ──────────────────────────────────────────
  const hasGoals  = !!(project.goals && project.goals.length > 0);
  const hasBudget = !!(project.totalBudget || project.budgetPhases?.length);

  if (hasGoals || hasBudget) {
    rule();
    const colW2 = (CW - 6) / 2;
    const col2X2 = M + colW2 + 6;
    const topY2 = y;
    let goalsEndY = y;
    let budgetEndY = y;

    // Left: Goals
    if (hasGoals) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ORANGE);
      doc.text('GOALS', M, y); y += 4;
      doc.setDrawColor(...ORANGE); doc.setLineWidth(0.3);
      doc.line(M, y - 0.5, M + colW2, y - 0.5);
      y += 2.5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK);

      project.goals!.forEach((goal, i) => {
        needY(LH_BODY);
        doc.setFontSize(9);
        const gl = doc.splitTextToSize(`${i + 1}. ${sanitize(goal)}`, colW2 - 2) as string[];
        gl.forEach(line => { doc.text(sanitize(line), M, y); y += LH_BODY; });
        y += 0.5;
      });
      goalsEndY = y;
    }

    // Right: Budget
    if (hasBudget) {
      y = topY2;
      const fmt = (n: number) => `${project.currency || 'GBP'} ${n.toLocaleString()}`;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ORANGE);
      doc.text('BUDGET', col2X2, y); y += 4;
      doc.setDrawColor(...ORANGE); doc.setLineWidth(0.3);
      doc.line(col2X2, y - 0.5, col2X2 + colW2, y - 0.5);
      y += 2.5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK);

      if (project.budgetPhases && project.budgetPhases.length > 0) {
        project.budgetPhases.slice(0, 6).forEach(phase => {
          doc.setFontSize(8.5);
          const phLines = doc.splitTextToSize(sanitize(phase.name || 'Phase'), colW2 - 20) as string[];
          doc.text(sanitize(phLines[0]), col2X2, y);
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(phase.target), col2X2 + colW2 - 1, y, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          y += LH_BODY;
        });
        if (project.totalBudget) {
          y += 0.5;
          doc.setFont('helvetica', 'bold');
          doc.text('Total', col2X2, y);
          doc.text(fmt(project.totalBudget), col2X2 + colW2 - 1, y, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          y += LH_BODY;
        }
      } else if (project.totalBudget) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ORANGE);
        doc.text(fmt(project.totalBudget), col2X2, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK);
        doc.setFontSize(9);
      }

      if (project.amountPledged) {
        doc.setFontSize(8.5); doc.setTextColor(...GRAY);
        doc.text('Pledged', col2X2, y);
        doc.setTextColor(...BLACK);
        doc.text(fmt(project.amountPledged), col2X2 + colW2 - 1, y, { align: 'right' });
        y += LH_BODY;
      }
      if (project.amountRaised) {
        doc.setFontSize(8.5); doc.setTextColor(...GRAY);
        doc.text('Raised', col2X2, y);
        doc.setTextColor(...GREEN);
        doc.text(fmt(project.amountRaised), col2X2 + colW2 - 1, y, { align: 'right' });
        y += LH_BODY; doc.setTextColor(...BLACK);
      }
      if (project.beneficiaries) {
        y += 1; label('Beneficiaries', col2X2);
        const bLines = (doc.splitTextToSize(sanitize(project.beneficiaries!), colW2) as string[]).slice(0, 3);
        doc.setFontSize(9); doc.setTextColor(...BLACK);
        bLines.forEach(l => { doc.text(sanitize(l), col2X2, y); y += LH_BODY; });
      }
      budgetEndY = y;
    }

    y = Math.max(goalsEndY, budgetEndY);
  }

  // ─── Expected Impact ─────────────────────────────────────────────────────
  if (project.projectImpact || (project.impactItems && project.impactItems.length > 0)) {
    rule();
    header('Expected Impact');
    if (project.projectImpact) { body(project.projectImpact); y += 1; }
    if (project.impactItems?.length) {
      project.impactItems.forEach(item => {
        needY(LH_BODY);
        doc.setFontSize(9); doc.setTextColor(...BLACK);
        const bLines = doc.splitTextToSize(`• ${sanitize(item)}`, CW - 4) as string[];
        bLines.forEach((line, li) => { doc.text(sanitize(line), M + (li > 0 ? 3 : 0), y); y += LH_BODY; });
      });
    }
  }

  // ─── Timeline ────────────────────────────────────────────────────────────
  if (project.targetCompletionDate || project.projectDuration) {
    rule();
    header('Timeline');
    if (project.targetCompletionDate) {
      doc.setFontSize(9); doc.setTextColor(...GRAY);
      doc.text('Target Completion:', M, y);
      doc.setTextColor(...BLACK);
      doc.text(project.targetCompletionDate, M + 38, y);
      y += LH_BODY + 0.5;
    }
    if (project.projectDuration) {
      doc.setFontSize(9); doc.setTextColor(...GRAY);
      doc.text('Duration:', M, y);
      doc.setTextColor(...BLACK);
      doc.text(`${project.projectDuration} ${project.projectDurationUnit || 'months'}`, M + 22, y);
      y += LH_BODY + 0.5;
    }
  }

  // ─── Other Details ───────────────────────────────────────────────────────
  if (project.otherDetails) {
    rule();
    header('Other Details');
    body(project.otherDetails);
  }

  // ─── Footer (on every page) ───────────────────────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text('Generated from Close2Source.com', M, PH - 7);
    doc.text(
      new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long' }),
      PW - M, PH - 7, { align: 'right' }
    );
  }

  const filename = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_profile.pdf`;
  doc.save(filename);
}

export async function generateIndividualPDF(individual: IndividualPDFData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = 20;

  // Generate QR code for individual profile URL
  if (individual.individualId) {
    try {
      const profileUrl = `https://close2source.com/individuals/profile?id=${individual.individualId}`;
      const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 200, margin: 1 });
      const qrSize = 30;
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - qrSize, 10, qrSize, qrSize);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  }

  const addSection = (title: string, content?: string) => {
    if (!content) return;
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text(title, margin, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(content, maxWidth);
    doc.text(lines, margin, yPos);
    yPos += (lines.length * 5) + 10;
    if (yPos > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38);
  doc.text(individual.name, margin, yPos);
  yPos += 10;

  // Type
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(individual.isFamily ? 'Family Profile' : 'Individual Profile', margin, yPos);
  yPos += 15;

  if (individual.bio) { addSection('About', individual.bio); }

  if (individual.serviceLocation || individual.organization) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Service Information', margin, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    if (individual.serviceLocation) { doc.text(`Location: ${individual.serviceLocation}`, margin, yPos); yPos += 6; }
    if (individual.organization)    { doc.text(`Organization: ${individual.organization}`, margin, yPos); yPos += 6; }
    if (individual.yearsInService)  { doc.text(`Years in Service: ${individual.yearsInService}`, margin, yPos); yPos += 6; }
    yPos += 10;
  }

  if (individual.vision)              { addSection('Vision', individual.vision); }
  if (individual.story)               { addSection('My Story', individual.story); }
  if (individual.ministryDescription) { addSection('Ministry Description', individual.ministryDescription); }

  if (individual.focusAreas && individual.focusAreas.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Focus Areas', margin, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    individual.focusAreas.forEach(area => {
      doc.text(`• ${area}`, margin + 5, yPos);
      yPos += 6;
      if (yPos > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); yPos = 20; }
    });
    yPos += 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated from Close2Source', margin, doc.internal.pageSize.getHeight() - 10);

  const filename = `${individual.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_profile.pdf`;
  doc.save(filename);
}
