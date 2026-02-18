
import { GoogleGenAI, Type } from "@google/genai";
import { NutriScore, Product } from "../types";

const PRODUCT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    storeName: { type: Type.STRING, description: "Nom de l'enseigne du magasin" },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nom clair et lisible du produit" },
          quantity: { type: Type.NUMBER, description: "Quantité ou poids approximatif" },
          nutriScore: { type: Type.STRING, description: "Nutri-Score estimé (A, B, C, D, ou E)" },
          isUltraProcessed: { type: Type.BOOLEAN, description: "Vrai si c'est un produit ultra-transformé (NOVA 4)" },
          calories: { type: Type.NUMBER, description: "kcal pour 100g" },
          sugar: { type: Type.NUMBER, description: "Sucre en g pour 100g" },
          salt: { type: Type.NUMBER, description: "Sel en g pour 100g" },
          saturatedFat: { type: Type.NUMBER, description: "Graisses saturées en g pour 100g" },
          proteins: { type: Type.NUMBER, description: "Protéines en g pour 100g" },
          carbs: { type: Type.NUMBER, description: "Glucides en g pour 100g" },
          fats: { type: Type.NUMBER, description: "Lipides en g pour 100g" },
        },
        required: ["name", "nutriScore", "isUltraProcessed", "calories", "sugar", "salt", "saturatedFat", "proteins", "carbs", "fats"]
      }
    }
  },
  required: ["storeName", "products"]
};

export async function processReceipt(base64Image: string): Promise<{ storeName: string, products: Product[] }> {
  // Always use {apiKey: process.env.API_KEY} as a named parameter.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image.split(",")[1] || base64Image,
    },
  };

  const prompt = `Analyse ce ticket de caisse avec précision chirurgicale.
  1. Identifie l'enseigne.
  2. Liste chaque produit alimentaire.
  3. Pour chaque produit, utilise tes connaissances nutritionnelles pour estimer les valeurs (Nutri-Score, NOVA, Macros) pour 100g.
  4. Sois pessimiste sur le Nutri-Score si tu hésites.
  Réponds uniquement au format JSON.`;

  try {
    // FIX: Using gemini-3-flash-preview for general multimodal text extraction tasks.
    // FIX: Request 'contents' structure updated to follow official examples.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: PRODUCT_SCHEMA,
      },
    });

    // FIX: Extract text directly from the response.text property (not a method).
    const result = JSON.parse(response.text || "{}");
    return {
      storeName: result.storeName || "Mon Magasin",
      products: (result.products || []).map((p: any) => ({
        ...p,
        id: Math.random().toString(36).substring(2, 11)
      }))
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Erreur d'analyse. Assurez-vous que le ticket est bien éclairé et lisible.");
  }
}
