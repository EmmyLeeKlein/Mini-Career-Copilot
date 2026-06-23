// Simulation.js
// Responsibility: Run the interactive "Interview Simulation" — let the user
//                 pick a scenario, then hold a live multi-turn mock interview
//                 with the AI interviewer in a chat interface.
//
// Inputs:  selected_scenario (from the scenario cards on screen-simulation)
//          user answers      (typed into #sim-input)
// Outputs: a running chat transcript rendered into #sim-chat
//
// Connects to: ai.js   (runSimulation — calls the Vercel serverless function)
//              app.js  (showScreen, showToast, escapeHtml, selectedRole, selectedLevel)
//
// Note: a simulation is STATEFUL. Unlike the one-shot kit, every turn we send
//       the whole conversation so far (simHistory) because the model has no
//       memory between calls.

// ─── State ───────────────────────────────────────────────────────────────────
let selectedScenario     = 'First Interview';
let selectedScenarioDesc = 'A typical first interview with general questions about you and your experience.';
let simHistory           = [];     // [{ role: 'assistant' | 'user', content: string }]
let simBusy              = false;  // true while waiting on the AI (locks input/buttons)
let currentSimulationId  = null;   // Supabase simulations.id (signed-in users only)

// ─── Scenario Selection ────────────────────────────────────────────────────────
/**
 * Highlights the chosen scenario card and updates the detail panel.
 * Called from each card's onclick on screen-simulation.
 */
function selectScenario(card) {
  document.querySelectorAll('.sim-scenario-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  selectedScenario     = card.dataset.scenario;
  selectedScenarioDesc = card.dataset.desc;

  document.getElementById('sim-detail-title').textContent = selectedScenario;
  document.getElementById('sim-detail-desc').textContent  = selectedScenarioDesc;
}

// ─── Start a Simulation ─────────────────────────────────────────────────────────
/**
 * Begins a fresh interview for the currently selected scenario.
 * Clears any previous transcript, asks the AI for an opening question,
 * and shows a typing indicator while waiting.
 */
async function startSimulation() {
  if (simBusy) return;

  simHistory = [];
  currentSimulationId = null;
  document.getElementById('sim-chat').innerHTML = '';
  setSimInputEnabled(true);

  const role  = typeof selectedRole  !== 'undefined' ? selectedRole  : null;
  const level = typeof selectedLevel !== 'undefined' ? selectedLevel : null;

  simBusy = true;
  showSimTyping();
  try {
    currentSimulationId = await dbCreateSimulation(selectedScenario, role, level);

    const result = await runSimulation({
      scenario: selectedScenario,
      role,
      level,
      history:  simHistory
    });
    removeSimTyping();
    addSimMessage('ai', result.message);
    simHistory.push({ role: 'assistant', content: result.message });
    dbAddSimulationMessage(currentSimulationId, simHistory.length, 'interviewer', result.message);

    if (result.isDemo) {
      showToast('Demo mode — showing a sample interview. Live AI is temporarily unavailable.');
    }
  } catch (err) {
    removeSimTyping();
    showToast('Could not start the simulation. Please try again.');
  } finally {
    simBusy = false;
    document.getElementById('sim-input').focus();
  }
}

// ─── Send the Candidate's Answer ────────────────────────────────────────────────
/**
 * Sends the user's typed answer, then renders the interviewer's next turn.
 */
async function sendSimMessage() {
  const input = document.getElementById('sim-input');
  const text  = input.value.trim();
  if (!text || simBusy) return;

  // If the user starts typing before pressing Start, kick the interview off implicitly.
  addSimMessage('user', text);
  simHistory.push({ role: 'user', content: text });
  dbAddSimulationMessage(currentSimulationId, simHistory.length, 'candidate', text);
  input.value = '';

  const role  = typeof selectedRole  !== 'undefined' ? selectedRole  : null;
  const level = typeof selectedLevel !== 'undefined' ? selectedLevel : null;

  simBusy = true;
  showSimTyping();
  try {
    const result = await runSimulation({
      scenario: selectedScenario,
      role,
      level,
      history:  simHistory
    });
    removeSimTyping();
    addSimMessage('ai', result.message);
    simHistory.push({ role: 'assistant', content: result.message });
    dbAddSimulationMessage(currentSimulationId, simHistory.length, 'interviewer', result.message);

    const userTurns = simHistory.filter(m => m.role === 'user').length;
    if (userTurns >= 5) {
      dbCompleteSimulation(currentSimulationId, result.message);
    }
  } catch (err) {
    removeSimTyping();
    showToast('Could not get a response. Please try again.');
  } finally {
    simBusy = false;
  }
}

// ─── Render a Chat Bubble ────────────────────────────────────────────────────────
/**
 * Appends one message bubble to the transcript and scrolls to it.
 * `sender` is 'ai' or 'user'.
 */
function addSimMessage(sender, text) {
  const chat = document.getElementById('sim-chat');
  const wrap = document.createElement('div');
  wrap.className = 'sim-msg ' + (sender === 'ai' ? 'sim-msg--ai' : 'sim-msg--user');

  const avatar = sender === 'ai' ? '🤖' : '🙂';
  const ticks  = sender === 'user'
    ? ' <svg width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M1 4.5L4 7.5L9 1.5" stroke="#A6ABC8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 4.5L8 7.5L13 1.5" stroke="#A6ABC8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '';

  wrap.innerHTML =
    '<div class="sim-avatar">' + avatar + '</div>' +
    '<div class="sim-bubble-wrap">' +
      '<div class="sim-bubble">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>' +
      '<span class="sim-msg-time">' + nowTime() + ticks + '</span>' +
    '</div>';

  chat.appendChild(wrap);
  scrollSimToBottom();
}

// ─── Typing Indicator ────────────────────────────────────────────────────────────
function showSimTyping() {
  const chat = document.getElementById('sim-chat');
  const el = document.createElement('div');
  el.className = 'sim-msg sim-msg--ai';
  el.id = 'sim-typing';
  el.innerHTML =
    '<div class="sim-avatar">🤖</div>' +
    '<div class="sim-bubble-wrap">' +
      '<div class="sim-bubble"><span class="spinner" style="border-color:rgba(108,77,255,.25);border-top-color:var(--primary)"></span></div>' +
    '</div>';
  chat.appendChild(el);
  scrollSimToBottom();
}

function removeSimTyping() {
  const el = document.getElementById('sim-typing');
  if (el) el.remove();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────
function scrollSimToBottom() {
  const scroll = document.querySelector('#screen-simulation .sim-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function setSimInputEnabled(on) {
  document.getElementById('sim-input').disabled    = !on;
  document.getElementById('sim-send-btn').disabled = !on;
}

// ─── Enter-to-send ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('sim-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendSimMessage(); }
    });
  }
});