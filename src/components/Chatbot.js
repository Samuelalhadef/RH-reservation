'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FAQ, FAQ_CATEGORIES, searchFaqIn } from '@/lib/chatbot-faq';
import { FAQ_RH, FAQ_CATEGORIES_RH } from '@/lib/chatbot-faq-rh';

const WELCOME_AUTH = {
  role: 'bot',
  text: "Bonjour ! Je suis l'assistant du Portail Agent. Posez-moi une question ou choisissez un sujet ci-dessous.",
};

const WELCOME_LOGIN = {
  role: 'bot',
  text: "Bonjour ! Besoin d'aide pour vous connecter ? Voici les questions les plus fréquentes.",
};

const Chatbot = () => {
  const { user, isRH } = useAuth();
  const userIsRH = user ? isRH() : false;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const scrollRef = useRef(null);

  const allFaq = useMemo(() => {
    if (!user) return FAQ.filter((f) => f.cat === 'compte');
    if (userIsRH) return [...FAQ, ...FAQ_RH];
    return FAQ;
  }, [user, userIsRH]);

  const allCategories = useMemo(() => {
    if (!user) return FAQ_CATEGORIES.filter((c) => c.id === 'compte');
    if (userIsRH) return [...FAQ_CATEGORIES, ...FAQ_CATEGORIES_RH];
    return FAQ_CATEGORIES;
  }, [user, userIsRH]);

  const welcome = user ? WELCOME_AUTH : WELCOME_LOGIN;
  const [messages, setMessages] = useState([welcome]);

  useEffect(() => {
    setMessages([welcome]);
    setActiveCat(user ? null : 'compte');
    setInput('');
  }, [user, welcome]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const visibleQuestions = useMemo(() => {
    return activeCat ? allFaq.filter((f) => f.cat === activeCat) : [];
  }, [activeCat, allFaq]);

  const askQuestion = (entry) => {
    setMessages((m) => [
      ...m,
      { role: 'user', text: entry.q },
      { role: 'bot', text: entry.a },
    ]);
    if (user) setActiveCat(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);

    const matches = searchFaqIn(allFaq, text, 3);
    setTimeout(() => {
      if (matches.length === 0) {
        setMessages((m) => [
          ...m,
          {
            role: 'bot',
            text: "Je n'ai pas trouvé de réponse précise. Essayez de reformuler ou choisissez un sujet ci-dessous.",
            showCategories: true,
          },
        ]);
      } else if (matches.length === 1) {
        setMessages((m) => [...m, { role: 'bot', text: matches[0].a }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'bot',
            text: "Plusieurs sujets correspondent, lequel souhaitez-vous ?",
            suggestions: matches,
          },
        ]);
      }
    }, 200);
  };

  const reset = () => {
    setMessages([welcome]);
    setActiveCat(user ? null : 'compte');
    setInput('');
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' }}
        aria-label="Ouvrir l'assistant"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Fenêtre */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden">
          {/* Header */}
          <div
            className="px-4 py-3 text-white flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' }}
          >
            <div>
              <p className="font-semibold text-sm">
                {!user
                  ? 'Aide à la connexion'
                  : userIsRH
                  ? 'Assistant RH'
                  : 'Assistant Portail Agent'}
              </p>
              <p className="text-xs opacity-90">
                {allFaq.length} réponses aux questions fréquentes
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition"
              title="Réinitialiser"
            >
              Reset
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    m.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white rounded-br-sm'
                      : 'mr-auto bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {m.text}
                </div>

                {m.suggestions && (
                  <div className="mt-2 space-y-1">
                    {m.suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => askQuestion(s)}
                        className="block w-full text-left text-xs bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 px-3 py-2 rounded-lg transition"
                      >
                        {s.q}
                      </button>
                    ))}
                  </div>
                )}

                {m.showCategories && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {allCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveCat(c.id)}
                        className="text-xs bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-50 px-2.5 py-1 rounded-full transition"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Sélecteur initial de catégories */}
            {messages.length === 1 && !activeCat && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {FAQ_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className="text-xs bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-50 px-2.5 py-1 rounded-full transition"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Liste des questions de la catégorie active */}
            {activeCat && (
              <div className="space-y-1">
                {allCategories.length > 1 && (
                  <button
                    onClick={() => setActiveCat(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    ← Retour aux sujets
                  </button>
                )}
                {visibleQuestions.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => askQuestion(entry)}
                    className="block w-full text-left text-xs bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 px-3 py-2 rounded-lg transition"
                  >
                    {entry.q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-2 flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tapez votre question..."
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' }}
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;
