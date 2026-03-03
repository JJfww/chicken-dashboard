export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(`
            SELECT id, date, title, content, created_at
            FROM blog_posts
            ORDER BY date DESC, created_at DESC
            LIMIT 20
        `).all();

        const baseUrl = 'https://chicken-dashboard.pages.dev';
        const blogLink = `${baseUrl}/blog.html#blog`;

        const items = results.map(post => {
            const pubDate = new Date(post.date + 'T12:00:00Z').toUTCString();
            const title = escapeXml(post.title || 'Untitled Post');
            const description = escapeXml(post.content);
            const guid = `${baseUrl}/blog.html#post-${post.id}`;

            return `    <item>
      <title>${title}</title>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <guid>${guid}</guid>
      <link>${guid}</link>
    </item>`;
        }).join('\n');

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Clucking Times</title>
    <description>Covering Hensington Palace since 2025</description>
    <link>${blogLink}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

        return new Response(rss, {
            status: 200,
            headers: {
                'Content-Type': 'application/rss+xml',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>${escapeXml(error.message)}</description></channel></rss>`, {
            status: 500,
            headers: { 'Content-Type': 'application/rss+xml' }
        });
    }
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
