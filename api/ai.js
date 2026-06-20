// api/ai.js — Vercel serverless function.
//
// Vercel and Netlify use different handler signatures, so this thin wrapper
// adapts a Vercel (req, res) request to the existing Netlify handler in
// netlify/functions/ai.js and reuses all of its logic (OpenAI calls, prompts,
// demo-mode 503 behaviour). Keeping one source of truth avoids drift.

const { handler } = require('../netlify/functions/ai.js');

module.exports = async (req, res) => {
  // Vercel auto-parses JSON bodies into objects; the Netlify handler expects a
  // raw string to JSON.parse, so normalise back to a string here.
  const rawBody =
    req.body === undefined || req.body === null
      ? ''
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

  const event = { httpMethod: req.method, body: rawBody };

  const result = await handler(event);

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
  }

  res.status(result.statusCode).send(result.body);
};
