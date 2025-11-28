import { AIModel, ProjectStage } from './types';

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 1, name: "即梦AI (Jimeng)", provider: "ByteDance", type: 'hybrid', requiresKey: true },
  { id: 2, name: "可灵 (Kling)", provider: "Kuaishou", type: 'video', requiresKey: true },
  { id: 3, name: "火山引擎 (Volcano)", provider: "ByteDance", type: 'video', requiresKey: true },
  { id: 4, name: "海螺 (Hailuo)", provider: "MiniMax", type: 'video', requiresKey: true },
  { id: 5, name: "通义万相 (Wanxiang)", provider: "Alibaba", type: 'image', requiresKey: true },
  { id: 6, name: "腾讯混元 (Hunyuan)", provider: "Tencent", type: 'hybrid', requiresKey: true },
  { id: 7, name: "百度绘想 (Baidu)", provider: "Baidu", type: 'image', requiresKey: true },
  { id: 8, name: "Google Veo", provider: "Google", type: 'video', requiresKey: false }, // Demo model
  { id: 9, name: "Runway Gen-3", provider: "Runway", type: 'video', requiresKey: true },
  { id: 10, name: "Luma Dream Machine", provider: "Luma", type: 'video', requiresKey: true },
];

export const WORKFLOW_STEPS = [
  { id: ProjectStage.INPUT, label: "用户输入", description: "小说 / 剧本 / 灵感" },
  { id: ProjectStage.ANALYSIS, label: "编剧助手", description: "格式化与分镜" },
  { id: ProjectStage.CHARACTER_DESIGN, label: "美术助手", description: "人设与概念图" },
  { id: ProjectStage.VISUAL_DEV, label: "艺术总监", description: "融图与构图" },
  { id: ProjectStage.VIDEO_GEN, label: "动画师", description: "视频生成" },
];

export const INITIAL_PROJECT_STATE = {
  rawInput: '',
  inputType: null,
  script: [],
  characters: [],
  selectedModelId: 8, // Default to Google Veo for demo functionality
  currentStage: ProjectStage.INPUT,
  isProcessing: false,
};