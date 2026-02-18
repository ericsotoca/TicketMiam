
import { createWorker } from 'tesseract.js';
import { NutriScore, Product } from '../types.ts';

/**
 * Nettoie une ligne de ticket pour extraire un nom de produit potentiel
 */
function cleanLine(line: string): string {
  let cleaned = line.replace(/\d+[,.]\d{2}/g, '');
  cleaned = cleaned.replace(/[€$*]|( x\d+)/gi, '');
  cleaned = cleaned.replace(/\b\d{4,}\b/g, ''); 
  cleaned = cleaned.replace(/\b\d+\b/g, '');
  return cleaned.trim();
}

/**
 * Recherche un produit sur l'API publique Open Food Facts
 */
export async function searchProduct(query: string): Promise<Product | null> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) return null;
  
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(trimmedQuery)}&search_simple=1&action=process&json=1&page_size=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.products && data.products.length > 0) {
      const p = data.products[0];
      const nutrients = p.nutriments || {};
      
      const scoreMap: Record<string, NutriScore> = {
        'a': NutriScore.A, 'b': NutriScore.B, 'c': NutriScore.C, 'd': NutriScore.D, 'e': NutriScore.E
      };

      return {
        id: Math.random().toString(36).substring(2, 11),
        name: p.product_name_fr || p.product_name || trimmedQuery,
        quantity: 1,
        nutriScore: scoreMap[p.nutrition_grades] || NutriScore.C,
        isUltraProcessed: p.nova_group === 4,
        calories: Math.round(nutrients['energy-kcal_100g'] || 0),
        sugar: +(nutrients.sugars_100g || 0).toFixed(1),
        salt: +(nutrients.salt_100g || 0).toFixed(1),
        saturatedFat: +(nutrients['saturated-fat_100g'] || 0).toFixed(1),
        proteins: +(nutrients.proteins_100g || 0).toFixed(1),
        carbs: +(nutrients.carbohydrates_100g || 0).toFixed(1),
        fats: +(nutrients.fat_100g || 0).toFixed(1),
      };
    }
  } catch (e) {
    console.error(`Error searching for ${trimmedQuery}`, e);
  }
  return null;
}

/**
 * Processeur local de secours (Tesseract v5)
 */
export async function processReceiptLocally(
  base64Image: string, 
  onProgress: (progress: number) => void
): Promise<{ storeName: string, products: Product[] }> {
  
  const worker = await createWorker('fra', 1, {
    logger: (m: any) => {
      if (m && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const result = await worker.recognize(base64Image);
  await worker.terminate();

  const lines = (result.data as any).lines || [];

  const potentialQueries: string[] = lines
    .map((l: any) => cleanLine(l.text || ""))
    .filter((q: string) => q.length > 4 && !/TOTAL|TVA|EURO|CARTE|MERCI|MAGASIN|REMISE|PAIEMENT|ARTICLES/i.test(q));

  const products: Product[] = [];
  const uniqueQueries: string[] = Array.from(new Set(potentialQueries)).slice(0, 10);
  
  for (const query of uniqueQueries) {
    const product = await searchProduct(query);
    if (product) products.push(product);
  }

  const storeLine = (lines[0] as any)?.text?.trim() || "Magasin Inconnu";

  return {
    storeName: storeLine,
    products
  };
}
