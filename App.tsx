
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

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const data = await processReceipt(base64);

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
    } catch (err: any) {
      console.error(err);
      setError(err.message?.includes('process is not defined') 
        ? "Erreur technique : Le navigateur bloque l'accès à l'IA. Rechargez la page." 
        : "Erreur d'analyse. Assurez-vous d'être bien éclairé.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen space-y-8 animate-fadeIn">
          <div className="w-20 h-20 border-8 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="text-center px-8">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Analyse Intermarché...</h2>
            <p className="text-slate-400 font-medium mt-1 italic">Gemini décode vos articles "Pâturages" et "Top Budget"</p>
          </div>
        </div>
      ) : view === 'home' ? (
        <div className="p-8 space-y-12 max-w-md mx-auto animate-fadeIn">
          <div className="text-center py-10">
            <h1 className="text-6xl font-black tracking-tighter italic">Ticket<span className="text-emerald-500">Miam</span></h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Intelligence Artificielle Nutritionnelle</p>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-80 border-4 border-emerald-500 border-dashed rounded-[3.5rem] bg-white shadow-2xl cursor-pointer hover:bg-emerald-50 transition-all active:scale-95 group">
            <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform">
              <i className="fas fa-camera text-4xl"></i>
            </div>
            <span className="font-black text-slate-800 text-xl text-center px-8">Scanner un ticket</span>
            <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Fonctionne avec Intermarché</p>
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
          </label>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Historique des courses</h3>
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setCurrentResult(h); setView('result'); }} className="flex items-center justify-between p-5 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <NutriScoreBadge score={h.totalScore} size="sm" />
                      <div>
                        <p className="font-bold text-slate-800 text-sm truncate w-32">{h.storeName}</p>
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

          <section className="bg-white rounded-[3.5rem] p-10 shadow-2xl text-center space-y-6 border border-slate-100">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Santé Globale du Panier</p>
            <div className="flex justify-center scale-150 py-4"><NutriScoreBadge score={currentResult.totalScore} size="lg" /></div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
               <div>
                  <p className="text-xl font-black text-emerald-500">{currentResult.products.length}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Produits</p>
               </div>
               <div>
                  <p className="text-xl font-black text-indigo-500">{currentResult.summary.processedRatio}%</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">NOVA 4</p>
               </div>
               <div>
                  <p className="text-xl font-black text-amber-500">{currentResult.summary.totalCalories}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Kcal tot.</p>
               </div>
            </div>
          </section>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Répartition Macronutriments</h3>
             <NutritionChart 
                proteins={currentResult.products.reduce((acc, p) => acc + (p.proteins || 0), 0)} 
                carbs={currentResult.products.reduce((acc, p) => acc + (p.carbs || 0), 0)} 
                fats={currentResult.products.reduce((acc, p) => acc + (p.fats || 0), 0)} 
             />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest px-4">Détails par article</h3>
            {currentResult.products.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-[2rem] flex items-center space-x-4 border border-slate-100 shadow-sm transition-all hover:border-emerald-200">
                <NutriScoreBadge score={p.nutriScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{p.name}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[9px] text-slate-300 font-bold italic">ticket: "{p.rawName}"</span>
                    {p.isUltraProcessed && <span className="bg-red-50 text-red-500 text-[8px] px-2 py-0.5 rounded-full font-black">NOVA 4</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{p.calories}kcal</p>
                  <p className="text-[8px] font-bold text-slate-300">/100g</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-8 left-8 right-8 bg-red-600 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between z-[100] animate-fadeIn">
          <div className="flex items-center space-x-3">
            <i className="fas fa-exclamation-triangle"></i>
            <p className="font-bold text-sm leading-tight">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
        </div>
      )}

      <nav className="fixed bottom-8 left-8 right-8 bg-white/80 backdrop-blur-xl px-10 py-5 flex justify-around items-center rounded-full shadow-2xl z-50 border border-white/20">
        <button onClick={() => setView('home')} className={`text-2xl transition-colors ${view === 'home' ? 'text-emerald-500' : 'text-slate-300'}`}><i className="fas fa-th-large"></i></button>
        <label className="bg-emerald-500 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer transform -translate-y-8 active:scale-90 transition-all border-4 border-slate-50">
          <i className="fas fa-plus text-xl"></i>
          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
        </label>
        <button onClick={() => { if(confirm("Vider l'historique ?")) { localStorage.clear(); setHistory([]); setView('home'); } }} className="text-2xl text-slate-300 hover:text-red-400 transition-colors"><i className="fas fa-trash-alt"></i></button>
      </nav>
    </div>
  );
};

export default App;
