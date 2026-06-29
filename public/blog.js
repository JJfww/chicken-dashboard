// Chicken avatar mapping
const chickenAvatars = {
    'Mamma Mia': '/images/mamma-mia.png',
    'Brown Betty': '/images/brown-betty.png',
    'Madame Pompadour': '/images/MadamePompadour26.png',
    'Velma': '/images/Velma.png',
    'The Chicks': '/images/3Chicks.png',
    'Rudy': '/images/rudy.png'
};

// Chicken egg image mapping
const chickenEggImages = {
    'Mamma Mia': '/images/egg_mamma_mia.png',
    'Brown Betty': '/images/egg_brown_betty.png',
    'Madame Pompadour': '/images/egg_madame_pompadour.png'
};

const statusState = {
    hasLoaded: false
};

function getEggImage(name) {
    return chickenEggImages[name] || null;
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

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (compareDate.getTime() === today.getTime()) {
        return 'Today';
    }

    return formatShortDate(dateString);
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncateText(text, maxLength = 120) {
    if (!text || text.length <= maxLength) {
        return text || '';
    }

    return `${text.slice(0, maxLength).trimEnd()}…`;
}

function renderStatusRow({ label, value, icon, tone = '', compact = false }) {
    return `
        <div class="status-item ${tone} ${compact ? 'status-item--compact' : ''}">
            <div class="status-icon">${icon}</div>
            <div class="status-text">
                <p class="status-label">${label}</p>
                <p class="status-value">${value}</p>
            </div>
        </div>
    `;
}

function renderHealthAlert(chicken) {
    if (!chicken.health_concern) {
        return '';
    }

    return `
        <div class="health-alert" role="note">
            <p class="health-alert-label">Health note: ${escapeHtml(chicken.health_concern.observation_type)}</p>
            <p class="health-alert-text">${escapeHtml(chicken.health_concern.description)}</p>
        </div>
    `;
}

function renderChickenMeta(chicken) {
    const eggImage = getEggImage(chicken.name);

    if (chicken.is_rooster || chicken.name === 'Velma' || chicken.display_name === 'Velma/Vinnie') {
        return '<p class="chicken-meta">Young rooster, no eggs</p>';
    }

    return `
        <p class="chicken-meta">
            ${eggImage ? `<img src="${eggImage}" alt="${escapeHtml(chicken.egg_color)} egg" class="egg-icon">` : '🥚'}
            ${escapeHtml(chicken.egg_color)} eggs
        </p>
    `;
}

function renderFlockCard(chicken, variant = 'feature') {
    const avatarImage = chickenAvatars[chicken.name] || '/images/default.png';
    const eggImage = getEggImage(chicken.name);
    const laidToday = chicken.laid_today;
    const isRooster = chicken.is_rooster || chicken.name === 'Velma' || chicken.display_name === 'Velma/Vinnie';
    const displayName = chicken.display_name || (chicken.name === 'Velma' ? 'Velma/Vinnie' : chicken.name);
    const cardClasses = variant === 'feature'
        ? 'chicken-card chicken-card--feature'
        : 'chicken-card chicken-card--compact';
    const eyebrow = variant === 'feature'
        ? '<p class="card-eyebrow">Current boss hen</p>'
        : `<p class="card-eyebrow">${isRooster ? 'Young rooster' : 'Supporting hen'}</p>`;
    const primaryValue = isRooster ? 'No eggs. Started crowing.' : (laidToday ? 'Egg laid!' : 'Not yet');
    const primaryIcon = isRooster
        ? '🚫🥚'
        : laidToday
        ? (eggImage ? `<img src="${eggImage}" alt="${escapeHtml(chicken.egg_color)} egg" class="egg-icon">` : '🥚')
        : '⏱️';

    return `
        <article class="${cardClasses}">
            ${eyebrow}
            <div class="chicken-avatar ${variant === 'compact' ? 'chicken-avatar--compact' : ''}">
                <img src="${avatarImage}" alt="${escapeHtml(chicken.name)}">
            </div>
            <h3 class="chicken-name">${escapeHtml(displayName)}</h3>
            ${chicken.role_label ? `<span class="role-badge">${escapeHtml(chicken.role_label)}</span>` : ''}
            ${renderChickenMeta(chicken)}
            <div class="status-stack">
                ${renderStatusRow({
                    label: 'Today',
                    value: escapeHtml(primaryValue),
                    icon: primaryIcon,
                    tone: laidToday ? 'laid-today' : (isRooster ? 'growing' : 'not-yet'),
                    compact: variant === 'compact'
                })}
                ${renderStatusRow({
                    label: isRooster ? 'Status' : 'Last egg',
                    value: escapeHtml(isRooster ? 'Competing for king of the coop' : formatStatusDate(chicken.last_egg_date)),
                    icon: isRooster ? '❌📆' : '📆',
                    compact: variant === 'compact'
                })}
            </div>
            ${renderHealthAlert(chicken)}
        </article>
    `;
}

function renderExpandableText(label, text, className = '') {
    if (!text) {
        return '';
    }

    const safeText = escapeHtml(text);
    const shortText = escapeHtml(truncateText(text));

    if (text.length <= 120) {
        return `<p class="${className}">${safeText}</p>`;
    }

    return `
        <details class="expandable-copy ${className}">
            <summary>${label}</summary>
            <p>${shortText}</p>
            <div class="expandable-copy-full">${safeText}</div>
        </details>
    `;
}

function renderChickGroupCard(chickGroup) {
    const avatarImage = chickenAvatars[chickGroup.name] || '/images/default.png';
    const milestone = chickGroup.milestone;
    const currentUpdate = milestone ? milestone.description : chickGroup.summary;

    return `
        <article class="chicken-card chicken-card--feature chicken-card--chicks">
            <p class="card-eyebrow">Latest chick update</p>
            <div class="chicken-avatar">
                <img src="${avatarImage}" alt="${escapeHtml(chickGroup.name)}">
            </div>
            <h3 class="chicken-name">${escapeHtml(chickGroup.name)}</h3>
            <p class="chick-hatch-dates">${escapeHtml(chickGroup.hatch_summary)}</p>
            <div class="status-stack">
                ${renderStatusRow({
                    label: 'Milestone',
                    value: escapeHtml(milestone ? milestone.label : 'No milestone logged yet'),
                    icon: '🐥'
                })}
                ${renderStatusRow({
                    label: 'Today',
                    value: escapeHtml(currentUpdate),
                    icon: '🪺'
                })}
            </div>
            ${renderExpandableText('More about the chicks', chickGroup.lineage_note, 'lineage-note')}
            ${milestone?.notes ? renderExpandableText('Field notes', milestone.notes, 'field-note') : ''}
        </article>
    `;
}

function renderFormerFlockCard(chicken) {
    const avatarImage = chickenAvatars[chicken.name] || '/images/default.png';

    return `
        <article class="chicken-card chicken-card--memorial">
            <div class="chicken-avatar chicken-avatar--compact">
                <img src="${avatarImage}" alt="${escapeHtml(chicken.name)}">
            </div>
            <div class="memorial-copy">
                <p class="card-eyebrow">Rooster and chick dad</p>
                <h3 class="chicken-name">${escapeHtml(chicken.name)}</h3>
                <p class="former-flock-caption">${escapeHtml(chicken.caption)}</p>
            </div>
        </article>
    `;
}

function renderSummaryStrip(data, bossHen) {
    const layingToday = data.activeFlock.filter((chicken) => chicken.laid_today);
    const layingNames = layingToday.length
        ? layingToday.map((chicken) => chicken.name).join(', ')
        : 'No eggs yet';
    const eggsValue = layingToday.length === 1 ? '1 egg today' : `${layingToday.length} eggs today`;
    const milestoneValue = data.chickGroup?.milestone?.label || 'No milestone logged';

    return `
        <article class="summary-card">
            <p class="summary-label">Egg report</p>
            <p class="summary-value">${escapeHtml(eggsValue)}</p>
            <p class="summary-detail">${escapeHtml(layingNames)}</p>
        </article>
        <article class="summary-card">
            <p class="summary-label">Boss hen</p>
            <p class="summary-value">${escapeHtml(bossHen?.name || 'Unknown')}</p>
            <p class="summary-detail">${escapeHtml(bossHen?.role_label || 'Running the coop')}</p>
        </article>
        <article class="summary-card">
            <p class="summary-label">Latest layer</p>
            <p class="summary-value">${escapeHtml(layingToday[0]?.name || 'Waiting')}</p>
            <p class="summary-detail">${escapeHtml(layingToday[0]?.egg_color ? `${layingToday[0].egg_color} egg` : 'No egg logged yet')}</p>
        </article>
        <article class="summary-card">
            <p class="summary-label">Chick milestone</p>
            <p class="summary-value">${escapeHtml(milestoneValue)}</p>
            <p class="summary-detail">${escapeHtml(truncateText(data.chickGroup?.milestone?.description || data.chickGroup?.summary || 'No update yet', 56))}</p>
        </article>
    `;
}

function renderSectionError(title, detail) {
    return `
        <div class="status-fallback" role="status">
            <p class="status-fallback-title">${title}</p>
            <p class="status-fallback-copy">${detail}</p>
        </div>
    `;
}

function renderStatusLoadingState() {
    const summaryStrip = document.getElementById('status-summary-strip');
    const bossHenRow = document.getElementById('boss-hen-row');
    const activeFlockGrid = document.getElementById('active-flock-grid');
    const chicksRow = document.getElementById('chicks-row');
    const formerFlockGrid = document.getElementById('former-flock-grid');

    summaryStrip.innerHTML = `
        <div class="summary-card skeleton-card"><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line"></span></div>
        <div class="summary-card skeleton-card"><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line"></span></div>
        <div class="summary-card skeleton-card"><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line"></span></div>
        <div class="summary-card skeleton-card"><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line"></span></div>
    `;

    bossHenRow.innerHTML = `
        <article class="chicken-card chicken-card--feature skeleton-card" aria-hidden="true">
            <div class="avatar-skeleton skeleton-circle"></div>
            <span class="skeleton-line skeleton-line-short centered"></span>
            <span class="skeleton-line skeleton-line-medium centered"></span>
            <div class="status-item skeleton-block"></div>
            <div class="status-item skeleton-block"></div>
        </article>
    `;

    activeFlockGrid.innerHTML = Array.from({ length: 3 }).map(() => `
        <article class="chicken-card chicken-card--compact skeleton-card" aria-hidden="true">
            <div class="avatar-skeleton skeleton-circle small"></div>
            <span class="skeleton-line skeleton-line-medium centered"></span>
            <div class="status-item skeleton-block compact"></div>
            <div class="status-item skeleton-block compact"></div>
        </article>
    `).join('');

    chicksRow.innerHTML = `
        <article class="chicken-card chicken-card--feature chicken-card--chicks skeleton-card" aria-hidden="true">
            <div class="avatar-skeleton skeleton-circle"></div>
            <span class="skeleton-line skeleton-line-short centered"></span>
            <span class="skeleton-line centered"></span>
            <span class="skeleton-line centered"></span>
            <div class="status-item skeleton-block"></div>
            <div class="status-item skeleton-block"></div>
        </article>
    `;

    formerFlockGrid.innerHTML = `
        <article class="chicken-card chicken-card--memorial skeleton-card" aria-hidden="true">
            <div class="avatar-skeleton skeleton-circle small"></div>
            <span class="skeleton-line skeleton-line-short centered"></span>
            <span class="skeleton-line centered"></span>
            <span class="skeleton-line centered"></span>
        </article>
    `;
}

// Hash routing system
const RouterManager = {
    currentTab: 'status',
    statusRefreshInterval: null,

    init() {
        const initialHash = window.location.hash.slice(1) || 'status';
        this.setTab(initialHash);

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'status';
            this.setTab(hash);
        });
    },

    setTab(tabName) {
        if (!['status', 'blog', 'history', 'poetry'].includes(tabName)) {
            tabName = 'status';
        }

        this.currentTab = tabName;

        if (window.location.hash.slice(1) !== tabName) {
            window.history.replaceState(null, '', `#${tabName}`);
        }

        this.updateTabUI(tabName);
        this.handleTabContent(tabName);
    },

    updateTabUI(tabName) {
        document.querySelectorAll('.tab').forEach((tab) => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        document.querySelectorAll('.tab-content').forEach((content) => {
            const isActive = content.id === `${tabName}-tab`;
            content.classList.toggle('active', isActive);
            content.hidden = !isActive;
        });
    },

    handleTabContent(tabName) {
        switch (tabName) {
            case 'status':
                this.startStatusRefresh();
                loadChickenStatus();
                break;
            case 'blog':
                this.stopStatusRefresh();
                loadBlogPosts();
                break;
            case 'history':
                this.stopStatusRefresh();
                loadActivity();
                break;
            case 'poetry':
                this.stopStatusRefresh();
                loadPoem();
                break;
        }
    },

    startStatusRefresh() {
        if (!this.statusRefreshInterval) {
            this.statusRefreshInterval = setInterval(loadChickenStatus, 60000);
        }
    },

    stopStatusRefresh() {
        if (this.statusRefreshInterval) {
            clearInterval(this.statusRefreshInterval);
            this.statusRefreshInterval = null;
        }
    }
};

// Load Chicken Status
async function loadChickenStatus() {
    const summaryStrip = document.getElementById('status-summary-strip');
    const bossHenRow = document.getElementById('boss-hen-row');
    const activeFlockGrid = document.getElementById('active-flock-grid');
    const chicksRow = document.getElementById('chicks-row');
    const formerFlockGrid = document.getElementById('former-flock-grid');

    if (!statusState.hasLoaded) {
        renderStatusLoadingState();
    }

    try {
        const response = await fetch('/api/status');
        if (!response.ok) {
            throw new Error('Failed to load status');
        }

        const data = await response.json();
        const bossHen = data.activeFlock.find((chicken) => chicken.name === 'Madame Pompadour') || data.activeFlock[0];
        const trioOrder = ['Brown Betty', 'Mamma Mia', 'Velma'];
        const remainingFlock = trioOrder
            .map((name) => data.activeFlock.find((chicken) => chicken.name === name))
            .filter(Boolean);

        summaryStrip.innerHTML = renderSummaryStrip(data, bossHen);
        bossHenRow.innerHTML = bossHen ? renderFlockCard(bossHen, 'feature') : renderSectionError('No lead hen found', 'The current flock data did not include a featured hen.');
        activeFlockGrid.innerHTML = remainingFlock.length
            ? remainingFlock.map((chicken) => renderFlockCard(chicken, 'compact')).join('')
            : renderSectionError('Supporting flock unavailable', 'The other active flock members could not be listed right now.');
        chicksRow.innerHTML = data.chickGroup
            ? renderChickGroupCard(data.chickGroup)
            : renderSectionError('Chick update unavailable', 'No chick group details are available right now.');
        formerFlockGrid.innerHTML = Array.isArray(data.formerFlock) && data.formerFlock.length
            ? data.formerFlock.map(renderFormerFlockCard).join('')
            : renderSectionError('No former flock member listed', 'A memorial card can appear here when a former flock note is available.');

        statusState.hasLoaded = true;
    } catch (error) {
        summaryStrip.innerHTML = renderSectionError('Status summary unavailable', 'The public status summary could not be loaded right now.');
        bossHenRow.innerHTML = renderSectionError('Current flock unavailable', 'The featured flock update could not be loaded. Please try again soon.');
        activeFlockGrid.innerHTML = renderSectionError('Supporting hens unavailable', 'The supporting flock cards could not be loaded right now.');
        chicksRow.innerHTML = renderSectionError('Chick update unavailable', 'The chick status feed could not be loaded right now.');
        formerFlockGrid.innerHTML = renderSectionError('Memorial update unavailable', 'The former flock section could not be loaded right now.');
    }
}

// Load Poem
async function loadPoem() {
    const display = document.getElementById('poem-display');
    display.innerHTML = '<p class="loading">Composing a poem...</p>';

    try {
        const response = await fetch('/api/poetry');
        if (response.ok) {
            const data = await response.json();

            if (data.error) {
                display.innerHTML = `
                    <p class="loading">⚠️ ${data.error}</p>
                    <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">${data.details || ''}</p>
                `;
                return;
            }

            const containerClass = data.isChicken ? 'poem-container' : 'poem-container squirrel';

            display.className = containerClass;
            display.innerHTML = `
                <div class="poem-subject">${data.isChicken ? '🐔' : '🐿️'} ${data.subject}</div>
                <div class="poem-text">${data.poem}</div>
                <div class="poem-form">${data.form}</div>
                <div class="poem-description">${data.description}</div>
                <button class="refresh-btn" onclick="loadPoem()">✨ Another Poem</button>
            `;
        } else {
            const errorData = await response.json().catch(() => ({}));
            display.innerHTML = `
                <p class="loading">⚠️ Failed to load poem</p>
                <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">${errorData.details || 'Please try again.'}</p>
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

// Load Blog Posts
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
                return `
                    <div class="activity-item blog-post">
                        <div class="activity-type">
                            ${post.title || 'Untitled Post'}
                            ${isAuto ? '<span style="font-size: 0.8rem; opacity: 0.7;"> (AI-Generated)</span>' : ''}
                        </div>
                        <div class="activity-details blog-content">${marked.parse(post.content || '')}</div>
                        <div class="activity-date">${formatDate(post.date)}</div>
                    </div>
                `;
            }).join('');

            if (append) {
                const existingBtn = feed.querySelector('.load-more-btn');
                if (existingBtn) {
                    existingBtn.remove();
                }
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
    if (activityType.includes('Egg')) {
        return 'egg';
    }
    if (activityType.includes('Treats') || activityType.includes('Scraps')) {
        return 'feeding';
    }
    if (activityType.includes('Free Range')) {
        return 'free_range';
    }
    if (activityType.includes('Health')) {
        return 'health';
    }
    if (activityType.includes('Photo')) {
        return 'photo';
    }
    return 'other';
}

function getEggTypeDisplay(activity) {
    if (activity.chicken_name && chickenEggImages[activity.chicken_name]) {
        const imgSrc = chickenEggImages[activity.chicken_name];
        return `<img src="${imgSrc}" alt="${activity.egg_color} egg" class="activity-egg-icon"> Egg Laid`;
    }
    return '🥚 Egg Laid';
}

async function loadActivity() {
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = '<p class="loading">Loading activity...</p>';

    try {
        const response = await fetch('/api/activity');
        if (response.ok) {
            const activities = await response.json();

            if (activities.length === 0) {
                feed.innerHTML = '<p class="loading">No activity yet. Check back soon!</p>';
                return;
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const recentActivities = activities.filter((activity) => {
                const activityDate = new Date(activity.date + 'T00:00:00');
                return activityDate >= sevenDaysAgo;
            });

            if (recentActivities.length === 0) {
                feed.innerHTML = '<p class="loading">No activity in the last 7 days.</p>';
                return;
            }

            const groupedByDate = {};
            recentActivities.forEach((activity) => {
                if (!groupedByDate[activity.date]) {
                    groupedByDate[activity.date] = [];
                }
                groupedByDate[activity.date].push(activity);
            });

            const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

            feed.innerHTML = sortedDates.map((date, index) => {
                const dateLabel = formatDate(date);
                const isFirstDay = index === 0;
                const activitiesForDate = groupedByDate[date];

                return `
                    <div class="day-section">
                        <button class="day-header ${isFirstDay ? 'open' : ''}" onclick="toggleDay(this)">
                            <span class="day-label">${dateLabel}</span>
                            <span class="day-count">${activitiesForDate.length} ${activitiesForDate.length === 1 ? 'activity' : 'activities'}</span>
                            <span class="toggle-icon">${isFirstDay ? '▼' : '▶'}</span>
                        </button>
                        <div class="day-activities" style="${isFirstDay ? '' : 'display: none;'}">
                            ${activitiesForDate.map((activity) => `
                                <div class="activity-item" data-type="${getActivityDataType(activity.type)}">
                                    <div class="activity-type">${activity.type.includes('Egg') ? getEggTypeDisplay(activity) : activity.type}</div>
                                    <div class="activity-details">${activity.details}</div>
                                    ${activity.photo_id ? `
                                        <img src="/api/photos/${activity.photo_id}"
                                             alt="${activity.details}"
                                             class="activity-photo-thumb"
                                             loading="lazy">
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            feed.innerHTML = '<p class="loading">Failed to load activity.</p>';
        }
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading activity.</p>';
    }
}

// Toggle day section open/closed
function toggleDay(button) {
    const isOpen = button.classList.contains('open');
    const dayActivities = button.nextElementSibling;
    const toggleIcon = button.querySelector('.toggle-icon');

    if (isOpen) {
        button.classList.remove('open');
        dayActivities.style.display = 'none';
        toggleIcon.textContent = '▶';
    } else {
        button.classList.add('open');
        dayActivities.style.display = 'block';
        toggleIcon.textContent = '▼';
    }
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

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

// Load weather
async function loadWeather() {
    const weatherDiv = document.getElementById('weather');
    if (!weatherDiv) {
        return;
    }

    try {
        const response = await fetch('/api/weather');
        if (response.ok) {
            const weather = await response.json();
            const humidityText = typeof weather.humidity === 'number'
                ? `${weather.humidity}%`
                : '--';
            const windText = typeof weather.wind === 'number'
                ? `${weather.wind} mph`
                : '--';
            weatherDiv.innerHTML = `
                🌡️ ${weather.temperature}°F |
                ${weather.description} |
                💧 ${humidityText} |
                💨 ${windText}
            `;
        } else {
            weatherDiv.innerHTML = '<span class="loading">Weather unavailable</span>';
        }
    } catch (error) {
        weatherDiv.innerHTML = '<span class="loading">Weather unavailable</span>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderStatusLoadingState();
    RouterManager.init();
    loadWeather();

    document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            RouterManager.setTab(tab.dataset.tab);
        });

        tab.addEventListener('keydown', (event) => {
            const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
            const currentIndex = tabs.indexOf(tab);

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                const nextTab = tabs[(currentIndex + 1) % tabs.length];
                nextTab.focus();
                RouterManager.setTab(nextTab.dataset.tab);
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const previousTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                previousTab.focus();
                RouterManager.setTab(previousTab.dataset.tab);
            }
        });
    });
});
