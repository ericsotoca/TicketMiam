
import { GoogleGenAI, Type } from "@google/genai";
import { NutriScore, Product } from "../types.ts";

const PRODUCT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    storeName: { type: Type.STRING, description: "Nom de l'enseigne (ex: Intermarché)" },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nom complet décodé (ex: 'Jambon' pour 'JBN')" },
          rawName: { type: Type.STRING, description: "Texte exact tel qu'écrit sur le ticket" },
          nutriScore: { type: Type.STRING, description: "Score A, B, C, D ou E" },
          isUltraProcessed: { type: Type.BOOLEAN, description: "Vrai si NOVA 4" },
          calories: { type: Type.NUMBER, description: "kcal/100g" },
          proteins: { type: Type.NUMBER, description: "g/100g" },
          carbs: { type: Type.NUMBER, description: "g/100g" },
          fats: { type: Type.NUMBER, description: "g/100g" },
          sugar: { type: Type.NUMBER },
          salt: { type: Type.NUMBER },
          saturatedFat: { type: Type.NUMBER }
        },
        required: ["name", "rawName", "nutriScore", "isUltraProcessed", "calories", "proteins", "carbs", "fats"]
      }
    }
  },
  required: ["storeName", "products"]
};

export async function processReceipt(base64Image: string): Promise<{ storeName: string, products: Product[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image.split(",")[1] || base64Image,
    },
  };

  const prompt = `Tu es un expert en tickets de caisse de supermarchés français (Intermarché, Leclerc, Carrefour). 
  Analyse cette image et extrais CHAQUE ligne de produit alimentaire.
  
  IMPORTANT : 
  - Décode les abréviations : "JBN" -> Jambon, "COL ALASK" -> Colin d'Alaska, "CHOC.LAIT" -> Chocolat au lait, "TRANCH" -> Tranches.
  - "BOITE X20 NEIGE" correspond à des œufs.
  - Identifie les marques distributeurs : "Top Budget", "Pâturages", "Chabrior", "Paquito".
  - Pour chaque produit, utilise tes connaissances nutritionnelles pour estimer les macros/100g.
  - Ignore les lignes de prix, totaux, et articles non-alimentaires (sacs, piles).
  
  Réponds uniquement au format JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: PRODUCT_SCHEMA,
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      storeName: result.storeName || "Supermarché",
      products: (result.products || []).map((p: any) => ({
        ...p,
        id: Math.random().toString(36).substring(2, 11),
        quantity: 1, // Par défaut
        sugar: p.sugar || 0,
        salt: p.salt || 0,
        saturatedFat: p.saturatedFat || 0
      }))
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Erreur d'analyse. Photo trop floue ou problème réseau.");
  }
}
