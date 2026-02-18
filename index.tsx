
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("TicketMiam: Initialisation...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("TicketMiam: Élément #root introuvable.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("TicketMiam: Rendu initial lancé.");
  } catch (err) {
    console.error("TicketMiam: Erreur lors du rendu React", err);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">Erreur de chargement : ${err.message}</div>`;
  }
}
