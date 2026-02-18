
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// --- TYPES & ENUMS ---
enum NutriScore { A = 'A', B = 'B', C = 'C', D = 'D', E = 'E' }

interface Product {
  id: string;
  name: string;
  rawName: string;
  nutriScore: NutriScore;
  isUltraProcessed: boolean;
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
  sugar?: number;
  salt?: number;
}

interface ScanResult {
  id: string;
  date: string;
  storeName: string;
  products: Product[];
  totalScore: NutriScore;
}

// --- CONFIGURATION GEMINI ---
const PRODUCT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    storeName: { type: Type.STRING },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          rawName: { type: Type.STRING },
          nutriScore: { type: Type.STRING },
          isUltraProcessed: { type: Type.BOOLEAN },
          calories: { type: Type.NUMBER },
          proteins: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER }
        },
        required: ["name", "rawName", "nutriScore", "isUltraProcessed", "calories", "proteins", "carbs", "fats"]
      }
    }
  },
  required: ["storeName", "products"]
};

// --- COMPOSANTS UI ---
const NutriScoreBadge = ({ score, size = 'md' }: { score: NutriScore, size?: 'sm' | 'md' | 'lg' }) => {
  const colors = { A: 'nutri-a', B: 'nutri-b', C: 'nutri-c', D: 'nutri-d', E: 'nutri-e' };
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-10 h-10 text-lg', lg: 'w-16 h-16 text-3xl' };
  return (
    <div className={`${colors[score] || 'bg-slate-200'} text-white ${sizes[size]} rounded-lg flex items-center justify-center font-black shadow-sm transition-transform`}>
      {score}
    </div>
  );
};

const NutritionChart = ({ data }: { data: any[] }) => (
  <div className="h-64 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" animationDuration={800}>
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

// --- APPLICATION ---
const App = () => {
  const [view, setView] = useState<'home' | 'result'>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [current, setCurrent] = useState<ScanResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tm_v5_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) { console.error(e); }
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((r) => {
        reader.onload = () => r(reader.result as string);
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64.split(",")[1] } },
            { text: `Analyse ce ticket Intermarché. Décode les abréviations :
              - BOITE X20 NEIGE = 20 Oeufs Score A.
              - PSDT = Pâturages.
              - T.BUDGET = Top Budget.
              Extraits le nom du magasin et chaque produit alimentaire avec son Nutri-Score (A-E) et ses macros pour 100g.` 
            }
          ]
        },
        config: { responseMimeType: "application/json", responseSchema: PRODUCT_SCHEMA }
      });

      const data = JSON.parse(response.text || "{}");
      const scoreValues = { A: 4, B: 3, C: 2, D: 1, E: 0 };
      const prods = data.products || [];
      const avg = prods.reduce((acc: number, p: any) => acc + (scoreValues[p.nutriScore as keyof typeof scoreValues] ?? 2), 0) / (prods.length || 1);
      
      const global = avg >= 3.5 ? NutriScore.A : avg >= 2.5 ? NutriScore.B : avg >= 1.5 ? NutriScore.C : avg >= 0.5 ? NutriScore.D : NutriScore.E;

      const result: ScanResult = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('fr-FR'),
        storeName: data.storeName || "Intermarché",
        products: prods.map((p: any) => ({ ...p, id: Math.random().toString(36).substr(2, 9) })),
        totalScore: global
      };

      setCurrent(result);
      const newHistory = [result, ...history].slice(0, 15);
      setHistory(newHistory);
      localStorage.setItem('tm_v5_history', JSON.stringify(newHistory));
      setView('result');
    } catch (err) {
      alert("Erreur lors de l'analyse. Vérifiez votre connexion et la netteté de la photo.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!current) return [];
    const p = current.products.reduce((acc, curr) => acc + (curr.proteins || 0), 0);
    const c = current.products.reduce((acc, curr) => acc + (curr.carbs || 0), 0);
    const f = current.products.reduce((acc, curr) => acc + (curr.fats || 0), 0);
    return [
      { name: 'Protéines', value: Math.round(p), color: '#10b981' },
      { name: 'Glucides', value: Math.round(c), color: '#3b82f6' },
      { name: 'Lipides', value: Math.round(f), color: '#f59e0b' }
    ];
  }, [current]);

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-slate-900 text-white animate-fadeIn">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-8"></div>
      <h2 className="text-2xl font-black italic">Décodage IA...</h2>
      <p className="text-slate-400 mt-2 text-center text-sm">Gemini identifie vos articles Intermarché</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen p-6 pb-32 animate-fadeIn bg-slate-50">
      {view === 'home' ? (
        <div className="space-y-12 py-10">
          <header className="text-center">
            <h1 className="text-6xl font-black tracking-tighter text-slate-900 leading-none italic">Ticket<br/><span className="text-emerald-500">Miam</span></h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4">Analyse Nutritionnelle IA</p>
          </header>

          <label className="flex flex-col items-center justify-center w-full h-80 border-4 border-emerald-500 border-dashed rounded-[3.5rem] bg-white shadow-2xl cursor-pointer hover:bg-emerald-50 transition-all active:scale-95 group">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4">
              <i className="fas fa-camera text-3xl"></i>
            </div>
            <span className="font-black text-slate-800 text-xl">Scanner un ticket</span>
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleUpload} />
          </label>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Dernières courses</h3>
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setCurrent(h); setView('result'); }} className="flex items-center justify-between p-5 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <NutriScoreBadge score={h.totalScore} size="sm" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 text-sm truncate w-32">{h.storeName}</span>
                        <span className="text-[10px] text-slate-300 font-bold">{h.date}</span>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-200"></i>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : current && (
        <div className="space-y-6">
          <button onClick={() => setView('home')} className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-400"><i className="fas fa-arrow-left"></i></button>
          
          <section className="bg-white rounded-[3rem] p-10 shadow-2xl text-center space-y-4 border border-slate-100">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Score Global du Panier</p>
            <div className="flex justify-center scale-150 py-4"><NutriScoreBadge score={current.totalScore} size="lg" /></div>
            <h2 className="text-2xl font-black text-slate-900">{current.storeName}</h2>
          </section>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition Macronutriments</h3>
             <NutritionChart data={chartData} />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest px-4">Détails articles</h3>
            {current.products.map((p) => (
              <div key={p.id} className="bg-white p-4 rounded-3xl flex items-center space-x-4 border border-slate-100 shadow-sm">
                <NutriScoreBadge score={p.nutriScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate uppercase tracking-tighter">{p.name}</p>
                  <p className="text-[9px] text-slate-300 font-bold italic truncate">"{p.rawName}"</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-slate-900">{p.calories}kcal</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-8 left-8 right-8 bg-white/90 backdrop-blur-md px-10 py-5 flex justify-around items-center rounded-full shadow-2xl z-50 border border-slate-100">
        <button onClick={() => setView('home')} className={`text-2xl ${view === 'home' ? 'text-emerald-500' : 'text-slate-300'}`}><i className="fas fa-home"></i></button>
        <label className="bg-emerald-500 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer transform -translate-y-8 active:scale-90 transition-all border-4 border-slate-50">
          <i className="fas fa-plus text-xl"></i>
          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleUpload} />
        </label>
        <button onClick={() => { if(confirm("Supprimer l'historique ?")) { localStorage.clear(); setHistory([]); setView('home'); }}} className="text-2xl text-slate-300"><i className="fas fa-trash"></i></button>
      </nav>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
