// ===========================================
// POMODORO TIMER
// ===========================================

let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroRunning = false;
let pomodoroSelectedMinutes = 25;
let pomodoroStartedAt = null;

// State Persistence
function savePomodoroState() {
  const state = {
    selectedMinutes: pomodoroSelectedMinutes,
    running: pomodoroRunning,
    startedAt: pomodoroStartedAt,
    pausedSecondsRemaining: pomodoroRunning ? null : pomodoroSeconds
  };
  localStorage.setItem('pomodoroState', JSON.stringify(state));
}

function loadPomodoroState() {
  try {
    const state = JSON.parse(localStorage.getItem('pomodoroState'));
    if (!state) return;

    pomodoroSelectedMinutes = state.selectedMinutes || 25;

    if (state.running && state.startedAt) {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);

      if (pomodoroSeconds > 0) {
        pomodoroStartedAt = state.startedAt;
        pomodoroRunning = true;
        startPomodoroInterval();
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.add('running');
        updateStartButton(true);
      } else {
        if (pomodoroSelectedMinutes === 25) {
          incrementTomato();
        }
        pomodoroComplete();
        pomodoroSeconds = pomodoroSelectedMinutes * 60;
        pomodoroRunning = false;
        pomodoroStartedAt = null;
      }
    } else if (state.pausedSecondsRemaining !== null) {
      pomodoroSeconds = state.pausedSecondsRemaining;
      pomodoroRunning = false;
      if (pomodoroSeconds < pomodoroSelectedMinutes * 60) {
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.add('paused');
      }
    }

    document.querySelectorAll('.pomodoro-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes) === pomodoroSelectedMinutes);
    });

    updatePomodoroDisplay();
  } catch (e) {
    console.log('Could not load pomodoro state:', e);
  }
}

function loadPomodoroCollapsedState() {
  const collapsed = localStorage.getItem('pomodoroCollapsed') === 'true';
  if (collapsed) {
    document.getElementById('pomodoro-widget').classList.add('collapsed');
  }
}

// Daily Tomatoes Tracking
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function loadDailyTomatoes() {
  try {
    const data = JSON.parse(localStorage.getItem('dailyTomatoes') || '{}');
    return data[getTodayKey()] || 0;
  } catch (e) {
    return 0;
  }
}

function saveDailyTomatoes(count) {
  try {
    const data = JSON.parse(localStorage.getItem('dailyTomatoes') || '{}');
    const today = getTodayKey();
    data[today] = count;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(data).forEach(key => {
      if (new Date(key) < cutoff) delete data[key];
    });
    localStorage.setItem('dailyTomatoes', JSON.stringify(data));
  } catch (e) {
    console.log('Could not save tomatoes:', e);
  }
}

function incrementTomato() {
  const count = loadDailyTomatoes() + 1;
  saveDailyTomatoes(count);
  updateTomatoDisplay(true);
}

function updateTomatoDisplay(isNew = false) {
  const container = document.getElementById('pomodoro-tomatoes');
  if (!container) return;

  const count = loadDailyTomatoes();

  if (count === 0) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    const maxIcons = 8;
    const iconsToShow = Math.min(count, maxIcons);
    let html = '<span class="pomodoro-tomatoes-label">Today:</span><span class="pomodoro-tomatoes-icons">';
    for (let i = 0; i < iconsToShow; i++) {
      const isLastAndNew = isNew && i === iconsToShow - 1;
      html += `<span class="pomodoro-tomato${isLastAndNew ? ' new' : ''}">🍅</span>`;
    }
    html += '</span>';
    if (count > maxIcons) {
      html += `<span class="pomodoro-tomatoes-count">+${count - maxIcons}</span>`;
    }
    container.innerHTML = html;
  }
}

// Display
function updatePomodoroDisplay() {
  const display = document.getElementById('pomodoro-display');
  const minutes = Math.floor(pomodoroSeconds / 60);
  const seconds = pomodoroSeconds % 60;
  display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function togglePomodoroExpand() {
  const widget = document.getElementById('pomodoro-widget');
  widget.classList.toggle('collapsed');
  localStorage.setItem('pomodoroCollapsed', widget.classList.contains('collapsed'));
}

function setPomodoroTime(minutes) {
  pomodoroSelectedMinutes = minutes;
  pomodoroSeconds = minutes * 60;
  pomodoroRunning = false;
  pomodoroStartedAt = null;
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;

  const widget = document.getElementById('pomodoro-widget');
  widget.classList.remove('running', 'paused');

  document.querySelectorAll('.pomodoro-preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
  });

  updateStartButton(false);
  updatePomodoroDisplay();
  savePomodoroState();
}

function updateStartButton(isRunning) {
  const btn = document.getElementById('pomodoro-start-btn');
  if (isRunning) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>`;
  }
}

// Audio
function playPomodoroSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'start') {
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.15);
    } else {
      oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.15);
    }

    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.log('Audio not supported');
  }
}

// Timer Control
function startPomodoroInterval() {
  if (pomodoroInterval) clearInterval(pomodoroInterval);

  pomodoroInterval = setInterval(() => {
    if (pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
    }

    updatePomodoroDisplay();

    if (pomodoroSeconds <= 0) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroRunning = false;
      pomodoroStartedAt = null;
      const widget = document.getElementById('pomodoro-widget');
      widget.classList.remove('running');
      updateStartButton(false);
      savePomodoroState();
      pomodoroComplete();
    }
  }, 1000);
}

function togglePomodoro() {
  const widget = document.getElementById('pomodoro-widget');

  if (pomodoroRunning) {
    if (pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
    }
    pomodoroRunning = false;
    pomodoroStartedAt = null;
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    widget.classList.remove('running');
    widget.classList.add('paused');
    updateStartButton(false);
    playPomodoroSound('pause');
    savePomodoroState();
  } else {
    if (pomodoroSeconds <= 0) {
      pomodoroSeconds = pomodoroSelectedMinutes * 60;
    }
    pomodoroStartedAt = Date.now() - ((pomodoroSelectedMinutes * 60 - pomodoroSeconds) * 1000);
    pomodoroRunning = true;
    widget.classList.remove('paused');
    widget.classList.add('running');
    updateStartButton(true);
    playPomodoroSound('start');
    savePomodoroState();
    startPomodoroInterval();
  }
}

function resetPomodoro() {
  pomodoroRunning = false;
  pomodoroStartedAt = null;
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroSeconds = pomodoroSelectedMinutes * 60;

  const widget = document.getElementById('pomodoro-widget');
  widget.classList.remove('running', 'paused');
  updateStartButton(false);
  updatePomodoroDisplay();
  savePomodoroState();
}

function pomodoroComplete() {
  if (pomodoroSelectedMinutes === 25) {
    incrementTomato();
  }

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 800;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 600);
  } catch (e) {
    console.log('Audio not supported');
  }

  const tomatoCount = loadDailyTomatoes();
  const notifBody = pomodoroSelectedMinutes === 25
    ? `Time for a break! 🍅 ${tomatoCount} today`
    : 'Break complete!';

  if (Notification.permission === 'granted') {
    new Notification('Pomodoro Complete!', {
      body: notifBody,
      icon: 'icons/icon-192.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// Initialize
function initPomodoro() {
  updatePomodoroDisplay();
  updateTomatoDisplay();
  loadPomodoroState();
  loadPomodoroCollapsedState();
  updatePomodoroDisplay();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pomodoroRunning && pomodoroStartedAt) {
      const elapsed = Math.floor((Date.now() - pomodoroStartedAt) / 1000);
      const totalSeconds = pomodoroSelectedMinutes * 60;
      pomodoroSeconds = Math.max(0, totalSeconds - elapsed);
      updatePomodoroDisplay();

      if (pomodoroSeconds <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroRunning = false;
        pomodoroStartedAt = null;
        const widget = document.getElementById('pomodoro-widget');
        widget.classList.remove('running');
        updateStartButton(false);
        savePomodoroState();
        pomodoroComplete();
      }
    }
  });
}

// Expose functions globally for onclick handlers
window.togglePomodoroExpand = togglePomodoroExpand;
window.setPomodoroTime = setPomodoroTime;
window.togglePomodoro = togglePomodoro;
window.resetPomodoro = resetPomodoro;
