// ai.js — Frontend module that calls the Vercel serverless function

const DEMO_QUESTIONS = [
  {
    question: "Tell me about yourself.",
    intent: "The interviewer wants to understand your background, motivation, and fit for the role and company culture.",
    structure: "Start with a brief personal background. Mention relevant skills or studies. Explain what draws you to this specific role. End with why you're excited about this opportunity.",
    example: "I'm a final-year marketing student passionate about branding and digital content. I've led two university campaign projects and interned at a local agency where I managed social media. I'm applying here because I admire your data-driven approach to growth marketing, and I'm eager to bring my creativity into a professional setting."
  },
  {
    question: "Why are you interested in this role?",
    intent: "They want to see genuine motivation and that you've done your research about the company and position.",
    structure: "Connect your personal interests to the role. Reference something specific about the company. Show how this fits your career path.",
    example: "I've been following your company's product launches and I'm genuinely excited by how you combine user research with bold creative decisions. This role aligns perfectly with my goal to work at the intersection of strategy and execution, and I believe my coursework in digital marketing gives me a solid foundation to contribute from day one."
  },
  {
    question: "What do you think makes a successful campaign?",
    intent: "They want to see how you understand marketing basics, creativity, strategy, and how you think about the target audience.",
    structure: "Define what success means in marketing. Talk about audience understanding. Mention the creative and analytical balance. Give a brief example.",
    example: "A successful campaign connects the right message with the right audience through the right channels. In my university project, we created a social media campaign for a local NGO. By focusing on authentic storytelling and targeting young adults on Instagram, we increased their follower engagement by 40% in three weeks."
  },
  {
    question: "How do you handle multiple tasks or deadlines?",
    intent: "They're testing your organizational skills, prioritization, and ability to perform under pressure.",
    structure: "Describe your approach to prioritization. Mention a specific method or tool you use. Share a real example of managing competing demands.",
    example: "I use a simple priority matrix — urgent vs important — to triage my tasks each morning. During finals, I was simultaneously running a student event, completing a group project, and studying for exams. By breaking everything into daily milestones and communicating clearly with my team, I delivered all three without missing a deadline."
  },
  {
    question: "Describe a time you worked on a team project.",
    intent: "They want to understand your collaboration style, communication skills, and how you contribute to group dynamics.",
    structure: "Set up the team context briefly. Describe your specific role and contribution. Highlight what made the collaboration work. Share the outcome.",
    example: "In my third year, I worked with four classmates on a semester-long brand strategy project. I took ownership of the competitive analysis and coordinated our weekly syncs. When we hit a creative disagreement mid-project, I suggested we each present our idea in five minutes and then vote — it turned productive tension into a stronger final concept. We received the highest grade in the class."
  }
];

async function generateKit(role, level) {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, level })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 503) {
        return { questions: DEMO_QUESTIONS, isDemo: true };
      }
      throw new Error(err.message || 'API request failed');
    }

    const data = await response.json();
    return { questions: data.questions, isDemo: false };

  } catch (err) {
    console.warn('AI function unavailable, using demo data:', err.message);
    return { questions: DEMO_QUESTIONS, isDemo: true };
  }
}

// ─── Simulation: multi-turn interview chat ────────────────────
// Calls the same Vercel function in "simulation" mode. `history` is the
// running conversation: [{ role:'assistant'|'user', content }, ...].
// Falls back to a lightweight scripted interviewer if the function is
// unavailable (e.g. no API key configured → 503, or backend not yet updated).

const DEMO_SIM_FOLLOWUPS = [
  "Thanks for sharing. Why does this field interest you the most?",
  "Good. Can you tell me about a project or experience you're proud of?",
  "Interesting — how did you handle a challenge or setback in that situation?",
  "Nice. What's one strength you'd bring to a team here?",
  "Thank you, that's all my questions. You came across as clear and motivated — try adding one concrete example to each answer to make your responses even stronger. Best of luck!"
];

function demoSimReply(scenario, history) {
  const userTurns = history.filter(m => m.role === 'user').length;
  if (userTurns === 0) {
    return `Hi there! Let's begin your ${scenario || 'interview'} practice. To start, can you tell me a bit about yourself?`;
  }
  return DEMO_SIM_FOLLOWUPS[Math.min(userTurns - 1, DEMO_SIM_FOLLOWUPS.length - 1)];
}

async function runSimulation({ scenario, role, level, history }) {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'simulation', scenario, role, level, messages: history })
    });

    if (!response.ok) {
      if (response.status === 503) {
        return { message: demoSimReply(scenario, history), isDemo: true };
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }

    const data = await response.json();
    return { message: data.message, isDemo: false };

  } catch (err) {
    console.warn('AI simulation unavailable, using demo data:', err.message);
    return { message: demoSimReply(scenario, history), isDemo: true };
  }
}