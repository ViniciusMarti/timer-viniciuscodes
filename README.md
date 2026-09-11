# Pomodoro Timer - timer.viniciuscodes.com.br ⏳

Single Page Application (SPA) minimalista de produtividade e foco com design editorial, alinhada à identidade visual e paleta oficial do ecossistema [viniciuscodes.com.br](https://viniciuscodes.com.br).

## 🚀 Recursos Principais
- **Acessibilidade Cognitiva (TEA Nível 1 & TDAH):** Sem distrações cíclicas ou animações desnecessárias; foco no tempo e progresso linear suave.
- **Screen Wake Lock API Resiliente:** Mantém a tela ligada durante a contagem e reconecta automaticamente em isibilitychange.
- **Motor Delta Timestamp com \Date.now()\:** Zero atraso ou desvio cumulativo (drift) de clock quando a aba é minimizada ou colocada em segundo plano.
- **Áudio Harmônico Suave:** Web Audio API sintetizada com ondas senoidais calmas (528 Hz e 792 Hz), com toggle de áudio rápido.
- **Identidade e Cores:** Cores oficiais da marca com suporte automático ao tema do sistema (Dark/Light).
- **Atalhos de Teclado:**
  - \Espaço\: Iniciar / Pausar
  - \R\: Resetar
  - \, \, \: Foco (25m), Pausa Curta (5m), Pausa Longa (15m)
  - \M\: Mudo / Som

## 🛠️ Tecnologias
- HTML5 Semântico (ARIA live regions e progressbar)
- CSS3 Moderno com Design Tokens oficiais
- JavaScript Nativo Modular (ES Modules)
- Vite para otimização de build
