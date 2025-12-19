// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load data when switching to specific tabs
        if (tabName === 'history') {
            loadActivity();
        } else if (tabName === 'blog') {
            loadBlogPosts();
        }
    });
});

// Load Blog Posts
async function loadBlogPosts() {
    const feed = document.getElementById('blog-feed');
    feed.innerHTML = '<p class="loading">Loading blog posts...</p>';

    try {
        const response = await fetch('/api/blog');
        if (response.ok) {
            const posts = await response.json();

            if (posts.length === 0) {
                feed.innerHTML = '<p class="loading">No blog posts yet. Check back soon!</p>';
                return;
            }

            feed.innerHTML = posts.map(post => {
                const isAuto = post.is_auto_generated === 1;
                return `
                    <div class="activity-item blog-post">
                        <div class="activity-type">
                            ${post.title || 'Untitled Post'}
                            ${isAuto ? '<span style="font-size: 0.8rem; opacity: 0.7;"> (AI-Generated)</span>' : ''}
                        </div>
                        <div class="activity-details" style="white-space: pre-wrap;">${post.content}</div>
                        <div class="activity-date">${formatDate(post.date)}</div>
                    </div>
                `;
            }).join('');
        } else {
            feed.innerHTML = '<p class="loading">Failed to load blog posts.</p>';
        }
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading blog posts.</p>';
    }
}

function getActivityDataType(activityType) {
    if (activityType.includes('Egg')) return 'egg';
    if (activityType.includes('Treats') || activityType.includes('Scraps')) return 'feeding';
    if (activityType.includes('Free Range')) return 'free_range';
    if (activityType.includes('Health')) return 'health';
    if (activityType.includes('Photo')) return 'photo';
    return 'other';
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

            feed.innerHTML = activities.map(activity => `
                <div class="activity-item" data-type="${getActivityDataType(activity.type)}">
                    <div class="activity-type">${activity.type}</div>
                    <div class="activity-details">${activity.details}</div>
                    <div class="activity-date">${formatDate(activity.date)}</div>
                </div>
            `).join('');
        } else {
            feed.innerHTML = '<p class="loading">Failed to load activity.</p>';
        }
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading activity.</p>';
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

// Load blog posts on page load
loadBlogPosts();
