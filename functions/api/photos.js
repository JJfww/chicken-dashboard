export async function onRequestPost(context) {
    try {
        const formData = await context.request.formData();
        const photo = formData.get('photo');
        const caption = formData.get('caption');
        const date = formData.get('date');

        if (!photo) {
            return new Response(JSON.stringify({ error: 'No photo provided' }), {
                status: 400,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = photo.name.split('.').pop();
        const filename = `${timestamp}.${extension}`;
        const r2Key = `photos/${filename}`;

        // Upload to R2
        await context.env.PHOTOS.put(r2Key, photo.stream(), {
            httpMetadata: {
                contentType: photo.type
            }
        });

        // Save photo metadata to database
        const result = await context.env.DB.prepare(
            'INSERT INTO photos (date, filename, r2_key, caption) VALUES (?, ?, ?, ?)'
        ).bind(date, filename, r2Key, caption || null).run();

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
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

export async function onRequestGet(context) {
    try {
        // Get recent photos
        const { results } = await context.env.DB.prepare(`
            SELECT id, date, filename, caption, created_at
            FROM photos
            ORDER BY date DESC, created_at DESC
            LIMIT 50
        `).all();

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
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
