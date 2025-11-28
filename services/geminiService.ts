import { GoogleGenAI, Type } from "@google/genai";
import { Character, ScriptSegment } from "../types";

// Initialize Gemini
// Note: In a real "User brings own key" app, we would re-init this with the user's key.
// Here we use the env key for the demo functionality, assuming it's injected by the key selection dialog.

// 1. Text Analysis: Identify type and format to script (Chinese Prompt)
export const analyzeAndFormatText = async (text: string): Promise<{ type: 'novel' | 'script' | 'idea', segments: ScriptSegment[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";
  const prompt = `
    你是一个专业的影视编剧助手。请分析用户输入的文本。
    
    任务流程：
    1. 判断文本类型是 'novel' (小说), 'script' (剧本), 还是 'idea' (灵感片段)。
    2. 如果是 'novel' 或 'idea'，请将其改编成标准的影视剧本格式。
    3. 如果是 'script'，请标准化格式。
    4. 将内容拆解为场景 (scene)、对话 (dialogue) 或动作 (action)。
    5. 为每个片段生成一段详细的画面提示词 (visualPrompt)，用于AI生图，提示词请用英文撰写以便模型理解。

    用户文本:
    ${text.substring(0, 5000)}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          inputType: { type: Type.STRING, enum: ['novel', 'script', 'idea'] },
          segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['scene', 'dialogue', 'action'] },
                content: { type: Type.STRING, description: "中文内容" },
                visualPrompt: { type: Type.STRING, description: "English visual prompt for image generation" }
              }
            }
          }
        }
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    type: result.inputType || 'idea',
    segments: result.segments || []
  };
};

// 2. Character Extraction & Binding (Chinese Prompt)
export const extractCharacters = async (segments: ScriptSegment[]): Promise<Character[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const textContext = segments.map(s => s.content).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `基于以下剧本内容，提取主要角色。为每个角色生成详细的外貌描述 (visualPrompt)，用于AI绘画（Stable Diffusion/Midjourney风格），提示词用英文。
    上下文: ${textContext.substring(0, 8000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING, description: "角色中文名" },
            description: { type: Type.STRING, description: "简短中文描述" },
            visualPrompt: { type: Type.STRING, description: "Detailed English visual description: appearance, clothing, style, face" }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

// 3. Image Generation for Characters (Visual Dev)
export const generateCharacterImage = async (char: Character): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Use Gemini Image generation
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: {
      parts: [
        { text: `Character Concept Art, high quality, detailed, white background. ${char.visualPrompt}` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

// 4. Video Generation (Veo)
export const generateVideoScene = async (prompt: string, imageBase64?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  console.log("Starting Veo generation...");
  
  try {
    let operation;
    
    if (imageBase64) {
      // Image-to-Video
       const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
       operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        image: {
          imageBytes: cleanBase64,
          mimeType: 'image/png', 
        },
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
    } else {
      // Text-to-Video
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
    }

    console.log("Veo operation started", operation);

    // Polling
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Polling Veo...", operation.metadata);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    // The URI requires the API key appended to fetch the actual bytes/file
    return `${videoUri}&key=${process.env.API_KEY}`;

  } catch (error) {
    console.error("Veo Error:", error);
    throw error;
  }
};

// 5. Chat Stream
export const getChatResponseStream = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: {
            systemInstruction: "你是一个专业的影视创作助手，名叫'次元助手'。你可以帮助用户构思剧本、解释视频生成技术、提供创意灵感。请用简洁、专业的中文回答。"
        }
    });

    return await chat.sendMessageStream({ message });
};