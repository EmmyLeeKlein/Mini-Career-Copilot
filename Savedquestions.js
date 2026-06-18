// SavedQuestions.js
// Responsibility: Display the user's saved interview questions and their
//                 edited answers. Allow reopening a question for viewing
//                 or re-editing.
//
// Inputs:  saved_interview_kit  — derived from savedSet (question indices)
//                                 and editedAnswers (from AnswerEditor.js)
// Outputs: displayed_saved_content — rendered list on screen-saved
//
// Connects to: app.js        (savedSet, questions, selectedRole, selectedLevel)
//              AnswerEditor.js (getEditedAnswer, hasEditedAnswer, openAnswerEditor)

// ─── Open Saved Questions Screen ─────────────────────────────────────────────
/**
 * Renders all saved questions and navigates to the saved screen.
 * Called from the "My Kits" nav or the Saved tab.
 */
function openSavedQuestions() {
  renderSavedQuestions();
  showScreen('screen-saved');
}

// ─── Render Saved Questions ───────────────────────────────────────────────────
/**
 * Builds and renders the full list of saved questions,
 * including edited answers where they exist.
 */
function renderSavedQuestions() {
  const container = document.getElementById('saved-questions-container');
  const emptyState = document.getElementById('saved-empty-state');
  const headerMeta = document.getElementById('saved-header-meta');

  // Update header meta info
  if (selectedRole && selectedLevel) {
    headerMeta.textContent = `${selectedRole} · ${selectedLevel}`;
  } else {
    headerMeta.textContent = '';
  }

  // Get all saved question indices, sorted
  const savedIndices = [...savedSet].sort((a, b) => a - b);

  // Show empty state if nothing saved
  if (savedIndices.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    document.getElementById('saved-count-badge').textContent = '0 saved';
    return;
  }

  emptyState.classList.add('hidden');
  document.getElementById('saved-count-badge').textContent =
    `${savedIndices.length} saved`;

  container.innerHTML = '';

  savedIndices.forEach((idx, displayPos) => {
    const q = questions[idx];
    if (!q) return;

    const edited      = getEditedAnswer(idx);
    const hasEdit     = hasEditedAnswer(idx);
    const answerToShow = edited !== null ? edited : q.example;

    const card = document.createElement('div');
    card.className = 'saved-question-card';
    card.innerHTML = `
      <div class="saved-card-header">
        <div class="saved-card-num-badge">${displayPos + 1}</div>
        <div class="saved-card-title-wrap">
          <p class="saved-card-question">${escapeHtml(q.question)}</p>
          ${hasEdit
            ? '<span class="saved-edited-tag">✏️ Edited</span>'
            : '<span class="saved-ai-tag">✦ AI Answer</span>'
          }
        </div>
        <button class="saved-card-remove-btn"
          onclick="removeSavedQuestion(event, ${idx})"
          aria-label="Remove from saved">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13"
              stroke="#A6ABC8" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="saved-card-answer-section">
        <p class="saved-card-answer-label">${hasEdit ? 'Your Answer' : 'AI Example'}</p>
        <p class="saved-card-answer-text">${escapeHtml(answerToShow)}</p>
      </div>

      <div class="saved-card-actions">
        <button class="saved-card-btn saved-card-btn--secondary"
          onclick="openQuestion(${idx})">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#6C4DFF" stroke-width="1.4"/>
            <path d="M7 5v2.5l1.5 1.5" stroke="#6C4DFF"
              stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          View Question
        </button>
        <button class="saved-card-btn saved-card-btn--primary"
          onclick="openAnswerEditor(${idx})">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l3 3-7 7H2v-3L9 2z"
              stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
          ${hasEdit ? 'Edit Again' : 'Edit Answer'}
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ─── Remove a Saved Question ──────────────────────────────────────────────────
/**
 * Removes a question from the saved set.
 * Confirms with user first via a toast-style confirmation.
 * Does NOT remove the edited answer — it's preserved in case
 * the user saves the question again later.
 */
function removeSavedQuestion(event, idx) {
  event.stopPropagation();

  savedSet.delete(idx);
  updateSavedTab();
  renderSavedQuestions();
  renderList();

  showToast('Question removed from saved.');
}

// ─── Clear All Saved ──────────────────────────────────────────────────────────
/**
 * Clears all saved questions after confirmation.
 * Called from the "Clear All" button on the saved screen header.
 */
function clearAllSaved() {
  if (savedSet.size === 0) return;

  // Use native confirm since we have no modal system yet
  const confirmed = window.confirm(
    `Remove all ${savedSet.size} saved question${savedSet.size > 1 ? 's' : ''}? This cannot be undone.`
  );

  if (!confirmed) return;

  savedSet.clear();
  updateSavedTab();
  renderSavedQuestions();
  renderList();

  showToast('All saved questions cleared.');
}

// ─── Refresh (called after editing) ──────────────────────────────────────────
/**
 * Re-renders the saved questions screen if it's currently active.
 * Called by AnswerEditor after a save to keep the list in sync.
 */
function refreshSavedIfVisible() {
  const savedScreen = document.getElementById('screen-saved');
  if (savedScreen && savedScreen.classList.contains('active')) {
    renderSavedQuestions();
  }
}