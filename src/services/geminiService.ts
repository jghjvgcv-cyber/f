import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface MapGroundingResult {
  text: string;
  links: { title: string; uri: string }[];
}

export const queryMapAssistant = async (
  prompt: string,
  location?: { latitude: number; longitude: number }
): Promise<MapGroundingResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: location ? {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        } : undefined
      },
    });

    const text = response.text || "Não foi possível obter uma resposta.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const links = chunks
      .filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        title: chunk.maps.title || "Ver no Mapa",
        uri: chunk.maps.uri
      }));

    return { text, links };
  } catch (error) {
    console.error("Gemini Map Assistant Error:", error);
    throw error;
  }
};
