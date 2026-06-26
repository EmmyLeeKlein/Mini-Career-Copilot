// db.js — Supabase persistence for logged-in users.
//
// Guest-first: every function here is a no-op (resolves to null) when
// nobody is signed in. Guests keep the existing localStorage-only
// behavior in app.js / AnswerEditor.js / Savedquestions.js untouched.
// All writes are best-effort: failures are logged, never block the UI.
//
// Connects to: auth.js (currentUser), app.js, AnswerEditor.js,
//              Savedquestions.js, simulation.js

// ─── Kits ──────────────────────────────────────────────────────────────────────
/**
 * Persists a freshly generated kit (role, level, 5 questions) and returns
 * { kitId, questions } where each question gets a `.id` (kit_questions row id)
 * merged in, matched by array order. Returns null for guests or on failure.
 */
async function dbCreateKit(role, level, questionsArr) {
  if (!currentUser) return null;
  try {
    const { data: kit, error: kitErr } = await supabaseClient
      .from('kits')
      .insert({ user_id: currentUser.id, role, level })
      .select()
      .single();
    if (kitErr) throw kitErr;

    const rows = questionsArr.map((q, i) => ({
      kit_id: kit.id,
      question_index: i + 1,
      question: q.question,
      intent: q.intent,
      structure: q.structure,
      example: q.example
    }));

    const { data: inserted, error: qErr } = await supabaseClient
      .from('kit_questions')
      .insert(rows)
      .select()
      .order('question_index');
    if (qErr) throw qErr;

    const questions = questionsArr.map((q, i) => ({ ...q, id: inserted[i].id }));
    return { kitId: kit.id, questions };
  } catch (err) {
    console.warn('dbCreateKit failed:', err.message);
    return null;
  }
}

/**
 * Appends more questions to an existing kit (the "Generate More" flow).
 * `startIndex` is the 0-based index of the first new question in the
 * full questions array. Returns the new questions merged with `.id`, or
 * null for guests / on failure.
 */
async function dbAddQuestions(kitId, newQuestions, startIndex) {
  if (!currentUser || !kitId) return null;
  try {
    const rows = newQuestions.map((q, i) => ({
      kit_id: kitId,
      question_index: startIndex + i + 1,
      question: q.question,
      intent: q.intent,
      structure: q.structure,
      example: q.example
    }));

    const { data: inserted, error } = await supabaseClient
      .from('kit_questions')
      .insert(rows)
      .select()
      .order('question_index');
    if (error) throw error;

    return newQuestions.map((q, i) => ({ ...q, id: inserted[i].id }));
  } catch (err) {
    console.warn('dbAddQuestions failed:', err.message);
    return null;
  }
}

// ─── Saved Questions (bookmarks) ───────────────────────────────────────────────
async function dbSetSaved(kitQuestionId, isSaved) {
  if (!currentUser || !kitQuestionId) return;
  try {
    if (isSaved) {
      const { error } = await supabaseClient
        .from('saved_questions')
        .upsert({ user_id: currentUser.id, kit_question_id: kitQuestionId }, { onConflict: 'user_id,kit_question_id' });
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('saved_questions')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('kit_question_id', kitQuestionId);
      if (error) throw error;
    }
  } catch (err) {
    console.warn('dbSetSaved failed:', err.message);
  }
}

// ─── Answer Drafts ──────────────────────────────────────────────────────────────
async function dbSaveAnswerDraft(kitQuestionId, draftText) {
  if (!currentUser || !kitQuestionId) return;
  try {
    const { error } = await supabaseClient
      .from('answer_drafts')
      .upsert(
        { user_id: currentUser.id, kit_question_id: kitQuestionId, draft_text: draftText, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,kit_question_id' }
      );
    if (error) throw error;
  } catch (err) {
    console.warn('dbSaveAnswerDraft failed:', err.message);
  }
}

// ─── Simulations ─────────────────────────────────────────────────────────────────
async function dbCreateSimulation(scenario, role, level) {
  if (!currentUser) return null;
  try {
    const { data, error } = await supabaseClient
      .from('simulations')
      .insert({ user_id: currentUser.id, scenario, role, level })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (err) {
    console.warn('dbCreateSimulation failed:', err.message);
    return null;
  }
}

async function dbAddSimulationMessage(simulationId, turnNumber, sender, content) {
  if (!currentUser || !simulationId) return;
  try {
    const { error } = await supabaseClient
      .from('simulation_messages')
      .insert({ simulation_id: simulationId, turn_number: turnNumber, sender, content });
    if (error) throw error;
  } catch (err) {
    console.warn('dbAddSimulationMessage failed:', err.message);
  }
}

// ─── Progress stats (home screen) ──────────────────────────────────────────────
/**
 * Returns { kits, savedQuestions, simulations } counts for the signed-in
 * user, or null for guests / on failure.
 */
async function dbGetProgressStats() {
  if (!currentUser) return null;
  try {
    const [kits, saved, sims] = await Promise.all([
      supabaseClient.from('kits').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
      supabaseClient.from('saved_questions').select('kit_question_id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
      supabaseClient.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id)
    ]);
    if (kits.error) throw kits.error;
    if (saved.error) throw saved.error;
    if (sims.error) throw sims.error;

    return {
      kits: kits.count || 0,
      savedQuestions: saved.count || 0,
      simulations: sims.count || 0
    };
  } catch (err) {
    console.warn('dbGetProgressStats failed:', err.message);
    return null;
  }
}

async function dbCompleteSimulation(simulationId, feedback) {
  if (!currentUser || !simulationId) return;
  try {
    const { error } = await supabaseClient
      .from('simulations')
      .update({ status: 'completed', feedback, completed_at: new Date().toISOString() })
      .eq('id', simulationId);
    if (error) throw error;
  } catch (err) {
    console.warn('dbCompleteSimulation failed:', err.message);
  }
}
