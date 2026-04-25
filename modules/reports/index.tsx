import { MetricCard } from './components/MetricCard';
import { FaChartLine, FaRegClipboard } from 'react-icons/fa';
import { IoHandLeftOutline } from 'react-icons/io5';

export default function Reportes() {
  return (
    <div className="p-8 max-w-8xl mx-auto bg-[#f8f9fa] min-h-screen">
      <h1 className="text-2xl font-bold text-[#0052ff] mb-8">Reporte general</h1>

      {/* Grid de Métricas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Ventas del día"
          value="0.00 USD"
          percentage="0.00%"
          trend="down"
          timeLabel="Último día"
          bgColor="bg-[#6366f1]" // Indigo
          icon={<FaChartLine />}
        />
        <MetricCard
          title="Ventas de la Semana"
          value="263.09 USD"
          percentage="-72.25%"
          trend="down"
          timeLabel="Última Semana"
          bgColor="bg-[#c084fc]" // Purple
          icon={<FaRegClipboard />}
        />
        <MetricCard
          title="Ventas del mes"
          value="1211.15 USD"
          percentage="100.00%"
          trend="up"
          timeLabel="Último mes"
          bgColor="bg-[#4ade80]" // Emerald
          icon={<IoHandLeftOutline />}
        />
      </div>

      {/* Tabla de Agentes */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8">
        <div className="bg-[#0052ff] grid grid-cols-3 text-white text-[11px] font-bold uppercase p-4 tracking-wider">
          <div className="text-center">Nombre del Agente</div>
          <div className="text-center">Por Categorías</div>
          <div className="text-center">Ventas Totales</div>
        </div>
        <div className="grid grid-cols-3 p-4 text-center text-gray-500 bg-[#f3f4f6] items-center">
          <div className="font-medium text-left px-4 lowercase text-gray-700">enzo</div>
          <div className="text-sm">0</div>
          <div className="font-bold text-gray-700 uppercase">0.00 USD</div>
        </div>
      </div>

      {/* Sección Notas Emitidas */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-8">Notas emitidas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#eef6ff] p-6 rounded-xl border-l-4 border-blue-400">
            <span className="text-4xl font-bold text-[#3b82f6]">0</span>
            <p className="text-sm text-gray-500 mt-2">Ordenes con notas</p>
          </div>
          <div className="bg-[#ecfdf5] p-6 rounded-xl border-l-4 border-emerald-400">
            <span className="text-4xl font-bold text-[#10b981]">0</span>
            <p className="text-sm text-gray-500 mt-2">Notas de crédito</p>
          </div>
          <div className="bg-[#fffbeb] p-6 rounded-xl border-l-4 border-amber-400">
            <span className="text-4xl font-bold text-[#f59e0b]">0</span>
            <p className="text-sm text-gray-500 mt-2">Notas de debito</p>
          </div>
        </div>

        <p className="text-gray-400 text-[13px] font-light">No hay notas emitidas registradas.</p>
      </div>
    </div>
  );
}