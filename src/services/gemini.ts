import { GoogleGenAI, Type } from "@google/genai";

export interface GeminiMetadata {
  primary_subject: string;
  secondary_context: string;
  asset_family: string;
  title: string;
  filename_base: string;
  category: string;
  top_keywords: string[];
  supporting_keywords: string[];
}

export type ApiKeyStatus = 'valid' | 'invalid' | 'quota_exhausted' | 'error';

export const validateApiKey = async (apiKey: string): Promise<ApiKeyStatus> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "test"
    });
    return 'valid';
  } catch (error: any) {
    console.error("API Key Validation Error:", error);
    const errStr = JSON.stringify(error);
    const errMsg = (error?.message || "").toLowerCase();
    const errStatus = (error?.status || "").toString().toLowerCase();
    const errCode = (error?.code || "").toString();
    
    if (
      errStr.includes("429") || 
      errStr.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("429") || 
      errMsg.includes("quota") ||
      errStatus.includes("resource_exhausted") ||
      errCode === "429"
    ) {
      return 'quota_exhausted';
    }
    if (
      errStr.includes("API_KEY_INVALID") || 
      errMsg.includes("invalid api key") || 
      errMsg.includes("api_key_invalid") ||
      errStatus.includes("invalid_argument")
    ) {
      return 'invalid';
    }
    return 'error';
  }
};

export const analyzeImageForMetadata = async (base64Image: string, mimeType: string, apiKey?: string): Promise<GeminiMetadata> => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI API Key is missing. Please provide a key in settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: "Analyze this image for microstock metadata generation.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: `You are generating Adobe Stock / Shutterstock style metadata.
Be literal, concise, and image-grounded.
Do not use promotional language.
Do not mention quality claims like premium, professional, high resolution, photorealistic photo.
Do not invent unsupported details.

Return strict JSON only with these fields:
{
  "primary_subject": string,
  "secondary_context": string,
  "asset_family": string,
  "title": string,
  "filename_base": string,
  "category": string,
  "top_keywords": string[],
  "supporting_keywords": string[]
}

Rules:
- title must be literal, subject-first, concise, and buyer-search friendly
- filename_base must match the title semantically
- top_keywords must contain the 10 strongest buyer-search terms
- supporting_keywords must remain visually relevant
- no brands
- no trademarks
- no timestamps
- no prompt residue
- no filler words like premium, professional, marketing, commercial use
- only output valid JSON`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primary_subject: { type: Type.STRING },
            secondary_context: { type: Type.STRING },
            asset_family: { type: Type.STRING },
            title: { type: Type.STRING },
            filename_base: { type: Type.STRING },
            category: { type: Type.STRING },
            top_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            supporting_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["primary_subject", "secondary_context", "asset_family", "title", "filename_base", "category", "top_keywords", "supporting_keywords"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from GEMINI");
    }

    return JSON.parse(resultText) as GeminiMetadata;
  } catch (error: any) {
    console.error("GEMINI Analysis Error:", error);
    const errStr = JSON.stringify(error);
    const errMsg = (error?.message || "").toLowerCase();
    const errStatus = (error?.status || "").toString().toLowerCase();
    const errCode = (error?.code || "").toString();
    
    // Handle specific error codes if possible
    if (
      errStr.includes("429") || 
      errStr.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("429") || 
      errMsg.includes("quota") ||
      errStatus.includes("resource_exhausted") ||
      errCode === "429"
    ) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    if (
      errStr.includes("API_KEY_INVALID") || 
      errMsg.includes("invalid api key") || 
      errMsg.includes("api_key_invalid") ||
      errStatus.includes("invalid_argument")
    ) {
      throw new Error("INVALID_API_KEY");
    }
    
    throw error;
  }
};
