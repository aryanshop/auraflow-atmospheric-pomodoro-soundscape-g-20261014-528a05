// State Management
const state = {
    mode: 'pomodoro',
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    isRunning: false,
    completedSessions: 0,
    timerId: null,
    soundEngineActive: false
};

const MODES = {
    pomodoro: { time: 25 * 60, status: 'Time to Focus' },
    shortBreak: { time: 5 * 60, status: 'Take a Breath' },
    longBreak: { time: 15 * 60, status: 'Rest & Recharge' }
};

// DOM Elements
const timerTimeEl = document.getElementById('timerTime');
const timerStatusEl = document.getElementById('timerStatus');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const progressBar = document.getElementById('progressBar');
const completedCountEl = document.getElementById('completedCount');
const modeBtns = document.querySelectorAll('.mode-btn');
const masterAudioBtn = document.getElementById('masterAudioBtn');
const themeDots = document.querySelectorAll('.theme-dot');
const sliders = document.querySelectorAll('.slider');

// Web Audio API Sound Synthesizer
let audioCtx = null;
let masterGain = null;
let soundNodes = {};

function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Create Rain (Filtered White Noise with modulation)
    soundNodes.rain = createRainNode();
    // Create Wind (Low-frequency filtered pinkish noise with LFO sweep)
    soundNodes.wind = createWindNode();
    // Create Vinyl (Impulse clicks + subtle rumble)
    soundNodes.vinyl = createVinylNode();
    // Create Waves (Filtered noise with slow volume oscillation)
    soundNodes.waves = createWavesNode();
}

function createWhiteNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

function createRainNode() {
    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = createWhiteNoiseBuffer();
    bufferSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.0;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    bufferSource.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    bufferSource.start();

    return { gain, source: bufferSource };
}

function createWindNode() {
    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = createWhiteNoiseBuffer();
    bufferSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 3.0;

    // LFO for wind howling effect
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.2;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 150;

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    bufferSource.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    bufferSource.start();

    return { gain, source: bufferSource };
}

function createVinylNode() {
    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = createWhiteNoiseBuffer();
    bufferSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    bufferSource.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    bufferSource.start();

    return { gain, source: bufferSource };
}

function createWavesNode() {
    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = createWhiteNoiseBuffer();
    bufferSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    // LFO for wave swelling
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.05;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    bufferSource.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    bufferSource.start();

    return { gain, source: bufferSource, baseGain: gain };
}

// UI & Timer Logic
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateDisplay() {
    timerTimeEl.textContent = formatTime(state.timeLeft);
    document.title = `${formatTime(state.timeLeft)} - AuraFlow`;

    const circumference = 729;
    const offset = circumference - (state.timeLeft / state.totalTime) * circumference;
    progressBar.style.strokeDashoffset = offset;
}

function setMode(newMode) {
    state.mode = newMode;
    state.timeLeft = MODES[newMode].time;
    state.totalTime = MODES[newMode].time;
    state.isRunning = false;
    clearInterval(state.timerId);
    startBtn.textContent = 'Start Session';
    timerStatusEl.textContent = MODES[newMode].status;

    modeBtns.forEach(btn => {
        if (btn.dataset.mode === newMode) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        }
    });

    updateDisplay();
}

function toggleTimer() {
    if (state.isRunning) {
        clearInterval(state.timerId);
        state.isRunning = false;
        startBtn.textContent = 'Resume Session';
        timerStatusEl.textContent = 'Paused';
    } else {
        if (!audioCtx && state.soundEngineActive) {
            initAudio();
        } else if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        state.isRunning = true;
        startBtn.textContent = 'Pause Session';
        timerStatusEl.textContent = MODES[state.mode].status;

        state.timerId = setInterval(() => {
            if (state.timeLeft > 0) {
                state.timeLeft--;
                updateDisplay();
            } else {
                clearInterval(state.timerId);
                state.isRunning = false;
                startBtn.textContent = 'Start Session';
                timerStatusEl.textContent = 'Session Complete!';
                if (state.mode === 'pomodoro') {
                    state.completedSessions++;
                    completedCountEl.textContent = state.completedSessions;
                }
                playChime();
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(state.timerId);
    state.isRunning = false;
    state.timeLeft = MODES[state.mode].time;
    state.totalTime = MODES[state.mode].time;
    startBtn.textContent = 'Start Session';
    timerStatusEl.textContent = MODES[state.mode].status;
    updateDisplay();
}

function playChime() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

// Event Listeners
startBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetTimer);

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
    });
});

masterAudioBtn.addEventListener('click', () => {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    state.soundEngineActive = !state.soundEngineActive;
    masterAudioBtn.setAttribute('aria-pressed', state.soundEngineActive);
    masterAudioBtn.textContent = state.soundEngineActive ? 'Sound Engine Active' : 'Enable Sound Engine';
    masterAudioBtn.style.background = state.soundEngineActive ? 'var(--accent)' : '';
});

sliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
        const soundType = e.target.dataset.sound;
        const val = parseFloat(e.target.value) / 100;

        if (!audioCtx && val > 0) {
            initAudio();
            state.soundEngineActive = true;
            masterAudioBtn.setAttribute('aria-pressed', 'true');
            masterAudioBtn.textContent = 'Sound Engine Active';
            masterAudioBtn.style.background = 'var(--accent)';
        }

        if (soundNodes && soundNodes[soundType]) {
            // Scale curve for nicer volume perception
            soundNodes[soundType].gain.gain.setValueAtTime(val * val * 0.4, audioCtx.currentTime);
        }
    });
});

themeDots.forEach(dot => {
    dot.addEventListener('click', () => {
        const theme = dot.dataset.theme;
        if (theme === 'midnight') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        themeDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
    });
});

// Initial setup
updateDisplay();
