/**
 * Pomodoro Timer - timer.viniciuscodes.com.br
 * Minimalist & Cognitive Accessibility Focused (ASD Level 1 & TDHD)
 * Features: Screen Wake Lock API, Zero-Drift Timestamp Delta Engine, Soft Web Audio API
 */

// Application State
const state = {
  mode: 'focus',
  durations: {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  status: 'idle',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  targetEndTime: null,
  timerInterval: null,
  wakeLockSentinel: null,
  soundEnabled: true,
  audioCtx: null
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
  manualMinInput: document.getElementById('manual-min-input'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  soundOnIcon: document.getElementById('sound-on-icon'),
  soundOffIcon: document.getElementById('sound-off-icon'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeMoonIcon: document.getElementById('theme-moon-icon'),
  themeSunIcon: document.getElementById('theme-sun-icon'),
  modeBtns: document.querySelectorAll('.mode-btn')
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
  const modeName = MODE_NAMES[state.mode];
  const stateIndicator = state.status === 'running' ? '▶ ' : state.status === 'paused' ? '‘ ' : '';
  document.title = stateIndicator + timeText + ' - ' + modeName + ' | timer.viniciuscodes.com.br';

  const percent = state.totalSeconds > 0
    ? Math.max(0, Math.min(100, (state.remainingSeconds / state.totalSeconds) * 100))
    : 0;
  elements.progressFill.style.width = percent + '%';
  elements.progressBar.setAttribute('aria-valuenow', Math.round(percent));

  if (state.status === 'running') {
    elements.startBtn.textContent = 'Pausar';
    elements.cycleStatusLabel.textContent = modeName + ' em andamento';
  } else if (state.status === 'paused') {
    elements.startBtn.textContent = 'Continuar';
    elements.cycleStatusLabel.textContent = modeName + ' pausado';
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
  releasewakeLock();
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
  document.title = '✓ Concluído - ' + MODE_NAMES[state.mode] + ' | timer.viniciuscodes.com.br';
  elements.cycleStatusLabel.textContent = MODE_NAMES[state.mode] + ' concluído!';
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

elements.modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    setMode(btn.dataset.mode);
  });
});

elements.manualMinInput.addEventListener('input', function(e) {
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val >= 1 && val <= 360) {
    const newSec = val * 60;
    state.durations[state.mode] = newSec;
    state.totalSeconds = newSec;
    if (state.status !== 'running') {
      state.remainingSeconds = newSec;
      updateUI();
    }
  }
});

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
  } else if (e.key === '1') {
    e.preventDefault();
    setMode('focus');
  } else if (e.key === '2') {
    e.preventDefault();
    setMode('shortBreak');
  } else if (e.key === '3') {
    e.preventDefault();
    setMode('longBreak');
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