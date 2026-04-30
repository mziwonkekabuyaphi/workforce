import {
  getAllStaff, saveStaff, updateStaff, deleteStaff,
  getActiveSessions, getShiftHistory,
  getTotalHoursByStaff, weeklyReset
} from './storage.js';

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `
    <span class="toast__icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  setTimeout(() => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function showModal(title, html, onConfirm) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  overlay.classList.add('modal--visible');
  document.getElementById('modalConfirm').onclick = () => {
    if (onConfirm()) closeModal();
  };
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('modal--visible');
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('nav__item--active'));
      btn.classList.add('nav__item--active');
      document.querySelectorAll('[data-section]').forEach(s => s.classList.remove('section--visible'));
      document.querySelector(`[data-section="${target}"]`).classList.add('section--visible');
    });
  });
}

// ─── PIN INPUT BUILDER ───────────────────────────────────────────────────────
function makePinInput(id, label) {
  return `
    <div class="form__field">
      <label for="${id}">${label}</label>
      <div class="pin-field-wrap">
        <input type="password" id="${id}" name="${id}" maxlength="6" pattern="\\d{6}" 
          placeholder="••••••" autocomplete="off" class="pin-field" inputmode="numeric">
        <button type="button" class="pin-toggle" data-target="${id}" title="Toggle visibility">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>`;
}

document.addEventListener('click', e => {
  if (e.target.closest('.pin-toggle')) {
    const btn = e.target.closest('.pin-toggle');
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
  }
});

// ─── STAFF FORM ──────────────────────────────────────────────────────────────
function initStaffForm() {
  const form = document.getElementById('staffForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('sName').value.trim();
    const role = document.getElementById('sRole').value.trim();
    const rate = parseFloat(document.getElementById('sRate').value);
    const pinIn = document.getElementById('sPinIn').value.trim();
    const pinOut = document.getElementById('sPinOut').value.trim();

    if (!name) return toast('Name is required', 'error');
    if (!/^\d{6}$/.test(pinIn)) return toast('Clock-in PIN must be exactly 6 digits', 'error');
    if (!/^\d{6}$/.test(pinOut)) return toast('Clock-out PIN must be exactly 6 digits', 'error');
    if (pinIn === pinOut) return toast('Clock-in and clock-out PINs must be different', 'error');

    const existing = getAllStaff();
    if (existing.some(s => s.pinIn === pinIn || s.pinOut === pinIn))
      return toast('Clock-in PIN already in use', 'error');
    if (existing.some(s => s.pinIn === pinOut || s.pinOut === pinOut))
      return toast('Clock-out PIN already in use', 'error');

    const staff = {
      id: crypto.randomUUID(),
      name,
      role: role || 'Staff',
      hourlyRate: isNaN(rate) ? 0 : rate,
      pinIn,
      pinOut,
      createdAt: new Date().toISOString(),
    };

    saveStaff(staff);
    form.reset();
    toast(`${name} added successfully`);
    renderAll();
  });
}

// ─── STATS CARDS ─────────────────────────────────────────────────────────────
function renderStats() {
  const staff = getAllStaff();
  const active = getActiveSessions();
  const history = getShiftHistory();

  const today = new Date();
  const todayStr = today.toDateString();
  const todayHours = history
    .filter(r => new Date(r.clockOutTime).toDateString() === todayStr)
    .reduce((s, r) => s + r.totalHours, 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekHours = history
    .filter(r => new Date(r.clockOutTime) >= weekStart)
    .reduce((s, r) => s + r.totalHours, 0);

  document.getElementById('statTotal').textContent = staff.length;
  document.getElementById('statActive').textContent = active.length;
  document.getElementById('statTodayHours').textContent = todayHours.toFixed(1) + 'h';
  document.getElementById('statWeekHours').textContent = weekHours.toFixed(1) + 'h';
}

// ─── ACTIVE STAFF BANNER ─────────────────────────────────────────────────────
function renderActiveBanner() {
  const sessions = getActiveSessions();
  const staff = getAllStaff();
  const wrap = document.getElementById('activeBanner');

  if (!sessions.length) {
    wrap.innerHTML = `<p class="empty-state">No staff currently on shift.</p>`;
    return;
  }

  wrap.innerHTML = sessions.map(sess => {
    const member = staff.find(s => s.id === sess.staffId);
    if (!member) return '';
    const elapsed = Math.floor((Date.now() - new Date(sess.clockInTime)) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    return `
      <div class="active-card" id="active-${member.id}">
        <div class="active-card__avatar">${member.name[0].toUpperCase()}</div>
        <div class="active-card__info">
          <span class="active-card__name">${member.name}</span>
          <span class="active-card__role">${member.role}</span>
        </div>
        <div class="active-card__timer" data-start="${sess.clockInTime}">${h}:${m}:${s}</div>
        <span class="badge badge--green">ON SHIFT</span>
      </div>`;
  }).join('');
}

// Live timer tick for active banner
setInterval(() => {
  document.querySelectorAll('.active-card__timer').forEach(el => {
    const start = new Date(el.dataset.start);
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  });
}, 1000);

// ─── STAFF TABLE ─────────────────────────────────────────────────────────────
function renderStaffTable() {
  const staff = getAllStaff();
  const sessions = getActiveSessions();
  const tbody = document.getElementById('staffTableBody');

  if (!staff.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No staff added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = staff.map(member => {
    const isActive = sessions.some(s => s.staffId === member.id);
    const totalHrs = getTotalHoursByStaff(member.id).toFixed(1);
    return `
      <tr class="${isActive ? 'row--active' : ''}">
        <td>
          <div class="staff-name-cell">
            <div class="avatar">${member.name[0].toUpperCase()}</div>
            <div>
              <div class="staff-name">${member.name}</div>
              <div class="staff-role-label">${member.role}</div>
            </div>
          </div>
        </td>
        <td>${member.role}</td>
        <td>$${member.hourlyRate.toFixed(2)}/hr</td>
        <td>${totalHrs}h</td>
        <td>
          ${isActive
            ? '<span class="badge badge--green">● Active</span>'
            : '<span class="badge badge--neutral">Off shift</span>'}
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-icon--edit" data-id="${member.id}" title="Edit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-icon--delete" data-id="${member.id}" title="Delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Edit handler
  tbody.querySelectorAll('.btn-icon--edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  // Delete handler
  tbody.querySelectorAll('.btn-icon--delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const member = getAllStaff().find(s => s.id === btn.dataset.id);
      if (!member) return;
      showModal('Confirm Delete', `<p>Are you sure you want to delete <strong>${member.name}</strong>? This cannot be undone.</p>`, () => {
        deleteStaff(member.id);
        toast(`${member.name} removed`, 'info');
        renderAll();
        return true;
      });
    });
  });
}

// ─── SHIFT HISTORY TABLE ─────────────────────────────────────────────────────
function renderHistory() {
  const history = getShiftHistory().slice().reverse();
  const staff = getAllStaff();
  const tbody = document.getElementById('historyTableBody');

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No completed shifts yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(rec => {
    const member = staff.find(s => s.id === rec.staffId);
    const name = member?.name ?? 'Unknown';
    const role = member?.role ?? '—';
    const rate = member?.hourlyRate ?? 0;
    const earnings = (rec.totalHours * rate).toFixed(2);
    const inTime = new Date(rec.clockInTime).toLocaleString();
    const outTime = new Date(rec.clockOutTime).toLocaleString();
    return `
      <tr>
        <td>
          <div class="staff-name-cell">
            <div class="avatar avatar--sm">${name[0].toUpperCase()}</div>
            <div>
              <div class="staff-name">${name}</div>
              <div class="staff-role-label">${role}</div>
            </div>
          </div>
        </td>
        <td>${inTime}</td>
        <td>${outTime}</td>
        <td><strong>${rec.totalHours.toFixed(2)}h</strong></td>
        <td><span class="earnings">$${earnings}</span></td>
      </tr>`;
  }).join('');
}

// ─── EDIT MODAL ──────────────────────────────────────────────────────────────
function openEditModal(id) {
  const member = getAllStaff().find(s => s.id === id);
  if (!member) return;
  const html = `
    <div class="form-grid">
      <div class="form__field">
        <label>Full Name</label>
        <input type="text" id="editName" value="${member.name}">
      </div>
      <div class="form__field">
        <label>Role</label>
        <input type="text" id="editRole" value="${member.role}">
      </div>
      <div class="form__field">
        <label>Hourly Rate ($)</label>
        <input type="number" id="editRate" value="${member.hourlyRate}" min="0" step="0.01">
      </div>
      ${makePinInput('editPinIn', 'Clock-in PIN (6-digit)')}
      ${makePinInput('editPinOut', 'Clock-out PIN (6-digit)')}
    </div>`;

  showModal(`Edit — ${member.name}`, html, () => {
    const name = document.getElementById('editName').value.trim();
    const role = document.getElementById('editRole').value.trim();
    const rate = parseFloat(document.getElementById('editRate').value);
    const pinIn = document.getElementById('editPinIn').value.trim() || member.pinIn;
    const pinOut = document.getElementById('editPinOut').value.trim() || member.pinOut;

    if (!name) { toast('Name required', 'error'); return false; }
    if (!/^\d{6}$/.test(pinIn)) { toast('Clock-in PIN must be 6 digits', 'error'); return false; }
    if (!/^\d{6}$/.test(pinOut)) { toast('Clock-out PIN must be 6 digits', 'error'); return false; }
    if (pinIn === pinOut) { toast('PINs must differ', 'error'); return false; }

    updateStaff(id, { name, role: role || 'Staff', hourlyRate: isNaN(rate) ? 0 : rate, pinIn, pinOut });
    toast(`${name} updated`);
    renderAll();
    return true;
  });
}

// ─── WEEKLY RESET ────────────────────────────────────────────────────────────
document.getElementById('btnWeeklyReset')?.addEventListener('click', () => {
  showModal('Weekly Reset', '<p>This will clear all shift history older than 7 days. Are you sure?</p>', () => {
    weeklyReset();
    toast('Weekly reset complete', 'info');
    renderAll();
    return true;
  });
});

// ─── MOBILE SIDEBAR ──────────────────────────────────────────────────────────
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('sidebar--open');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('sidebar--open');
});

// ─── MODAL CLOSE ─────────────────────────────────────────────────────────────
document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalCancel')?.addEventListener('click', closeModal);
document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ─── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderActiveBanner();
  renderStaffTable();
  renderHistory();
}

// ─── INIT ────────────────────────────────────────────────────────────────────
initNav();
initStaffForm();
renderAll();
setInterval(renderStats, 5000);
setInterval(renderActiveBanner, 10000);

// ─── AUTO COLLAPSE SIDEBAR ON MOBILE WHEN NAV ITEM IS CLICKED ────────────────
function closeSidebarOnMobile() {
  if (window.innerWidth < 900) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('sidebar--open')) {
      sidebar.classList.remove('sidebar--open');
      if (overlay) overlay.style.display = 'none';
    }
  }
}

// Add listener to all existing .nav__item elements
document.querySelectorAll('.nav__item').forEach(item => {
  item.addEventListener('click', closeSidebarOnMobile);
});

// Watch for dynamically added .nav__item elements (future‑proof)
const sidebarCollapseObserver = new MutationObserver(() => {
  document.querySelectorAll('.nav__item:not([data-sidebar-closer])').forEach(item => {
    item.setAttribute('data-sidebar-closer', 'true');
    item.addEventListener('click', closeSidebarOnMobile);
  });
});
sidebarCollapseObserver.observe(document.body, { childList: true, subtree: true });
