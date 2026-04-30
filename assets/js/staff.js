import {
  getStaffByPinIn, getStaffByPinOut,
  getActiveSessionByStaff, createSession, removeSession,
  saveShiftRecord
} from './storage.js';

// ─── STATE ───────────────────────────────────────────────────────────────────
let timerInterval = null;
let currentEntry = '';
let shiftMode = 'clockin'; // 'clockin' | 'clockout'

// ─── ELEMENTS ────────────────────────────────────────────────────────────────
const pinDots = document.getElementById('pinDots');
const pinError = document.getElementById('pinError');
const pinScreen = document.getElementById('pinScreen');
const shiftScreen = document.getElementById('shiftScreen');
const shiftName = document.getElementById('shiftName');
const shiftRole = document.getElementById('shiftRole');
const shiftClockIn = document.getElementById('shiftClockIn');
const shiftTimer = document.getElementById('shiftTimer');
const shiftEarnings = document.getElementById('shiftEarnings');
const modeLabel = document.getElementById('modeLabel');
const modeSubLabel = document.getElementById('modeSubLabel');
const endShiftBtn = document.getElementById('endShiftBtn');
const clockoutPanel = document.getElementById('clockoutPanel');
const clockoutPinDots = document.getElementById('clockoutPinDots');
const clockoutError = document.getElementById('clockoutError');
const cancelClockout = document.getElementById('cancelClockout');

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `<span class="toast__icon">${type === 'success' ? '✓' : '✕'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  setTimeout(() => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// ─── PIN DOT DISPLAY ─────────────────────────────────────────────────────────
function updateDots(entry, dotsEl) {
  const dots = dotsEl.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('dot--filled', i < entry.length);
  });
}

function shakeError(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ─── KEYPAD INPUT ────────────────────────────────────────────────────────────
document.querySelectorAll('[data-key]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;

    if (clockoutPanel.classList.contains('panel--visible')) {
      handleClockoutKey(key);
    } else {
      handleClockInKey(key);
    }
  });
});

function handleClockInKey(key) {
  if (key === 'del') {
    currentEntry = currentEntry.slice(0, -1);
  } else if (currentEntry.length < 6) {
    currentEntry += key;
  }
  updateDots(currentEntry, pinDots);
  pinError.textContent = '';

  if (currentEntry.length === 6) {
    setTimeout(() => processClockIn(currentEntry), 120);
  }
}

let clockoutEntry = '';
const confirmClockoutBtn = document.getElementById('confirmClockoutBtn');

function handleClockoutKey(key) {
  if (key === 'del') {
    clockoutEntry = clockoutEntry.slice(0, -1);
  } else if (clockoutEntry.length < 6) {
    clockoutEntry += key;
  }
  updateDots(clockoutEntry, clockoutPinDots);
  clockoutError.textContent = '';

  // Enable confirm button when 6 digits entered
  if (confirmClockoutBtn) {
    if (clockoutEntry.length === 6) {
      confirmClockoutBtn.style.opacity = '1';
      confirmClockoutBtn.style.pointerEvents = 'auto';
    } else {
      confirmClockoutBtn.style.opacity = '0.5';
      confirmClockoutBtn.style.pointerEvents = 'none';
    }
  }

  if (clockoutEntry.length === 6) {
    setTimeout(() => processClockOut(clockoutEntry), 120);
  }
}

// ─── CLOCK IN ────────────────────────────────────────────────────────────────
function processClockIn(pin) {
  const staff = getStaffByPinIn(pin);
  currentEntry = '';
  updateDots('', pinDots);

  if (!staff) {
    pinError.textContent = 'Invalid PIN. Please try again.';
    shakeError(pinDots);
    return;
  }

  const existing = getActiveSessionByStaff(staff.id);
  if (existing) {
    pinError.textContent = `${staff.name} is already clocked in.`;
    shakeError(pinDots);
    return;
  }

  const session = {
    staffId: staff.id,
    clockInTime: new Date().toISOString(),
  };
  createSession(session);
  toast(`Welcome, ${staff.name}! Shift started.`);
  showShiftScreen(staff, session);
}

// ─── CLOCK OUT ───────────────────────────────────────────────────────────────
function processClockOut(pin) {
  const staff = getStaffByPinOut(pin);
  clockoutEntry = '';
  updateDots('', clockoutPinDots);

  if (!staff) {
    clockoutError.textContent = 'Invalid clock-out PIN.';
    shakeError(clockoutPinDots);
    return;
  }

  const session = getActiveSessionByStaff(staff.id);
  if (!session) {
    clockoutError.textContent = `No active session found for ${staff.name}.`;
    shakeError(clockoutPinDots);
    return;
  }

  const clockOutTime = new Date().toISOString();
  const totalMs = new Date(clockOutTime) - new Date(session.clockInTime);
  const totalHours = totalMs / 3600000;

  saveShiftRecord({
    id: crypto.randomUUID(),
    staffId: staff.id,
    clockInTime: session.clockInTime,
    clockOutTime,
    totalHours,
  });

  removeSession(staff.id);
  stopTimer();

  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  toast(`Shift ended. ${h}h ${m}m worked. See you soon!`, 'success');

  hideClockoutPanel();
  showPinScreen();
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────────
function showPinScreen() {
  shiftScreen.classList.remove('screen--visible');
  pinScreen.classList.add('screen--visible');
  currentEntry = '';
  updateDots('', pinDots);
  pinError.textContent = '';
  modeLabel.textContent = 'Clock In';
  modeSubLabel.textContent = 'Enter your 6-digit clock-in PIN';
}

function showShiftScreen(staff, session) {
  pinScreen.classList.remove('screen--visible');
  shiftScreen.classList.add('screen--visible');

  shiftName.textContent = staff.name;
  shiftRole.textContent = staff.role;
  shiftClockIn.textContent = new Date(session.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  startTimer(session.clockInTime, staff.hourlyRate);
}

function startTimer(clockInISO, hourlyRate) {
  stopTimer();
  const startTime = new Date(clockInISO);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    shiftTimer.textContent = `${h}:${m}:${s}`;

    if (shiftEarnings && hourlyRate > 0) {
      const earnings = (elapsed / 3600) * hourlyRate;
      shiftEarnings.textContent = `$${earnings.toFixed(2)}`;
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function showClockoutPanel() {
  clockoutEntry = '';
  updateDots('', clockoutPinDots);
  clockoutError.textContent = '';
  if (confirmClockoutBtn) {
    confirmClockoutBtn.style.opacity = '0.5';
    confirmClockoutBtn.style.pointerEvents = 'none';
  }
  clockoutPanel.classList.add('panel--visible');
}

function hideClockoutPanel() {
  clockoutPanel.classList.remove('panel--visible');
}

// ─── END SHIFT BUTTON ────────────────────────────────────────────────────────
endShiftBtn.addEventListener('click', showClockoutPanel);
cancelClockout.addEventListener('click', hideClockoutPanel);

// ─── RESTORE ACTIVE SESSION ON LOAD ──────────────────────────────────────────
function restoreSession() {
  // Check if there's a single active session to restore
  // (Staff screen is single-user; admin manages all)
  // For multi-user kiosk mode, we just show the login screen
  showPinScreen();
}

// ─── INACTIVITY LOGOUT ───────────────────────────────────────────────────────
let inactivityTimer;
const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

function resetInactivity() {
  clearTimeout(inactivityTimer);
  if (shiftScreen.classList.contains('screen--visible')) return; // don't log out during active shift
  inactivityTimer = setTimeout(() => {
    currentEntry = '';
    updateDots('', pinDots);
    pinError.textContent = '';
    toast('Session timed out for security', 'info');
  }, INACTIVITY_MS);
}

['click', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, resetInactivity));

// ─── INIT ────────────────────────────────────────────────────────────────────
restoreSession();

// ========== NATIVE KEYBOARD HELPER FOR PHONES ==========
// Adds a hidden input field that, when focused, shows the phone's numeric keypad.
// Tapping on the PIN dots area focuses the hidden input, and digits / backspace
// are forwarded to the existing keypad handlers (without breaking the custom keypad).
(function() {
  // Create hidden input
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'tel';
  hiddenInput.inputMode = 'numeric';
  hiddenInput.pattern = '[0-9]*';
  hiddenInput.setAttribute('autocomplete', 'off');
  hiddenInput.style.position = 'fixed';
  hiddenInput.style.top = '-100px';
  hiddenInput.style.left = '-100px';
  hiddenInput.style.opacity = '0';
  hiddenInput.style.pointerEvents = 'none';
  hiddenInput.style.height = '0';
  hiddenInput.style.width = '0';
  document.body.appendChild(hiddenInput);

  // Helper to simulate a keypad button click
  function pressKeypadKey(keyValue) {
    const keyButton = document.querySelector(`.key[data-key="${keyValue}"]`);
    if (keyButton) {
      keyButton.click();
    }
  }

  // Function to focus hidden input and show native keyboard when PIN dots are tapped
  const pinDotsContainers = [pinDots, clockoutPinDots];
  pinDotsContainers.forEach(container => {
    if (container) {
      container.addEventListener('click', (e) => {
        e.stopPropagation();
        hiddenInput.value = '';
        hiddenInput.focus();
      });
    }
  });

  // Map native keyboard digits to keypad clicks
  hiddenInput.addEventListener('input', (e) => {
    let newValue = e.target.value;
    const lastChar = newValue.slice(-1);
    if (/[0-9]/.test(lastChar)) {
      pressKeypadKey(lastChar);
    }
    hiddenInput.value = ''; // clear after each digit to avoid repetition
  });

  // Map backspace/delete from native keyboard to the 'del' key
  hiddenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      pressKeypadKey('del');
    }
  });

  // When any custom keypad button is tapped, blur the hidden input to avoid double input
  document.querySelectorAll('.key').forEach(btn => {
    btn.addEventListener('click', () => {
      hiddenInput.blur();
    });
  });
})();
