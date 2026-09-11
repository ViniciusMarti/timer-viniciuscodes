/**
 * Pomodoro Timer - timer.viniciuscodes.com.br
 * Minimalist & Cognitive Accessibility Focused (ASD Level 1 & TDHD)
 * Features: Screen Wake Lock API, Zero-Drift Timestamp Delta Engine, Soft Web Audio API
 */

// Application State
const state = {
  activeView: 'pomodoro', // 'pomodoro' | 'timer'
  mode: 'focus',
  durations: {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  simpleTimerDuration: 5 * 60,
  status: 'idle',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  targetEndTime: null,
  timerInterval: null,
  wakeLockSentinel: null,
  soundEnabled: true,
  audioCtx: null,
  lofiPlaying: false,
  lofiInterval: null,
  lofiGain: null
};

// Mode display names for accessibility and titles
const MODE_NAMES = {
  focus: 'Foco',
  shortBreak: 'Pausa Curta',
  longBreak: 'Pausa Longa'
};

// DOM Elements
const elements = {
  display: document.getElementById('timer-display'),
  progressBar: document.getElementById('progress-bar'),
  progressFill: document.getElementById('progress-fill'),
  startBtn: document.getElementById('start-btn'),
  resetBtn: document.getElementById('reset-btn'),
  screenStatusDot: document.getElementById('screen-status-dot'),
  screenStatusLabel: document.getElementById('screen-status-label'),
  screenStatusPill: document.getElementById('screen-status-pill'),
  cycleStatusLabel: document.getElementById('cycle-status-label'),
  viewPomodoroBtn: document.getElementById('view-pomodoro-btn'),
  viewTimerBtn: document.getElementById('view-timer-btn'),
  pomodoroModesNav: document.getElementById('pomodoro-modes-nav'),
  simpleTimerModesNav: document.getElementById('simple-timer-modes-nav'),
  manualLabel: document.getElementById('manual-label'),
  manualMinInput: document.getElementById('manual-min-input'),
  lofiToggleBtn: document.getElementById('lofi-toggle-btn'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  soundOnIcon: document.getElementById('sound-on-icon'),
  soundOffIcon: document.getElementById('sound-off-icon'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeMoonIcon: document.getElementById('theme-moon-icon'),
  themeSunIcon: document.getElementById('theme-sun-icon'),
  modeBtns: document.querySelectorAll('#pomodoro-modes-nav .mode-btn'),
  simpleTimerBtns: document.querySelectorAll('#simple-timer-modes-nav .mode-btn')
};

// --- Web Audio API Chime (Soft, non-startling sine chord) ---
function playHarmonicChime() {
  if (!state.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioCtx) {
      state.audioCtx = new AudioContext();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    const now = state.audioCtx.currentTime;
    const freqs = [528, 792];
    freqs.forEach(function(freq, index) {
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.2 : 0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.65);
    });
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

// --- Lofi Ambient Audio Engine (Stream Real + Fallback Sintetizado) ---
// Utiliza stream confiável de alta qualidade de rádio lofi 24/7 (chill lofi hiphop beats)
const LOFI_STREAM_URL = 'https://streams.ilovemusic.de/iloveradio17.mp3'; // 24/7 Chill Lofi Beats stream
let lofiAudioElement = null;

// Progressões de acordes 7th de jazz lofi para fallback offline
const LOFI_CHORDS = [
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [164.81, 207.65, 246.94, 311.13], // Emaj7
  [146.83, 174.61, 220.00, 261.63], // Dm7
  [130.81, 164.81, 196.00, 246.94]  // Cmaj7
];
let currentChordIndex = 0;

function ensureAudioContext() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audioCtx = new AudioContext();
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function playSynthesizedLofiChord() {
  if (!state.lofiPlaying || !state.audioCtx) return;

  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const chord = LOFI_CHORDS[currentChordIndex];
  currentChordIndex = (currentChordIndex + 1) % LOFI_CHORDS.length;

  chord.forEach(function(freq, i) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(1.8, now);

    const chordDuration = 3.6;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(state.lofiGain || ctx.destination);

    osc.start(now);
    osc.stop(now + chordDuration + 0.1);
  });
}

function startLofi() {
  state.lofiPlaying = true;
  ensureAudioContext();

  if (elements.lofiToggleBtn) {
    elements.lofiToggleBtn.classList.add('active');
    elements.lofiToggleBtn.setAttribute('aria-label', 'Desligar som ambiente Lofi');
  }

  // Tentar stream de rádio lofi primeiro
  try {
    if (!lofiAudioElement) {
      lofiAudioElement = new Audio(LOFI_STREAM_URL);
      lofiAudioElement.volume = 0.5;
      lofiAudioElement.preload = 'auto';

      lofiAudioElement.addEventListener('error', function() {
        console.warn('Lofi stream inacessível, alternando para síntese procedimental...');
        startSynthesizedFallback();
      });
    }

    const playPromise = lofiAudioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(function(err) {
        console.warn('Stream bloqueado pelo navegador/CORS, iniciando sintetizador:', err);
        startSynthesizedFallback();
      });
    }
  } catch (e) {
    console.warn('Erro ao inicializar elemento de áudio:', e);
    startSynthesizedFallback();
  }
}

function startSynthesizedFallback() {
  ensureAudioContext();
  if (!state.audioCtx) return;

  if (!state.lofiGain) {
    state.lofiGain = state.audioCtx.createGain();
    state.lofiGain.gain.setValueAtTime(0.8, state.audioCtx.currentTime);
    state.lofiGain.connect(state.audioCtx.destination);
  }

  playSynthesizedLofiChord();
  if (state.lofiInterval) clearInterval(state.lofiInterval);
  state.lofiInterval = setInterval(playSynthesizedLofiChord, 3500);
}

function stopLofi() {
  state.lofiPlaying = false;
  if (lofiAudioElement) {
    try {
      lofiAudioElement.pause();
    } catch (e) {}
  }
  if (state.lofiInterval) {
    clearInterval(state.lofiInterval);
    state.lofiInterval = null;
  }
  if (elements.lofiToggleBtn) {
    elements.lofiToggleBtn.classList.remove('active');
    elements.lofiToggleBtn.setAttribute('aria-label', 'Ligar som ambiente Lofi');
  }
}

function toggleLofi() {
  if (state.lofiPlaying) {
    stopLofi();
  } else {
    startLofi();
  }
}

// --- Screen Wake Lock API Management ---
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    elements.screenStatusDot.classList.remove('active');
    elements.screenStatusLabel.textContent = 'Wake Lock não suportado';
    elements.screenStatusPill.title = 'Navvegador sem suporte a Screen Wake Lock API nativa.';
    return;
  }
  try {
    if (!state.wakeLockSentinel) {
      state.wakeLockSentinel = await navigator.wakeLock.request('screen');
      elements.screenStatusDot.classList.add('active');
      elements.screenStatusLabel.textContent = 'Tela ativa';
      elements.screenStatusPill.title = 'Screen Wake Lock ativo: tela não entrará em suspensão durante o timer.';
      state.wakeLockSentinel.addEventListener('release', function() {
        if (state.status !== 'running') {
          elements.screenStatusDot.classList.remove('active');
          elements.screenStatusLabel.textContent = 'Modo padrão';
          elements.screenStatusPill.title = 'Screen Wake Lock inativo.';
        }
      });
    }
  } catch (err) {
    console.warn('Wake Lock error:', err);
    elements.screenStatusDot.classList.remove('active');
    elements.screenStatusLabel.textContent = 'Modo padrão';
  }
}

function releaseWakeLock() {
  if (state.wakeLockSentinel) {
    state.wakeLockSentinel.release().then(function() {
      state.wakeLockSentinel = null;
    }).catch(function() {
      state.wakeLockSentinel = null;
    });
  }
  elements.screenStatusDot.classList.remove('active');
  elements.screenStatusLabel.textContent = 'Modo padrão';
}

document.addEventListener('visibilitychange', async function() {
  if (document.visibilityState === 'visible' && state.status === 'running') {
    await requestWakeLock();
  }
});

// --- Timer Display & Progress Utilities ---
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateUI() {
  const timeText = formatTime(state.remainingSeconds);
  elements.display.textContent = timeText;

  const activeLabel = state.activeView === 'pomodoro' ? MODE_NAMES[state.mode] : 'Timer Simples';
  const stateIndicator = state.status === 'running' ? '▶ ' : state.status === 'paused' ? '⏸ ' : '';
  document.title = stateIndicator + timeText + ' - ' + activeLabel + ' | timer.viniciuscodes.com.br';

  const percent = state.totalSeconds > 0
    ? Math.max(0, Math.min(100, (state.remainingSeconds / state.totalSeconds) * 100))
    : 0;
  elements.progressFill.style.width = percent + '%';
  elements.progressBar.setAttribute('aria-valuenow', Math.round(percent));

  if (state.status === 'running') {
    elements.startBtn.textContent = 'Pausar';
    elements.cycleStatusLabel.textContent = activeLabel + ' em andamento';
  } else if (state.status === 'paused') {
    elements.startBtn.textContent = 'Continuar';
    elements.cycleStatusLabel.textContent = activeLabel + ' pausado';
  } else {
    elements.startBtn.textContent = 'Iniciar';
    elements.cycleStatusLabel.textContent = 'Ciclo em repouso';
  }
}

// --- High Precision Delta Timestamp Engine ---
function tick() {
  if (state.status !== 'running') return;
  const now = Date.now();
  const diffMs = state.targetEndTime - now;
  const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));
  state.remainingSeconds = remainingSec;
  updateUI();
  if (remainingSec <= 0) {
    completeTimer();
  }
}

function startTimer() {
  if (state.status === 'running') return;
  if (!state.audioCtx) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) state.audioCtx = new AudioContext();
    } catch (_) {}
  }
  state.status = 'running';
  state.targetEndTime = Date.now() + (state.remainingSeconds * 1000);
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(tick, 250);
  requestWakeLock();
  updateUI();
}

function pauseTimer() {
  if (state.status !== 'running') return;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.status = 'paused';
  const now = Date.now();
  const diffMs = Math.max(0, state.targetEndTime - now);
  state.remainingSeconds = Math.ceil(diffMs / 1000);
  releaseWakeLock();
  updateUI();
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.status = 'idle';
  state.remainingSeconds = state.totalSeconds;
  releaseWakeLock();
  updateUI();
}

function completeTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.status = 'idle';
  state.remainingSeconds = 0;
  releaseWakeLock();
  updateUI();
  playHarmonicChime();
  const label = state.activeView === 'pomodoro' ? MODE_NAMES[state.mode] : 'Timer';
  document.title = '✓ Concluído - ' + label + ' | timer.viniciuscodes.com.br';
  elements.cycleStatusLabel.textContent = label + ' concluído!';
}

function setView(newView) {
  if (state.activeView === newView) return;
  if (state.status === 'running') {
    pauseTimer();
  }

  state.activeView = newView;

  // Alternar abas principais
  elements.viewPomodoroBtn.classList.toggle('active', newView === 'pomodoro');
  elements.viewPomodoroBtn.setAttribute('aria-selected', newView === 'pomodoro' ? 'true' : 'false');
  elements.viewTimerBtn.classList.toggle('active', newView === 'timer');
  elements.viewTimerBtn.setAttribute('aria-selected', newView === 'timer' ? 'true' : 'false');

  // Alternar menus de navegação de presets
  elements.pomodoroModesNav.style.display = newView === 'pomodoro' ? 'flex' : 'none';
  elements.simpleTimerModesNav.style.display = newView === 'timer' ? 'flex' : 'none';

  if (newView === 'pomodoro') {
    elements.manualLabel.textContent = 'Duração do modo ativo:';
    state.totalSeconds = state.durations[state.mode];
  } else {
    elements.manualLabel.textContent = 'Minutos do timer:';
    state.totalSeconds = state.simpleTimerDuration;
  }

  state.remainingSeconds = state.totalSeconds;
  state.status = 'idle';
  elements.manualMinInput.value = Math.floor(state.totalSeconds / 60);
  releaseWakeLock();
  updateUI();
}

function setSimplePreset(minutes) {
  if (state.status === 'running') {
    pauseTimer();
  }
  const sec = minutes * 60;
  state.simpleTimerDuration = sec;
  state.totalSeconds = sec;
  state.remainingSeconds = sec;
  state.status = 'idle';

  elements.simpleTimerBtns.forEach(function(btn) {
    const isCur = parseInt(btn.dataset.timerMin, 10) === minutes;
    btn.classList.toggle('active', isCur);
    btn.setAttribute('aria-selected', isCur ? 'true' : 'false');
  });

  elements.manualMinInput.value = minutes;
  releaseWakeLock();
  updateUI();
}

function setMode(newMode) {
  if (state.status === 'running') {
    pauseTimer();
  }
  state.mode = newMode;
  state.totalSeconds = state.durations[newMode];
  state.remainingSeconds = state.totalSeconds;
  state.status = 'idle';

  elements.modeBtns.forEach(function(btn) {
    const isCurrent = btn.dataset.mode === newMode;
    btn.classList.toggle('active', isCurrent);
    btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });

  elements.manualMinInput.value = Math.floor(state.totalSeconds / 60);
  releaseWakeLock();
  updateUI();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  elements.soundOnIcon.style.display = state.soundEnabled ? 'block' : 'none';
  elements.soundOffIcon.style.display = state.soundEnabled ? 'none' : 'block';
  elements.soundToggleBtn.setAttribute('aria-label', state.soundEnabled ? 'Desativar som' : 'Ativar som');
  localStorage.setItem('viniciuscodes_timer_sound', state.soundEnabled ? 'true' : 'false');
}

function getEffectiveTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  elements.themeMoonIcon.style.display = theme === 'light' ? 'none' : 'block';
  elements.themeSunIcon.style.display = theme === 'light' ? 'block' : 'none';
  if (save) {
    localStorage.setItem('viniciuscodes_timer_theme', theme);
  }
}

function toggleTheme() {
  const current = getEffectiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

// Event Listeners
elements.startBtn.addEventListener('click', function() {
  if (state.status === 'running') {
    pauseTimer();
  } else {
    startTimer();
  }
});

elements.resetBtn.addEventListener('click', resetTimer);

if (elements.viewPomodoroBtn) {
  elements.viewPomodoroBtn.addEventListener('click', function() {
    setView('pomodoro');
  });
}

if (elements.viewTimerBtn) {
  elements.viewTimerBtn.addEventListener('click', function() {
    setView('timer');
  });
}

elements.modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    setMode(btn.dataset.mode);
  });
});

elements.simpleTimerBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    const min = parseInt(btn.dataset.timerMin, 10);
    if (!isNaN(min)) {
      setSimplePreset(min);
    }
  });
});

elements.manualMinInput.addEventListener('input', function(e) {
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val >= 1 && val <= 360) {
    const newSec = val * 60;
    if (state.activeView === 'pomodoro') {
      state.durations[state.mode] = newSec;
    } else {
      state.simpleTimerDuration = newSec;
    }
    state.totalSeconds = newSec;
    if (state.status !== 'running') {
      state.remainingSeconds = newSec;
      updateUI();
    }
  }
});

if (elements.lofiToggleBtn) {
  elements.lofiToggleBtn.addEventListener('click', toggleLofi);
}
elements.soundToggleBtn.addEventListener('click', toggleSound);
elements.themeToggleBtn.addEventListener('click', toggleTheme);

window.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.status === 'running') pauseTimer();
    else startTimer();
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    resetTimer();
  } else if (e.key === 't' || e.key === 'T') {
    e.preventDefault();
    setView(state.activeView === 'pomodoro' ? 'timer' : 'pomodoro');
  } else if (e.key === '1') {
    e.preventDefault();
    if (state.activeView === 'pomodoro') setMode('focus');
    else setSimplePreset(1);
  } else if (e.key === '2') {
    e.preventDefault();
    if (state.activeView === 'pomodoro') setMode('shortBreak');
    else setSimplePreset(5);
  } else if (e.key === '3') {
    e.preventDefault();
    if (state.activeView === 'pomodoro') setMode('longBreak');
    else setSimplePreset(10);
  } else if (e.key === 'l' || e.key === 'L') {
    e.preventDefault();
    toggleLofi();
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    toggleSound();
  }
});

function init() {
  const savedTheme = localStorage.getItem('viniciuscodes_timer_theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    applyTheme(savedTheme, false);
  } else {
    // Segue o padrão do sistema operacional do usuário
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark', false);
  }

  // Escuta alteração em tempo real do sistema (caso o usuário mude o tema do Windows/navegador)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
      const hasCustom = localStorage.getItem('viniciuscodes_timer_theme');
      if (!hasCustom) {
        applyTheme(e.matches ? 'light' : 'dark', false);
      }
    });
  }

  const savedSound = localStorage.getItem('viniciuscodes_timer_sound');
  if (savedSound === 'false') {
    state.soundEnabled = false;
    elements.soundOnIcon.style.display = 'none';
    elements.soundOffIcon.style.display = 'block';
  }

  updateUI();
}

init();