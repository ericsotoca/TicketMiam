
export enum NutriScore {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  nutriScore: NutriScore;
  isUltraProcessed: boolean; // Equivalent NOVA 4
  calories: number;
  sugar: number;
  salt: number;
  saturatedFat: number;
  proteins: number;
  carbs: number;
  fats: number;
}

export interface ScanResult {
  id: string;
  date: string;
  timestamp: number;
  storeName: string;
  products: Product[];
  totalScore: NutriScore;
  summary: {
    totalCalories: number;
    avgSugar: number;
    avgSalt: number;
    avgSaturatedFat: number;
    processedRatio: number; // Percentage of ultra-processed products
  };
}

export type View = 'home' | 'scan' | 'result' | 'history';
