import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { TOOLS, CATEGORIES, type ToolConfig } from '../data/tools';


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
          Every Doc You Make
        </h4>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light text-white uppercase tracking-wider leading-[1.1]">
          Uncompromising Roxanne /<br />
          <span className="font-serif">Redefining Document Tools</span>
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

      {/* Tools Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredTools.map((tool) => (
            <motion.div
              key={tool.slug}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              layout
              onClick={() => {
                if (!tool.comingSoon) navigate(`/tools/${tool.slug}`);
              }}
              className={`group relative glass-card rounded-2xl p-6 flex flex-col gap-4 overflow-hidden ${
                tool.comingSoon
                  ? 'opacity-40 cursor-default'
                  : 'cursor-pointer hover:-translate-y-1'
              }`}
            >
              {/* Hover gradient effect inside card */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Coming Soon Badge */}
              {tool.comingSoon && (
                <span className="absolute top-4 right-4 text-[9px] font-bold tracking-widest uppercase text-white/40 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              )}

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl ${tool.iconBg} border border-white/10 shadow-inner flex items-center justify-center shrink-0 transition-all duration-300 ${
                  !tool.comingSoon ? 'group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''
                }`}
              >
                <ToolIcon
                  name={tool.icon}
                  className={`w-5 h-5 ${tool.iconColor}`}
                />
              </div>

              {/* Text */}
              <div className="relative z-10">
                <h3
                  className={`text-[15px] font-medium tracking-wide leading-snug ${
                    tool.comingSoon ? 'text-white/50' : 'text-white/90'
                  }`}
                >
                  {tool.name}
                </h3>
                <p
                  className={`text-xs mt-2 leading-relaxed font-light ${
                    tool.comingSoon ? 'text-white/30' : 'text-white/50'
                  }`}
                >
                  {tool.description}
                </p>
              </div>

              {/* Arrow indicator on hover */}
              {!tool.comingSoon && (
                <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <LucideIcons.ArrowUpRight className="w-5 h-5 text-white/50" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
