import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface ProjectPDFData {
  name: string;
  projectId?: string;
  description?: string;
  strapline?: string;
  coverPhotoUrl?: string;
  locationName?: string;
  locationIntroduction?: string;
  locationVision?: string;
  locationWhatWeDo?: string;
  vision?: string;
  projectSummary?: string;
  projectImpact?: string;
  targetCompletionDate?: string;
  totalBudget?: number;
  currency?: string;
  goals?: string[];
  beneficiaries?: string;
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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = 20;

  // Generate QR code for project URL
  if (project.projectId) {
    try {
      const profileUrl = `https://close2source.com/projects/${project.projectId}/proposal`;
      const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 200, margin: 1 });
      
      // Add QR code to top right corner
      const qrSize = 30;
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - qrSize, 10, qrSize, qrSize);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  }

  // Add organization logo to the left of the project name
  let logoWidth = 0;
  if (project.organizationLogoUrl) {
    try {
      // Try loading without CORS first (works if same-origin or bucket allows it)
      const logoData = await new Promise<string | null>((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve(null);
          }
        };
        
        img.onerror = () => resolve(null);
        img.src = project.organizationLogoUrl!;
        setTimeout(() => resolve(null), 3000);
      });
      
      if (logoData) {
        const logoHeight = 15;
        logoWidth = 15;
        doc.addImage(logoData, 'PNG', margin, yPos - 3, logoWidth, logoHeight);
        logoWidth += 5;
      }
    } catch (error) {
      // Logo will be skipped - PDF generates without it
    }
  }

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 12, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, yPos);
    yPos += (lines.length * fontSize * 0.4) + 5;
    
    // Check if we need a new page
    if (yPos > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addSection = (title: string, content?: string) => {
    if (!content) return;
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Orange color
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

  // Title (with logo spacing)
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38);
  doc.text(project.name, margin + logoWidth, yPos);
  yPos += 12;

  // Strapline — bold sentence summarising what will be funded
  if (project.strapline) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    const strapLines = doc.splitTextToSize(project.strapline, maxWidth);
    doc.text(strapLines, margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += (strapLines.length * 6) + 4;
  }

  // Description — shown inline below the strapline
  if (project.description) {
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(project.description, maxWidth);
    doc.text(descLines, margin, yPos);
    yPos += (descLines.length * 5) + 8;
  }

  // Organization
  if (project.organizationName) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`By ${project.organizationName}`, margin, yPos);
    yPos += 10;
  }

  // Location
  if (project.locationName) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Location', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(project.locationName, margin, yPos);
    yPos += 8;
    
    if (project.locationIntroduction) {
      const lines = doc.splitTextToSize(project.locationIntroduction, maxWidth);
      doc.text(lines, margin, yPos);
      yPos += (lines.length * 5) + 10;
    }
  }

  // Location Vision (from org location, takes precedence) or Project Vision
  if (project.locationVision) {
    addSection('Vision', project.locationVision);
  } else if (project.vision) {
    addSection('Vision', project.vision);
  }

  // What We Do (from org location)
  if (project.locationWhatWeDo) {
    addSection('What We Do', project.locationWhatWeDo);
  }

  // Project Summary
  if (project.projectSummary) {
    addSection('Project Summary', project.projectSummary);
  }

  // Goals
  if (project.goals && project.goals.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Goals', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    project.goals.forEach((goal, index) => {
      const lines = doc.splitTextToSize(`${index + 1}. ${goal}`, maxWidth - 5);
      doc.text(lines, margin + 5, yPos);
      yPos += (lines.length * 5) + 3;
      
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = 20;
      }
    });
    yPos += 7;
  }

  // Impact
  if (project.projectImpact) {
    addSection('Expected Impact', project.projectImpact);
  }

  // Beneficiaries
  if (project.beneficiaries) {
    addSection('Beneficiaries', project.beneficiaries);
  }

  // Budget & Timeline
  if (project.totalBudget || project.targetCompletionDate) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Budget & Timeline', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    if (project.totalBudget) {
      doc.text(`Budget: ${project.currency || 'USD'} ${project.totalBudget.toLocaleString()}`, margin, yPos);
      yPos += 6;
    }
    
    if (project.targetCompletionDate) {
      doc.text(`Target Completion: ${project.targetCompletionDate}`, margin, yPos);
      yPos += 6;
    }
    yPos += 10;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated from Close2Source', margin, doc.internal.pageSize.getHeight() - 10);

  // Save the PDF
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
      
      // Add QR code to top right corner
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

  // Bio
  if (individual.bio) {
    addSection('About', individual.bio);
  }

  // Service Info
  if (individual.serviceLocation || individual.organization) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Service Information', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    if (individual.serviceLocation) {
      doc.text(`Location: ${individual.serviceLocation}`, margin, yPos);
      yPos += 6;
    }
    
    if (individual.organization) {
      doc.text(`Organization: ${individual.organization}`, margin, yPos);
      yPos += 6;
    }
    
    if (individual.yearsInService) {
      doc.text(`Years in Service: ${individual.yearsInService}`, margin, yPos);
      yPos += 6;
    }
    yPos += 10;
  }

  // Vision
  if (individual.vision) {
    addSection('Vision', individual.vision);
  }

  // Story
  if (individual.story) {
    addSection('My Story', individual.story);
  }

  // Ministry Description
  if (individual.ministryDescription) {
    addSection('Ministry Description', individual.ministryDescription);
  }

  // Focus Areas
  if (individual.focusAreas && individual.focusAreas.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('Focus Areas', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    individual.focusAreas.forEach((area, index) => {
      doc.text(`• ${area}`, margin + 5, yPos);
      yPos += 6;
      
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = 20;
      }
    });
    yPos += 10;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated from Close2Source', margin, doc.internal.pageSize.getHeight() - 10);

  // Save the PDF
  const filename = `${individual.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_profile.pdf`;
  doc.save(filename);
}
