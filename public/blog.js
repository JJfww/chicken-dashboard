// Chicken avatar mapping
const chickenAvatars = {
    'Rudy': '/images/rudy.png',
    'Mamma Mia': '/images/mamma-mia.png',
    'Brown Betty': '/images/brown-betty.png',
    'Madame Pompadour': '/images/madame-pompadour.png'
};

// Chicken egg image mapping
const chickenEggImages = {
    'Mamma Mia': '/images/egg_mamma_mia.png',
    'Brown Betty': '/images/egg_brown_betty.png',
    'Madame Pompadour': '/images/egg_madame_pompadour.png'
};

function getEggImage(name) {
    return chickenEggImages[name] || null;
}

function getRudyStatusText(rudyStatus) {
    return rudyStatus?.text || rudyStatus?.label || 'No Rudy Meter entry yet';
}

function getRudyMenaceLabel(score) {
    const menaceLevels = {
        0: 'Low',
        1: 'Mild',
        2: 'Elevated',
        3: 'High',
        4: 'Severe',
        5: 'Maximum'
    };
    return menaceLevels[score] || '';
}

function getRudyMeterCaption(rudyStatus) {
    const menaceLabel = getRudyMenaceLabel(rudyStatus?.score);
    return menaceLabel ? `Menace Level: ${menaceLabel}` : '';
}

// Hash routing system
const RouterManager = {
    currentTab: 'status',
    statusRefreshInterval: null,

    init() {
        // Handle initial hash on page load
        const initialHash = window.location.hash.slice(1) || 'status';
        this.setTab(initialHash);

        // Listen for hash changes (back/forward buttons)
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'status';
            this.setTab(hash);
        });
    },

    setTab(tabName) {
        // Validate tab exists
        if (!['status', 'blog', 'history', 'poetry'].includes(tabName)) {
            tabName = 'status';
        }

        // Update current tab
        this.currentTab = tabName;

        // Update hash (without triggering hashchange event if already set)
        if (window.location.hash.slice(1) !== tabName) {
            window.history.replaceState(null, '', `#${tabName}`);
        }

        // Update tab UI
        this.updateTabUI(tabName);

        // Load/start content for specific tabs
        this.handleTabContent(tabName);
    },

    updateTabUI(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Add active class to clicked tab
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Hide all content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show selected content
        const contentEl = document.getElementById(`${tabName}-tab`);
        if (contentEl) contentEl.classList.add('active');
    },

    handleTabContent(tabName) {
        switch(tabName) {
            case 'status':
                this.startStatusRefresh();
                loadChickenStatus(); // Initial load
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
        // Only start if not already running
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
    const rudyContainer = document.getElementById('rudy-container');
    const hensGrid = document.getElementById('hens-grid');

    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Failed to load status');

        const chickens = await response.json();

        // Separate Rudy from the hens
        const rudy = chickens.find(c => c.rudy_status);
        const hens = chickens.filter(c => !c.rudy_status);

        // Render Rudy's card
        if (rudy) {
            const avatarImage = chickenAvatars[rudy.name] || '/images/default.png';
            const rudyMeterCaption = getRudyMeterCaption(rudy.rudy_status);
            rudyContainer.innerHTML = `
                <div class="chicken-card rudy-card">
                    <div class="chicken-avatar">
                        <img src="${avatarImage}" alt="${rudy.name}">
                    </div>
                    <h2 class="chicken-name">${rudy.name}</h2>
                    <p class="egg-color">${rudy.rudy_meter ? 'Latest Rudy reading' : 'The Gentleman of the Coop'}</p>
                    <div class="rudy-status">
                        <span class="rudy-emoji">${rudy.rudy_status.emoji}</span>
                        <strong>${getRudyStatusText(rudy.rudy_status)}</strong>
                        ${rudyMeterCaption ? `<span class="rudy-meter-inline">${rudyMeterCaption}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // Render hens' cards
        hensGrid.innerHTML = hens.map(chicken => {
            const avatarImage = chickenAvatars[chicken.name] || '/images/default.png';
            const eggImage = getEggImage(chicken.name);
            const laidToday = chicken.laid_today;
            const lastEggDate = chicken.last_egg_date ? formatDate(chicken.last_egg_date) : 'Never';

            // Build egg display HTML
            const eggIcon = eggImage
                ? `<img src="${eggImage}" alt="${chicken.egg_color} egg" class="egg-icon">`
                : '🥚';

            return `
                <div class="chicken-card">
                    <div class="chicken-avatar">
                        <img src="${avatarImage}" alt="${chicken.name}">
                    </div>
                    <h2 class="chicken-name">${chicken.name}</h2>
                    <p class="egg-color">
                        ${eggIcon}
                        ${chicken.egg_color} eggs
                    </p>

                    <div class="status-item ${laidToday ? 'laid-today' : 'not-yet'}">
                        <div class="status-icon">${laidToday ? eggIcon : '⏱️'}</div>
                        <div class="status-text">
                            <p class="status-label">Today</p>
                            <p class="status-value">${laidToday ? 'Egg laid!' : 'Not yet'}</p>
                        </div>
                    </div>

                    <div class="status-item">
                        <div class="status-icon">📅</div>
                        <div class="status-text">
                            <p class="status-label">Last egg</p>
                            <p class="status-value">${lastEggDate}</p>
                        </div>
                    </div>

                    ${chicken.health_concern ? `
                        <div class="status-item health-warning">
                            <div class="status-icon">⚠️</div>
                            <div class="status-text">
                                <p class="status-label">${chicken.health_concern.observation_type}</p>
                                <p class="status-value">${chicken.health_concern.description}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        hensGrid.innerHTML = '<p style="text-align: center; color: red; grid-column: 1 / -1;">Failed to load status. Please try again.</p>';
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

            // Check if there's an error in the response
            if (data.error) {
                display.innerHTML = `
                    <p class="loading">⚠️ ${data.error}</p>
                    <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-top: 1rem;">${data.details || ''}</p>
                `;
                return;
            }

            // Apply squirrel class if it's a squirrel poem
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

            const postsHtml = posts.map(post => {
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
                // Remove existing "Load More" button before appending
                const existingBtn = feed.querySelector('.load-more-btn');
                if (existingBtn) existingBtn.remove();
                feed.insertAdjacentHTML('beforeend', postsHtml);
            } else {
                feed.innerHTML = postsHtml;
            }

            // Add "Load More" button if there are more posts
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
    if (activityType.includes('Photo')) return 'photo';
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

            // Filter to last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const recentActivities = activities.filter(activity => {
                const activityDate = new Date(activity.date + 'T00:00:00');
                return activityDate >= sevenDaysAgo;
            });

            if (recentActivities.length === 0) {
                feed.innerHTML = '<p class="loading">No activity in the last 7 days.</p>';
                return;
            }

            // Group by date
            const groupedByDate = {};
            recentActivities.forEach(activity => {
                if (!groupedByDate[activity.date]) {
                    groupedByDate[activity.date] = [];
                }
                groupedByDate[activity.date].push(activity);
            });

            // Sort dates descending
            const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

            // Build collapsible sections
            feed.innerHTML = sortedDates.map((date, index) => {
                const dateLabel = formatDate(date);
                const isFirstDay = index === 0; // First day open by default
                const activities = groupedByDate[date];

                return `
                    <div class="day-section">
                        <button class="day-header ${isFirstDay ? 'open' : ''}" onclick="toggleDay(this)">
                            <span class="day-label">${dateLabel}</span>
                            <span class="day-count">${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}</span>
                            <span class="toggle-icon">${isFirstDay ? '▼' : '▶'}</span>
                        </button>
                        <div class="day-activities" style="${isFirstDay ? '' : 'display: none;'}">
                            ${activities.map(activity => `
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
    // Parse the date string as a local date, not UTC
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day); // month is 0-indexed

    // Get today at midnight local time for accurate comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}

// Load weather
async function loadWeather() {
    const weatherDiv = document.getElementById('weather');
    if (!weatherDiv) return;

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

// Initialize router and set up tab click listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    RouterManager.init();
    loadWeather();

    // Set up tab click listeners
    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            RouterManager.setTab(tab.dataset.tab);
        });
    });
});
