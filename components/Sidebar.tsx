import React from 'react';
import { Box, Key, ExternalLink, Cpu } from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants';

interface SidebarProps {
  selectedModelId: number;
  onSelectModel: (id: number) => void;
  onOpenKeys: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedModelId, onSelectModel, onOpenKeys }) => {
  return (
    <div className="w-64 h-screen bg-[#09090b] border-r border-zinc-800 flex flex-col flex-shrink-0 z-20">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-900/50">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Box className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-zinc-100 tracking-wide">
            次元塑造科技
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Dimensional Shaping</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
          <Cpu className="w-3 h-3" /> 模型引擎选择
        </div>
        <div className="space-y-1">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                selectedModelId === model.id
                  ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-colors ${selectedModelId === model.id ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-zinc-700 group-hover:bg-zinc-600'}`} />
              <span className="truncate text-left flex-1 font-medium">{model.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-zinc-800 bg-zinc-900/20">
         <button 
           onClick={onOpenKeys}
           className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all border border-zinc-700 hover:border-zinc-600"
         >
           <Key className="w-4 h-4" />
           <span>配置 API 密钥</span>
         </button>
         <div className="mt-3 px-1 flex justify-between items-center text-[10px] text-zinc-600">
           <span>Flowchart Inspired by</span>
           <a href="https://www.oiioii.ai/home" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
             oiioii.ai <ExternalLink className="w-2.5 h-2.5"/>
           </a>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;