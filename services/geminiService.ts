
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getWidgetAIAssistance = async (description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Given this widget description: "${description}", suggest 3 catchy call-to-action titles and 1 supportive sentence to increase conversion.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            description: { type: Type.STRING }
          },
          required: ["titles", "description"]
        }
      }
    });
    
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Assistance Error:", error);
    return null;
  }
};

export const simulateTelegramSubmission = async (widgetName: string, channel: string, value: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Simulate a Telegram Bot notification for a new feedback submission.
      Widget: ${widgetName}
      Channel: ${channel}
      Value: ${value}
      Format the output as a professional Telegram message with emojis.`,
    });
    return response.text;
  } catch (error) {
    return `🚀 New Submission!\n\nWidget: ${widgetName}\nChannel: ${channel}\nContact: ${value}`;
  }
};
