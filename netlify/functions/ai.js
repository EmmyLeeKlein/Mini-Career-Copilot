// netlify/functions/ai.js — Serverless function that calls OpenAI

const https = require('https');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body' }) };
  }

  const { role, level } = body;
  if (!role || !level) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing role or level' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, body: JSON.stringify({ message: 'OpenAI API key not configured' }) };
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
    const questions = await callOpenAI(apiKey, prompt);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions })
    };
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to generate questions. Please try again.' })
    };
  }
};

function callOpenAI(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'OpenAI API error'));
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Empty response from OpenAI'));
          const clean = content.replace(/```json|```/g, '').trim();
          const questions = JSON.parse(clean);
          if (!Array.isArray(questions) || questions.length === 0)
            return reject(new Error('Invalid questions format from AI'));
          resolve(questions);
        } catch (e) {
          reject(new Error('Failed to parse OpenAI response: ' + e.message));
        }
      });
    });

    req.on('error', e => reject(e));
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(requestBody);
    req.end();
  });
}