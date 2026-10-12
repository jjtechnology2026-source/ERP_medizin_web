interface BarChartProps {
  data: { label: string; value1: number; value2: number }[];
  yAxisLabels: string[];
  className?: string;
}

export const BarChartCustom = ({ data, yAxisLabels, className = "" }: BarChartProps) => {
  return (
    <div className={`flex w-full gap-4 pb-8 ${className}`}>
      {/* Escala Lateral (Y-Axis) */}
      <div className="flex flex-col justify-between h-48 text-[10px] text-gray-400 font-medium pb-6">
        {yAxisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {/* Area del Grafico */}
      <div className="flex-1 flex justify-between items-end h-48 px-2 border-l border-b border-gray-100 relative">
        {data.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-3 group relative h-full justify-end">
            <div className="flex gap-1 items-end h-32">
              {/* Barra Azul */}
              <div 
                className="w-2.5 bg-blue-600 rounded-full transition-all duration-500 hover:opacity-80 relative group"
                style={{ height: `${item.value1}%` }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {item.value1}
                </span>
              </div>
              {/* Barra Rosa */}
              <div 
                className="w-2.5 bg-pink-400 rounded-full transition-all duration-500 hover:opacity-80 relative group"
                style={{ height: `${item.value2}%` }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {item.value2}
                </span>
              </div>
            </div>
            
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-0">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};