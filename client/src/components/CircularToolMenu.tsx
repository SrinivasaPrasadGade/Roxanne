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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  const toolsRef = useRef<ToolConfig[]>(tools);
  const hoveredToolRef = useRef<ToolConfig | null>(null);

  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  // Keep track of the container size dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Dynamically adjust radius based on number of tools and container width
  const baseRadius = tools.length > 8 ? 260 : tools.length > 4 ? 200 : 140;
  const radius = Math.min(baseRadius, (containerWidth / 600) * baseRadius);
  const iconSize = containerWidth < 480 ? 48 : 64;
  const marginOffset = -iconSize / 2;

  const radiusRef = useRef<number>(radius);
  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

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
    hoveredToolRef.current = tool;
    playTickSound();
  };

  const handleMouseLeave = () => {
    setHoveredTool(null);
    hoveredToolRef.current = null;
  };

  // Setup touch event listeners for phone / mobile devices
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchPositionDetails = (e: TouchEvent) => {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      return { distance, angle };
    };

    const updateTouchHover = (e: TouchEvent) => {
      const details = getTouchPositionDetails(e);
      if (!details) return;

      const { distance, angle } = details;
      const currentRadius = radiusRef.current;
      const minDistance = 30;
      const maxDistance = currentRadius + 100;

      if (distance < minDistance || distance > maxDistance) {
        if (hoveredToolRef.current !== null) {
          setHoveredTool(null);
          hoveredToolRef.current = null;
        }
        return;
      }

      // Normalize angle to [0, 2*PI]
      const normalizeAngle = (a: number) => {
        let normalized = a % (2 * Math.PI);
        if (normalized < 0) normalized += 2 * Math.PI;
        return normalized;
      };

      const normTouchAngle = normalizeAngle(angle);
      const currentTools = toolsRef.current;
      let closestTool: ToolConfig | null = null;
      let minDiff = Infinity;

      currentTools.forEach((tool, index) => {
        const toolAngle = (index / currentTools.length) * 2 * Math.PI - Math.PI / 2;
        const normToolAngle = normalizeAngle(toolAngle);

        let diff = Math.abs(normTouchAngle - normToolAngle);
        if (diff > Math.PI) {
          diff = 2 * Math.PI - diff;
        }

        if (diff < minDiff) {
          minDiff = diff;
          closestTool = tool;
        }
      });

      if (closestTool && hoveredToolRef.current?.slug !== (closestTool as ToolConfig).slug) {
        setHoveredTool(closestTool);
        hoveredToolRef.current = closestTool;
        playTickSound();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const details = getTouchPositionDetails(e);
      if (details) {
        const { distance } = details;
        // If touching active circular interaction area, prevent default scroll/click behavior
        if (distance >= 30 && distance <= radiusRef.current + 100) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
      updateTouchHover(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent default scrolling when moving finger over the tools
      if (e.cancelable) {
        e.preventDefault();
      }
      updateTouchHover(e);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const tool = hoveredToolRef.current;
      if (tool) {
        if (!tool.comingSoon) {
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
          navigate(`/tools/${tool.slug}`);
        }
        setHoveredTool(null);
        hoveredToolRef.current = null;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[600px] mx-auto aspect-square flex items-center justify-center my-12"
    >
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
              className="text-center max-w-[140px] sm:max-w-[240px] flex flex-col items-center justify-center"
            >
              <div
                className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl ${hoveredTool.iconBg} border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center justify-center mb-3 sm:mb-6`}
              >
                <ToolIcon name={hoveredTool.icon} className={`w-7 h-7 sm:w-10 sm:h-10 ${hoveredTool.iconColor}`} />
              </div>
              <h3 className={`text-lg sm:text-2xl font-medium tracking-wide ${hoveredTool.comingSoon ? 'text-white/50' : 'text-white'}`}>
                {hoveredTool.name}
              </h3>
              <p className={`text-xs sm:text-sm mt-1 sm:mt-3 font-light leading-relaxed ${hoveredTool.comingSoon ? 'text-white/30' : 'text-white/50'}`}>
                {hoveredTool.description}
              </p>
              {hoveredTool.comingSoon && (
                <span className="mt-2 sm:mt-5 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-white/40 bg-white/5 border border-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full inline-block shadow-inner">
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
              className="text-center flex flex-col items-center justify-center"
            >
              <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] flex items-center justify-center mb-3 sm:mb-6 animate-pulse">
                <LucideIcons.MousePointerClick className="w-5 h-5 sm:w-8 sm:h-8 text-white/30" />
              </div>
              <p className="text-white/40 text-xs sm:text-sm tracking-[0.2em] uppercase font-medium">
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
                style={{
                  marginLeft: `${marginOffset}px`,
                  marginTop: `${marginOffset}px`,
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                }}
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
                  className={`relative group rounded-xl sm:rounded-2xl w-full h-full flex items-center justify-center transition-all duration-300 ${
                    tool.comingSoon
                      ? 'opacity-30 cursor-default'
                      : 'cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-xl sm:rounded-2xl ${tool.iconBg} border border-white/10 flex items-center justify-center transition-all duration-300 ${
                      isHovered && !tool.comingSoon
                        ? 'shadow-[0_0_35px_rgba(255,255,255,0.4)] border-white/40 bg-white/10'
                        : 'glass-card hover:bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <ToolIcon
                      name={tool.icon}
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${tool.iconColor} transition-all duration-300 ${
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
