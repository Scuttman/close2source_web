export interface HTMLPrintData {
  projectName?: string;
  projectId?: string;
  description?: string;
  strapline?: string;
  coverPhotoURL?: string;
  projectStage?: string;
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
  budgetPhases?: Array<{ 
    id: string; 
    name: string; 
    description?: string; 
    notes?: string; 
    duration?: string | number;
    timeline?: string;
    target: number; 
    pledged?: number; 
    raised?: number;
  }>;
  currentPhaseId?: string;
  // Timeline
  targetCompletionDate?: string;
  projectDuration?: number | string;
  projectDurationUnit?: string;
  // Organisation
  orgName?: string;
  orgLogoURL?: string;
  orgId?: string;
  // People
  people?: Array<{
    name: string;
    role?: string;
    photoURL?: string;
    isLead?: boolean;
  }>;
}

export function openPrintPreview(data: HTMLPrintData): void {
  const formatCurrency = (amount?: number, currency = 'USD') => {
    if (amount === undefined || amount === null) return '';
    try {
      return new Intl.NumberFormat('en-GB', { 
        style: 'currency', 
        currency, 
        maximumFractionDigits: 0 
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const safe = (str?: string | null | any) => {
    if (str === null || str === undefined) return '';
    const s = typeof str === 'string' ? str : String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const paragraphs = (text?: string) =>
    (text || '').split(/\n\n+/).filter(Boolean).map(p => `<p style="margin-bottom: 10px;">${safe(p)}</p>`).join('');

  const phasesHtml = data.budgetPhases && data.budgetPhases.length > 0
    ? `<div class="section-sidebar">
        <h2 style="font-size: 11pt;">Phases</h2>
        <div class="phases">
          ${data.budgetPhases.map((ph, i) => `
            <div class="phase-card ${data.currentPhaseId === ph.id ? 'phase-current' : ''}">
              <div class="phase-header">
                <span class="phase-num">P${i + 1}</span>
                <strong style="font-size: 9pt;">${safe(ph.name)}</strong>
              </div>
              ${ph.description ? `<div style="font-size: 8pt; color: #4b5563; margin-bottom: 5px; line-height: 1.2;">${safe(ph.description)}</div>` : ''}
              ${ph.notes ? `<div style="font-size: 7.5pt; color: #6b7280; margin-bottom: 5px; line-height: 1.2; font-style: italic;">${safe(ph.notes)}</div>` : ''}
              ${ph.duration || ph.timeline ? `<div style="font-size: 7.5pt; color: #f97316; margin-bottom: 5px; font-weight: 600;">⏱ ${safe(ph.duration || ph.timeline)}</div>` : ''}
              <div class="phase-meta" style="font-size: 8pt; justify-content: space-between;">
                <span>${formatCurrency(ph.target, data.currency)}</span>
                ${ph.raised ? `<span style="color: #166534;">${formatCurrency(ph.raised, data.currency)}</span>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

  const peopleHtml = data.people?.length
    ? `<div class="section-sidebar" style="padding-top: 15px;">
        <h2 style="font-size: 11pt;">People Involved</h2>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          ${data.people
            .sort((a: any, b: any) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0))
            .map((p: any) => `
            <div style="display: flex; align-items: center; gap: 8px; background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #e5e7eb; flex-shrink: 0;">
                ${p.photoURL ? `<img src="${p.photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; font-size: 8pt; font-weight: bold;">${p.name?.charAt(0) || '?'}</div>`}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: bold; font-size: 8pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">
                  <span>${safe(p.name)}</span>
                  ${p.isLead ? '<span style="color: #3b82f6; font-size: 10pt;">★</span>' : ''}
                </div>
                <div style="font-size: 7pt; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safe(p.role || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : '';

  const budgetSummaryHtml = data.totalBudget
    ? `<div class="section-sidebar">
        <h2 style="font-size: 11pt;">Fundraising</h2>
        <div class="budget-grid">
          <div class="budget-card budget-target">
            <div class="budget-label">Target</div>
            <div class="budget-amount" style="font-size: 13pt;">${formatCurrency(data.totalBudget, data.currency)}</div>
          </div>
          ${data.amountRaised ? `<div class="budget-card budget-raised">
            <div class="budget-label">Raised</div>
            <div class="budget-amount" style="font-size: 13pt;">${formatCurrency(data.amountRaised, data.currency)}</div>
          </div>` : ''}
        </div>
      </div>` : '';

  const impactHtml = `<div class="section" style="margin-top: 10px;">
    <h2>Goals &amp; Impact</h2>
    ${data.projectImpact ? `<p style="font-style: italic; margin-bottom: 15px; color: #4b5563;">${safe(data.projectImpact)}</p>` : ''}
    ${data.impactItems?.length ? `
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${data.impactItems.map(item => `
          <li style="display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start;">
            <span style="color: #f97316; font-weight: bold; flex-shrink: 0;">•</span>
            <span style="flex: 1;">${safe(item)}</span>
          </li>
        `).join('')}
      </ul>
    ` : ''}
  </div>`;

  const complianceHtml = (data.oversight || data.safeguardingInPlace || data.financialAccountabilityInPlace)
    ? `<h2 style="font-size: 11pt; border-bottom: 1px solid #fed7aa; margin-top: 0; margin-bottom: 10px;">Compliance</h2>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${data.oversight ? `<div style="line-height: 1.2;"><strong>Oversight:</strong> ${safe(data.oversight)}</div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 8.5pt;">Safeguarding</span>
            <span style="padding: 1px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; ${data.safeguardingInPlace ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
              ${data.safeguardingInPlace ? 'YES' : 'NO'}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 8.5pt;">Financial Acc.</span>
            <span style="padding: 1px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; ${data.financialAccountabilityInPlace ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
              ${data.financialAccountabilityInPlace ? 'YES' : 'NO'}
            </span>
          </div>
        </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safe(data.projectName)} — Project Profile</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.5;
      color: #1a1a1a;
      background: #f4f4f5;
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @media screen {
      body {
        padding: 40px 0;
      }
    }

    @media print {
      body { 
        background: white !important; 
        padding: 0 !important; 
      }
      .no-print { display: none !important; }
      .page-wrapper { 
        border: none !important; 
        box-shadow: none !important; 
        width: 210mm !important; 
        max-width: none !important; 
        margin: 0 !important; 
        padding-bottom: 0 !important;
      }
      .hero {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Force background images and colors to show */
      * { 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }

    .page-wrapper {
      background: white;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      background: white;
      box-sizing: border-box;
      overflow: hidden;
      page-break-after: always;
    }

    .page-1 {
      height: 297mm;
    }

    .page-2 {
      height: 297mm;
      padding-top: 1.5cm;
    }

    .content-section {
      page-break-inside: avoid;
    }

    .force-page-break {
      page-break-before: always;
    }

    .hero {
      height: 164px;
      position: relative;
      background: #111;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 50px;
      overflow: hidden;
    }

    .hero-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.6;
    }

    .hero-content { position: relative; z-index: 10; margin-right: 120px; }
    
    .qr-container {
      position: absolute;
      top: 1.5cm;
      right: 1.5cm;
      background: white;
      padding: 10px;
      border-radius: 12px;
      z-index: 20;
      text-align: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }

    .section { padding: 30px 50px; border-bottom: 1px solid #f0f0f0; }
    .section-sidebar { padding: 25px 25px; border-bottom: 1px solid #e5e7eb; }
    .section:last-of-type { border-bottom: none; }
    
    .compliance-card {
      background: #f9fafb; 
      padding: 5px 10px; 
      border-radius: 8px; 
      border: 1px solid #e5e7eb; 
      height: fit-content;
      font-size: 9pt;
    }
    .compliance-card div { font-size: 8.5pt; }
    .compliance-card strong { font-size: 8.5pt; }
    
    .activities-cols {
      column-count: 2; 
      column-gap: 40px; 
      column-rule: 1px solid #f0f0f0;
    }
    
    h2 { color: #f97316; font-size: 15pt; text-transform: uppercase; margin-top: 5px; margin-bottom: 10px; letter-spacing: 0.5px; border-bottom: 2px solid #fed7aa; padding-bottom: 5px; display: inline-block; }

    .budget-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }
    .budget-card {
      padding: 10px;
      border-radius: 8px;
      text-align: center;
    }
    .budget-label { font-size: 7.5pt; text-transform: uppercase; color: #6b7280; margin-bottom: 3px; }
    .budget-amount { font-size: 14pt; font-weight: bold; }
    .budget-target { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .budget-pledged { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .budget-raised { background: #fefce8; border: 1px solid #fef08a; color: #854d0e; }

    .phases { display: flex; flex-direction: column; gap: 8px; }
    .phase-card { padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #ffffff; }
    .phase-current { border-color: #3b82f6; background: #eff6ff; border-width: 2px; }
    .phase-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
    .phase-num { font-size: 7.5pt; font-weight: bold; color: #6b7280; text-transform: uppercase; }
    .badge-current { background: #3b82f6; color: white; font-size: 7pt; padding: 2px 8px; border-radius: 10px; }
    .phase-meta { display: flex; gap: 20px; font-size: 8.5pt; color: #4b5563; }

    .page-break {
      page-break-before: always;
      height: 0;
      margin: 0;
      border: none;
    }

    .org-page-content {
      padding: 1.5cm 50px;
    }

    p, li, div { font-size: 11pt; }

    .footer { 
      margin-top: auto; 
      padding: 0 50px 1.5cm; 
      border-top: 1px solid #f0f0f0; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      font-size: 8pt;
      color: #9ca3af;
    }
    .footer div { font-size: 8pt; }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 20px; left: 0; right: 0; display: flex; justify-content: center; z-index: 1000;">
    <div style="background: rgba(0,0,0,0.85); color: white; padding: 12px 24px; border-radius: 50px; display: flex; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1);">
      <div style="font-weight: 600; font-size: 14px;">Project Profile Preview</div>
      <button onclick="window.print()" style="background: #f97316; color: white; border: none; padding: 8px 18px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 13px; transition: all 0.2s; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#ea580c'" onmouseout="this.style.background='#f97316'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H8v3h8V3z"/></svg>
        Print / Save as PDF
      </button>
      <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.2);"></div>
      <div style="font-size: 12px; color: #9ca3af;">Optimized for A4 paper</div>
    </div>
  </div>

  <div class="page-wrapper">
    <!-- PAGE 1 - HERO -->
    <div class="page page-1">
      <div class="hero">
        ${data.coverPhotoURL ? `<img src="${data.coverPhotoURL}" class="hero-img">` : ''}
        <div class="qr-container">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://close2source.com/projects/${data.projectId}/profile" alt="QR Code" width="100" height="100">
          <div style="color: black; font-size: 7.5pt; text-align: center; margin-top: 6px; font-weight: bold;">SCAN TO VIEW ONLINE</div>
        </div>
        <div class="hero-content">
          <div style="font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-size: 9pt; color: #f97316; margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
            ${data.projectStage || 'Proposal'}
            <span style="width: 30px; height: 2px; background: #f97316;"></span>
          </div>
          <h1 style="font-size: 32pt; margin: 0; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px;">${safe(data.projectName)}</h1>
          ${data.strapline ? `<p style="font-size: 13pt; margin-top: 15px; opacity: 0.9; font-weight: 400; max-width: 66%; line-height: 1.4;">${safe(data.strapline)}</p>` : ''}
        </div>
      </div>

      <div class="section" style="background: #111; color: white; padding: 15px 50px; display: flex; justify-content: space-between; align-items: center; page-break-after: avoid;">
        <div style="font-size: 10pt; font-weight: 500;">
          📍 ${[data.locationName, data.locationTown, data.locationCountry].filter(Boolean).map(safe).join(', ')}
        </div>
        <div style="font-size: 9pt; opacity: 0.7; font-family: monospace;">ID: ${data.projectId}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr calc(240px + 1.5cm); gap: 0; flex: 1; overflow: hidden;">
        <div style="border-right: 1px solid #f0f0f0; padding-bottom: 30px; overflow: hidden;">
          ${data.description ? (() => {
            // Split executive summary at ~28 lines, paragraph-aware
            const paras = data.description.split(/\n\n+/);
            const charsPerLine = 75; // conservative for main column width
            const maxLines = 26;
            let usedLines = 0;
            let splitIdx = paras.length; // default: all fit
            
            for (let i = 0; i < paras.length; i++) {
              const paraLines = Math.ceil(paras[i].length / charsPerLine) || 1;
              const paraGap = i > 0 ? 1 : 0; // each paragraph break uses ~1 line of space
              usedLines += paraLines + paraGap;
              if (usedLines > maxLines) {
                splitIdx = i;
                break;
              }
            }
            
            const part1 = paras.slice(0, splitIdx).join('\n\n').trim();
            const part2 = paras.slice(splitIdx).join('\n\n').trim();
            
            // Store for page 2
            (data as any)._execContinuation = part2;
            
            return `<div class="section"><h2>Executive Summary</h2>${paragraphs(part1 || data.description)}</div>`;
          })() : ''}
        </div>
        
        <!-- SIDEBAR: Budget & Phases only on Page 1 -->
        <div style="background: #fafafa; overflow: hidden; padding-right: 1.5cm;">
          ${budgetSummaryHtml}
          ${phasesHtml}
        </div>
      </div>
    </div>

    <!-- PAGE 2 - Continuation + Goals + People -->
    <div class="page page-2">
      <div style="display: grid; grid-template-columns: 1fr calc(240px + 1.5cm); gap: 0; height: 100%; overflow: hidden;">
        <div style="border-right: 1px solid #f0f0f0; padding-bottom: 30px; overflow: hidden;">
          ${(data as any)._execContinuation ? `
            <div class="section" style="padding-top: 15px;">
              <h2 style="font-size: 11pt; margin-bottom: 8px;">Executive Summary (continued)</h2>
              ${paragraphs((data as any)._execContinuation)}
            </div>
          ` : ''}
          
          <div style="margin-top: 10px;">
            ${impactHtml}
          </div>
        </div>
        
        <!-- SIDEBAR Page 2: People Involved -->
        <div style="background: #fafafa; overflow: hidden; padding-right: 1.5cm;">
          ${peopleHtml}
        </div>
      </div>
    </div>

    <!-- PAGE 3 - ORGANIZATION INFO -->
    <div class="page force-page-break" style="padding-top: 1.5cm; padding-bottom: 1cm;">
      <div style="border-bottom: 2px solid #f97316; margin: 0 50px 25px; padding-bottom: 10px; position: relative;">
        <div style="max-width: 80%;">
          <h1 style="font-size: 24pt; color: #111; margin: 0;">${safe(data.locationName)}</h1>
          <div style="font-size: 12pt; color: #f97316; font-weight: 600; margin-top: 5px;">Lead Organisation: ${safe(data.orgName)}</div>
        </div>
        ${data.orgId ? `
        <div style="position: absolute; top: -0.5cm; right: 0; background: white; padding: 8px; border-radius: 10px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://close2source.com/org/${data.orgId}" alt="Org QR Code" width="80" height="80">
          <div style="color: #666; font-size: 6.5pt; margin-top: 4px; font-weight: bold;">SCAN FOR ORG</div>
        </div>
        ` : ''}
      </div>

      <div style="padding: 0 50px;">
        <div style="display: grid; grid-template-columns: 0.66fr 0.34fr; gap: 40px; margin-bottom: 15px;">
          <div>
            ${data.locationVision ? `<div><h2>Our Vision</h2>${paragraphs(data.locationVision)}</div>` : ''}
          </div>
          <div>
            ${data.orgLogoURL ? `
              <div style="text-align: center; margin-bottom: 15px;">
                <img src="${data.orgLogoURL}" style="max-width: 140px; max-height: 70px; object-fit: contain;">
                <div style="font-weight: bold; font-size: 9pt; margin-top: 5px;">${safe(data.orgName)}</div>
              </div>
            ` : ''}
            <div class="compliance-card">
              ${complianceHtml}
            </div>
          </div>
        </div>

        ${data.locationWhatWeDo ? `
          <div style="margin-bottom: 20px;">
            <h2>What We Do</h2>
            <div class="activities-cols">
              ${paragraphs(data.locationWhatWeDo)}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="footer" style="margin-top: auto; padding: 0 50px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
        <div>© ${new Date().getFullYear()} Close2Source — Digital transparency for high impact projects</div>
        <div>Project Data Verified: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.focus();
    // Large delay for blob URL to load properly in the new window
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
