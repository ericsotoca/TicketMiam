
import React, { useState, useEffect } from 'react';
import { View, ScanResult, NutriScore, Product } from './types.ts';
import { processReceipt } from './services/geminiService.ts';
import NutriScoreBadge from './components/NutriScoreBadge.tsx';
import NutritionChart from './components/NutritionChart.tsx';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ticketmiam_v2_data');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const calculateGlobalScore = (products: Product[]): NutriScore => {
    if (products.length === 0) return NutriScore.C;
    const scores = { [NutriScore.A]: 4, [NutriScore.B]: 3, [NutriScore.C]: 2, [NutriScore.D]: 1, [NutriScore.E]: 0 };
    const avg = products.reduce((acc, p) => acc + (scores[p.nutriScore] ?? 2), 0) / products.length;
    if (avg >= 3.5) return NutriScore.A;
    if (avg >= 2.5) return NutriScore.B;
    if (avg >= 1.5) return NutriScore.C;
    if (avg >= 0.5) return NutriScore.D;
    return NutriScore.E;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setProgress(20);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      setProgress(50);
      const data = await processReceipt(base64);
      setProgress(90);

      const result: ScanResult = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('fr-FR'),
        storeName: data.storeName,
        products: data.products,
        totalScore: calculateGlobalScore(data.products),
        summary: {
          totalCalories: Math.round(data.products.reduce((acc, p) => acc + p.calories, 0)),
          avgSugar: +(data.products.reduce((acc, p) => acc + (p.sugar || 0), 0) / (data.products.length || 1)).toFixed(1),
          avgSalt: +(data.products.reduce((acc, p) => acc + (p.salt || 0), 0) / (data.products.length || 1)).toFixed(1),
          avgSaturatedFat: +(data.products.reduce((acc, p) => acc + (p.saturatedFat || 0), 0) / (data.products.length || 1)).toFixed(1),
          processedRatio: Math.round((data.products.filter(p => p.isUltraProcessed).length / (data.products.length || 1)) * 100)
        }
      };

      setCurrentResult(result);
      const newHistory = [result, ...history].slice(0, 20);
      setHistory(newHistory);
      localStorage.setItem('ticketmiam_v2_data', JSON.stringify(newHistory));
      setView('result');
    } catch (err) {
      setError("Analyse impossible. Vérifiez la netteté de l'image.");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen space-y-8 animate-fadeIn">
          <div className="w-20 h-20 border-8 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Analyse IA en cours</h2>
            <p className="text-slate-400 font-medium mt-1">Lecture des produits...</p>
          </div>
        </div>
      ) : view === 'home' ? (
        <div className="p-8 space-y-12 max-w-md mx-auto animate-fadeIn">
          <div className="text-center py-10">
            <h1 className="text-6xl font-black tracking-tighter">Ticket<span className="text-emerald-500">Miam</span></h1>
            <p className="text-slate-400 font-medium mt-2">Le scanneur de ticket intelligent</p>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-80 border-4 border-emerald-500 border-dashed rounded-[3rem] bg-white shadow-2xl cursor-pointer hover:bg-emerald-50 transition-all active:scale-95">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4">
              <i className="fas fa-camera text-3xl"></i>
            </div>
            <span className="font-black text-slate-800 text-xl text-center px-6">Scanner mon ticket Intermarché</span>
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
          </label>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Derniers Scans</h3>
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setCurrentResult(h); setView('result'); }} className="flex items-center justify-between p-5 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <NutriScoreBadge score={h.totalScore} size="sm" />
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{h.storeName}</p>
                        <p className="text-[10px] text-slate-300 font-bold">{h.date}</p>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-slate-200"></i>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : currentResult && (
        <div className="max-w-xl mx-auto p-6 space-y-8 animate-fadeIn">
          <header className="flex items-center space-x-4">
            <button onClick={() => setView('home')} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500"><i className="fas fa-arrow-left"></i></button>
            <h1 className="text-2xl font-black text-slate-900 truncate">{currentResult.storeName}</h1>
          </header>

          <section className="bg-white rounded-[3rem] p-10 shadow-2xl text-center space-y-6">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Score Global Panier</p>
            <div className="flex justify-center scale-150 py-4"><NutriScoreBadge score={currentResult.totalScore} size="lg" /></div>
            <div className="grid grid-cols-3 gap-4 pt-4">
               <div className="bg-slate-50 p-4 rounded-3xl">
                  <p className="text-xl font-black text-emerald-500">{currentResult.products.length}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Articles</p>
               </div>
               <div className="bg-slate-50 p-4 rounded-3xl">
                  <p className="text-xl font-black text-indigo-500">{currentResult.summary.processedRatio}%</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Ultra-T</p>
               </div>
               <div className="bg-slate-50 p-4 rounded-3xl">
                  <p className="text-xl font-black text-amber-500">{currentResult.summary.totalCalories}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">kcal tot.</p>
               </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Répartition Macros Moyenne</h3>
             <NutritionChart 
                proteins={currentResult.products.reduce((acc, p) => acc + p.proteins, 0)} 
                carbs={currentResult.products.reduce((acc, p) => acc + p.carbs, 0)} 
                fats={currentResult.products.reduce((acc, p) => acc + p.fats, 0)} 
             />
          </section>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest px-4">Liste des produits décodés</h3>
            {currentResult.products.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-[1.8rem] flex items-center space-x-4 border border-slate-100 shadow-sm transition-all hover:border-emerald-200">
                <NutriScoreBadge score={p.nutriScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{p.name}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[9px] text-slate-300 font-bold italic truncate">"{p.rawName}"</span>
                    {p.isUltraProcessed && <span className="bg-red-50 text-red-500 text-[8px] px-2 py-0.5 rounded-full font-black">NOVA 4</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400">{p.calories}kcal</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-32 left-8 right-8 bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-50 animate-fadeIn">
          <p className="font-bold text-sm">{error}</p>
          <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
};

export default App;
