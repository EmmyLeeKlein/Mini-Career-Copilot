// api/ai.js — Vercel serverless function that calls OpenAI.
//
// Handles two modes on the same endpoint:
//   1. Interview Kit  →  POST { role, level }
//                        → { questions: [ {question, intent, structure, example}, ... ] }
//   2. Simulation     →  POST { type: 'simulation', scenario, role, level, messages: [...] }
//                        → { message: "next interviewer turn" }
//
// `messages` is the running conversation so far, e.g.
//   [ { role: 'assistant', content: '...' }, { role: 'user', content: '...' } ]
// On the first call it is empty, and the model opens the interview.
//
// Returns 503 when OPENAI_API_KEY is missing — the frontend treats that as
// "fall back to demo mode".

const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { message: 'Method not allowed' });
  }

  // Vercel auto-parses JSON bodies into objects, but be tolerant of a raw
  // string body too (e.g. when no Content-Type header is set).
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return send(res, 400, { message: 'Invalid request body' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, { message: 'OpenAI API key not configured' });
  }

  // ── Route ──
  if (body.type === 'simulation' || Array.isArray(body.messages)) {
    return handleSimulation(res, apiKey, body);
  }
  return handleKit(res, apiKey, body);
};

function send(res, statusCode, payload) {
  res.setHeader('Content-Type', 'application/json');
  res.status(statusCode).send(JSON.stringify(payload));
}


// ════════════════════════════════════════════════════════════
//  MODE 1 — Interview Kit
// ════════════════════════════════════════════════════════════
async function handleKit(res, apiKey, body) {
  const { role, level } = body;
  if (!role || !level) {
    return send(res, 400, { message: 'Missing role or level' });
  }

  const prompt = `You are a professional career coach helping students and early-career candidates prepare for job interviews.

Generate exactly 5 interview questions for a ${role} position at ${level} level (${level === 'Student' ? 'no professional experience, focus on academic projects and personal initiatives' : '0–2 years of experience'}).

Return ONLY a valid JSON array with no extra text, no markdown, no code blocks. Each item must have exactly these four fields:
- "question": the interview question (string)
- "intent": what the interviewer wants to learn — 1 to 2 sentences (string)
- "structure": a suggested answer structure for the candidate — 2 to 4 sentences, written as a guide (string)
- "example": a concrete, natural-sounding example answer appropriate for a ${level} candidate — 3 to 5 sentences (string)

Make the questions realistic and directly relevant to the ${role} role. The example answers should feel authentic for someone at ${level} level.`;

  try {
    const content = await callOpenAI(apiKey, [{ role: 'user', content: prompt }]);
    const clean = content.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format from AI');
    }
    return send(res, 200, { questions });
  } catch (err) {
    console.error('OpenAI error (kit):', err.message);
    return send(res, 500, { message: 'Failed to generate questions. Please try again.' });
  }
}


// ════════════════════════════════════════════════════════════
//  MODE 2 — Interview Simulation (multi-turn chat)
// ════════════════════════════════════════════════════════════
async function handleSimulation(res, apiKey, body) {
  const { scenario, role, level, messages } = body;
  const history = Array.isArray(messages) ? messages : [];

  // Keep only valid chat turns and cap length to stay within token limits.
  const cleanHistory = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20);

  const chat = [
    { role: 'system', content: buildSimulationSystemPrompt(scenario, role, level) },
    ...cleanHistory
  ];

  // First turn: nudge the model to open the interview.
  if (cleanHistory.length === 0) {
    chat.push({ role: 'user', content: 'Please begin the interview now with a brief, warm greeting followed by your first question.' });
  }

  try {
    const content = await callOpenAI(apiKey, chat);
    return send(res, 200, { message: content.trim() });
  } catch (err) {
    console.error('OpenAI error (simulation):', err.message);
    return send(res, 500, { message: 'Failed to get a response. Please try again.' });
  }
}

function buildSimulationSystemPrompt(scenario, role, level) {
  const personas = {
    'First Interview':
      'You are warm and encouraging. Ask general, getting-to-know-you questions about background, motivation and interests.',
    'Stressful Interviewer':
      'You are demanding and skeptical, but always professional. Challenge the candidate, ask pointed follow-ups and probe weak or vague answers. Never insult or demean them.',
    'Behavioral Interview':
      'You focus on past behaviour using the STAR method. Ask for specific real situations ("Tell me about a time when...") and follow up on the Situation, Task, Action and Result.',
    'Lack of Experience':
      'You are supportive and focus on potential. Ask about transferable skills, learning ability, academic projects and motivation rather than years of professional experience.'
  };
  const persona = personas[scenario] || personas['First Interview'];
  const who = `a ${level || 'early-career'} candidate${role ? ` interviewing for a ${role} role` : ''}`;

  return [
    `You are an interviewer running a realistic mock job interview to help ${who} practise.`,
    `Interview style — ${scenario}: ${persona}`,
    'Rules:',
    '- Ask ONE question at a time. Keep every message short (1 to 3 sentences).',
    '- Briefly react to the previous answer before asking your next question.',
    '- Stay fully in character as the interviewer. Never give meta commentary or mention that this is a simulation.',
    '- After about 5 questions, wrap up: give 2 to 3 sentences of specific, constructive, encouraging feedback, then end the interview.'
  ].join('\n');
}


// ════════════════════════════════════════════════════════════
//  Shared OpenAI call — takes a messages array, returns text
// ════════════════════════════════════════════════════════════
function callOpenAI(apiKey, messages) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.7,
      messages
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'OpenAI API error'));
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Empty response from OpenAI'));
          resolve(content);
        } catch (e) {
          reject(new Error('Failed to parse OpenAI response: ' + e.message));
        }
      });
    });

    apiReq.on('error', e => reject(e));
    apiReq.setTimeout(25000, () => { apiReq.destroy(); reject(new Error('Request timed out')); });
    apiReq.write(requestBody);
    apiReq.end();
  });
}
