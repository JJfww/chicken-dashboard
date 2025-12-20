export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function onRequestGet(context) {
    try {
        const photoId = context.params.id;

        // Get photo metadata from database
        const { results } = await context.env.DB.prepare(
            'SELECT r2_key FROM photos WHERE id = ?'
        ).bind(photoId).all();

        if (results.length === 0) {
            return new Response('Photo not found', {
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        const r2Key = results[0].r2_key;

        // Get photo from R2
        const object = await context.env.PHOTOS.get(r2Key);

        if (!object) {
            return new Response('Photo not found in storage', {
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Return photo
        return new Response(object.body, {
            headers: {
                'Content-Type': object.httpMetadata.contentType || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    } catch (error) {
        return new Response('Error retrieving photo', {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
