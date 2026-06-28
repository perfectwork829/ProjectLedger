import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function textToParagraphs(text: string): Paragraph[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 0) {
    return [new Paragraph({ children: [new TextRun(' ')] })];
  }
  return lines.map((line) => new Paragraph({ children: [new TextRun(line || ' ')] }));
}

export async function downloadTextAsDocx(text: string, filename: string): Promise<void> {
  const doc = new Document({
    sections: [{ properties: {}, children: textToParagraphs(text) }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}

export function downloadTextAsPdf(text: string, filename: string): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const lines = pdf.splitTextToSize(text.replace(/\r\n/g, '\n'), pageWidth);
  let y = margin;
  const lineHeight = 6;

  for (const line of lines) {
    if (y > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(String(line), margin, y);
    y += lineHeight;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function safeDownloadBasename(company: string, jobTitle: string, kind: 'cover-letter' | 'resume'): string {
  const slug = [company, jobTitle, kind]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || kind;
}
