export interface AIModel {
  id: number;
  name: string;
  provider: string;
  type: 'video' | 'image' | 'text' | 'hybrid';
  requiresKey: boolean;
}

export enum ProjectStage {
  INPUT = 'INPUT',
  ANALYSIS = 'ANALYSIS', // Script Assistant (编剧助手)
  CHARACTER_DESIGN = 'CHARACTER_DESIGN', // Art Assistant (美术助手)
  VISUAL_DEV = 'VISUAL_DEV', // Art Director (艺术总监)
  VIDEO_GEN = 'VIDEO_GEN', // Animator (动画师)
  COMPLETE = 'COMPLETE'
}

export interface Character {
  id: string;
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl?: string;
}

export interface ScriptSegment {
  id: string;
  type: 'scene' | 'dialogue' | 'action';
  content: string;
  visualPrompt?: string;
}

export interface ProjectState {
  rawInput: string;
  inputType: 'novel' | 'script' | 'idea' | null;
  script: ScriptSegment[];
  characters: Character[];
  selectedModelId: number;
  currentStage: ProjectStage;
  isProcessing: boolean;
  generatedVideoUrl?: string;
  // New fields for Image-to-Video flow
  uploadedImage?: string; 
  videoPrompt?: string;
}

export interface ApiKeyConfig {
  [modelId: number]: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}