import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { type ToolConfig } from '../data/tools';

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return <LucideIcons.File className={className} />;
  return <Icon className={className} />;
}

export default function CircularToolMenu({ tools }: { tools: ToolConfig[] }) {
  const navigate = useNavigate();
  const [hoveredTool, setHoveredTool] = useState<ToolConfig | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on first interaction to comply with browser autoplay policies
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('mouseover', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('mouseover', initAudio);
    };
  }, []);

  const playTickSound = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(15); // subtle vibration
      }

      if (audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        const oscillator = audioCtxRef.current.createOscillator();
        const gainNode = audioCtxRef.current.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.05);

        gainNode.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtxRef.current.destination);

        oscillator.start();
        oscillator.stop(audioCtxRef.current.currentTime + 0.05);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const handleMouseEnter = (tool: ToolConfig) => {
    setHoveredTool(tool);
    playTickSound();
  };

  const handleMouseLeave = () => {
    setHoveredTool(null);
  };

  // Dynamically adjust radius based on number of tools to prevent crowding
  const radius = tools.length > 8 ? 260 : tools.length > 4 ? 200 : 140;

  return (
    <div className="relative w-full max-w-[600px] mx-auto aspect-square flex items-center justify-center my-12">
      {/* Center Details */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <AnimatePresence mode="wait">
          {hoveredTool ? (
            <motion.div
              key={hoveredTool.slug}
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
              transition={{ duration: 0.2 }}
              className="text-center max-w-[240px] flex flex-col items-center justify-center"
            >
              <div
                className={`w-20 h-20 rounded-3xl ${hoveredTool.iconBg} border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center justify-center mb-6`}
              >
                <ToolIcon name={hoveredTool.icon} className={`w-10 h-10 ${hoveredTool.iconColor}`} />
              </div>
              <h3 className={`text-2xl font-medium tracking-wide ${hoveredTool.comingSoon ? 'text-white/50' : 'text-white'}`}>
                {hoveredTool.name}
              </h3>
              <p className={`text-sm mt-3 font-light leading-relaxed ${hoveredTool.comingSoon ? 'text-white/30' : 'text-white/50'}`}>
                {hoveredTool.description}
              </p>
              {hoveredTool.comingSoon && (
                <span className="mt-5 text-[10px] font-bold tracking-widest uppercase text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full inline-block shadow-inner">
                  Coming Soon
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] flex items-center justify-center mb-6 animate-pulse">
                <LucideIcons.MousePointerClick className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/40 text-sm tracking-[0.2em] uppercase font-medium">
                Explore Tools
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Circular Items */}
      <div className="relative w-full h-full z-10 pointer-events-none">
        <AnimatePresence>
          {tools.map((tool, index) => {
            const angle = (index / tools.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isHovered = hoveredTool?.slug === tool.slug;

            return (
              <motion.div
                key={tool.slug}
                layoutId={`tool-${tool.slug}`}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{
                  opacity: 1,
                  x,
                  y,
                  scale: isHovered ? 1.25 : 1,
                  zIndex: isHovered ? 20 : 10,
                }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  mass: 0.8,
                }}
                className={`absolute top-1/2 left-1/2 pointer-events-auto`}
                style={{ marginLeft: '-32px', marginTop: '-32px' }} // Center the 64x64 item
              >
                <div
                  onMouseEnter={() => handleMouseEnter(tool)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    if (!tool.comingSoon) {
                      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
                      navigate(`/tools/${tool.slug}`);
                    }
                  }}
                  className={`relative group rounded-2xl w-16 h-16 flex items-center justify-center transition-all duration-300 ${
                    tool.comingSoon
                      ? 'opacity-30 cursor-default'
                      : 'cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-2xl ${tool.iconBg} border border-white/10 flex items-center justify-center transition-all duration-300 ${
                      isHovered && !tool.comingSoon
                        ? 'shadow-[0_0_35px_rgba(255,255,255,0.4)] border-white/40 bg-white/10'
                        : 'glass-card hover:bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <ToolIcon
                      name={tool.icon}
                      className={`w-6 h-6 ${tool.iconColor} transition-all duration-300 ${
                        isHovered && !tool.comingSoon ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] text-white' : ''
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
