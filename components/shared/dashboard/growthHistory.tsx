import { DashboardCard } from "../cards/dashboardCard";

const DATA = [
  { month: "Jul", amount: "$1,200", x: 20, y: 120 },
  { month: "Aug", amount: "$2,500", x: 80, y: 80 },
  { month: "Sep", amount: "$1,800", x: 140, y: 100 },
  { month: "Oct", amount: "$4,200", x: 200, y: 40 },
  { month: "Nov", amount: "$3,100", x: 260, y: 70 },
  { month: "Dec", amount: "$5,800", x: 320, y: 15 },
  { month: "Jan", amount: "$4,900", x: 380, y: 30 },
];

export const GrowthHistory = () => (
  <DashboardCard title="Historial de crecimiento" className="h-[400px]">
    <div className="relative w-full pt-10 pb-6 px-4">
      {/* Contenedor relativo para alinear ejes y SVG */}
      <div className="relative h-[180px] w-full">
        {/* Ejes Horizontales (Monto) */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 ml-4">
          {[6000, 4500, 3000, 1500, 0].map((val) => (
            <div
              key={val}
              className="w-full border-t border-gray-100/80 relative"
            >
              <span className="absolute -left-10 -top-2 text-[9px] text-gray-400 font-medium w-8 text-right">
                ${val.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Gráfica SVG */}
        <svg
          viewBox="0 0 400 150"
          className="absolute inset-0 w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Líneas Guía Verticales (Por Mes) */}
          {DATA.map((p, i) => (
            <line
              key={`v-${i}`}
              x1={p.x}
              y1="0"
              x2={p.x}
              y2="150"
              stroke="#f1f5f9"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* Área Sombreada Ondulada (Ajustada con padding x:20 y x:380) */}
          <path
            d="M20,120 C70,120 50,80 80,80 C110,80 110,100 140,100 C170,100 180,40 200,40 C230,40 230,70 260,70 C290,70 300,15 320,15 C350,15 360,30 380,30 V150 H20 Z"
            fill="url(#fillGrad)"
          />

          {/* Línea de la Curva Principal */}
          <path
            d="M20,120 C70,120 50,80 80,80 C110,80 110,100 140,100 C170,100 180,40 200,40 C230,40 230,70 260,70 C290,70 300,15 320,15 C350,15 360,30 380,30"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Puntos de Datos e Interactividad */}
          {DATA.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              {/* Tooltip con fondo desenfocado (Efecto Glass) */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <rect
                  x={p.x - 22}
                  y={p.y - 32}
                  width="44"
                  height="18"
                  rx="4"
                  className="fill-gray-900/90"
                />
                <text
                  x={p.x}
                  y={p.y - 20}
                  textAnchor="middle"
                  className="text-[9px] fill-white font-bold pointer-events-none"
                >
                  {p.amount}
                </text>
              </g>

              {/* Punto con Aura en Hover */}
              <circle
                cx={p.x}
                cy={p.y}
                r="8"
                className="fill-transparent group-hover:fill-blue-100/50 transition-colors"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                className="fill-white stroke-[#3b82f6] stroke-2 transition-all group-hover:r-5 group-hover:fill-blue-600"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Etiquetas Eje X (Alineadas con x:20 y x:380) */}
      <div className="flex justify-between mt-6 px-[5%] text-[10px] text-gray-400 font-bold uppercase">
        {DATA.map((d) => (
          <span key={d.month} className="w-10 text-center tracking-tighter">
            {d.month}
          </span>
        ))}
      </div>
    </div>
  </DashboardCard>
);
