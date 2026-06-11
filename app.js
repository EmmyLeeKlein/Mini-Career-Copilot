// app.js — Career Copilot Mini MVP
// Multi-screen navigation, state management, question rendering

// ─── State ───────────────────────────────────────────────────
let selectedRole  = null;
let selectedLevel = null;
let questions     = [];
let savedSet      = new Set();   // indices of saved questions
let currentQuestionIndex = 0;
let activeTab = 'all';

// ─── Screen Navigation ───────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
  }
}

// ─── Role Selection ──────────────────────────────────────────
function selectRole(btn) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  selectedRole = btn.dataset.role;
  document.getElementById('role-error').classList.remove('visible');
}

// ─── Level Selection ─────────────────────────────────────────
function selectLevel(level, btn) {
  document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedLevel = level;
  document.getElementById('level-error').classList.remove('visible');

  // Show hint
  const hints = {
    Student: "We'll tailor the questions to your level using academic projects, coursework and personal initiatives.",
    Junior:  "We'll focus on practical experience, real challenges you've solved and learnings from early projects."
  };
  const hintCard = document.getElementById('level-hint');
  const hintText = document.getElementById('hint-text');
  hintText.textContent = hints[level] || '';
  hintCard.style.display = 'flex';
}

// ─── Generate Kit ─────────────────────────────────────────────
async function handleGenerate() {
  let valid = true;

  if (!selectedRole) {
    document.getElementById('role-error').classList.add('visible');
    valid = false;
  }
  if (!selectedLevel) {
    document.getElementById('level-error').classList.add('visible');
    valid = false;
  }
  if (!valid) return;

  setGenerateLoading(true);

  try {
    const result = await generateKit(selectedRole, selectedLevel);
    questions = result.questions;
    savedSet  = new Set();

    renderQuestionsList();
    showScreen('screen-questions');

    if (result.isDemo) {
      document.getElementById('demo-banner').classList.remove('hidden');
    } else {
      document.getElementById('demo-banner').classList.add('hidden');
    }
  } catch (err) {
    showToast('Something went wrong. Please try again.');
  } finally {
    setGenerateLoading(false);
  }
}

function setGenerateLoading(on) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = on;
  document.getElementById('btn-content').classList.toggle('hidden', on);
  document.getElementById('btn-loading').classList.toggle('hidden', !on);
}

// ─── Generate More ────────────────────────────────────────────
async function generateMore() {
  const btn = document.getElementById('generate-more-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const result = await generateKit(selectedRole, selectedLevel);
    const newQ = result.questions.filter(
      nq => !questions.some(eq => eq.question === nq.question)
    );
    questions = [...questions, ...newQ];
    renderQuestionsList();
  } catch {
    showToast('Could not generate more questions. Try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.2 4.2.6-3 2.9.7 4.3L8 11.2 4.3 13l.7-4.3-3-2.9 4.2-.6L8 1z" fill="white"/></svg>
      Generate More Questions`;
  }
}

// ─── Render Questions List ────────────────────────────────────
function renderQuestionsList() {
  // Header
  document.getElementById('qh-title').textContent = selectedRole + ' Kit';
  document.getElementById('qh-meta').textContent = selectedRole + ' · ' + selectedLevel;

  const total = questions.length;
  document.getElementById('progress-label').textContent = total + '/' + total;

  // Progress circle — full circle
  const circle = document.getElementById('progress-circle');
  const circumference = 2 * Math.PI * 22;
  circle.setAttribute('stroke-dasharray', circumference);
  circle.setAttribute('stroke-dashoffset', '0');

  updateSavedTab();
  renderList();
}

function renderList() {
  const list = document.getElementById('questions-list');
  list.innerHTML = '';

  const toShow = activeTab === 'all'
    ? questions
    : questions.filter((_, i) => savedSet.has(i));

  if (toShow.length === 0 && activeTab === 'saved') {
    list.innerHTML = `<li style="text-align:center;padding:32px 0;color:var(--text-placeholder);font-size:14px">No saved questions yet.<br>Tap the bookmark icon to save one.</li>`;
    return;
  }

  toShow.forEach((q, displayIdx) => {
    const realIdx = activeTab === 'all' ? displayIdx : [...savedSet][displayIdx];
    const isSaved = savedSet.has(activeTab === 'all' ? displayIdx : realIdx);

    const li = document.createElement('li');
    li.className = 'question-item';
    li.innerHTML = `
      <div class="question-num-badge">${(activeTab === 'all' ? displayIdx : realIdx) + 1}</div>
      <div class="question-item-body">
        <p class="question-item-text">${escapeHtml(q.question)}</p>
        ${isSaved ? '<span class="saved-tag">✓ Saved</span>' : ''}
      </div>
      <button class="bookmark-icon-btn" onclick="toggleSaveFromList(event, ${activeTab === 'all' ? displayIdx : realIdx})" aria-label="Save">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 3h10a1 1 0 011 1v13l-6-3.5L4 17V4a1 1 0 011-1z"
            fill="${isSaved ? 'var(--primary)' : 'none'}"
            stroke="${isSaved ? 'var(--primary)' : '#A6ABC8'}"
            stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    li.querySelector('.question-item-body').addEventListener('click', () => {
      openQuestion(activeTab === 'all' ? displayIdx : realIdx);
    });
    li.querySelector('.question-num-badge').addEventListener('click', () => {
      openQuestion(activeTab === 'all' ? displayIdx : realIdx);
    });
    list.appendChild(li);
  });
}

function updateSavedTab() {
  const savedCount = savedSet.size;
  document.getElementById('tab-saved').textContent = `Saved (${savedCount})`;
}

// ─── Tab Switching ────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
  document.getElementById('tab-' + tab).classList.add('tab-btn--active');
  renderList();
}

// ─── Save/Bookmark from List ──────────────────────────────────
function toggleSaveFromList(e, idx) {
  e.stopPropagation();
  if (savedSet.has(idx)) {
    savedSet.delete(idx);
  } else {
    savedSet.add(idx);
  }
  updateSavedTab();
  renderList();
}

// ─── Open Question Detail ─────────────────────────────────────
function openQuestion(idx) {
  currentQuestionIndex = idx;
  renderDetail();
  showScreen('screen-detail');
}

function renderDetail() {
  const q = questions[currentQuestionIndex];
  if (!q) return;

  document.getElementById('detail-progress').textContent =
    `Question ${currentQuestionIndex + 1} of ${questions.length}`;

  // Meta tags
  const metaEl = document.getElementById('detail-meta');
  metaEl.innerHTML = `
    <span class="detail-meta-tag">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke="#6C4DFF" stroke-width="1.2"/><path d="M3 5h6M3 7h4" stroke="#6C4DFF" stroke-width="1.2" stroke-linecap="round"/></svg>
      ${escapeHtml(selectedRole)}
    </span>
    <span class="detail-meta-tag" style="background:#DDEBFF;color:#4B7FFF">
      ${escapeHtml(selectedLevel)}
    </span>
  `;

  document.getElementById('detail-question-text').textContent = q.question;
  document.getElementById('detail-intent').textContent = q.intent;

  // Parse structure into numbered list items
  const structureList = document.getElementById('detail-structure');
  structureList.innerHTML = '';
  const steps = q.structure
    .split(/\.\s+|;\s+|\n/)
    .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(s => s.length > 8);

  (steps.length > 0 ? steps : [q.structure]).forEach((step, i) => {
    const li = document.createElement('li');
    li.className = 'structure-item';
    li.innerHTML = `<span class="structure-item-num">${i + 1}</span><span>${escapeHtml(step)}</span>`;
    structureList.appendChild(li);
  });

  document.getElementById('detail-example').textContent = q.example;

  // Bookmark state
  const bookmarkBtn = document.getElementById('detail-bookmark');
  if (savedSet.has(currentQuestionIndex)) {
    bookmarkBtn.classList.add('saved');
  } else {
    bookmarkBtn.classList.remove('saved');
  }

  // Prev/Next
  document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
  document.getElementById('next-btn').disabled = currentQuestionIndex === questions.length - 1;
}

// ─── Detail: Toggle Expand Sections ──────────────────────────
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const body    = section.querySelector('.ai-expand-body');
  const chevron = section.querySelector('.expand-chevron');
  body.classList.toggle('open');
  chevron.classList.toggle('open');
}

// ─── Detail: Bookmark ─────────────────────────────────────────
function toggleBookmark() {
  if (savedSet.has(currentQuestionIndex)) {
    savedSet.delete(currentQuestionIndex);
  } else {
    savedSet.add(currentQuestionIndex);
  }
  updateSavedTab();
  renderDetail();
  renderList();
}

// ─── Detail: Navigate Questions ──────────────────────────────
function navigateQuestion(dir) {
  const next = currentQuestionIndex + dir;
  if (next < 0 || next >= questions.length) return;
  currentQuestionIndex = next;
  renderDetail();
  // Scroll to top of detail
  document.querySelector('.detail-scroll').scrollTop = 0;
}

// ─── Edit Answer (placeholder) ────────────────────────────────
function editAnswer() {
  showToast('Answer editing coming soon!');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('error-toast');
  document.getElementById('error-toast-text').textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hidden');
  }, 3200);
}

// ─── Helpers ──────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}