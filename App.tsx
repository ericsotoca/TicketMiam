
import React, { useState, useEffect } from 'react';
import { View, ScanResult, NutriScore, Product } from './types.ts';
import { searchProduct, processReceiptLocally } from './services/receiptProcessor.ts';
import { processReceipt } from './services/geminiService.ts';
import NutriScoreBadge from './components/NutriScoreBadge.tsx';
import NutritionChart from './components/NutritionChart.tsx';
import TrendsChart from './components/TrendsChart.tsx';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ticketmiam_final_v1');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load history from localStorage", e);
    }
  }, []);

  // Sécurité supplémentaire : si le rendu crash, on affiche un message simple
  if (error && view === 'home' && history.length === 0 && !isLoading) {
    console.log("Current state error:", error);
  }

  const calculateGlobalScore = (products: Product[]): NutriScore => {
    if (!products || products.length === 0) return NutriScore.C;
    const scores = { [NutriScore.A]: 4, [NutriScore.B]: 3, [NutriScore.C]: 2, [NutriScore.D]: 1, [NutriScore.E]: 0 };
    const avg = products.reduce((acc, p) => acc + (scores[p.nutriScore] ?? 2), 0) / products.length;
    if (avg >= 3.5) return NutriScore.A;
    if (avg >= 2.5) return NutriScore.B;
    if (avg >= 1.5) return NutriScore.C;
    if (avg >= 0.5) return NutriScore.D;
    return NutriScore.E;
  };

  const toggleNutriScore = (id: string) => {
    if (!currentResult) return;
    const scores = [NutriScore.A, NutriScore.B, NutriScore.C, NutriScore.D, NutriScore.E];
    const updatedProducts = currentResult.products.map(p => {
      if (p.id === id) {
        const currentIndex = scores.indexOf(p.nutriScore);
        const nextIndex = (currentIndex + 1) % scores.length;
        return { ...p, nutriScore: scores[nextIndex] };
      }
      return p;
    });
    updateResultState(updatedProducts);
  };

  const updateResultState = (updatedProducts: Product[]) => {
    if (!currentResult) return;
    const totalScore = calculateGlobalScore(updatedProducts);
    const count = updatedProducts.length || 1;
    const summary = {
      totalCalories: Math.round(updatedProducts.reduce((acc, p) => acc + (p.calories || 0), 0)),
      avgSugar: +(updatedProducts.reduce((acc, p) => acc + (p.sugar || 0), 0) / count).toFixed(1),
      avgSalt: +(updatedProducts.reduce((acc, p) => acc + (p.salt || 0), 0) / count).toFixed(1),
      avgSaturatedFat: +(updatedProducts.reduce((acc, p) => acc + (p.saturatedFat || 0), 0) / count).toFixed(1),
      processedRatio: Math.round((updatedProducts.filter(p => p.isUltraProcessed).length / count) * 100)
    };
    
    const newResult = { ...currentResult, products: updatedProducts, totalScore, summary };
    setCurrentResult(newResult);
    
    const newHistory = [newResult, ...history.filter(h => h.id !== newResult.id)].slice(0, 30);
    setHistory(newHistory);
    localStorage.setItem('ticketmiam_final_v1', JSON.stringify(newHistory));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(10);
    setError(null);
    setView('scan');

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let data;
      try {
        setProgress(30);
        data = await processReceipt(base64);
        setProgress(90);
      } catch (geminiErr) {
        console.warn("Gemini failed, falling back to local OCR...", geminiErr);
        setProgress(40);
        data = await processReceiptLocally(base64, (p) => setProgress(40 + (p * 0.5)));
      }

      const result: ScanResult = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        storeName: data.storeName || "Mon Magasin",
        products: data.products || [],
        totalScore: calculateGlobalScore(data.products || []),
        summary: {
          totalCalories: Math.round((data.products || []).reduce((acc, p) => acc + (p.calories || 0), 0)),
          avgSugar: +((data.products || []).reduce((acc, p) => acc + (p.sugar || 0), 0) / (data.products?.length || 1)).toFixed(1),
          avgSalt: +((data.products || []).reduce((acc, p) => acc + (p.salt || 0), 0) / (data.products?.length || 1)).toFixed(1),
          avgSaturatedFat: +((data.products || []).reduce((acc, p) => acc + (p.saturatedFat || 0), 0) / (data.products?.length || 1)).toFixed(1),
          processedRatio: Math.round(((data.products || []).filter(p => p.isUltraProcessed).length / (data.products?.length || 1)) * 100)
        }
      };

      setCurrentResult(result);
      const newHistory = [result, ...history].slice(0, 30);
      setHistory(newHistory);
      localStorage.setItem('ticketmiam_final_v1', JSON.stringify(newHistory));
      setView('result');
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError("Désolé, l'image n'a pas pu être analysée. Réessayez avec une photo plus nette.");
      setView('home');
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const renderAlerts = (summary: any) => {
    const alerts = [];
    if (summary.avgSugar > 12) alerts.push({ icon: 'fa-candy-cane', label: 'Excès de sucre', color: 'text-orange-600', bg: 'bg-orange-50' });
    if (summary.avgSalt > 1.2) alerts.push({ icon: 'fa-salt-shaker', label: 'Trop de sel', color: 'text-red-600', bg: 'bg-red-50' });
    if (summary.avgSaturatedFat > 5) alerts.push({ icon: 'fa-cheese', label: 'Gras saturés élevés', color: 'text-amber-600', bg: 'bg-amber-50' });
    if (summary.processedRatio > 40) alerts.push({ icon: 'fa-industry', label: 'Beaucoup d\'ultra-transformés', color: 'text-indigo-600', bg: 'bg-indigo-50' });

    if (alerts.length === 0) return (
      <div className="bg-emerald-50 p-4 rounded-2xl flex items-center space-x-3 border border-emerald-100">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
          <i className="fas fa-check"></i>
        </div>
        <p className="text-xs font-bold text-emerald-700 uppercase">Panier équilibré et sain</p>
      </div>
    );

    return (
      <div className="grid grid-cols-1 gap-2">
        {alerts.map((alert, i) => (
          <div key={i} className={`${alert.bg} p-4 rounded-2xl flex items-center space-x-3 border border-black/5 animate-fadeIn`} style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${alert.color.replace('text', 'bg')}/10 ${alert.color}`}>
              <i className={`fas ${alert.icon}`}></i>
            </div>
            <p className={`text-xs font-black uppercase tracking-tight ${alert.color}`}>{alert.label}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Outfit'] antialiased text-slate-900 selection:bg-emerald-100">
      <main className="pb-36">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[90vh] space-y-12 px-10 text-center animate-fadeIn">
            <div className="relative">
              <div className="w-32 h-32 border-[10px] border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 w-32 h-32 border-[10px] border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-emerald-600">{Math.round(progress)}%</span>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight">Analyse en cours...</h2>
              <p className="text-slate-400 font-medium max-w-[250px] mx-auto">Nous extrayons les données nutritionnelles de votre ticket.</p>
            </div>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <div className="flex flex-col items-center py-16 px-8 space-y-12 animate-fadeIn">
                <div className="text-center space-y-4">
                  <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Version 1.2 Stable</div>
                  <h1 className="text-6xl font-black tracking-tighter text-slate-900">TicketMiam</h1>
                  <p className="text-slate-400 font-medium text-lg leading-tight">Votre coach nutritionnel<br/>basé sur vos tickets.</p>
                </div>

                <div className="w-full max-w-sm group">
                  <label className="flex flex-col items-center justify-center w-full h-80 border-4 border-emerald-500 border-dashed rounded-[3.5rem] cursor-pointer bg-white hover:bg-emerald-50 transition-all shadow-2xl active:scale-95 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex flex-col items-center p-8 text-center space-y-6 relative z-10">
                      <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)]">
                        <i className="fas fa-receipt text-4xl"></i>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800">Scanner un ticket</h3>
                        <p className="text-sm text-slate-400 mt-2 font-medium">Cliquez pour capturer</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm w-full max-w-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">Historique Récent</p>
                   {history.length === 0 ? (
                     <p className="text-center text-slate-300 text-sm italic py-4">Aucune analyse encore.</p>
                   ) : (
                     <div className="space-y-3">
                       {history.slice(0, 3).map(h => (
                         <div key={h.id} onClick={() => { setCurrentResult(h); setView('result'); }} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                            <div className="flex items-center space-x-3">
                               <NutriScoreBadge score={h.totalScore} size="sm" />
                               <span className="text-sm font-bold truncate w-32">{h.storeName}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-black">{h.date}</span>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>
            )}
            
            {view === 'result' && currentResult && (
              <div className="max-w-xl mx-auto py-8 px-6 space-y-8 animate-fadeIn">
                <header className="flex items-center justify-between">
                   <button onClick={() => setView('home')} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500 active:scale-90 transition-all"><i className="fas fa-chevron-left"></i></button>
                   <h1 className="text-xl font-black text-slate-800 truncate px-4">{currentResult.storeName}</h1>
                   <button onClick={() => setView('history')} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500"><i className="fas fa-history"></i></button>
                </header>

                <section className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-50 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-indigo-400"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Qualité Globale</p>
                  <div className="flex justify-center scale-125 py-2">
                    <NutriScoreBadge score={currentResult.totalScore} size="lg" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-slate-900">Score Panier : {currentResult.totalScore}</p>
                    <p className="text-slate-400 text-sm font-medium">Analyse de {currentResult.products.length} articles</p>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Points de vigilance</h3>
                  {renderAlerts(currentResult.summary)}
                </section>

                <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Profil Macronutriments (100g)</h3>
                   <NutritionChart 
                      proteins={currentResult.products.reduce((acc, p) => acc + (p.proteins || 0), 0)} 
                      carbs={currentResult.products.reduce((acc, p) => acc + (p.carbs || 0), 0)} 
                      fats={currentResult.products.reduce((acc, p) => acc + (p.fats || 0), 0)} 
                   />
                </section>

                <section className="space-y-4 pb-20">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Détail des articles</h3>
                    <span className="text-[9px] text-slate-400 font-black uppercase">Édition activée</span>
                  </div>

                  <div className="space-y-3">
                    {currentResult.products.map((p, i) => (
                      <div key={p.id} className="bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-100 flex items-center justify-between animate-fadeIn hover:border-emerald-200 transition-all group" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => toggleNutriScore(p.id)}>
                          <NutriScoreBadge score={p.nutriScore} size="sm" />
                          <div className="max-w-[180px]">
                            <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{p.calories} kcal/100g</span>
                              {p.isUltraProcessed && <span className="bg-indigo-100 text-indigo-600 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Ultra-T</span>}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => updateResultState(currentResult.products.filter(item => item.id !== p.id))}
                          className="w-10 h-10 rounded-full text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            
            {view === 'history' && (
              <div className="max-w-xl mx-auto py-8 px-6 space-y-8 animate-fadeIn">
                 <header className="flex items-center justify-between">
                    <button onClick={() => setView('home')} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-slate-500"><i className="fas fa-chevron-left"></i></button>
                    <h1 className="text-2xl font-black text-slate-800">Historique</h1>
                    <div className="w-12"></div>
                 </header>
                 
                 {history.length >= 2 ? (
                   <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Évolution Nutritionnelle</h3>
                     <TrendsChart history={history} />
                   </div>
                 ) : (
                    <div className="bg-emerald-50 p-8 rounded-[3rem] text-center space-y-4">
                      <i className="fas fa-chart-line text-3xl text-emerald-500"></i>
                      <p className="text-sm font-bold text-emerald-800">Scannez un 2ème ticket pour voir votre progression !</p>
                    </div>
                 )}

                 <div className="space-y-4">
                    {history.map((item, i) => (
                      <div key={item.id} onClick={() => { setCurrentResult(item); setView('result'); }} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 animate-fadeIn" style={{ animationDelay: `${i * 50}ms` }}>
                         <div className="flex items-center space-x-5">
                            <NutriScoreBadge score={item.totalScore} size="md" />
                            <div>
                               <p className="font-black text-slate-800 text-sm truncate w-40">{item.storeName}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.date} • {item.products.length} articles</p>
                            </div>
                         </div>
                         <i className="fas fa-chevron-right text-slate-200"></i>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-12 left-10 right-10 bg-white/80 backdrop-blur-3xl border border-white/20 px-10 py-5 flex justify-around items-center rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] z-50 animate-fadeIn">
        <button onClick={() => setView('home')} className={`text-2xl transition-all ${view === 'home' ? 'text-emerald-500 scale-125' : 'text-slate-300'}`}><i className="fas fa-home"></i></button>
        <label className="bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] cursor-pointer transform -translate-y-10 active:scale-90 hover:scale-110 transition-all">
           <i className="fas fa-plus text-2xl"></i>
           <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
        </label>
        <button onClick={() => setView('history')} className={`text-2xl transition-all ${view === 'history' ? 'text-emerald-500 scale-125' : 'text-slate-300'}`}><i className="fas fa-history"></i></button>
      </nav>

      {error && (
        <div className="fixed bottom-40 left-8 right-8 bg-slate-900 text-white p-6 rounded-3xl shadow-2xl flex items-center justify-between z-[100] animate-slideUp">
          <div className="flex items-center space-x-4">
             <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"><i className="fas fa-info"></i></div>
             <p className="text-xs font-bold leading-snug max-w-[200px]">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><i className="fas fa-times text-slate-400"></i></button>
        </div>
      )}
    </div>
  );
};

export default App;
