
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

const App = () => {
  const [view, setView] = useState<'home' | 'result'>('home');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('miam_v3_store');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
            { text: "Analyse ce ticket de caisse. Décode les abréviations (ex: 'PSDT' -> Pâturages). Liste les produits alimentaires avec leur Nutri-Score estimé et macros pour 100g. Réponds UNIQUEMENT en JSON: { 'magasin': 'Nom', 'score': 'A-E', 'produits': [{ 'nom': 'Nom simplifié', 'score': 'A-E', 'kcal': 120, 'p': 10, 'g': 20, 'l': 5 }] }" }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      const res = { ...data, id: Date.now(), date: new Date().toLocaleDateString('fr-FR') };
      
      setCurrent(res);
      const newHistory = [res, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('miam_v3_store', JSON.stringify(newHistory));
      setView('result');
    } catch (err) {
      alert("Erreur de lecture. Réessayez avec une photo plus nette.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-emerald-500 flex flex-col items-center justify-center p-8 text-white text-center">
      <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-black italic">Analyse IA...</h2>
      <p className="opacity-80 mt-2 text-sm">Décodage du ticket et calcul nutritionnel</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col font-medium">
      {view === 'home' ? (
        <div className="p-6 space-y-10 animate-slideIn">
          <header className="py-12 text-center">
            <h1 className="text-6xl font-black text-gray-900 tracking-tighter italic">Ticket<span className="text-emerald-500">Miam</span></h1>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-2">Nutrition Instantanée par IA</p>
          </header>

          <label className="block w-full h-80 bg-white border-4 border-dashed border-emerald-200 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4 text-3xl">
              <i className="fas fa-camera"></i>
            </div>
            <span className="font-black text-gray-800 text-xl">Scanner un ticket</span>
            <p className="text-gray-300 text-xs mt-1 font-bold">Intermarché, Carrefour, Lidl...</p>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
          </label>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">Historique</h3>
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setCurrent(h); setView('result'); }} className="bg-white p-5 rounded-[2rem] flex items-center justify-between shadow-sm border border-gray-100 active:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black nutri-${h.score}`}>{h.score}</div>
                      <div>
                        <p className="font-black text-gray-800 text-sm truncate w-32 uppercase tracking-tight">{h.magasin}</p>
                        <p className="text-[10px] text-gray-300 font-bold">{h.date}</p>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-gray-200"></i>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 space-y-6 animate-slideIn pb-32">
          <button onClick={() => setView('home')} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-400 active:scale-90 transition-all">
            <i className="fas fa-arrow-left"></i>
          </button>
          
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl text-center border border-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Note Globale du Panier</p>
            <div className={`w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center text-white text-5xl font-black nutri-${current.score} shadow-xl mb-6`}>
              {current.score}
            </div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">{current.magasin}</h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">Analyse des articles</h3>
            {current.produits.map((p: any, i: number) => (
              <div key={i} className="bg-white p-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm border border-gray-100">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black nutri-${p.score}`}>{p.score}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-xs truncate uppercase tracking-tight leading-none">{p.nom}</p>
                  <div className="flex gap-1 mt-2">
                    <div className="h-1 bg-emerald-100 flex-1 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, p.p * 4)}%` }}></div>
                    </div>
                    <div className="h-1 bg-blue-100 flex-1 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, p.g * 2)}%` }}></div>
                    </div>
                    <div className="h-1 bg-amber-100 flex-1 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, p.l * 3)}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-xs font-black text-gray-900">{p.kcal}</span>
                  <span className="text-[8px] block text-gray-300 font-bold">kcal</span>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-8 left-8 right-8 flex justify-center">
            <button 
              onClick={() => { if(confirm("Supprimer l'historique ?")) {localStorage.removeItem('miam_v3_store'); setHistory([]); setView('home');} }} 
              className="bg-white/90 backdrop-blur px-8 py-3 rounded-full shadow-xl border border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 active:scale-95 transition-all"
            >
              <i className="fas fa-trash mr-2"></i> Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
