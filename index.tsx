
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createWorker } from 'tesseract.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// --- TYPES & ENUMS ---
const NutriScore = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' };

// --- GEMINI SERVICE ---
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
          quantity: { type: Type.NUMBER },
          nutriScore: { type: Type.STRING },
          isUltraProcessed: { type: Type.BOOLEAN },
          calories: { type: Type.NUMBER },
          sugar: { type: Type.NUMBER },
          salt: { type: Type.NUMBER },
          saturatedFat: { type: Type.NUMBER },
          proteins: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
        },
        required: ["name", "nutriScore", "isUltraProcessed", "calories", "sugar", "salt", "saturatedFat", "proteins", "carbs", "fats"]
      }
    }
  },
  required: ["storeName", "products"]
};

async function processReceipt(base64Image) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = { inlineData: { mimeType: "image/jpeg", data: base64Image.split(",")[1] || base64Image } };
  const prompt = `Analyse ce ticket de caisse. Identifie l'enseigne et les produits. Estime Nutri-Score, NOVA, Macros pour 100g. Réponds en JSON.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: { responseMimeType: "application/json", responseSchema: PRODUCT_SCHEMA },
  });

  const result = JSON.parse(response.text || "{}");
  return {
    storeName: result.storeName || "Mon Magasin",
    products: (result.products || []).map(p => ({ ...p, id: Math.random().toString(36).substring(2, 11) }))
  };
}

// --- COMPONENTS ---
const NutriScoreBadge = ({ score, size = 'md' }) => {
  const config = {
    A: { color: 'bg-emerald-600', text: 'text-white' },
    B: { color: 'bg-green-500', text: 'text-white' },
    C: { color: 'bg-yellow-400', text: 'text-black' },
    D: { color: 'bg-orange-500', text: 'text-white' },
    E: { color: 'bg-red-600', text: 'text-white' },
  };
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-10 h-10 text-lg', lg: 'w-16 h-16 text-3xl' };
  return (
    <div className={`${config[score]?.color || 'bg-slate-200'} ${config[score]?.text || 'text-slate-500'} ${sizes[size]} rounded-lg flex items-center justify-center font-bold shadow-sm`}>
      {score}
    </div>
  );
};

const NutritionChart = ({ proteins, carbs, fats }) => {
  const total = proteins + carbs + fats;
  const data = total === 0 ? [{ name: 'N/A', value: 1, color: '#f1f5f9' }] : [
    { name: 'Protéines', value: proteins, color: '#10b981' },
    { name: 'Glucides', value: carbs, color: '#3b82f6' },
    { name: 'Lipides', value: fats, color: '#f59e0b' },
  ];
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
            {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
          </Pie>
          <RechartsTooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [view, setView] = useState('home');
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('ticketmiam_v1');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const calculateGlobalScore = (products) => {
    if (!products || products.length === 0) return 'C';
    const scores = { A: 4, B: 3, C: 2, D: 1, E: 0 };
    const avg = products.reduce((acc, p) => acc + (scores[p.nutriScore] ?? 2), 0) / products.length;
    if (avg >= 3.5) return 'A';
    if (avg >= 2.5) return 'B';
    if (avg >= 1.5) return 'C';
    if (avg >= 0.5) return 'D';
    return 'E';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true); setView('scan'); setProgress(20); setError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const data = await processReceipt(base64);
      const result = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        storeName: data.storeName,
        products: data.products,
        totalScore: calculateGlobalScore(data.products),
        summary: {
          totalCalories: Math.round(data.products.reduce((acc, p) => acc + p.calories, 0)),
          avgSugar: +(data.products.reduce((acc, p) => acc + p.sugar, 0) / (data.products.length || 1)).toFixed(1),
          processedRatio: Math.round((data.products.filter(p => p.isUltraProcessed).length / (data.products.length || 1)) * 100)
        }
      };
      setCurrentResult(result);
      const newHistory = [result, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('ticketmiam_v1', JSON.stringify(newHistory));
      setView('result');
    } catch (err) {
      setError("Analyse impossible. Vérifiez votre connexion.");
      setView('home');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full"></div>
          <h2 className="text-xl font-black text-emerald-600 uppercase tracking-widest">Analyse...</h2>
        </div>
      ) : (
        <>
          {view === 'home' && (
            <div className="space-y-12 py-10 animate-fadeIn">
              <header className="text-center space-y-2">
                <h1 className="text-5xl font-black tracking-tighter text-slate-900">TicketMiam</h1>
                <p className="text-slate-400 font-medium">Scannez. Analysez. Mangez mieux.</p>
              </header>
              <label className="flex flex-col items-center justify-center w-full h-80 border-4 border-emerald-500 border-dashed rounded-[3rem] bg-white shadow-2xl cursor-pointer hover:bg-emerald-50 transition-all">
                <i className="fas fa-camera text-4xl text-emerald-500 mb-4"></i>
                <span className="font-bold text-slate-700">Scanner un ticket</span>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
              </label>
              {history.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Derniers tickets</h3>
                  {history.slice(0, 3).map(h => (
                    <div key={h.id} onClick={() => { setCurrentResult(h); setView('result'); }} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <NutriScoreBadge score={h.totalScore} size="sm" />
                        <span className="font-bold text-sm">{h.storeName}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-300">{h.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'result' && currentResult && (
            <div className="space-y-8 animate-fadeIn">
              <button onClick={() => setView('home')} className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500"><i className="fas fa-arrow-left"></i></button>
              <section className="bg-white rounded-[2.5rem] p-8 shadow-xl text-center space-y-6">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Qualité du Panier</p>
                <div className="flex justify-center scale-150 py-4"><NutriScoreBadge score={currentResult.totalScore} size="lg" /></div>
                <h2 className="text-2xl font-black">{currentResult.storeName}</h2>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Sucre</p>
                    <p className="font-bold text-sm text-orange-500">{currentResult.summary.avgSugar}g</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Kcal</p>
                    <p className="font-bold text-sm text-indigo-500">{currentResult.summary.totalCalories}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Ultra-T</p>
                    <p className="font-bold text-sm text-red-500">{currentResult.summary.processedRatio}%</p>
                  </div>
                </div>
              </section>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                <NutritionChart 
                  proteins={currentResult.products.reduce((acc, p) => acc + p.proteins, 0)} 
                  carbs={currentResult.products.reduce((acc, p) => acc + p.carbs, 0)} 
                  fats={currentResult.products.reduce((acc, p) => acc + p.fats, 0)} 
                />
              </div>
              <div className="space-y-3">
                {currentResult.products.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center space-x-4 border border-slate-100 shadow-sm">
                    <NutriScoreBadge score={p.nutriScore} size="sm" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 leading-tight">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{p.calories} kcal</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="fixed top-6 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-50 animate-fadeIn">
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
};

// Montage final
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
