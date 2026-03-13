function buildLogoutCookie(request) {
    const url = new URL(request.url);
    const secureFlag = url.protocol === 'https:' ? ' Secure;' : '';
    return `session=; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=0`;
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
    // Clear the session cookie by setting it to expire immediately
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Credentials': 'true',
            'Set-Cookie': buildLogoutCookie(context.request)
        }
    });
}
