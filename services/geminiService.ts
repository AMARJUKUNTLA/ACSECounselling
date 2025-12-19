
import { GoogleGenAI, Type } from "@google/genai";
import { Student } from "../types";

export const getGeminiInsights = async (students: Student[], query: string): Promise<string> => {
  // Use named parameter for apiKey as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Create a compact version of data for Gemini to avoid token limits
  const dataSummary = students.slice(0, 50).map(s => ({
    name: s.name,
    reg: s.regNo,
    branch: s.branch,
    year: s.year
  }));

  // Always use generateContent for standard text generation tasks.
  // We remove maxOutputTokens as it's optional and can block output in thinking models if set without a thinkingBudget.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      You are an AI Education Assistant. Below is a subset of student data:
      ${JSON.stringify(dataSummary)}
      
      The user is asking: "${query}"
      
      Based on the full dataset (of which you see a preview), explain how to find this or provide general insights. 
      Keep it brief and professional.
    `,
    config: {
      temperature: 0.7,
    }
  });

  // Access the text property directly (it's not a method).
  return response.text || "I couldn't generate insights at this time.";
};
