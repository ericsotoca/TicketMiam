
import { GoogleGenAI, Type } from "@google/genai";
import { NutriScore, Product } from "../types.ts";

const PRODUCT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    storeName: { type: Type.STRING, description: "Nom de l'enseigne" },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nom décodé (ex: 'Oeufs de poule' pour 'BOITE X20 NEIGE')" },
          rawName: { type: Type.STRING, description: "Texte exact du ticket" },
          nutriScore: { type: Type.STRING, description: "Score A, B, C, D ou E" },
          isUltraProcessed: { type: Type.BOOLEAN },
          calories: { type: Type.NUMBER },
          proteins: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
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
  // Utilisation directe de process.env.API_KEY comme requis
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image.split(",")[1] || base64Image,
    },
  };

  const prompt = `Analyse ce ticket Intermarché. 
  Extraits chaque produit alimentaire et décode les abréviations :
  - "BOITE X20 NEIGE" -> 20 Oeufs frais (Nutri-Score A, 13g prot/100g).
  - "WASA AUTHENTIQUE" -> Cracker de seigle.
  - "PAQUITO FRAMBOISE" -> Confiture ou Coulis.
  - "IDS HOUMOUS" -> Houmous.
  - "PSDT BUCHE CHEVRE" -> Bûche de chèvre (Pâturages).
  - "TOP BUDGET CHOC.LAIT" -> Chocolat au lait.
  - "PATURAGES ROQUEFORT" -> Fromage Roquefort.
  - "CHABRIOR EXTRA MOELN" -> Pain de mie extra moelleux.
  - "T.BUDGET COL ALASK" -> Colin d'Alaska.
  
  Fournis les valeurs nutritionnelles moyennes pour 100g de chaque produit identifié.
  Ignore le montant total (32.21 EUR) et les frais de service.
  Réponds en JSON uniquement.`;

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
      storeName: result.storeName || "Intermarché",
      products: (result.products || []).map((p: any) => ({
        ...p,
        id: Math.random().toString(36).substring(2, 11),
        quantity: 1,
        sugar: p.sugar || 0,
        salt: p.salt || 0,
        saturatedFat: p.saturatedFat || 0
      }))
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}
