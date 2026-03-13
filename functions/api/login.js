import { createSession } from './_auth.js';

function buildSessionCookie(request, sessionToken, maxAge) {
    const url = new URL(request.url);
    const secureFlag = url.protocol === 'https:' ? ' Secure;' : '';
    return `session=${sessionToken}; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function onRequestPost(context) {
    try {
        const { password } = await context.request.json();

        // Check password against environment variable
        if (!password || password !== context.env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: 'Invalid password' }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                    'Access-Control-Allow-Credentials': 'true'
                }
            });
        }

        // Create session token
        const sessionToken = await createSession(context.env);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true',
                'Set-Cookie': buildSessionCookie(context.request, sessionToken, 86400)
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}
