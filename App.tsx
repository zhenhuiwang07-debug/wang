import React, { useState, useEffect, useRef } from 'react';
import { Play, FileText, Users, Video, Loader2, Wand2, ArrowRight, Settings2, Palette, Film, CheckCircle2, Key, MessageSquare, X, Send, Image as ImageIcon, UploadCloud } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { ProjectState, ProjectStage, ChatMessage } from './types';
import { INITIAL_PROJECT_STATE, WORKFLOW_STEPS, AVAILABLE_MODELS } from './constants';
import * as GeminiService from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<number, string>>({});
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // New State for Input Mode
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: '你好！我是次元助手。有什么可以帮你的吗？我可以帮你构思剧本，或者解释如何使用视频生成工具。', timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mandatory API Key Selection for Google Models
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // Assume key selection was successful to handle race condition
      setHasApiKey(true);
    }
  };

  // Handlers for Model Selection
  const handleModelSelect = (id: number) => {
    setState(prev => ({ ...prev, selectedModelId: id }));
  };

  const handleKeyChange = (id: number, val: string) => {
    setApiKeys(prev => ({ ...prev, [id]: val }));
  };

  // Chat Functions
  const handleSendMessage = async () => {
      if (!chatInput.trim()) return;
      
      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: chatInput,
          timestamp: Date.now()
      };
      
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatTyping(true);

      try {
          // Format history for Gemini SDK
          const history = chatMessages.map(m => ({
              role: m.role,
              parts: [{ text: m.text }]
          }));

          const stream = await GeminiService.getChatResponseStream(history, userMsg.text);
          
          let fullResponse = "";
          const modelMsgId = (Date.now() + 1).toString();
          
          // Add placeholder message
          setChatMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() }]);

          for await (const chunk of stream) {
              const text = chunk.text; // Access .text property directly
              if (text) {
                fullResponse += text;
                setChatMessages(prev => 
                    prev.map(m => m.id === modelMsgId ? { ...m, text: fullResponse } : m)
                );
              }
          }
      } catch (error) {
          console.error("Chat Error", error);
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "抱歉，我遇到了一些连接问题，请稍后再试。", timestamp: Date.now() }]);
      } finally {
          setIsChatTyping(false);
      }
  };

  // Step 1: Input Analysis (编剧助手)
  const handleAnalyze = async () => {
    if (!state.rawInput.trim()) return;
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const result = await GeminiService.analyzeAndFormatText(state.rawInput);
      setState(prev => ({
        ...prev,
        inputType: result.type,
        script: result.segments,
        currentStage: ProjectStage.ANALYSIS,
        isProcessing: false
      }));
    } catch (e) {
      console.error(e);
      alert("分析失败，请重试");
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({ ...prev, uploadedImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 1 Alternative: Direct Video Generation (Image-to-Video)
  const handleDirectVideoGen = async () => {
    if (!state.uploadedImage) return;
    
    // Skip to Video Gen Stage
    setState(prev => ({ ...prev, isProcessing: true, currentStage: ProjectStage.VIDEO_GEN }));
    
    try {
      const prompt = state.videoPrompt || "Cinematic movement, high quality";
      const videoUrl = await GeminiService.generateVideoScene(prompt, state.uploadedImage);
      
      setState(prev => ({
        ...prev,
        generatedVideoUrl: videoUrl,
        isProcessing: false,
        currentStage: ProjectStage.COMPLETE
      }));
    } catch (e) {
      console.error(e);
      alert("视频生成失败。请重试。");
      setState(prev => ({ ...prev, isProcessing: false, currentStage: ProjectStage.INPUT }));
    }
  };

  // Step 2: Character Extraction (美术助手)
  const handleCharacterExtraction = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const chars = await GeminiService.extractCharacters(state.script);
      setState(prev => ({
        ...prev,
        characters: chars,
        currentStage: ProjectStage.CHARACTER_DESIGN,
        isProcessing: false
      }));
    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Step 3: Generate Character Image (美术助手/人设)
  const handleGenerateCharImage = async (charId: string) => {
    const charIndex = state.characters.findIndex(c => c.id === charId);
    if (charIndex === -1) return;
    
    setState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const base64Image = await GeminiService.generateCharacterImage(state.characters[charIndex]);
      const newChars = [...state.characters];
      newChars[charIndex] = { ...newChars[charIndex], imageUrl: base64Image };
      
      setState(prev => ({
        ...prev,
        characters: newChars,
        isProcessing: false
      }));
    } catch (e) {
      console.error(e);
      alert("图片生成失败");
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Transition to Visual Dev (艺术总监)
  const handleToVisualDev = () => {
    setState(prev => ({ ...prev, currentStage: ProjectStage.VISUAL_DEV }));
  };

  // Step 4: Video Generation (动画师)
  const handleGenerateVideo = async () => {
    setState(prev => ({ ...prev, isProcessing: true, currentStage: ProjectStage.VIDEO_GEN }));
    
    const protagonist = state.characters[0];
    const firstScene = state.script.find(s => s.type === 'scene' || s.type === 'action');
    
    if (!protagonist || !firstScene) {
      alert("需要角色和剧本才能生成视频。");
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    try {
      const prompt = `Cinematic shot. ${firstScene.visualPrompt || firstScene.content}. Featuring a character looking like: ${protagonist.visualPrompt}`;
      
      // In a real scenario, we'd check if `apiKeys[state.selectedModelId]` exists.
      // For this demo, we use the GeminiService which uses the Env key for Veo.
      const videoUrl = await GeminiService.generateVideoScene(prompt, protagonist.imageUrl);
      
      setState(prev => ({
        ...prev,
        generatedVideoUrl: videoUrl,
        isProcessing: false,
        currentStage: ProjectStage.COMPLETE
      }));

    } catch (e) {
      console.error(e);
      alert("视频生成失败 (请检查 API Quota)。");
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Render Pipeline Flowchart at Top
  const renderFlowchart = () => (
    <div className="mb-8 px-4">
      <div className="flex items-center justify-between relative max-w-5xl mx-auto">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 transform -translate-y-1/2" />
        
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCurrent = state.currentStage === step.id;
          const isCompleted = WORKFLOW_STEPS.findIndex(s => s.id === state.currentStage) > idx || state.currentStage === ProjectStage.COMPLETE;
          
          let Icon = FileText;
          if (step.id === ProjectStage.ANALYSIS) Icon = Settings2;
          if (step.id === ProjectStage.CHARACTER_DESIGN) Icon = Users;
          if (step.id === ProjectStage.VISUAL_DEV) Icon = Palette;
          if (step.id === ProjectStage.VIDEO_GEN) Icon = Film;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 bg-[#0f0f11] px-2">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 shadow-xl ${
                 isCurrent ? 'bg-indigo-600 border-indigo-500 text-white scale-110 shadow-indigo-500/30' : 
                 isCompleted ? 'bg-zinc-900 border-green-500/50 text-green-500' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
               }`}>
                 {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
               </div>
               <div className={`text-center transition-colors ${isCurrent ? 'text-indigo-400 font-bold' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'}`}>
                 <div className="text-xs uppercase tracking-wider mb-0.5">{step.label}</div>
                 <div className="text-[10px] opacity-70 hidden md:block">{step.description}</div>
               </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  if (!hasApiKey) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f0f11] text-zinc-100">
        <div className="text-center space-y-6 max-w-md p-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 backdrop-blur-sm shadow-2xl">
           <h1 className="text-2xl font-bold bg-gradient-to-br from-indigo-400 to-violet-400 bg-clip-text text-transparent">API Access Required</h1>
           <p className="text-zinc-400 text-sm leading-relaxed">
             To use the Google Veo and Gemini models for creative generation, please select a paid API key from your Google Cloud project.
           </p>
           <button 
             onClick={handleSelectKey}
             className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:scale-[1.02]"
           >
             Select API Key
           </button>
           <div className="text-xs text-zinc-500">
             Ensure your project has billing enabled. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-indigo-400 transition-colors">Billing Documentation</a>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f0f11] overflow-hidden text-zinc-100 font-sans selection:bg-indigo-500/30">
      <Sidebar 
        selectedModelId={state.selectedModelId} 
        onSelectModel={handleModelSelect}
        onOpenKeys={() => setShowKeyModal(true)}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Stylish Grid Background */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/0 via-zinc-900/5 to-zinc-900/20 pointer-events-none" />

        <div className="p-8 pb-4 relative z-10">
          {renderFlowchart()}
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-20 relative z-10 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* STAGE 1: INPUT */}
            {(state.currentStage === ProjectStage.INPUT) && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2">开始您的创作</h2>
                  <p className="text-zinc-500">选择您的创作模式：剧本拆解或图片生成视频。</p>
                </div>
                
                {/* Mode Switcher */}
                <div className="flex justify-center mb-6">
                   <div className="bg-zinc-900/80 p-1 rounded-xl flex gap-1 border border-zinc-800">
                      <button 
                        onClick={() => setInputMode('text')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'text' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:text-white'}`}
                      >
                        <span className="flex items-center gap-2"><FileText className="w-4 h-4"/> 剧本/小说</span>
                      </button>
                      <button 
                        onClick={() => setInputMode('image')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'image' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:text-white'}`}
                      >
                         <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4"/> 图片生成视频</span>
                      </button>
                   </div>
                </div>
                
                <div className="glass-panel p-1 rounded-2xl bg-zinc-900/50 border border-zinc-800 shadow-2xl">
                  {inputMode === 'text' ? (
                    <textarea 
                      className="w-full h-72 bg-[#0c0c0e] p-6 rounded-xl resize-none outline-none text-zinc-200 placeholder-zinc-700 transition-all focus:bg-[#121214]"
                      placeholder="在此输入文本..."
                      value={state.rawInput}
                      onChange={(e) => setState(s => ({ ...s, rawInput: e.target.value }))}
                    />
                  ) : (
                    <div className="w-full h-72 bg-[#0c0c0e] rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 relative overflow-hidden">
                       {state.uploadedImage ? (
                         <>
                           <img src={state.uploadedImage} alt="Uploaded" className="absolute inset-0 w-full h-full object-contain bg-black/50" />
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <label className="cursor-pointer px-4 py-2 bg-white/20 backdrop-blur text-white rounded-lg border border-white/20">
                                更换图片
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                              </label>
                           </div>
                         </>
                       ) : (
                         <label className="flex flex-col items-center justify-center cursor-pointer group">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors">
                              <UploadCloud className="w-8 h-8 text-zinc-500 group-hover:text-zinc-300" />
                            </div>
                            <span className="text-zinc-400 font-medium group-hover:text-zinc-200">点击上传图片</span>
                            <span className="text-zinc-600 text-xs mt-1">支持 JPG, PNG, WEBP</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                         </label>
                       )}
                    </div>
                  )}
                </div>

                {inputMode === 'image' && (
                  <div className="mt-4">
                     <input 
                       type="text"
                       placeholder="描述您想生成的视频内容 (例如: 镜头缓慢推进，火焰在燃烧...)"
                       value={state.videoPrompt || ''}
                       onChange={(e) => setState(s => ({...s, videoPrompt: e.target.value}))}
                       className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:border-indigo-500 outline-none"
                     />
                  </div>
                )}
                
                <div className="flex justify-center mt-8">
                  {inputMode === 'text' ? (
                    <button 
                      onClick={handleAnalyze}
                      disabled={state.isProcessing || !state.rawInput}
                      className="group relative px-8 py-4 bg-white text-black rounded-full font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="flex items-center gap-2 relative z-10">
                        {state.isProcessing ? <Loader2 className="animate-spin" /> : <Wand2 />}
                        启动编剧助手 (Analyze)
                      </span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleDirectVideoGen}
                      disabled={state.isProcessing || !state.uploadedImage}
                      className="group relative px-8 py-4 bg-indigo-600 text-white rounded-full font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <span className="flex items-center gap-2 relative z-10">
                        {state.isProcessing ? <Loader2 className="animate-spin" /> : <Film />}
                        直接生成视频 (Generate Video)
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 2: ANALYSIS DISPLAY */}
            {state.currentStage === ProjectStage.ANALYSIS && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                  <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        剧本拆解完成
                      </h3>
                      <p className="text-zinc-500 text-sm mt-1">识别类型: <span className="text-indigo-400 font-mono uppercase bg-indigo-400/10 px-2 py-0.5 rounded">{state.inputType}</span></p>
                    </div>
                    <button 
                      onClick={handleCharacterExtraction}
                      disabled={state.isProcessing}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-indigo-600/20"
                    >
                      {state.isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Users className="w-4 h-4" />}
                      下一步：提取人设 (Extract Characters)
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {state.script.map((seg, i) => (
                      <div key={i} className={`p-5 rounded-xl border border-zinc-800/50 backdrop-blur-sm transition-colors hover:border-zinc-700 ${
                        seg.type === 'scene' ? 'bg-zinc-900/80 border-l-4 border-l-indigo-500' : 
                        seg.type === 'dialogue' ? 'bg-zinc-900/40 ml-8 border-l-4 border-l-emerald-500' : 
                        'bg-zinc-900/60 border-l-4 border-l-amber-500'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                           <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                             seg.type === 'scene' ? 'bg-indigo-500/10 text-indigo-400' : 
                             seg.type === 'dialogue' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                           }`}>{seg.type}</span>
                        </div>
                        <div className="text-zinc-300 leading-relaxed font-light">{seg.content}</div>
                      </div>
                    ))}
                  </div>
               </div>
            )}

            {/* STAGE 3: CHARACTER DESIGN */}
            {state.currentStage === ProjectStage.CHARACTER_DESIGN && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                 <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white">角色定妆 (Character Binding)</h3>
                      <p className="text-zinc-500 text-sm mt-1">美术助手已提取主要角色，请生成视觉设定图。</p>
                    </div>
                    <button 
                      onClick={handleToVisualDev}
                      className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-black rounded-lg transition-all flex items-center gap-2 text-sm font-bold"
                    >
                      下一步：艺术总监 (Next) <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.characters.map((char) => (
                      <div key={char.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-600 transition-all hover:-translate-y-1 duration-300">
                        <div className="aspect-[3/4] bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                          {char.imageUrl ? (
                            <>
                              <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <span className="text-green-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> 已生成</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-6 flex flex-col items-center">
                              <div className="w-16 h-16 bg-zinc-800/50 rounded-full mb-4 flex items-center justify-center border border-zinc-700 dashed">
                                <Users className="text-zinc-600" />
                              </div>
                              <p className="text-xs text-zinc-500">等待生成视觉形象</p>
                            </div>
                          )}
                          
                          <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${char.imageUrl ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                             {char.imageUrl ? (
                               <button 
                                onClick={() => handleGenerateCharImage(char.id)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white rounded-full text-sm flex items-center gap-2"
                               >
                                 <Wand2 className="w-3 h-3"/> 重新生成
                               </button>
                             ) : (
                               <button 
                                onClick={() => handleGenerateCharImage(char.id)}
                                disabled={state.isProcessing}
                                className="px-5 py-2.5 bg-white text-black rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
                               >
                                 {state.isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>} 
                                 生成立绘
                               </button>
                             )}
                          </div>
                        </div>
                        <div className="p-4 bg-zinc-900">
                          <h4 className="font-bold text-lg text-white mb-1">{char.name}</h4>
                          <p className="text-xs text-zinc-500 line-clamp-2">{char.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            )}

            {/* STAGE 4: VISUAL DEV (Place holder for this step in demo flow) */}
            {state.currentStage === ProjectStage.VISUAL_DEV && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 flex flex-col items-center justify-center py-12">
                 <div className="text-center space-y-4 max-w-2xl">
                   <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-orange-500/20">
                     <Palette className="w-10 h-10 text-white" />
                   </div>
                   <h2 className="text-3xl font-bold text-white">艺术总监审核 (Art Direction)</h2>
                   <p className="text-zinc-400">
                     在此阶段，我们将把“剧本分镜”与“角色资产”进行融合 (Compositing)。
                     <br/>确认画面构图、光影基调与镜头语言。
                   </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4 w-full max-w-lg opacity-50 pointer-events-none grayscale">
                    {/* Mockup of compositing */}
                    <div className="h-32 bg-zinc-800 rounded-lg border border-zinc-700"></div>
                    <div className="h-32 bg-zinc-800 rounded-lg border border-zinc-700"></div>
                 </div>

                 <button 
                    onClick={handleGenerateVideo}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg shadow-xl shadow-indigo-600/30 hover:scale-105 transition-all flex items-center gap-3"
                  >
                    <Film className="w-5 h-5" />
                    移交动画师生成视频 (Generate Video)
                  </button>
              </div>
            )}

             {/* STAGE 5: VIDEO / COMPLETE */}
             {(state.currentStage === ProjectStage.VIDEO_GEN || state.currentStage === ProjectStage.COMPLETE) && (
               <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center justify-center min-h-[50vh]">
                  {state.isProcessing ? (
                    <div className="text-center space-y-6">
                      <div className="relative w-32 h-32 mx-auto">
                        <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-4 border-r-4 border-purple-500 rounded-full animate-spin animation-delay-200"></div>
                        <div className="absolute inset-8 border-b-4 border-pink-500 rounded-full animate-spin animation-delay-500"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <Video className="w-8 h-8 text-white animate-pulse" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">正在渲染最终成片...</h3>
                        <p className="text-zinc-400 mt-2">调用引擎: <span className="text-indigo-400">{AVAILABLE_MODELS.find(m => m.id === state.selectedModelId)?.name}</span></p>
                      </div>
                      <div className="max-w-md mx-auto bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 text-xs text-zinc-500 font-mono">
                        > Initializing Model Context...<br/>
                        > Loading Character LoRA...<br/>
                        > Synthesizing Frames...
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-4xl space-y-8 text-center">
                       <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium">
                         <CheckCircle2 className="w-4 h-4" /> 渲染完成 (Render Complete)
                       </div>
                       
                       <div className="relative group rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl bg-black">
                         {state.generatedVideoUrl ? (
                           <video 
                            src={state.generatedVideoUrl} 
                            controls 
                            autoPlay 
                            loop 
                            className="w-full aspect-video bg-black"
                           />
                         ) : (
                           <div className="aspect-video bg-zinc-900 flex items-center justify-center text-zinc-600">
                             Video Generation Failed
                           </div>
                         )}
                       </div>

                       <div className="flex justify-center gap-4">
                         <button 
                           onClick={() => setState(INITIAL_PROJECT_STATE)}
                           className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                         >
                           开始新项目
                         </button>
                         <button className="px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                           下载视频资产 (Download)
                         </button>
                       </div>
                    </div>
                  )}
               </div>
             )}

          </div>
        </div>

        {/* API Key Modal */}
        {showKeyModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-zinc-800">
                <h3 className="text-xl font-bold text-white">模型 API 配置</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  请为每个服务商输入您的私有 API Key。为了安全，Key 仅存储在本地会话中。
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {AVAILABLE_MODELS.filter(m => m.requiresKey).map(model => (
                  <div key={model.id} className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 flex justify-between">
                      {model.name}
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{model.provider}</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="password" 
                        placeholder={`sk-...`}
                        value={apiKeys[model.id] || ''}
                        onChange={(e) => handleKeyChange(model.id, e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                      />
                      <Key className="absolute right-3 top-2.5 w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900/50 rounded-b-2xl">
                <button 
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => setShowKeyModal(false)}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Widget */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
           {isChatOpen && (
             <div className="w-80 h-96 bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="font-bold text-sm text-white">次元助手 (AI Chat)</span>
                   </div>
                   <button onClick={() => setIsChatOpen(false)} className="text-zinc-500 hover:text-white">
                     <X className="w-4 h-4" />
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-900/20">
                   {chatMessages.map(msg => (
                     <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                          msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                        }`}>
                          {msg.text || <div className="flex gap-1 h-5 items-center"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"/><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-100"/><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-200"/></div>}
                        </div>
                     </div>
                   ))}
                   <div ref={chatEndRef} />
                </div>

                <div className="p-3 bg-zinc-900 border-t border-zinc-800">
                   <div className="flex gap-2">
                     <input 
                       className="flex-1 bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                       placeholder="输入消息..."
                       value={chatInput}
                       onChange={e => setChatInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && !isChatTyping && handleSendMessage()}
                     />
                     <button 
                       onClick={handleSendMessage}
                       disabled={isChatTyping || !chatInput.trim()}
                       className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       <Send className="w-4 h-4" />
                     </button>
                   </div>
                </div>
             </div>
           )}

           <button 
             onClick={() => setIsChatOpen(!isChatOpen)}
             className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 ${
               isChatOpen ? 'bg-zinc-800 text-white rotate-90' : 'bg-indigo-600 text-white shadow-indigo-600/30'
             }`}
           >
             {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
           </button>
        </div>

      </main>
    </div>
  );
};

export default App;