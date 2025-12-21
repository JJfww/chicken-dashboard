// Session-based authentication middleware
// Sessions are encrypted tokens stored in httpOnly cookies

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Simple HMAC-like signature using Web Crypto API
async function signSession(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifySession(data, signature, secret) {
    const expectedSignature = await signSession(data, secret);
    return signature === expectedSignature;
}

// Create a signed session token
export async function createSession(env) {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    const sessionData = JSON.stringify({ expires: expiresAt });
    const signature = await signSession(sessionData, env.ADMIN_PASSWORD);
    return btoa(sessionData) + '.' + signature;
}

// Parse and verify a session token
async function parseSession(token, env) {
    try {
        const [encodedData, signature] = token.split('.');
        if (!encodedData || !signature) return null;

        const sessionData = atob(encodedData);
        const isValid = await verifySession(sessionData, signature, env.ADMIN_PASSWORD);
        if (!isValid) return null;

        const session = JSON.parse(sessionData);
        if (Date.now() > session.expires) return null;

        return session;
    } catch {
        return null;
    }
}

// Get session cookie from request
function getSessionCookie(request) {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(/session=([^;]+)/);
    return match ? match[1] : null;
}

// Middleware: require valid session for protected routes
export async function requireSession(request, env) {
    const token = getSessionCookie(request);

    if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }

    const session = await parseSession(token, env);

    if (!session) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }

    return null; // Auth succeeded
}

// Check if session is valid (for auth check endpoint)
export async function isAuthenticated(request, env) {
    const token = getSessionCookie(request);
    if (!token) return false;
    const session = await parseSession(token, env);
    return session !== null;
}
