// Public site for The Clucking Times. Chicken profiles, avatars, and egg images
// come from /api/status and /api/chickens, so flock changes need no code edits.

const TABS = ['today', 'blog', 'photos', 'flock', 'recipes', 'history', 'poetry'];
const PHOTO_PAGE_SIZE = 24;

const store = {
    status: null,
    stats: null,
    chickens: null
};

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatShortDate(dateString) {
    return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatStatusDate(dateString) {
    if (!dateString) {
        return 'Not yet';
    }

    const label = formatDate(dateString);
    return ['Today', 'Yesterday'].includes(label) || label.endsWith('days ago') ? label : formatShortDate(dateString);
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((today - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    }
    if (diffDays === 1) {
        return 'Yesterday';
    }
    if (diffDays < 7) {
        return `${diffDays} days ago`;
    }

    return date.toLocaleDateString();
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed: ${url}`);
    }
    return response.json();
}

async function loadFlockData({ force = false } = {}) {
    if (force || !store.status || !store.stats) {
        const [status, stats] = await Promise.all([fetchJson('/api/status'), fetchJson('/api/stats')]);
        store.status = status;
        store.stats = stats;
    }
    return store;
}

async function loadChickens() {
    if (!store.chickens) {
        store.chickens = await fetchJson('/api/chickens');
    }
    return store.chickens;
}

function renderSectionError(title, detail) {
    return `
        <div class="status-fallback" role="status">
            <p class="status-fallback-title">${title}</p>
            <p class="status-fallback-copy">${detail}</p>
        </div>
    `;
}

function eggColorLabel(chicken) {
    if (!chicken.egg_color_label) return '';
    const icon = chicken.egg_image_url
        ? `<img src="${escapeHtml(chicken.egg_image_url)}" alt="" class="egg-icon">`
        : '🥚';
    const provisional = chicken.egg_color_provisional
        ? ' <span class="provisional-badge" title="Not confirmed yet">unconfirmed</span>'
        : '';
    return `${icon} ${escapeHtml(chicken.egg_color_label)} eggs${provisional}`;
}

function henStats(chickenId) {
    return store.stats?.hens.find(hen => hen.id === chickenId) || null;
}

// ---------- Today ----------

function renderHeadline(headline) {
    const banner = document.getElementById('headline-banner');
    if (!headline) {
        banner.innerHTML = '';
        return;
    }
    banner.innerHTML = `
        <aside class="headline-banner" role="note">
            <p class="headline-kicker">Breaking from the palace · ${escapeHtml(formatStatusDate(headline.date))}</p>
            <p class="headline-text">${escapeHtml(headline.content)}</p>
        </aside>
    `;
}

function stripMarkdown(markdown) {
    return String(markdown || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_#>`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function loadLatestDispatch() {
    const container = document.getElementById('latest-dispatch');
    try {
        const data = await fetchJson('/api/blog?limit=1&offset=0');
        const post = data.posts?.[0];
        if (!post) {
            container.innerHTML = '';
            return;
        }
        const leadImage = post.content.match(/\/api\/photos\/(\d+)/);
        const words = stripMarkdown(post.content).split(' ');
        const excerpt = words.slice(0, 55).join(' ') + (words.length > 55 ? '…' : '');
        container.innerHTML = `
            <a class="lead-story-link" href="#blog">
                ${leadImage && !/<video/.test(post.content) ? `<img class="lead-story-image" src="/api/photos/${leadImage[1]}" alt="" loading="lazy">` : ''}
                <div class="lead-story-body">
                    <p class="lead-story-kicker">Latest dispatch · ${escapeHtml(formatShortDate(post.date))}</p>
                    <h2 class="lead-story-title">${escapeHtml(post.title || 'Dispatch from the palace')}</h2>
                    <p class="lead-story-excerpt">${escapeHtml(excerpt)}</p>
                    <span class="lead-story-more">Read the full dispatch →</span>
                </div>
            </a>
        `;
    } catch (error) {
        container.innerHTML = '';
    }
}

function renderStatTiles() {
    const { stats, status } = store;
    const layingToday = status.activeFlock.filter(chicken => chicken.laid_today);
    const weekDelta = stats.totals.this_week - stats.totals.last_week;
    const trend = weekDelta === 0
        ? 'Same as the week before'
        : `${weekDelta > 0 ? '▲' : '▼'} ${Math.abs(weekDelta)} vs the week before`;
    const streakLeader = [...stats.hens].sort((a, b) => b.streak - a.streak)[0];
    const since = stats.totals.since ? new Date(`${stats.totals.since}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

    document.getElementById('stat-tiles').innerHTML = `
        <article class="stat-tile">
            <p class="stat-label"><span class="stat-icon" aria-hidden="true">🥚</span> Eggs today</p>
            <p class="stat-value">${stats.totals.today}</p>
            <p class="stat-detail">${escapeHtml(layingToday.map(chicken => chicken.display_name).join(', ') || 'None yet today')}</p>
        </article>
        <article class="stat-tile">
            <p class="stat-label"><span class="stat-icon" aria-hidden="true">🧺</span> Eggs, 7 days</p>
            <p class="stat-value">${stats.totals.this_week}</p>
            <p class="stat-detail">${escapeHtml(trend)}</p>
        </article>
        <article class="stat-tile">
            <p class="stat-label"><span class="stat-icon" aria-hidden="true">🔥</span> Laying streak</p>
            <p class="stat-value">${streakLeader?.streak ? plural(streakLeader.streak, 'day') : '—'}</p>
            <p class="stat-detail">${streakLeader?.streak ? `${escapeHtml(streakLeader.display_name)}, laying daily` : 'No streak running'}</p>
        </article>
        <article class="stat-tile">
            <p class="stat-label"><span class="stat-icon" aria-hidden="true">🏆</span> All-time eggs</p>
            <p class="stat-value">${stats.totals.all_time.toLocaleString()}</p>
            <p class="stat-detail">Since ${escapeHtml(since)}${stats.best_day ? ` · record ${stats.best_day.count} in a day` : ''}</p>
        </article>
    `;
}

function renderFlockCard(chicken) {
    const stats = henStats(chicken.id);
    let rows = '';

    if (chicken.is_rooster) {
        rows = '<p class="flock-card-state flock-card-state--guard">🐓 On guard duty</p>';
    } else if (chicken.is_pullet) {
        rows = '<p class="flock-card-state">🌱 Not laying yet</p>';
    } else {
        rows = `
            <p class="flock-card-state ${chicken.laid_today ? 'flock-card-state--laid' : ''}">
                ${chicken.laid_today ? (chicken.egg_image_url ? `<img src="${escapeHtml(chicken.egg_image_url)}" alt="" class="egg-icon">` : '🥚') + ' Egg today' : '⏱️ Not yet today'}
            </p>
            <p class="flock-card-meta">Last egg: ${escapeHtml(formatStatusDate(chicken.last_egg_date))}</p>
            ${stats?.streak >= 2 ? `<p class="flock-card-meta flock-card-streak">🔥 ${stats.streak}-day streak</p>` : ''}
        `;
    }

    return `
        <a class="flock-card" href="#hen/${chicken.id}">
            <img class="flock-card-avatar" src="${escapeHtml(chicken.avatar_url)}" alt="">
            <h3 class="flock-card-name">${escapeHtml(chicken.display_name)}</h3>
            ${chicken.role_label ? `<span class="role-badge">${escapeHtml(chicken.role_label)}</span>` : ''}
            ${rows}
            ${chicken.health_concern ? `<span class="health-chip">⚠️ ${escapeHtml(chicken.health_concern.observation_type)}</span>` : ''}
        </a>
    `;
}

// Six-month calendar: columns are weeks (Sunday first), one cell per day.
function renderEggCalendar(container, heatmap) {
    const counts = new Map(heatmap.days.map(day => [day.date, day.count]));
    const start = new Date(`${heatmap.start}T12:00:00`);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(`${heatmap.end}T12:00:00`);
    const max = Math.max(1, ...heatmap.days.map(day => day.count));
    const level = count => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

    const weeks = [];
    const monthLabels = [];
    for (let cursor = new Date(start), week = 0; cursor <= end; week += 1) {
        const cells = [];
        for (let day = 0; day < 7; day += 1) {
            const iso = cursor.toLocaleDateString('en-CA');
            const inRange = iso >= heatmap.start && iso <= heatmap.end;
            if (cursor.getDate() === 1 || (week === 0 && day === 0)) {
                monthLabels.push({ week, label: cursor.toLocaleDateString('en-US', { month: 'short' }) });
            }
            if (inRange) {
                const count = counts.get(iso) || 0;
                const label = `${formatShortDate(iso)}: ${plural(count, 'egg')}`;
                cells.push(`<button type="button" class="heat-cell heat-${level(count)}" data-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`);
            } else {
                cells.push('<span class="heat-cell heat-empty" aria-hidden="true"></span>');
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(`<div class="heat-week">${cells.join('')}</div>`);
    }

    const weekCount = weeks.length;
    container.innerHTML = `
        <div class="heat-scroll">
            <div class="heat-months" style="grid-template-columns: repeat(${weekCount}, var(--heat-size));">
                ${monthLabels.map(month => `<span style="grid-column: ${month.week + 1} / span 4;">${month.label}</span>`).join('')}
            </div>
            <div class="heat-grid">${weeks.join('')}</div>
        </div>
        <div class="heat-footer">
            <p class="heat-readout" aria-live="polite">Tap a day to see its count.</p>
            <div class="heat-legend" aria-hidden="true">
                <span>Fewer</span>
                <span class="heat-cell heat-0"></span><span class="heat-cell heat-1"></span><span class="heat-cell heat-2"></span><span class="heat-cell heat-3"></span><span class="heat-cell heat-4"></span>
                <span>More</span>
            </div>
        </div>
    `;

    const readout = container.querySelector('.heat-readout');
    container.querySelectorAll('button.heat-cell').forEach(cell => {
        const show = () => { readout.textContent = cell.dataset.label; };
        cell.addEventListener('mouseenter', show);
        cell.addEventListener('focus', show);
        cell.addEventListener('click', show);
    });

    const scroller = container.querySelector('.heat-scroll');
    scroller.scrollLeft = scroller.scrollWidth;
}

// A dozen-egg carton filled with the eggs laid since the last full carton, oldest first.
function renderCarton() {
    const { carton } = store.stats;
    const container = document.getElementById('egg-carton');
    const cups = Array.from({ length: carton.size }, (_, index) => {
        const egg = carton.eggs[index];
        if (!egg) return '<span class="carton-cup" aria-hidden="true"></span>';
        const label = `${egg.name || 'Unknown hen'}, ${formatShortDate(egg.date)}`;
        return `
            <span class="carton-cup carton-cup--filled" title="${escapeHtml(label)}">
                ${egg.egg_image_url ? `<img src="${escapeHtml(egg.egg_image_url)}" alt="">` : '<span class="carton-egg-emoji">🥚</span>'}
            </span>
        `;
    }).join('');

    const tally = new Map();
    carton.eggs.forEach(egg => tally.set(egg.name, (tally.get(egg.name) || 0) + 1));
    const remaining = carton.size - carton.filled;

    container.innerHTML = `
        <div class="carton" role="img" aria-label="Carton number ${carton.number}: ${carton.filled} of ${carton.size} eggs">
            <div class="carton-cups">${cups}</div>
        </div>
        <p class="carton-caption">
            <strong>Carton #${carton.number}</strong> · ${carton.filled} of ${carton.size}
            ${remaining ? `· ${plural(remaining, 'egg')} to go` : '· full! A new carton starts with the next egg.'}
        </p>
        ${tally.size ? `<p class="carton-tally">${[...tally].map(([name, count]) => `${escapeHtml(name || 'Unknown')} ${count}`).join(' · ')}</p>` : ''}
    `;
}

function renderPhotoThumb(photo, { size = 'grid' } = {}) {
    const isVideo = photo.media_type === 'video';
    const caption = photo.caption || (isVideo ? 'Video from the coop' : 'Photo from the coop');
    return `
        <button type="button" class="photo-thumb photo-thumb--${size}" data-photo-id="${photo.id}" aria-label="${escapeHtml(caption)}">
            ${isVideo
                ? `<video src="/api/photos/${photo.id}#t=0.5" preload="metadata" muted playsinline tabindex="-1"></video><span class="photo-thumb-play" aria-hidden="true">▶</span>`
                : `<img src="/api/photos/${photo.id}" alt="" loading="lazy">`}
        </button>
    `;
}

const photoIndex = new Map();

function rememberPhotos(photos) {
    photos.forEach(photo => photoIndex.set(String(photo.id), photo));
}

async function loadPhotoStrip() {
    const strip = document.getElementById('photo-strip');
    try {
        const photos = await fetchJson('/api/photos?limit=10');
        rememberPhotos(photos);
        strip.innerHTML = photos.map(photo => renderPhotoThumb(photo, { size: 'strip' })).join('');
    } catch (error) {
        strip.innerHTML = renderSectionError('Photos unavailable', 'The latest photos could not be loaded right now.');
    }
}

async function loadToday({ force = false } = {}) {
    try {
        await loadFlockData({ force });
        const { status, stats } = store;
        renderHeadline(stats.headline);
        renderStatTiles();
        renderCarton();
        document.getElementById('flock-today').innerHTML = status.activeFlock.map(renderFlockCard).join('');
        renderEggCalendar(document.getElementById('egg-calendar'), stats.heatmap);
    } catch (error) {
        document.getElementById('stat-tiles').innerHTML = renderSectionError('Status unavailable', 'Today’s numbers could not be loaded. Please try again soon.');
        document.getElementById('flock-today').innerHTML = '';
    }
}

// ---------- Flock ----------

function renderLeaderboard() {
    const hens = [...store.stats.hens].filter(hen => hen.total > 0).sort((a, b) => b.last_30 - a.last_30);
    const max = Math.max(1, ...hens.map(hen => hen.last_30));
    document.getElementById('egg-leaderboard').innerHTML = `
        <table class="leaderboard">
            <thead>
                <tr><th scope="col">Hen</th><th scope="col">30 days</th><th scope="col" class="num">All time</th><th scope="col" class="num">Streak</th></tr>
            </thead>
            <tbody>
                ${hens.map(hen => `
                    <tr>
                        <th scope="row"><a href="#hen/${hen.id}">${hen.egg_image_url ? `<img src="${escapeHtml(hen.egg_image_url)}" alt="" class="egg-icon">` : '🥚'} ${escapeHtml(hen.display_name)}</a></th>
                        <td>
                            <div class="bar-cell">
                                <span class="bar" style="width: ${(hen.last_30 / max) * 100}%"></span>
                                <span class="bar-value">${hen.last_30}</span>
                            </div>
                        </td>
                        <td class="num">${hen.total}</td>
                        <td class="num">${hen.streak ? `${hen.streak}d` : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const cost = store.stats.cost_per_egg;
    document.getElementById('cost-per-egg').innerHTML = cost
        ? `<p class="cost-line">💰 About <strong>$${cost.per_egg.toFixed(2)} per egg</strong> so far: $${cost.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent on feed, supplies, and medicine, divided by ${store.stats.totals.all_time.toLocaleString()} eggs.</p>`
        : '';
}

// Two panels sharing one week axis (never a dual-axis chart): weekly egg bars, daylight line.
function renderDaylightChart() {
    const container = document.getElementById('daylight-chart');
    const weeks = store.stats.weekly;
    // Size the viewBox to the container so axis text stays at its real pixel size on phones.
    const width = Math.max(300, Math.min(container.clientWidth || 640, 720));
    const pad = { left: 36, right: 12 };
    const eggsPanel = { top: 24, height: 120 };
    const lightPanel = { top: 194, height: 64 };
    const height = lightPanel.top + lightPanel.height + 24;
    const step = (width - pad.left - pad.right) / weeks.length;
    const maxEggs = Math.max(1, ...weeks.map(week => week.eggs));
    const lightValues = weeks.map(week => week.avg_daylight_hours).filter(value => value !== null);
    const minLight = Math.floor(Math.min(...lightValues, 9));
    const maxLight = Math.ceil(Math.max(...lightValues, 15));
    const x = index => pad.left + index * step + step / 2;
    const yEggs = value => eggsPanel.top + eggsPanel.height - (value / maxEggs) * eggsPanel.height;
    const yLight = value => lightPanel.top + lightPanel.height - ((value - minLight) / (maxLight - minLight)) * lightPanel.height;
    const barWidth = Math.max(2, step - 4);

    const bars = weeks.map((week, index) => {
        const top = yEggs(week.eggs);
        const barHeight = eggsPanel.top + eggsPanel.height - top;
        if (!barHeight) return '';
        const radius = Math.min(4, barHeight, barWidth / 2);
        const left = x(index) - barWidth / 2;
        const bottom = eggsPanel.top + eggsPanel.height;
        return `<path class="chart-bar" d="M${left},${bottom} V${top + radius} Q${left},${top} ${left + radius},${top} H${left + barWidth - radius} Q${left + barWidth},${top} ${left + barWidth},${top + radius} V${bottom} Z"></path>`;
    }).join('');

    const linePoints = weeks
        .map((week, index) => (week.avg_daylight_hours === null ? null : `${x(index)},${yLight(week.avg_daylight_hours)}`))
        .filter(Boolean);

    const monthTicks = weeks.map((week, index) => {
        const date = new Date(`${week.week_end}T12:00:00`);
        return date.getDate() <= 7 ? `<text class="chart-axis" x="${x(index)}" y="${height - 6}" text-anchor="middle">${date.toLocaleDateString('en-US', { month: 'short' })}</text>` : '';
    }).join('');

    const hitAreas = weeks.map((week, index) => `
        <rect class="chart-hit" x="${pad.left + index * step}" y="0" width="${step}" height="${height - 20}" data-index="${index}"></rect>
    `).join('');

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Weekly eggs and average daylight hours for the last six months">
            <text class="chart-axis" x="${pad.left - 6}" y="${eggsPanel.top + 4}" text-anchor="end">${maxEggs}</text>
            <text class="chart-axis" x="${pad.left - 6}" y="${eggsPanel.top + eggsPanel.height}" text-anchor="end">0</text>
            <line class="chart-baseline" x1="${pad.left}" x2="${width - pad.right}" y1="${eggsPanel.top + eggsPanel.height}" y2="${eggsPanel.top + eggsPanel.height}"></line>
            <text class="chart-panel-title" x="${pad.left}" y="${eggsPanel.top - 10}">Eggs per week</text>
            ${bars}
            <text class="chart-axis" x="${pad.left - 6}" y="${lightPanel.top + 4}" text-anchor="end">${maxLight}h</text>
            <text class="chart-axis" x="${pad.left - 6}" y="${lightPanel.top + lightPanel.height}" text-anchor="end">${minLight}h</text>
            <line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${lightPanel.top + lightPanel.height}" y2="${lightPanel.top + lightPanel.height}"></line>
            ${linePoints.length > 1 ? `<polyline class="chart-line" points="${linePoints.join(' ')}"></polyline>` : ''}
            <text class="chart-panel-title" x="${pad.left}" y="${lightPanel.top - 8}">Average daylight</text>
            <line class="chart-crosshair" x1="0" x2="0" y1="0" y2="${height - 20}" visibility="hidden"></line>
            ${monthTicks}
            ${hitAreas}
        </svg>
        <p class="chart-readout" aria-live="polite">Hover or tap a week for details.</p>
        <details class="chart-table">
            <summary>Show as a table</summary>
            <table>
                <thead><tr><th scope="col">Week ending</th><th scope="col" class="num">Eggs</th><th scope="col" class="num">Avg daylight</th></tr></thead>
                <tbody>${weeks.map(week => `<tr><td>${formatShortDate(week.week_end)}</td><td class="num">${week.eggs}</td><td class="num">${week.avg_daylight_hours ?? '—'}${week.avg_daylight_hours ? ' h' : ''}</td></tr>`).join('')}</tbody>
            </table>
        </details>
    `;

    const readout = container.querySelector('.chart-readout');
    const crosshair = container.querySelector('.chart-crosshair');
    container.querySelectorAll('.chart-hit').forEach(area => {
        const show = () => {
            const index = Number(area.dataset.index);
            const week = weeks[index];
            crosshair.setAttribute('x1', x(index));
            crosshair.setAttribute('x2', x(index));
            crosshair.setAttribute('visibility', 'visible');
            readout.textContent = `Week ending ${formatShortDate(week.week_end)}: ${plural(week.eggs, 'egg')}${week.avg_daylight_hours ? `, ${week.avg_daylight_hours} h of daylight` : ''}`;
        };
        area.addEventListener('mouseenter', show);
        area.addEventListener('click', show);
    });
}

function renderCameraFavorites() {
    const chickens = store.stats.photo_counts;
    const container = document.getElementById('camera-favorites');
    if (!chickens.length) {
        container.innerHTML = '<p class="loading">No tagged photos yet.</p>';
        return;
    }
    const max = Math.max(...chickens.map(chicken => chicken.photos));
    container.innerHTML = `
        <table class="leaderboard camera-favorites">
            <thead><tr><th scope="col">Chicken</th><th scope="col">Photos &amp; videos</th></tr></thead>
            <tbody>
                ${chickens.map(chicken => `
                    <tr class="${chicken.status === 'former' ? 'is-former' : ''}">
                        <th scope="row">
                            <a href="#hen/${chicken.id}">
                                <img src="${escapeHtml(chicken.avatar_url)}" alt="" class="camera-avatar">
                                ${escapeHtml(chicken.name)}${chicken.status === 'former' ? ' <span class="former-label">former</span>' : ''}
                            </a>
                        </th>
                        <td>
                            <div class="bar-cell">
                                <span class="bar" style="width: ${(chicken.photos / max) * 100}%"></span>
                                <span class="bar-value">${chicken.photos}</span>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

const isWeekend = date => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());

function formatMinutes(minutes) {
    return `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}

// Two panels sharing one day axis: free-range bars (weekends in a second color on a shaded band)
// and the daily high temperature line.
function renderOutdoorsChart() {
    const container = document.getElementById('outdoors-chart');
    const days = store.stats.outdoors;
    const width = Math.max(300, Math.min(container.clientWidth || 640, 720));
    const pad = { left: 36, right: 12 };
    const timePanel = { top: 24, height: 120 };
    const tempPanel = { top: 194, height: 64 };
    const height = tempPanel.top + tempPanel.height + 24;
    const step = (width - pad.left - pad.right) / days.length;
    const maxHours = Math.max(1, Math.ceil(Math.max(...days.map(day => day.minutes)) / 60));
    const temps = days.map(day => day.temp_high_f).filter(value => value !== null);
    const minTemp = Math.floor(Math.min(...temps, 40) / 10) * 10;
    const maxTemp = Math.ceil(Math.max(...temps, 80) / 10) * 10;
    const x = index => pad.left + index * step + step / 2;
    const yTime = minutes => timePanel.top + timePanel.height - (minutes / 60 / maxHours) * timePanel.height;
    const yTemp = value => tempPanel.top + tempPanel.height - ((value - minTemp) / (maxTemp - minTemp)) * tempPanel.height;
    const barWidth = Math.max(1, step * 0.7);
    const baseline = timePanel.top + timePanel.height;

    const weekendBands = days.map((day, index) => (isWeekend(day.date)
        ? `<rect class="chart-weekend-band" x="${pad.left + index * step}" y="${timePanel.top}" width="${step}" height="${timePanel.height}"></rect>`
        : '')).join('');

    const bars = days.map((day, index) => {
        if (!day.minutes) return '';
        const top = yTime(day.minutes);
        return `<rect class="${isWeekend(day.date) ? 'chart-bar-weekend' : 'chart-bar-weekday'}" x="${x(index) - barWidth / 2}" y="${top}" width="${barWidth}" height="${baseline - top}" rx="${Math.min(2, barWidth / 2)}"></rect>`;
    }).join('');

    // Break the temperature line where weather is missing rather than drawing across the gap.
    const segments = [];
    let current = [];
    days.forEach((day, index) => {
        if (day.temp_high_f === null) {
            if (current.length) segments.push(current);
            current = [];
        } else {
            current.push(`${x(index)},${yTemp(day.temp_high_f)}`);
        }
    });
    if (current.length) segments.push(current);

    const monthTicks = days.map((day, index) => (day.date.endsWith('-01')
        ? `<text class="chart-axis" x="${x(index)}" y="${height - 6}" text-anchor="middle">${new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</text>`
        : '')).join('');

    const hitAreas = days.map((day, index) => `
        <rect class="chart-hit" x="${pad.left + index * step}" y="0" width="${step}" height="${height - 20}" data-index="${index}"></rect>
    `).join('');

    const describe = day => {
        const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
        const outside = day.minutes ? `${formatMinutes(day.minutes)} outside` : 'no logged time outside';
        const weather = day.temp_high_f !== null
            ? ` · high ${day.temp_high_f}°F${day.conditions ? `, ${day.conditions.toLowerCase()}` : ''}${day.precipitation_inches > 0 ? `, ${day.precipitation_inches}" rain` : ''}`
            : '';
        return `${weekday}, ${formatShortDate(day.date)}: ${outside}${weather}`;
    };

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Daily free-range time and high temperature for the last six months">
            ${weekendBands}
            <text class="chart-axis" x="${pad.left - 6}" y="${timePanel.top + 4}" text-anchor="end">${maxHours}h</text>
            <text class="chart-axis" x="${pad.left - 6}" y="${baseline}" text-anchor="end">0</text>
            <line class="chart-baseline" x1="${pad.left}" x2="${width - pad.right}" y1="${baseline}" y2="${baseline}"></line>
            <text class="chart-panel-title" x="${pad.left}" y="${timePanel.top - 10}">Hours outside</text>
            ${bars}
            <text class="chart-axis" x="${pad.left - 6}" y="${tempPanel.top + 4}" text-anchor="end">${maxTemp}°</text>
            <text class="chart-axis" x="${pad.left - 6}" y="${tempPanel.top + tempPanel.height}" text-anchor="end">${minTemp}°</text>
            <line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${tempPanel.top + tempPanel.height}" y2="${tempPanel.top + tempPanel.height}"></line>
            ${segments.filter(points => points.length > 1).map(points => `<polyline class="chart-line chart-line--temp" points="${points.join(' ')}"></polyline>`).join('')}
            <text class="chart-panel-title" x="${pad.left}" y="${tempPanel.top - 8}">High temperature</text>
            <line class="chart-crosshair" x1="0" x2="0" y1="0" y2="${height - 20}" visibility="hidden"></line>
            ${monthTicks}
            ${hitAreas}
        </svg>
        <div class="chart-legend">
            <span><span class="legend-swatch legend-swatch--weekday"></span>Weekday</span>
            <span><span class="legend-swatch legend-swatch--weekend"></span>Weekend (shaded)</span>
        </div>
        <p class="chart-readout" aria-live="polite">Hover or tap a day for details.</p>
        <details class="chart-table">
            <summary>Show as a table</summary>
            <table>
                <thead><tr><th scope="col">Date</th><th scope="col">Day</th><th scope="col" class="num">Outside</th><th scope="col" class="num">High</th></tr></thead>
                <tbody>${[...days].reverse().filter(day => day.minutes).map(day => `<tr><td>${formatShortDate(day.date)}</td><td>${new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</td><td class="num">${formatMinutes(day.minutes)}</td><td class="num">${day.temp_high_f ?? '—'}${day.temp_high_f !== null ? '°F' : ''}</td></tr>`).join('')}</tbody>
            </table>
        </details>
    `;

    const readout = container.querySelector('.chart-readout');
    const crosshair = container.querySelector('.chart-crosshair');
    container.querySelectorAll('.chart-hit').forEach(area => {
        const show = () => {
            const index = Number(area.dataset.index);
            crosshair.setAttribute('x1', x(index));
            crosshair.setAttribute('x2', x(index));
            crosshair.setAttribute('visibility', 'visible');
            readout.textContent = describe(days[index]);
        };
        area.addEventListener('mouseenter', show);
        area.addEventListener('click', show);
    });

    // Headline comparison: average time outside per weekend day vs weekday.
    const average = list => (list.length ? list.reduce((sum, day) => sum + day.minutes, 0) / list.length : 0);
    const weekendAverage = average(days.filter(day => isWeekend(day.date)));
    const weekdayAverage = average(days.filter(day => !isWeekend(day.date)));
    document.getElementById('outdoors-summary').innerHTML = `
        <div class="outdoors-summary">
            <p><span class="legend-swatch legend-swatch--weekend"></span><strong>${formatMinutes(weekendAverage)}</strong> a day on weekends</p>
            <p><span class="legend-swatch legend-swatch--weekday"></span><strong>${formatMinutes(weekdayAverage)}</strong> a day on weekdays</p>
        </div>
    `;
}

function renderRememberWhenCard() {
    return `
        <article class="chicken-card chicken-card--memorial remember-when-card">
            <div class="chicken-avatar chicken-avatar--compact">
                <img src="/images/3Chicks.png" alt="Peppercorn, Salty, and Gomez when they were little">
            </div>
            <div class="memorial-copy">
                <p class="card-eyebrow">The early days</p>
                <h3 class="chicken-name">The three together</h3>
                <p class="former-flock-caption">Peppercorn, Salty, and Gomez—back when they could all fit under Mamma Mia’s wings. Madame Pompadour is their biological mom: she laid the eggs, and Mamma Mia did the work of hatching and raising them.</p>
            </div>
        </article>
    `;
}

function renderFormerFlockCard(chicken) {
    return `
        <a class="chicken-card chicken-card--memorial" href="#hen/${chicken.id}">
            <div class="chicken-avatar chicken-avatar--compact">
                <img src="${escapeHtml(chicken.avatar_url)}" alt="">
            </div>
            <div class="memorial-copy">
                <p class="card-eyebrow">${escapeHtml(chicken.eyebrow || 'Former flock member')}</p>
                <h3 class="chicken-name">${escapeHtml(chicken.display_name)}</h3>
                ${chicken.caption ? `<p class="former-flock-caption">${escapeHtml(chicken.caption)}</p>` : ''}
            </div>
        </a>
    `;
}

function renderProfileCard(chicken) {
    return `
        <a class="flock-card flock-card--profile" href="#hen/${chicken.id}">
            <img class="flock-card-avatar" src="${escapeHtml(chicken.avatar_url)}" alt="">
            <h3 class="flock-card-name">${escapeHtml(chicken.display_name)}</h3>
            ${chicken.role_label ? `<span class="role-badge">${escapeHtml(chicken.role_label)}</span>` : ''}
            <p class="flock-card-meta">${chicken.is_rooster ? 'Rooster' : eggColorLabel(chicken) || 'Not laying yet'}</p>
            ${chicken.bio || chicken.tagline ? `<p class="flock-card-bio">${escapeHtml(chicken.bio || chicken.tagline)}</p>` : ''}
        </a>
    `;
}

async function loadFlockTab() {
    try {
        await loadFlockData();
        document.getElementById('flock-profiles').innerHTML = store.status.activeFlock.map(renderProfileCard).join('');
        renderLeaderboard();
        renderCameraFavorites();
        renderDaylightChart();
        renderOutdoorsChart();
        document.getElementById('flock-history').innerHTML = renderRememberWhenCard()
            + store.status.formerFlock.map(renderFormerFlockCard).join('');
    } catch (error) {
        document.getElementById('flock-profiles').innerHTML = renderSectionError('Flock unavailable', 'The flock could not be loaded right now.');
    }
}

// ---------- Hen profile ----------

async function loadHenProfile(chickenId) {
    const container = document.getElementById('hen-profile');
    container.innerHTML = '<p class="loading">Loading profile…</p>';

    try {
        const [chickens, stats, photos] = await Promise.all([
            loadChickens(),
            fetchJson(`/api/stats?chicken=${chickenId}`),
            fetchJson(`/api/photos?chicken=${chickenId}&limit=24`),
            loadFlockData()
        ]);
        const chicken = chickens.find(item => item.id === chickenId);
        if (!chicken) {
            container.innerHTML = renderSectionError('Chicken not found', 'That flock member could not be found.');
            return;
        }
        rememberPhotos(photos);
        const live = store.status.activeFlock.find(item => item.id === chickenId);
        const hen = stats.hens[0];
        const isFormer = chicken.status === 'former';
        const hasEggs = stats.totals.all_time > 0;
        document.title = `${chicken.display_name} · The Clucking Times`;

        const tiles = [];
        if (hasEggs) {
            tiles.push(['All-time eggs', stats.totals.all_time, hen?.first_egg_date ? `Since ${formatShortDate(hen.first_egg_date)}` : '']);
            tiles.push(['Last 30 days', hen?.last_30 ?? 0, `${stats.totals.this_week} in the last 7 days`]);
            if (!isFormer) tiles.push(['Streak', hen?.streak ? plural(hen.streak, 'day') : '—', `Last egg: ${formatStatusDate(hen?.last_egg_date)}`]);
            if (hen?.weighed) tiles.push(['Average weight', `${hen.avg_weight_g} g`, `Heaviest ${hen.max_weight_g} g · ${plural(hen.weighed, 'egg')} weighed`]);
        }

        container.innerHTML = `
            <a class="back-link" href="#flock">← The whole flock</a>
            <article class="hen-hero card">
                <img class="hen-hero-avatar" src="${escapeHtml(chicken.avatar_url)}" alt="${escapeHtml(chicken.display_name)}">
                <div class="hen-hero-copy">
                    <p class="card-eyebrow">${isFormer ? 'Former flock member' : chicken.is_rooster ? 'Rooster' : 'Hen'}</p>
                    <h2 class="hen-hero-name">${escapeHtml(chicken.display_name)}</h2>
                    ${chicken.role_label ? `<span class="role-badge">${escapeHtml(chicken.role_label)}</span>` : ''}
                    ${eggColorLabel(chicken) ? `<p class="flock-card-meta">${eggColorLabel(chicken)}</p>` : ''}
                    ${chicken.bio ? `<p class="hen-hero-bio">${escapeHtml(chicken.bio)}</p>` : ''}
                    ${chicken.tagline ? `<p class="hen-hero-bio">${escapeHtml(chicken.tagline)}</p>` : ''}
                    ${isFormer && chicken.departure_note ? `<p class="hen-hero-bio">${escapeHtml(chicken.departure_note)}</p>` : ''}
                    ${live?.health_concern ? `<p class="health-chip">⚠️ ${escapeHtml(live.health_concern.observation_type)}: ${escapeHtml(live.health_concern.description)}</p>` : ''}
                    ${live?.first_egg_date ? `
                        <details class="hen-first-egg">
                            <summary>${live.first_egg_presumed ? 'Presumed first egg' : 'First egg'}: ${escapeHtml(formatShortDate(live.first_egg_date))}</summary>
                            ${live.first_egg_notes ? `<p>${escapeHtml(live.first_egg_notes)}</p>` : ''}
                        </details>` : ''}
                </div>
            </article>
            ${tiles.length ? `
                <div class="stat-tiles">
                    ${tiles.map(([label, value, detail]) => `
                        <article class="stat-tile">
                            <p class="stat-label">${escapeHtml(label)}</p>
                            <p class="stat-value">${escapeHtml(value)}</p>
                            <p class="stat-detail">${escapeHtml(detail)}</p>
                        </article>`).join('')}
                </div>
                <section class="card status-section">
                    <h3 class="section-heading section-heading--left">${escapeHtml(chicken.display_name)}’s egg calendar</h3>
                    <div id="hen-calendar" class="egg-calendar"></div>
                </section>` : ''}
            <section class="card status-section">
                <h3 class="section-heading section-heading--left">Photos of ${escapeHtml(chicken.display_name)}</h3>
                ${photos.length
                    ? `<div class="photo-grid">${photos.map(photo => renderPhotoThumb(photo)).join('')}</div>
                       ${photos.length >= 24 ? `<p class="section-link-row"><a class="section-link" href="#photos" data-filter="${chicken.id}">See all photos of ${escapeHtml(chicken.display_name)} →</a></p>` : ''}`
                    : '<p class="loading">No tagged photos yet.</p>'}
            </section>
        `;

        if (tiles.length) {
            renderEggCalendar(document.getElementById('hen-calendar'), stats.heatmap);
        }
        container.querySelector('[data-filter]')?.addEventListener('click', () => {
            photoState.chicken = chickenId;
        });
    } catch (error) {
        container.innerHTML = renderSectionError('Profile unavailable', 'This profile could not be loaded right now.');
    }
}

// ---------- Photos ----------

const photoState = { chicken: null, offset: 0 };

async function renderPhotoFilters() {
    const chickens = await loadChickens();
    const filters = document.getElementById('photo-filters');
    const chips = [{ id: null, label: 'Everyone' }, ...chickens.map(chicken => ({ id: chicken.id, label: chicken.display_name }))];
    filters.innerHTML = chips.map(chip => `
        <button type="button" class="chip ${photoState.chicken === chip.id ? 'chip--active' : ''}" data-chicken="${chip.id ?? ''}" aria-pressed="${photoState.chicken === chip.id}">
            ${escapeHtml(chip.label)}
        </button>
    `).join('');
    filters.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            photoState.chicken = chip.dataset.chicken ? Number(chip.dataset.chicken) : null;
            loadPhotosTab();
        });
    });
}

async function loadPhotoPage(append) {
    const grid = document.getElementById('photo-grid');
    const more = document.getElementById('photo-more');
    if (!append) {
        photoState.offset = 0;
        grid.innerHTML = '<p class="loading">Loading photos…</p>';
    }
    more.innerHTML = '';

    try {
        const params = new URLSearchParams({ limit: PHOTO_PAGE_SIZE, offset: photoState.offset });
        if (photoState.chicken) params.set('chicken', photoState.chicken);
        const photos = await fetchJson(`/api/photos?${params}`);
        rememberPhotos(photos);
        const html = photos.map(photo => renderPhotoThumb(photo)).join('');
        if (append) {
            grid.insertAdjacentHTML('beforeend', html);
        } else {
            grid.innerHTML = html || '<p class="loading">No photos tagged with this chicken yet.</p>';
        }
        photoState.offset += photos.length;
        if (photos.length === PHOTO_PAGE_SIZE) {
            more.innerHTML = '<button type="button" class="load-more-btn">Load more photos</button>';
            more.querySelector('button').addEventListener('click', () => loadPhotoPage(true));
        }
    } catch (error) {
        grid.innerHTML = renderSectionError('Photos unavailable', 'The photo gallery could not be loaded right now.');
    }
}

async function loadPhotosTab() {
    await renderPhotoFilters().catch(() => {});
    await loadPhotoPage(false);
}

function openLightbox(photoId) {
    const photo = photoIndex.get(String(photoId));
    if (!photo) return;
    const dialog = document.getElementById('lightbox');
    const isVideo = photo.media_type === 'video';
    document.getElementById('lightbox-media').innerHTML = isVideo
        ? `<video src="/api/photos/${photo.id}" controls autoplay playsinline></video>`
        : `<img src="/api/photos/${photo.id}" alt="${escapeHtml(photo.caption || 'Photo from the coop')}">`;
    document.getElementById('lightbox-meta').innerHTML = `
        ${photo.caption ? `<p class="lightbox-caption">${escapeHtml(photo.caption)}</p>` : ''}
        <p class="lightbox-date">${escapeHtml(formatShortDate(photo.date))}</p>
        ${photo.chickens?.length ? `<div class="chip-row">${photo.chickens.map(chicken => `<a class="chip" href="#hen/${chicken.id}">${escapeHtml(chicken.display_name)}</a>`).join('')}</div>` : ''}
    `;
    dialog.showModal();
}

function closeLightbox() {
    const dialog = document.getElementById('lightbox');
    dialog.querySelector('video')?.pause();
    dialog.close();
}

// ---------- Router ----------

const RouterManager = {
    refreshInterval: null,

    init() {
        this.route();
        window.addEventListener('hashchange', () => this.route());
    },

    route() {
        const hash = window.location.hash.slice(1);
        const henMatch = hash.match(/^hen\/(\d+)$/);
        if (henMatch) {
            this.show('hen', 'flock');
            loadHenProfile(Number(henMatch[1]));
            window.scrollTo({ top: 0 });
            return;
        }
        const recipeMatch = hash.match(/^recipes\/(\d{4}-\d{2}-\d{2})$/);
        if (recipeMatch) {
            this.stopRefresh();
            this.show('recipes', 'recipes');
            loadRecipesTab(recipeMatch[1]);
            window.scrollTo({ top: 0 });
            return;
        }
        document.title = 'The Clucking Times';
        // Old links used #status for the front page
        this.setTab(hash === 'status' ? 'today' : hash);
    },

    setTab(tabName) {
        if (!TABS.includes(tabName)) {
            tabName = 'today';
        }

        if (window.location.hash.slice(1) !== tabName) {
            window.history.replaceState(null, '', `#${tabName}`);
        }

        this.show(tabName, tabName);
        this.handleTabContent(tabName);
    },

    show(panelName, tabName) {
        document.querySelectorAll('.tab').forEach((tab) => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
            if (isActive) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });

        document.querySelectorAll('.tab-content').forEach((content) => {
            const isActive = content.id === `${panelName}-tab`;
            content.classList.toggle('active', isActive);
            content.hidden = !isActive;
        });
    },

    handleTabContent(tabName) {
        this.stopRefresh();
        switch (tabName) {
            case 'today':
                loadToday();
                loadLatestDispatch();
                loadPhotoStrip();
                loadRecipeTeaser();
                this.refreshInterval = setInterval(() => loadToday({ force: true }), 60000);
                break;
            case 'blog':
                loadBlogPosts();
                break;
            case 'photos':
                loadPhotosTab();
                break;
            case 'flock':
                loadFlockTab();
                break;
            case 'recipes':
                loadRecipesTab();
                break;
            case 'history':
                loadActivity();
                break;
            case 'poetry':
                loadPoem();
                break;
        }
    },

    stopRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};

// ---------- Recipes ----------

const recipeCache = new Map();

function fetchRecipe(week) {
    const key = week || 'current';
    if (!recipeCache.has(key)) {
        recipeCache.set(key, fetchJson(week ? `/api/recipe?week=${week}` : '/api/recipe').catch(error => {
            recipeCache.delete(key);
            throw error;
        }));
    }
    return recipeCache.get(key);
}

const formatWeekOf = weekStart => `Week of ${new Date(`${weekStart}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

function renderRecipe(recipe, isCurrent) {
    const meta = [
        recipe.servings && `Serves ${recipe.servings}`,
        recipe.total_time,
        recipe.eggs_used && `Uses ${plural(recipe.eggs_used, 'egg')}`
    ].filter(Boolean);
    return `
        <p class="card-eyebrow">🍳 Clucky’s Kitchen · ${isCurrent ? 'This week' : escapeHtml(formatWeekOf(recipe.week_start))}</p>
        <h2 class="recipe-title">${escapeHtml(recipe.title)}</h2>
        ${recipe.intro ? `<p class="recipe-intro">${escapeHtml(recipe.intro)}</p>` : ''}
        ${meta.length ? `<p class="recipe-meta">${meta.map(escapeHtml).join(' · ')}</p>` : ''}
        <div class="recipe-body">
            <section>
                <h3>Ingredients</h3>
                <ul class="recipe-ingredients">${recipe.ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </section>
            <section>
                <h3>Method</h3>
                <ol class="recipe-steps">${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
            </section>
        </div>
        ${recipe.tip ? `<p class="recipe-tip"><strong>Clucky’s tip:</strong> ${escapeHtml(recipe.tip)}</p>` : ''}
        ${isCurrent ? '' : '<p><a href="#recipes" class="section-link">← This week’s recipe</a></p>'}
    `;
}

async function loadRecipesTab(week) {
    const display = document.getElementById('recipe-display');
    display.innerHTML = '<p class="loading">Cracking open this week’s recipe…</p>';
    try {
        const recipe = await fetchRecipe(week);
        const current = await fetchRecipe().catch(() => null);
        display.innerHTML = renderRecipe(recipe, !week || recipe.week_start === current?.week_start);
    } catch (error) {
        display.innerHTML = renderSectionError('Kitchen closed', 'The recipe could not be loaded right now. Please try again soon.');
    }

    try {
        const archive = await fetchJson('/api/recipe?archive=1');
        document.getElementById('recipe-archive-list').innerHTML = archive.length
            ? archive.map(item => `
                <li><a href="#recipes/${item.week_start}">${escapeHtml(item.title)}</a> <span class="recipe-archive-date">${escapeHtml(formatWeekOf(item.week_start))}</span></li>
            `).join('')
            : '<li>This is the first one!</li>';
    } catch {
        document.getElementById('recipe-archive-list').innerHTML = '';
    }
}

async function loadRecipeTeaser() {
    const teaser = document.getElementById('recipe-teaser');
    try {
        const recipe = await fetchRecipe();
        teaser.innerHTML = `
            <span class="recipe-teaser-icon" aria-hidden="true">🍳</span>
            <span>
                <span class="recipe-teaser-kicker">This week in Clucky’s Kitchen</span>
                <span class="recipe-teaser-title">${escapeHtml(recipe.title)}</span>
            </span>
            <span class="recipe-teaser-arrow" aria-hidden="true">→</span>
        `;
        teaser.hidden = false;
    } catch {
        teaser.hidden = true;
    }
}

// ---------- Poetry, dispatches, history, weather ----------

async function loadPoem() {
    const display = document.getElementById('poem-display');
    display.innerHTML = '<p class="loading">Composing a poem...</p>';

    try {
        const response = await fetch('/api/poetry');
        if (response.ok) {
            const data = await response.json();

            if (data.error) {
                display.innerHTML = `
                    <p class="loading">⚠️ ${escapeHtml(data.error)}</p>
                    <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">${escapeHtml(data.details || '')}</p>
                `;
                return;
            }

            display.className = data.isChicken ? 'poem-container' : 'poem-container squirrel';
            display.innerHTML = `
                <div class="poem-subject">${data.isChicken ? '🐔' : '🐿️'} ${escapeHtml(data.subject)}</div>
                <div class="poem-text">${escapeHtml(data.poem)}</div>
                <div class="poem-form">${escapeHtml(data.form)}</div>
                <div class="poem-description">${escapeHtml(data.description)}</div>
                <button class="refresh-btn" onclick="loadPoem()">✨ Another Poem</button>
            `;
        } else {
            const errorData = await response.json().catch(() => ({}));
            display.innerHTML = `
                <p class="loading">⚠️ Failed to load poem</p>
                <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">${escapeHtml(errorData.details || 'Please try again.')}</p>
            `;
        }
    } catch (error) {
        display.innerHTML = `
            <p class="loading">⚠️ Network error loading poem</p>
            <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">Please check your connection and try again.</p>
        `;
    }
}

// Blog pagination state
let blogOffset = 0;
const BLOG_LIMIT = 5;

function getBlogPublicationDate(createdAt) {
    if (!createdAt) return null;

    // D1's default datetime('now') is UTC, without a timezone suffix.
    const timestamp = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
    const publishedAt = new Date(timestamp);
    if (Number.isNaN(publishedAt.getTime())) return null;

    const publicationDate = publishedAt.toLocaleDateString('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return { timestamp: publishedAt.toISOString(), date: publicationDate };
}

async function loadBlogPosts(append = false) {
    const feed = document.getElementById('blog-feed');

    if (!append) {
        blogOffset = 0;
        feed.innerHTML = '<p class="loading">Loading blog posts...</p>';
    }

    try {
        const response = await fetch(`/api/blog?limit=${BLOG_LIMIT}&offset=${blogOffset}`);
        if (response.ok) {
            const data = await response.json();
            const posts = data.posts;

            if (posts.length === 0 && blogOffset === 0) {
                feed.innerHTML = '<p class="loading">No blog posts yet. Check back soon!</p>';
                return;
            }

            const postsHtml = posts.map((post) => {
                const isAuto = post.is_auto_generated === 1;
                const publication = getBlogPublicationDate(post.created_at);
                return `
                    <article class="activity-item blog-post">
                        <h3 class="activity-type">
                            ${escapeHtml(post.title || 'Untitled Post')}
                            ${isAuto ? '<span style="font-size: 0.8rem; opacity: 0.7;"> (AI-Generated)</span>' : ''}
                        </h3>
                        ${publication ? `<div class="activity-date">Posted <time datetime="${publication.timestamp}">${formatShortDate(publication.date)}</time></div>` : ''}
                        <div class="activity-details blog-content">${marked.parse(post.content || '')}</div>
                        ${publication ? '' : `<div class="activity-date">${formatDate(post.date)}</div>`}
                    </article>
                `;
            }).join('');

            if (append) {
                feed.querySelector('.load-more-btn')?.remove();
                feed.insertAdjacentHTML('beforeend', postsHtml);
            } else {
                feed.innerHTML = postsHtml;
            }

            if (data.hasMore) {
                feed.insertAdjacentHTML('beforeend', `
                    <button class="load-more-btn" onclick="loadMoreBlogPosts()">
                        Load More Posts (${data.total - blogOffset - posts.length} remaining)
                    </button>
                `);
            }

            blogOffset += posts.length;
        } else {
            feed.innerHTML = '<p class="loading">Failed to load blog posts.</p>';
        }
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading blog posts.</p>';
    }
}

function loadMoreBlogPosts() {
    loadBlogPosts(true);
}

function getActivityDataType(activityType) {
    if (activityType.includes('Egg')) return 'egg';
    if (activityType.includes('Treats') || activityType.includes('Scraps')) return 'feeding';
    if (activityType.includes('Free Range')) return 'free_range';
    if (activityType.includes('Health')) return 'health';
    if (activityType.includes('Photo') || activityType.includes('Video')) return 'photo';
    if (activityType.includes('Headline')) return 'headline';
    return 'other';
}

async function getEggImages() {
    try {
        const chickens = await loadChickens();
        return new Map(chickens.filter(chicken => chicken.egg_image_url).map(chicken => [chicken.name, chicken.egg_image_url]));
    } catch {
        return new Map();
    }
}

async function loadActivity() {
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = '<p class="loading">Loading activity...</p>';

    try {
        const [activities, eggImages] = await Promise.all([fetchJson('/api/activity'), getEggImages()]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentActivities = activities.filter(activity => new Date(`${activity.date}T00:00:00`) >= sevenDaysAgo);

        if (recentActivities.length === 0) {
            feed.innerHTML = '<p class="loading">No activity in the last 7 days.</p>';
            return;
        }

        const groupedByDate = {};
        recentActivities.forEach((activity) => {
            (groupedByDate[activity.date] ||= []).push(activity);
        });

        const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

        feed.innerHTML = sortedDates.map((date, index) => {
            const isFirstDay = index === 0;
            const activitiesForDate = groupedByDate[date];

            return `
                <div class="day-section">
                    <button class="day-header ${isFirstDay ? 'open' : ''}" onclick="toggleDay(this)">
                        <span class="day-label">${formatDate(date)}</span>
                        <span class="day-count">${activitiesForDate.length} ${activitiesForDate.length === 1 ? 'activity' : 'activities'}</span>
                        <span class="toggle-icon">${isFirstDay ? '▼' : '▶'}</span>
                    </button>
                    <div class="day-activities" style="${isFirstDay ? '' : 'display: none;'}">
                        ${activitiesForDate.map((activity) => {
                            const eggImage = eggImages.get(activity.chicken_name);
                            const type = activity.type.includes('Egg') && eggImage
                                ? `<img src="${escapeHtml(eggImage)}" alt="" class="activity-egg-icon"> Egg Laid`
                                : escapeHtml(activity.type);
                            return `
                                <div class="activity-item" data-type="${getActivityDataType(activity.type)}">
                                    <div class="activity-type">${type}</div>
                                    <div class="activity-details">${escapeHtml(activity.details)}</div>
                                    ${activity.photo_id ? (activity.media_type === 'video'
                                        ? `<video src="/api/photos/${activity.photo_id}#t=0.5" class="activity-photo-thumb" preload="metadata" controls playsinline></video>`
                                        : `<img src="/api/photos/${activity.photo_id}" alt="${escapeHtml(activity.details)}" class="activity-photo-thumb" loading="lazy">`) : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading activity.</p>';
    }
}

function toggleDay(button) {
    const isOpen = button.classList.toggle('open');
    button.nextElementSibling.style.display = isOpen ? 'block' : 'none';
    button.querySelector('.toggle-icon').textContent = isOpen ? '▼' : '▶';
}

async function loadWeather() {
    const weatherDiv = document.getElementById('weather');
    if (!weatherDiv) {
        return;
    }

    try {
        const weather = await fetchJson('/api/weather');
        weatherDiv.textContent = `${weather.temperature}°F, ${weather.description} in Lawrence`;
    } catch (error) {
        weatherDiv.innerHTML = '<span class="loading">Weather unavailable</span>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('masthead-date').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Chicago'
    });

    RouterManager.init();
    loadWeather();

    document.addEventListener('click', (event) => {
        const thumb = event.target.closest('[data-photo-id]');
        if (thumb) {
            openLightbox(thumb.dataset.photoId);
        }
    });

    const lightbox = document.getElementById('lightbox');
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeLightbox();
        if (event.target.closest('a')) closeLightbox();
    });
    lightbox.addEventListener('close', () => lightbox.querySelector('video')?.pause());

    document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            window.location.hash = tab.dataset.tab;
        });

        tab.addEventListener('keydown', (event) => {
            const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
            const currentIndex = tabs.indexOf(tab);
            const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!offset) return;
            event.preventDefault();
            const nextTab = tabs[(currentIndex + offset + tabs.length) % tabs.length];
            nextTab.focus();
            window.location.hash = nextTab.dataset.tab;
        });
    });
});
