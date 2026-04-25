"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

interface CarouselSlide {
  id: string | number;
  title: string;
  description: string;
  image: string;
  badge?: string;
}

interface CarouselProps {
  slides: CarouselSlide[];
  autoPlay?: boolean;
  interval?: number;
}

export function Carousel({ slides, autoPlay = true, interval = 5000 }: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const next = useCallback(() => setCurrent((prev) => (prev + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (!autoPlay || isHovered) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, next, isHovered]);

  return (
    <div 
      className="relative w-full h-[600px] md:h-[500px] rounded-[3rem] overflow-hidden bg-[#f8fafc] group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex flex-col md:flex-row"
        >
          {/* Contenedor de Imagen */}
          <div className="absolute inset-0 md:relative md:flex-1 h-full w-full order-1 md:order-2">
            {/* Overlay sutil para móvil: oscurece arriba para que el badge resalte y abajo para el texto */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-[#f8fafc] md:hidden z-10" />
            <motion.img
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              src={slides[current].image}
              alt={slides[current].title}
              className="w-full h-full object-contain p-14 md:p-20 opacity-20 md:opacity-100 mt-[-10%] md:mt-0"
            />
          </div>

          {/* Contenedor de Texto */}
          <div className="relative flex-1 flex flex-col justify-end md:justify-center p-8 md:p-24 z-20 order-2 md:order-1">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-4 md:space-y-6 mb-16 md:mb-0" // mb-16 para alejarlo de los puntos en móvil
            >
              {slides[current].badge && (
                <span className="inline-block px-4 py-1.5 bg-blue-600/10 text-blue-600 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] rounded-full">
                  {slides[current].badge}
                </span>
              )}
              <h2 className="text-3xl md:text-6xl font-black text-slate-900 leading-[1.2] md:leading-[1.1] tracking-tight pr-4 md:pr-0">
                {slides[current].title}
              </h2>
              <p className="text-slate-500 text-sm md:text-lg font-medium leading-relaxed max-w-[90%] md:max-w-md">
                {slides[current].description}
              </p>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navegación Web: SE MANTIENE IGUAL (solo visible en desktop) */}
      <div className="hidden md:block">
        <button
          onClick={prev}
          className="absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-white hover:text-blue-600 hover:border-white hover:shadow-xl transition-all z-30 opacity-0 group-hover:opacity-100"
        >
          <HiChevronLeft size={24} />
        </button>
        <button
          onClick={next}
          className="absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-white hover:text-blue-600 hover:border-white hover:shadow-xl transition-all z-30 opacity-0 group-hover:opacity-100"
        >
          <HiChevronRight size={24} />
        </button>
      </div>

      {/* Indicadores */}
      <div className="absolute bottom-10 left-8 md:left-24 flex gap-3 z-30">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              current === idx ? "w-10 bg-blue-600" : "w-2 bg-slate-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}