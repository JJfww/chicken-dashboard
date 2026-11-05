// Adds a `chickens` array ({ id, name, display_name, source }) to each photo row.
export async function attachPhotoTags(db, photos) {
    if (!photos.length) return photos;

    const ids = photos.map(photo => photo.id);
    const { results } = await db.prepare(`
        SELECT pc.photo_id, pc.source, c.id, c.name, COALESCE(c.display_name, c.name) AS display_name
        FROM photo_chickens pc
        JOIN chickens c ON c.id = pc.chicken_id
        WHERE pc.photo_id IN (${ids.map(() => '?').join(', ')})
        ORDER BY c.sort_order, c.id
    `).bind(...ids).all();

    return photos.map(photo => ({
        ...photo,
        chickens: results
            .filter(tag => tag.photo_id === photo.id)
            .map(({ id, name, display_name, source }) => ({ id, name, display_name, source }))
    }));
}

// Replaces a photo's tags. Tags saved this way are confirmed by a person ('manual').
export async function setPhotoTags(db, photoId, chickenIds) {
    const uniqueIds = [...new Set(chickenIds.map(Number).filter(Boolean))];
    await db.batch([
        db.prepare('DELETE FROM photo_chickens WHERE photo_id = ?').bind(photoId),
        ...uniqueIds.map(chickenId => db.prepare(
            'INSERT OR IGNORE INTO photo_chickens (photo_id, chicken_id, source) VALUES (?, ?, \'manual\')'
        ).bind(photoId, chickenId))
    ]);
}
