import { requireSession } from './_auth.js';
import { TOOL_DEFINITIONS, executeTool } from './_chat-tools.js';

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
    'Access-Control-Allow-Credentials': 'true'
};

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function onRequestPost(context) {
    // Require authentication
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { question, history } = await context.request.json();

        if (!question) {
            return new Response(JSON.stringify({ error: 'No question provided' }), {
                status: 400,
                headers: CORS_HEADERS
            });
        }

        // Get today's date for context
        const today = new Date().toISOString().split('T')[0];

        // Build the system prompt
        const systemPrompt = `You are Clucky, the witty and knowledgeable AI assistant for this chicken dashboard. Today's date is ${today}.

Persona Guidelines:
- Be friendly and occasionally use chicken puns, but never at the expense of clarity
- When presenting data, be precise and accurate
- Use markdown tables when showing comparisons or trends
- Format durations as H:MM (e.g., 2:30 for 2 hours 30 minutes)
- Format currency with $ symbol

The flock at Hensington Palace:
- Mamma Mia (hen, lays brown-olive eggs)
- Brown Betty (hen, lays green eggs)
- Madame Pompadour (hen, lays eggshell-colored eggs)
- Peppercorn (young hen, first confirmed egg October 13, 2026: small and orangish; identified because Jen found her in the nesting box that morning)
- Salty (young hen; no confirmed egg recorded yet). Future eggs may be difficult to distinguish from Peppercorn's. Do not assign an uncertain egg to either hen based on color alone.
- Vinnie (young rooster finding his way; seems bonded with Madame Pompadour, though she sometimes chases him after he tries to mount her)
- Three chicks hatched on May 24, 25, and 26 of 2026
- Madame Pompadour is the biological mother of Peppercorn, Salty, and Gomez: she laid their eggs. Mamma Mia hatched and raised them and is their mom. Preserve both mothers' roles when discussing the chicks.

Conversation Context:
- You are given the full conversation history in the message list; use it to answer questions about prior turns.
- Never claim you can't see the conversation history in this session.

IMPORTANT: Use the provided tools to query data. Don't guess or make up numbers - always call a tool if you need data. If you're unsure what date range to use, ask or use reasonable defaults (e.g., "last 7 days" = last week, "this month" = current month).`;

        // Build messages with conversation history
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Include prior conversation history (exclude the current question, which is the last entry)
        if (history && Array.isArray(history)) {
            const priorHistory = history.slice(0, -1);
            for (const msg of priorHistory) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        messages.push({ role: 'user', content: question });

        // Tool calling loop (max 5 iterations to prevent infinite loops)
        const MAX_ITERATIONS = 5;
        let iteration = 0;
        let finalAnswer = null;

        while (iteration < MAX_ITERATIONS && !finalAnswer) {
            iteration++;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${context.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
                    'X-Title': 'Chicken Dashboard'
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: messages,
                    tools: TOOL_DEFINITIONS,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const choice = data.choices[0];
            const message = choice.message;

            // Add assistant's response to message history
            messages.push(message);

            // Check if there are tool calls
            if (message.tool_calls && message.tool_calls.length > 0) {
                // Execute each tool call
                for (const toolCall of message.tool_calls) {
                    const toolName = toolCall.function.name;
                    let toolParams = {};

                    try {
                        toolParams = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        toolParams = {};
                    }

                    // Execute the tool
                    const toolResult = await executeTool(context.env.DB, toolName, toolParams);

                    // Add tool result to message history
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult)
                    });
                }
            } else {
                // No tool calls - this is the final answer
                finalAnswer = message.content;
            }

            // Check for finish reason
            if (choice.finish_reason === 'stop' && !message.tool_calls) {
                finalAnswer = message.content;
            }
        }

        // If we hit max iterations without a final answer, ask for a summary
        if (!finalAnswer) {
            messages.push({
                role: 'user',
                content: 'Please provide your final answer based on the data you have gathered.'
            });

            const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${context.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
                    'X-Title': 'Chicken Dashboard'
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (finalResponse.ok) {
                const finalData = await finalResponse.json();
                finalAnswer = finalData.choices[0].message.content;
            } else {
                finalAnswer = "I gathered some data but had trouble formulating a complete response. Please try asking again.";
            }
        }

        return new Response(JSON.stringify({ answer: finalAnswer }), {
            status: 200,
            headers: CORS_HEADERS
        });

    } catch (error) {
        console.error('Chat error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: CORS_HEADERS
        });
    }
}
