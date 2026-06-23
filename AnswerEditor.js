// AnswerEditor.js
// Responsibility: Allow the user to personalize the AI-generated answer,
//                 save their edited version, and track changes per question.
//
// Inputs:  generated_answer (from questions[idx].example)
//          user_input       (what the user types)
// Outputs: edited_answer    (stored in editedAnswers map, keyed by question index)
//
// Connects to: app.js (openAnswerEditor / closeAnswerEditor called from detail screen)
//              SavedQuestions.js (edited answers are read there when displaying saved kits)

// ─── State ───────────────────────────────────────────────────────────────────
// Map of questionIndex → edited answer text
// Persisted in memory for the session; survives screen navigation
const editedAnswers = new Map();

// Track which question is currently being edited
let editorQuestionIndex = null;

// ─── Open Editor ─────────────────────────────────────────────────────────────
/**
 * Opens the answer editor for the question at `idx`.
 * Called from the "Edit Answer" button on screen-detail.
 * Pre-fills the textarea with the user's previous edit (if any),
 * otherwise falls back to the AI-generated example answer.
 */
function openAnswerEditor(idx) {
  editorQuestionIndex = idx;
  const q = questions[idx];
  if (!q) return;

  // Populate header info
  document.getElementById('editor-question-text').textContent = q.question;
  document.getElementById('editor-role-tag').textContent = selectedRole || '';
  document.getElementById('editor-level-tag').textContent = selectedLevel || '';

  // Show the original AI answer for reference
  document.getElementById('editor-original-text').textContent = q.example;

  // Pre-fill textarea: use saved edit if it exists, else use AI example
  const existing = editedAnswers.get(idx);
  const textarea = document.getElementById('editor-textarea');
  textarea.value = existing !== undefined ? existing : q.example;

  // Reset validation state
  document.getElementById('editor-error').classList.remove('visible');

  // Update char count
  updateCharCount();

  // Update save button label to reflect edit vs first-time
  document.getElementById('editor-save-btn').textContent =
    existing !== undefined ? '✓  Update Answer' : '✓  Save Answer';

  // Show the editor screen
  showScreen('screen-editor');

  // Focus textarea after transition
  setTimeout(() => textarea.focus(), 100);
}

// ─── Close Editor ─────────────────────────────────────────────────────────────
/**
 * Returns to the question detail screen without saving.
 */
function closeAnswerEditor() {
  showScreen('screen-detail');
}

// ─── Save Edited Answer ───────────────────────────────────────────────────────
/**
 * Validates and saves the user's edited answer.
 * Prevents saving if the textarea is empty.
 * Shows a success toast on save.
 */
function saveEditedAnswer() {
  const textarea = document.getElementById('editor-textarea');
  const value    = textarea.value.trim();
  const errorEl  = document.getElementById('editor-error');

  // Validation: prevent empty save
  if (!value) {
    errorEl.textContent = 'Answer cannot be empty. Please write something before saving.';
    errorEl.classList.add('visible');
    textarea.focus();
    return;
  }

  // Save to the editedAnswers map
  editedAnswers.set(editorQuestionIndex, value);

  // Mark question as saved (bookmark) automatically when an answer is edited
  savedSet.add(editorQuestionIndex);
  updateSavedTab();
  persistState();

  const q = questions[editorQuestionIndex];
  if (q && q.id) {
    dbSaveAnswerDraft(q.id, value);
    dbSetSaved(q.id, true);
  }

  // Update the save button label
  document.getElementById('editor-save-btn').textContent = '✓  Update Answer';

  // Show success feedback
  showToast('Answer saved! View it in your Saved Questions.');

  // Return to the detail screen
  showScreen('screen-detail');

  // Re-render detail so "Edit Answer" button reflects saved state
  renderDetail();
  renderList();
}

// ─── Reset to AI Answer ───────────────────────────────────────────────────────
/**
 * Resets the textarea back to the original AI-generated example answer.
 * Does not save — user still needs to click Save.
 */
function resetToOriginal() {
  const q = questions[editorQuestionIndex];
  if (!q) return;

  const textarea = document.getElementById('editor-textarea');
  textarea.value = q.example;
  updateCharCount();

  document.getElementById('editor-error').classList.remove('visible');
  showToast('Reset to original AI answer. Click Save to keep this.');
}

// ─── Character Counter ────────────────────────────────────────────────────────
/**
 * Updates the live character count shown below the textarea.
 */
function updateCharCount() {
  const textarea = document.getElementById('editor-textarea');
  const counter  = document.getElementById('editor-char-count');
  const len      = textarea.value.length;
  counter.textContent = `${len} character${len !== 1 ? 's' : ''}`;

  // Clear validation error as user types
  if (len > 0) {
    document.getElementById('editor-error').classList.remove('visible');
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
// These are called from app.js and index.html

/**
 * Returns the edited answer for a given question index,
 * or null if the user has not edited that question.
 */
function getEditedAnswer(idx) {
  return editedAnswers.has(idx) ? editedAnswers.get(idx) : null;
}

/**
 * Returns true if the user has a saved edit for the given question index.
 */
function hasEditedAnswer(idx) {
  return editedAnswers.has(idx);
}