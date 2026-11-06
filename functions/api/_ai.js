// Ask OpenRouter for a JSON object and parse it.
export async function generateJson(env, { model = 'google/gemini-2.5-flash', title, system, user, temperature = 0.9, maxTokens = 1500 }) {
    if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
            'X-Title': title
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            response_format: { type: 'json_object' },
            temperature,
            max_tokens: maxTokens
        })
    });
    if (!response.ok) throw new Error(`OpenRouter API error (${response.status}): ${await response.text()}`);
    const data = await response.json();
    const content = (data?.choices?.[0]?.message?.content || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(content);
}
