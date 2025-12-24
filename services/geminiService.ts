import { GoogleGenAI } from "@google/genai";
import { MealAnalysis, PortionSize } from "../types";

// Helper to validate API key format simply
export const isValidApiKey = (key: string) => key && key.length > 20;

export const analyzeFoodImage = async (
  apiKey: string,
  base64Image: string,
  portionHint?: string
): Promise<MealAnalysis> => {
  if (!apiKey) throw new Error("API Key is required");

  const ai = new GoogleGenAI({ apiKey });

  // Build portion context if user provided a hint
  const portionContext = portionHint
    ? `\n\nIMPORTANT USER-PROVIDED PORTION INFO: The user has specified that their portion is "${portionHint}". Use this information to calculate more accurate nutrition values. Adjust all estimates (calories, carbs, protein, etc.) based on this portion size.`
    : '';

  const prompt = `You are an expert diabetic dietician and AI nutritionist for the 'Dia-Log' application.
Analyze the food image provided and return a detailed JSON object with the following fields:

REQUIRED FIELDS:
- foodName: string (name of the food/dish)
- estimatedCarbs: number (estimated carbohydrates in grams)
- estimatedProtein: number (estimated protein in grams)
- estimatedFat: number (estimated fat in grams)
- estimatedCalories: number (estimated total calories)
- estimatedFiber: number (estimated fiber in grams)
- estimatedSugar: number (estimated sugar in grams)
- glycemicIndex: string (must be one of: "Low", "Medium", or "High")
- prediction: string (2-3 sentences about glucose impact for diabetics)
- healthScore: number (1-10, where 10 is best for diabetics)
- portionSize: string (must be one of: "small", "medium", "large", or "extra-large")
- portionDescription: string (describe the portion, e.g., "1 medium bowl", "2 slices", "1 cup")

IMPORTANT: 
- Return ONLY valid JSON, no markdown, no code blocks, just the raw JSON object.
- Be accurate with carbohydrate and sugar estimates as this is critical for diabetics.
- Consider the visible portion size when estimating nutrition values.${portionContext}

Example response format:
{"foodName": "Grilled Chicken Salad", "estimatedCarbs": 15, "estimatedProtein": 32, "estimatedFat": 12, "estimatedCalories": 295, "estimatedFiber": 4, "estimatedSugar": 5, "glycemicIndex": "Low", "prediction": "This meal will cause a minimal glucose spike due to low carbs and high protein. The fiber content helps slow glucose absorption. Excellent choice for blood sugar control.", "healthScore": 9, "portionSize": "medium", "portionDescription": "1 large plate"}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    let text = response.text;
    if (!text) throw new Error("No response from AI");

    // Clean up the response - remove markdown code blocks if present
    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.slice(7);
    }
    if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    const result = JSON.parse(text) as MealAnalysis;

    // Validate and ensure proper types
    return {
      foodName: result.foodName || "Unknown Food",
      estimatedCarbs: Number(result.estimatedCarbs) || 0,
      estimatedProtein: Number(result.estimatedProtein) || 0,
      estimatedFat: Number(result.estimatedFat) || 0,
      estimatedCalories: Number(result.estimatedCalories) || 0,
      estimatedFiber: Number(result.estimatedFiber) || 0,
      estimatedSugar: Number(result.estimatedSugar) || 0,
      glycemicIndex: validateGlycemicIndex(result.glycemicIndex),
      prediction: result.prediction || "Unable to generate prediction.",
      healthScore: Math.min(10, Math.max(1, Number(result.healthScore) || 5)),
      portionSize: validatePortionSize(result.portionSize),
      portionDescription: result.portionDescription || "1 serving",
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// Validate glycemic index value
const validateGlycemicIndex = (value: string): "Low" | "Medium" | "High" => {
  const normalized = value?.toLowerCase?.();
  if (normalized === "low") return "Low";
  if (normalized === "high") return "High";
  return "Medium";
};

// Validate portion size value
const validatePortionSize = (value: string): PortionSize => {
  const normalized = value?.toLowerCase?.();
  if (normalized === "small") return "small";
  if (normalized === "large") return "large";
  if (normalized === "extra-large") return "extra-large";
  return "medium";
};

export const generateDailyInsight = async (
  apiKey: string,
  logs: any[]
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is required");

  const ai = new GoogleGenAI({ apiKey });

  const logSummary = JSON.stringify(logs.slice(-5)); // Send last 5 logs for context

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a diabetes health coach. Analyze these recent health logs for a diabetic patient: ${logSummary}.
              
Provide a single, actionable, and encouraging insight regarding their glycemic control, stress, or dietary habits.
Keep it under 50 words. Be warm and supportive.`,
            },
          ],
        },
      ],
    });

    return response.text || "Keep tracking your data to see more insights.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insight at this time. Keep logging your health data!";
  }
};