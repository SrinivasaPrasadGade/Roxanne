import React from 'react';
import { useParams, Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { getToolBySlug } from '../data/tools';
import type { SupportedFormat } from '../../../shared/types';
import UploadWorkspace from '../components/UploadWorkspace';

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return <LucideIcons.File className={className} />;
  return <Icon className={className} />;
}

/**
 * Map SupportedFormat values to the MIME-type accept map that react-dropzone expects.
 */
function buildAcceptMap(formats: SupportedFormat[]): Record<string, string[]> {
  const mimeMap: Record<SupportedFormat, Record<string, string[]>> = {
    pdf: { 'application/pdf': ['.pdf'] },
    docx: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    pptx: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    xlsx: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    jpg: { 'image/jpeg': ['.jpg', '.jpeg'] },
    png: { 'image/png': ['.png'] },
  };

  const result: Record<string, string[]> = {};
  for (const fmt of formats) {
    const entries = mimeMap[fmt];
    if (entries) {
      for (const [mime, exts] of Object.entries(entries)) {
        result[mime] = exts;
      }
    }
  }
  return result;
}

/**
 * Human-readable label for the accepted formats.
 */
function buildAcceptLabel(formats: SupportedFormat[]): string {
  return 'Supports ' + formats.map((f) => f.toUpperCase()).join(', ');
}

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getToolBySlug(slug) : undefined;

  if (!tool) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center relative z-10">
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
          <LucideIcons.FileQuestion className="w-10 h-10 text-white/40" />
        </div>
        <h1 className="text-2xl font-serif text-white mb-2 tracking-wide">Tool Not Found</h1>
        <p className="text-white/50 mb-6 font-light">
          The tool "<code className="text-white bg-white/10 px-1.5 py-0.5 rounded"> {slug} </code>" doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm transition-all tracking-wider uppercase text-glow"
        >
          <LucideIcons.ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>
      </div>
    );
  }

  const acceptFormats = buildAcceptMap(tool.inputFormats);
  const acceptLabel = buildAcceptLabel(tool.inputFormats);

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-8 sm:py-10 flex flex-col gap-6 relative z-10">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase font-medium text-white/50 hover:text-white transition-colors w-fit group"
      >
        <LucideIcons.ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All tools
      </Link>

      {/* Tool Header */}
      <div className="flex items-center gap-5 mb-4">
        <div
          className={`w-16 h-16 rounded-2xl ${tool.iconBg} border border-white/10 flex items-center justify-center shrink-0 shadow-xl backdrop-blur-md`}
        >
          <ToolIcon
            name={tool.icon}
            className={`w-8 h-8 ${tool.iconColor}`}
          />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-light text-white tracking-wide uppercase">
            {tool.name}
          </h1>
          <p className="text-sm text-white/50 mt-1 font-light tracking-wide flex items-center gap-3">
            {tool.description}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-white/10 border border-white/20 text-white/80">
              → {tool.outputFormat}
            </span>
          </p>
        </div>
      </div>

      {/* Upload Workspace */}
      <UploadWorkspace
        acceptFormats={acceptFormats}
        toolName={`Upload & ${tool.name}`}
        toolDescription={`Drop your files below to ${tool.description.toLowerCase()}.`}
        acceptLabel={acceptLabel}
      />
    </div>
  );
}
