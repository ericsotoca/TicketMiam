
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- LOGIQUE & TYPES ---
enum NutriScore { A = 'A', B = 'B', C = 'C', D = 'D', E = 'E' }

interface Product {
  nom: string;
  score: NutriScore;
  kcal: number;
  p: number; // protéines
  g: number; // glucides
  l: number; // lipides
}

interface ScanData {
  id: string;
  date: string;
  magasin: string;
  scoreGlobal: NutriScore;
  produits: Product[];
}

// --- COMPOSANTS INTERNES ---
const Badge = ({ score, size = 'md' }: { score: NutriScore, size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-lg', lg: 'w-20 h-20 text-4xl' };
  return (
    <div className={`nutri-${score} text-white font-black rounded-xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 ${sizes[size]}`}>
      {score}
    </div>
  );
};

// --- APPLICATION PRINCIPALE ---
const App = () => {
  const [view, setView] = useState<'home' | 'result'>('home');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ScanData[]>([]);
  const [current, setCurrent] = useState<ScanData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ticketmiam_v5_final');
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
            { text: "Analyse ce ticket de caisse. Liste les produits alimentaires avec leur Nutri-Score estimé et macros pour 100g. Décode les abréviations (ex: PSDT=Pâturages). Réponds UNIQUEMENT en JSON: { 'magasin': 'Nom', 'scoreGlobal': 'A-E', 'produits': [{ 'nom': 'Nom simplifié', 'score': 'A-E', 'kcal': 120, 'p': 10, 'g': 20, 'l': 5 }] }" }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      const newScan: ScanData = {
        ...data,
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('fr-FR')
      };

      setCurrent(newScan);
      const newHistory = [newScan, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('ticketmiam_v5_final', JSON.stringify(newHistory));
      setView('result');
    } catch (err) {
      alert("Erreur de lecture. Vérifiez la photo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-8 text-white text-center">
      <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-black italic">Analyse IA...</h2>
      <p className="opacity-80 mt-2 text-sm max-w-xs">Gemini décode votre ticket Intermarché et calcule les nutriments</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-32">
      {view === 'home' ? (
        <div className="p-6 space-y-12 animate-slideUp">
          <header className="py-10 text-center">
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter italic">Ticket<span className="text-emerald-500">Miam</span></h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Scan Nutritionnel Intelligent</p>
          </header>

          <label className="block w-full h-80 bg-white border-4 border-dashed border-emerald-100 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4 text-3xl">
              <i className="fas fa-camera"></i>
            </div>
            <span className="font-black text-slate-800 text-xl">Scanner un ticket</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
          </label>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Historique</h3>
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setCurrent(h); setView('result'); }} className="bg-white p-5 rounded-[2rem] flex items-center justify-between shadow-sm border border-slate-50 active:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <Badge score={h.scoreGlobal} size="sm" />
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{h.magasin}</p>
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
      ) : current && (
        <div className="p-6 space-y-6 animate-slideUp">
          <button onClick={() => setView('home')} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-300"><i className="fas fa-arrow-left"></i></button>
          
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl text-center border border-slate-50">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Note Globale du Panier</p>
            <div className="flex justify-center mb-6">
              <Badge score={current.scoreGlobal} size="lg" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{current.magasin}</h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Détails des articles</h3>
            {current.produits.map((p, i) => (
              <div key={i} className="bg-white p-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm border border-slate-50">
                <Badge score={p.score} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-[11px] truncate uppercase tracking-tight">{p.nom}</p>
                  <div className="flex gap-1 mt-2">
                    <div className="h-1 bg-emerald-100 flex-1 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, p.p * 5)}%` }}></div></div>
                    <div className="h-1 bg-blue-100 flex-1 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, p.g * 2)}%` }}></div></div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-900">{p.kcal}</span>
                  <span className="text-[8px] block text-slate-300 font-bold uppercase">kcal</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barre de navigation fixe */}
      <nav className="fixed bottom-8 left-8 right-8 bg-white/90 backdrop-blur px-8 py-4 flex justify-around items-center rounded-full shadow-2xl border border-slate-100">
        <button onClick={() => setView('home')} className={`text-xl ${view === 'home' ? 'text-emerald-500' : 'text-slate-200'}`}><i className="fas fa-home"></i></button>
        <label className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer transform -translate-y-6 border-4 border-slate-50">
          <i className="fas fa-plus"></i>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
        </label>
        <button onClick={() => { if(confirm("Supprimer l'historique ?")) { localStorage.clear(); setHistory([]); setView('home'); }}} className="text-xl text-slate-200 hover:text-red-400 transition-colors"><i className="fas fa-trash"></i></button>
      </nav>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
