// Generate random chicken or squirrel poetry
export async function onRequestGet(context) {
  const { env } = context;

  // Poetry forms with their specifications
  const poetryForms = [
    {
      name: "Haiku",
      description: "3 lines, 5-7-5 syllables, focused on nature and a moment of insight",
      instructions: "Write a haiku (3 lines, 5-7-5 syllables) about {subject}. Focus on a moment of nature and insight."
    },
    {
      name: "Senryū",
      description: "3 lines, 5-7-5 syllables, focused on human nature and humor",
      instructions: "Write a senryū (3 lines, 5-7-5 syllables) about {subject}. Focus on humor and the quirks of {subject} nature."
    },
    {
      name: "Tanka",
      description: "5 lines, 5-7-5-7-7 syllables",
      instructions: "Write a tanka (5 lines, 5-7-5-7-7 syllables) about {subject}. Create a contemplative observation."
    },
    {
      name: "Limerick",
      description: "5 lines with AABBA rhyme scheme, humorous",
      instructions: "Write a limerick (5 lines, AABBA rhyme) about {subject}. Make it playful and humorous."
    },
    {
      name: "Cinquain",
      description: "5 lines, 2-4-6-8-2 syllables",
      instructions: "Write a cinquain (5 lines, 2-4-6-8-2 syllables) about {subject}."
    },
    {
      name: "Clerihew",
      description: "4 lines, AABB rhyme, biographical and comedic",
      instructions: "Write a clerihew (4 lines, AABB rhyme) about {subject}. Make it biographical and comedic."
    },
    {
      name: "Epigram",
      description: "Brief, witty, satirical observation",
      instructions: "Write a brief epigram about {subject}. Make it witty and insightful."
    },
    {
      name: "Couplet",
      description: "2 rhyming lines expressing a complete thought",
      instructions: "Write a rhyming couplet about {subject} that expresses a complete, clever thought."
    },
    {
      name: "Sijo",
      description: "Korean 3-line form with a twist in the final line",
      instructions: "Write a sijo (3 lines) about {subject}. Build up in the first two lines and add a twist or insight in the final line."
    },
    {
      name: "Ghazal Couplet",
      description: "Self-contained rhyming couplet from Persian tradition",
      instructions: "Write a ghazal couplet (2 lines that rhyme) about {subject}. Make it lyrical and self-contained."
    },
    {
      name: "Rubai",
      description: "Persian 4-line form, AABA rhyme scheme",
      instructions: "Write a rubai (4 lines, AABA rhyme) about {subject}. Make it philosophical or contemplative."
    }
  ];

  // 90% chicken, 10% squirrel
  const isChicken = Math.random() < 0.9;
  const subject = isChicken ? "chickens" : "squirrels";
  const subjectSingular = isChicken ? "a chicken" : "a squirrel";

  // Randomly select a poetry form
  const form = poetryForms[Math.floor(Math.random() * poetryForms.length)];

  // Replace {subject} in instructions
  const prompt = form.instructions.replace(/{subject}/g, subject);

  // Call OpenRouter API
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chicken-dashboard.pages.dev",
        "X-Title": "Hensington Palace - Poetry"
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [
          {
            role: "system",
            content: "You are a creative poet. Generate poems exactly as requested, following the form specifications precisely. Output ONLY the poem itself, with no additional commentary, titles, or explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 1.0 // High creativity
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const poem = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({
      poem,
      form: form.name,
      description: form.description,
      subject: subjectSingular,
      isChicken
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to generate poem",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
