// ActionButton.tsx
export const ActionButton = ({ icon, color, onClick }: { icon: any, color: 'blue' | 'amber' | 'red', onClick?: () => void }) => {
  const styles = {
    blue: "text-blue-500 bg-blue-50 hover:bg-blue-500",
    amber: "text-amber-500 bg-amber-50 hover:bg-amber-500",
    red: "text-red-500 bg-red-50 hover:bg-red-500"
  };
  return (
    <button onClick={onClick} className={`p-2 rounded-lg transition-all duration-200 hover:text-white active:scale-90 ${styles[color]}`}>
      {icon}
    </button>
  );
};

// FormInput.tsx
export const FormInput = ({ label, placeholder, required, ...props }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-bold text-slate-700 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      {...props}
      placeholder={placeholder}
      className="px-4 py-3 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
    />
  </div>
);