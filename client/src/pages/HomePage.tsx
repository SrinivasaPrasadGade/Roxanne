import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { TOOLS, CATEGORIES, type ToolConfig } from '../data/tools';
import CircularToolMenu from '../components/CircularToolMenu';


function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return <LucideIcons.File className={className} />;
  return <Icon className={className} />;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<
    ToolConfig['category'] | undefined
  >(undefined);

  const filteredTools = useMemo(() => {
    if (!activeCategory) return TOOLS;
    return TOOLS.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 sm:py-24 relative z-10">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <h4 className="text-white/50 text-xs tracking-[0.3em] font-medium uppercase mb-4">
          The <b><b>POLICE</b></b> brings you
        </h4>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light text-white uppercase tracking-wider leading-[1.1]">
          <i>Every Doc You Make</i>
        </h1>
        <p className="mt-6 text-sm sm:text-base text-white/50 max-w-2xl mx-auto font-light tracking-wide">
          Roxanne
          <br />
          You don't have to put on the red light
          <br />
          Those days are over
        </p>
      </div>


      {/* Category Filter Tabs */}
      <div className="flex items-center justify-center mb-10">
        <div className="inline-flex items-center gap-1 bg-white/5 backdrop-blur-lg border border-white/10 rounded-full p-1 shadow-2xl">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`relative px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 focus:outline-none ${
                  isActive
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Circular Menu */}
      <CircularToolMenu tools={filteredTools} />
    </div>
  );
}
