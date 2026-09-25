"use client";
import React from "react";
import { Carousel } from "@/components/shared/carousel";

export function PromoCarousel() {
  const slides = [
    {
      id: 1,
      badge: "Asesoría Profesional",
      title: "Cuida tu Bienestar",
      description:
        "¡Tu salud es nuestra prioridad! Recibe atención personalizada y encuentra todo lo que necesitas para el cuidado de tu familia. Aprovecha nuestras jornadas de despistaje y descuentos exclusivos en vitaminas y suplementos.",
      image: "https://cdn-icons-png.flaticon.com/512/3063/3063176.png", // Placeholder o un SVG lindo
    },
    {
      id: 2,
      badge: "Nuevos Productos",
      title: "Stock Actualizado",
      description:
        "Hemos recibido nuevos cargamentos de medicamentos genéricos y de marca. Revisa la sección de stock para actualizar tus inventarios y asegurar el abastecimiento de tus farmacias.",
      image: "https://cdn-icons-png.flaticon.com/512/883/883344.png",
    },
  ];

  return (
    <div className="w-full">
      <Carousel slides={slides} />
    </div>
  );
}
