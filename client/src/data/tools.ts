import type { SupportedFormat } from '../../../shared/types';

export interface ToolConfig {
  slug: string;
  name: string;
  description: string;
  icon: string;          // lucide-react icon name
  iconColor: string;     // Tailwind text color class
  iconBg: string;        // Tailwind bg color class
  inputFormats: SupportedFormat[];
  outputFormat: SupportedFormat;
  category: 'convert' | 'organize' | 'optimize' | 'edit' | 'security';
  comingSoon?: boolean;
}

export const TOOLS: ToolConfig[] = [
  // ── Organize ────────────────────────────────────────────────────────────────
  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDFs into one document',
    icon: 'Layers',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'organize',
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    description: 'Split into individual pages or ranges',
    icon: 'Scissors',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'organize',
  },

  // ── Optimize ────────────────────────────────────────────────────────────────
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce file size without losing quality',
    icon: 'FileDown',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'optimize',
  },

  // ── Convert (PDF → Office) ─────────────────────────────────────────────────
  {
    slug: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF documents to editable DOCX',
    icon: 'FileText',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'docx',
    category: 'convert',
  },
  {
    slug: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    description: 'Transform PDFs into editable PPTX slides',
    icon: 'Presentation',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pptx',
    category: 'convert',
  },
  {
    slug: 'pdf-to-excel',
    name: 'PDF to Excel',
    description: 'Extract tables and data into XLSX spreadsheets',
    icon: 'FileSpreadsheet',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'xlsx',
    category: 'convert',
  },

  // ── Convert (Office → PDF) ─────────────────────────────────────────────────
  {
    slug: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert DOCX documents to PDF format',
    icon: 'FileText',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['docx'],
    outputFormat: 'pdf',
    category: 'convert',
  },
  {
    slug: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert PPTX presentations to PDF',
    icon: 'Presentation',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pptx'],
    outputFormat: 'pdf',
    category: 'convert',
  },
  {
    slug: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Convert XLSX spreadsheets to PDF format',
    icon: 'FileSpreadsheet',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['xlsx'],
    outputFormat: 'pdf',
    category: 'convert',
  },

  // ── Edit ────────────────────────────────────────────────────────────────────
  {
    slug: 'edit-pdf',
    name: 'Edit PDF',
    description: 'Add text, images, and shapes to PDFs',
    icon: 'PenLine',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'edit',
  },

  // ── Convert (Image) ────────────────────────────────────────────────────────
  {
    slug: 'pdf-to-jpg',
    name: 'PDF to JPG',
    description: 'Convert each PDF page to a JPG image',
    icon: 'Image',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'jpg',
    category: 'convert',
  },
  {
    slug: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'Combine images into a single PDF document',
    icon: 'ImagePlus',
    iconColor: 'text-white/80',
    iconBg: 'bg-white/5',
    inputFormats: ['jpg', 'png'],
    outputFormat: 'pdf',
    category: 'convert',
  },

  // ── Coming Soon ─────────────────────────────────────────────────────────────
  {
    slug: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate PDF pages to any orientation',
    icon: 'RotateCw',
    iconColor: 'text-white/40',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'organize',
    comingSoon: true,
  },
  {
    slug: 'ocr-pdf',
    name: 'OCR PDF',
    description: 'Make scanned PDFs searchable with OCR',
    icon: 'ScanText',
    iconColor: 'text-white/40',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'edit',
    comingSoon: true,
  },
  {
    slug: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Add text or image watermarks to PDFs',
    icon: 'Stamp',
    iconColor: 'text-white/40',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'edit',
    comingSoon: true,
  },
  {
    slug: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Add password protection to your PDFs',
    icon: 'ShieldCheck',
    iconColor: 'text-white/40',
    iconBg: 'bg-white/5',
    inputFormats: ['pdf'],
    outputFormat: 'pdf',
    category: 'security',
    comingSoon: true,
  },
];

/** Look up a tool by its URL slug */
export function getToolBySlug(slug: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Filter tools by category (returns all if category is undefined) */
export function getToolsByCategory(
  category?: ToolConfig['category']
): ToolConfig[] {
  if (!category) return TOOLS;
  return TOOLS.filter((t) => t.category === category);
}

/** All category values for the filter tabs */
export const CATEGORIES = [
  { key: undefined as ToolConfig['category'] | undefined, label: 'All' },
  { key: 'convert' as const, label: 'Convert' },
  { key: 'organize' as const, label: 'Organize' },
  { key: 'optimize' as const, label: 'Optimize' },
  { key: 'edit' as const, label: 'Edit' },
  { key: 'security' as const, label: 'Security' },
];
