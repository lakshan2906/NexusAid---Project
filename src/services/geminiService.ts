import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

try {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    ai = new GoogleGenAI({ apiKey: key });
  } else {
    console.warn('GEMINI_API_KEY not found. AI features will be unavailable.');
  }
} catch (error) {
  console.error('Failed to initialize AI:', error);
}

export interface EmergencyAnalysis {
  resourcesNeeded: {
    resource: string;
    quantity: string;
  }[];
  peopleAffected: string;
  injuredCount: string;
  location: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  categories: string[];
  recommendedNGO: string;
  allocationHint: string;
  summary: string;
}

export async function parseEmergencySMS(text: string, isOffline: boolean = false): Promise<EmergencyAnalysis> {
  // Offline Fallback Logic
  if (isOffline || !ai) {
    const lowerText = text.toLowerCase();
    const analysis: EmergencyAnalysis = {
      resourcesNeeded: [],
      peopleAffected: "Not specified",
      injuredCount: "Not specified",
      location: "Not specified",
      urgency: 'MEDIUM',
      categories: [],
      recommendedNGO: "General Relief NGO",
      allocationHint: "Offline Mode: Simple keyword matching active. Suggest verifying via mesh voice comms.",
      summary: `OFFLINE_ANALYSIS: ${text.substring(0, 50)}...`
    };

    // Keyword matching
    if (lowerText.includes('food') || lowerText.includes('hungry')) {
      analysis.resourcesNeeded.push({ resource: 'food', quantity: 'Not specified' });
      analysis.categories.push('Food');
    }
    if (lowerText.includes('water') || lowerText.includes('thirsty')) {
      analysis.resourcesNeeded.push({ resource: 'water', quantity: 'Not specified' });
      analysis.categories.push('Water');
    }
    if (lowerText.includes('medical') || lowerText.includes('doctor') || lowerText.includes('blood') || lowerText.includes('hurt')) {
      analysis.resourcesNeeded.push({ resource: 'medical', quantity: 'Not specified' });
      analysis.categories.push('Medical');
      analysis.urgency = 'HIGH';
      analysis.recommendedNGO = "Medical NGO";
    }
    if (lowerText.includes('shelter') || lowerText.includes('house') || lowerText.includes('roof')) {
      analysis.resourcesNeeded.push({ resource: 'shelter', quantity: 'Not specified' });
      analysis.categories.push('Shelter');
    }
    
    if (analysis.categories.length === 0) analysis.categories.push('General Relief');
    
    return analysis;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this emergency disaster message: "${text}"`,
      config: {
        systemInstruction: `You are an AI Disaster Response Assistant. Use advanced NLU to analyze emergency messages and convert them into structured data.
        
Analyze the input message and perform ALL of the following:

1. Extract Information:
- resources needed (food, water, medical, shelter, clothes, etc.)
- quantity (if mentioned)
- number of people affected
- number of injured (if any)
- location (if mentioned)

2. Determine Urgency Level:
- HIGH → injured, trapped, critical, bleeding, unconscious
- MEDIUM → food/water shortage, stranded people
- LOW → non-critical needs (clothes, blankets)

3. Categorize Request:
- Medical, Food, Water, Shelter, Clothes

4. Recommend NGO Type:
- Medical NGO, Food Supply NGO, Shelter NGO, General Relief NGO

5. Provide Smart Allocation Hint:
- Suggest if nearby resources can be used
- Suggest if immediate response is required
- Indicate if multiple NGOs may be needed

6. Generate a Short Summary

Rules:
- Do not add explanations
- Do not return text outside JSON
- If data is missing, use "Not specified"
- Be concise and accurate.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resourcesNeeded: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  resource: { type: Type.STRING },
                  quantity: { type: Type.STRING }
                },
                required: ["resource", "quantity"]
              }
            },
            peopleAffected: { type: Type.STRING },
            injuredCount: { type: Type.STRING },
            location: { type: Type.STRING },
            urgency: { type: Type.STRING },
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedNGO: { type: Type.STRING },
            allocationHint: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["resourcesNeeded", "peopleAffected", "injuredCount", "location", "urgency", "categories", "recommendedNGO", "allocationHint", "summary"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error, falling back to keyword matching:", error);
    return parseEmergencySMS(text, true);
  }
}
