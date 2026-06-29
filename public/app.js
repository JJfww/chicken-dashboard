// Utility function to get current date in CST timezone
function getCurrentDateCST() {
    const now = new Date();
    // Convert to CST (America/Chicago timezone)
    const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const year = cstDate.getFullYear();
    const month = String(cstDate.getMonth() + 1).padStart(2, '0');
    const day = String(cstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const chickMilestoneLevels = [
    { score: 0, label: 'Hatchling Bubble', description: 'Freshly hatched and mostly tucked in close.' },
    { score: 1, label: 'Following Mama', description: 'Shadowing mom closely and learning the basics.' },
    { score: 2, label: 'Backyard Peeking', description: 'Starting to notice the wider world in short bursts.' },
    { score: 3, label: 'Short Solo Missions', description: 'Taking quick little detours before circling back.' },
    { score: 4, label: 'Confident Explorers', description: 'Covering more ground and acting noticeably bolder.' },
    { score: 5, label: 'Little Coop Citizens', description: 'Fully engaged in flock life with plenty of independence.' }
];

const chickMilestoneScoreInput = document.getElementById('chick-milestone-score');
const chickMilestoneNotesInput = document.getElementById('chick-milestone-notes');
const chickMilestoneScoreValue = document.getElementById('chick-milestone-score-value');
const chickMilestoneScoreLabel = document.getElementById('chick-milestone-score-label');
const chickMilestoneScoreDescription = document.getElementById('chick-milestone-score-description');
const chickMilestoneQuickPicks = document.getElementById('chick-milestone-quick-picks');
const chickMilestoneLastSaved = document.getElementById('chick-milestone-last-saved');

function getChickMilestoneLevel(score) {
    return chickMilestoneLevels.find(level => level.score === score) || chickMilestoneLevels[0];
}

function renderChickMilestoneQuickPicks(activeScore) {
    chickMilestoneQuickPicks.innerHTML = chickMilestoneLevels.map(level => `
        <button
            type="button"
            class="rudy-pick ${level.score === activeScore ? 'is-active' : ''}"
            data-score="${level.score}"
        >
            <strong>${level.score} · ${level.label}</strong><br>
            <span>${level.description}</span>
        </button>
    `).join('');

    chickMilestoneQuickPicks.querySelectorAll('.rudy-pick').forEach(button => {
        button.addEventListener('click', () => {
            chickMilestoneScoreInput.value = button.dataset.score;
            updateChickMilestoneUI();
        });
    });
}

function updateChickMilestoneUI() {
    const score = parseInt(chickMilestoneScoreInput.value, 10);
    const level = getChickMilestoneLevel(score);

    chickMilestoneScoreValue.textContent = score;
    chickMilestoneScoreLabel.textContent = level.label;
    chickMilestoneScoreDescription.textContent = level.description;
    renderChickMilestoneQuickPicks(score);
}

async function loadChickMilestone() {
    const today = getCurrentDateCST();

    try {
        const response = await fetch(`/api/chick-milestone?date=${today}`, { credentials: 'include' });
        if (!response.ok) {
            chickMilestoneLastSaved.textContent = "Today's chick milestone is unavailable right now.";
            updateChickMilestoneUI();
            return;
        }

        const result = await response.json();
        if (result.entry) {
            chickMilestoneScoreInput.value = result.entry.score;
            chickMilestoneNotesInput.value = result.entry.notes || '';
            updateChickMilestoneUI();
            chickMilestoneLastSaved.textContent = `Saved for today: ${result.entry.label}${result.entry.notes ? ` - ${result.entry.notes}` : ''}`;
            return;
        }

        chickMilestoneNotesInput.value = '';
        updateChickMilestoneUI();
        chickMilestoneLastSaved.textContent = 'No chick milestone saved for today yet.';
    } catch (error) {
        updateChickMilestoneUI();
        chickMilestoneLastSaved.textContent = "Today's chick milestone is unavailable right now.";
    }
}

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
        if (tabName === 'photos') {
            loadPhotos();
        } else if (tabName === 'history') {
            loadActivity();
        } else if (tabName === 'log') {
            loadChickMilestone();
        }
    });
});

chickMilestoneScoreInput.addEventListener('input', updateChickMilestoneUI);
updateChickMilestoneUI();

// Chicken button selection for egg logging (allows multiple selections)
document.querySelectorAll('.chicken-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Toggle selection on clicked button
        btn.classList.toggle('selected');
    });
});

// Photo/video preview
document.getElementById('photo-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photo-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (file.type.startsWith('video/')) {
                preview.innerHTML = `<video src="${e.target.result}" controls style="max-width: 100%;"></video>`;
            } else {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            }
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
});

// Egg Form Submission
document.getElementById('egg-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const notes = document.getElementById('egg-notes').value;
    const time = document.getElementById('egg-time').value;

    // Get all selected chickens
    const selectedChickens = Array.from(document.querySelectorAll('.chicken-btn.selected'))
        .map(btn => parseInt(btn.dataset.chicken));

    if (selectedChickens.length === 0) {
        showMessage('error', 'Please select at least one chicken!');
        return;
    }

    try {
        // Submit one egg record per selected chicken
        const promises = selectedChickens.map(chickenId =>
            fetch('/api/eggs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    chicken_id: chickenId,
                    date: getCurrentDateCST(),
                    notes: notes || null,
                    time: time || null
                })
            })
        );

        const responses = await Promise.all(promises);

        if (responses.every(r => r.ok)) {
            const count = selectedChickens.length;
            showMessage('success', `${count} egg${count > 1 ? 's' : ''} logged successfully!`);
            e.target.reset();
            document.querySelectorAll('.chicken-btn').forEach(b => b.classList.remove('selected'));
        } else {
            showMessage('error', 'Failed to log some eggs. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Feeding Form Submission
document.getElementById('feeding-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        date: getCurrentDateCST(),
        feed_type: formData.get('feed_type'),
        description: formData.get('description'),
        notes: formData.get('notes') || null,
        time: formData.get('time') || null
    };

    try {
        const response = await fetch('/api/feeding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage('success', 'Feeding logged successfully!');
            e.target.reset();
        } else {
            showMessage('error', 'Failed to log feeding. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Free Range Form Submission
document.getElementById('free-range-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const time_start = formData.get('time_start') || null;
    const time_end = formData.get('time_end') || null;

    // Validate at least one time is provided
    if (!time_start && !time_end) {
        showMessage('error', 'Please provide at least a start time or end time.');
        return;
    }

    const data = {
        date: getCurrentDateCST(),
        time_start,
        time_end,
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/free-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // Show appropriate message based on action
            if (result.action === 'started') {
                showMessage('success', 'Free range session started! Submit end time when they return.');
            } else if (result.action === 'completed') {
                showMessage('success', 'Free range session completed!');
            } else {
                showMessage('success', 'Free range time logged successfully!');
            }
            e.target.reset();
        } else {
            showMessage('error', result.error || 'Failed to log free range. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Health Form Submission
document.getElementById('health-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const chickenId = formData.get('chicken_id');
    const data = {
        date: getCurrentDateCST(),
        chicken_id: chickenId ? parseInt(chickenId) : null,
        observation_type: formData.get('observation_type'),
        description: formData.get('description'),
        notes: null,
        time: formData.get('time') || null
    };

    try {
        const response = await fetch('/api/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage('success', 'Health observation logged successfully!');
            e.target.reset();
        } else {
            showMessage('error', 'Failed to log observation. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

document.getElementById('chick-milestone-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const score = parseInt(chickMilestoneScoreInput.value, 10);
    const notes = chickMilestoneNotesInput.value.trim();

    try {
        const response = await fetch('/api/chick-milestone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                date: getCurrentDateCST(),
                score,
                notes: notes || null
            })
        });

        const result = await response.json();

        if (response.ok) {
            chickMilestoneLastSaved.textContent = `Saved for today: ${result.entry.label}${result.entry.notes ? ` - ${result.entry.notes}` : ''}`;
            showMessage('success', 'Chick Milestone Meter updated.');
        } else {
            showMessage('error', result.error || 'Failed to save chick milestone.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Notes Form Submission
const notesForm = document.getElementById('notes-form');
if (notesForm) {
    notesForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = {
            date: getCurrentDateCST(),
            content: formData.get('content')
        };

        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showMessage('success', 'Note added successfully!');
                e.target.reset();
            } else {
                showMessage('error', 'Failed to add note. Please try again.');
            }
        } catch (error) {
            showMessage('error', 'Network error. Please check your connection.');
        }
    });
}

// Photo Form Submission
document.getElementById('photo-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('photo-file');
    const caption = document.getElementById('photo-caption').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!fileInput.files[0]) {
        showMessage('error', 'Please select a photo or video to upload.');
        return;
    }

    // Show uploading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('caption', caption || '');
    formData.append('date', getCurrentDateCST());

    try {
        const response = await fetch('/api/photos', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (response.ok) {
            showMessage('success', 'Uploaded successfully!');
            e.target.reset();
            document.getElementById('photo-preview').innerHTML = '';
            loadPhotos();
        } else {
            showMessage('error', 'Failed to upload. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload';
    }
});

// Chat Form Submission
let chatHistory = [];

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('chat-input');
    const question = input.value.trim();

    if (!question) return;

    // Add user message to chat
    addChatMessage('user', question);
    chatHistory.push({ role: 'user', content: question });
    input.value = '';

    // Add loading message
    const loadingDiv = addChatMessage('assistant', 'Thinking...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ question, history: chatHistory })
        });

        if (response.ok) {
            const data = await response.json();
            loadingDiv.remove();
            addChatMessage('assistant', data.answer);
            chatHistory.push({ role: 'assistant', content: data.answer });
        } else {
            loadingDiv.remove();
            addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        }
    } catch (error) {
        loadingDiv.remove();
        addChatMessage('assistant', 'Network error. Please check your connection.');
    }
});

// Helper Functions
function showMessage(type, text) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;

    const firstCard = document.querySelector('.tab-content.active .card');
    firstCard.insertBefore(message, firstCard.firstChild);

    setTimeout(() => message.remove(), 5000);
}

function addChatMessage(role, content) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    // Parse markdown for assistant messages, plain text for user messages
    if (role === 'assistant' && typeof marked !== 'undefined') {
        messageDiv.innerHTML = marked.parse(content);
    } else {
        messageDiv.innerHTML = `<p>${content}</p>`;
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageDiv;
}

async function loadPhotos() {
    const gallery = document.getElementById('photos-gallery');
    gallery.innerHTML = '<p class="loading">Loading media...</p>';

    try {
        const response = await fetch('/api/photos', { credentials: 'include' });
        if (response.ok) {
            const media = await response.json();

            if (media.length === 0) {
                gallery.innerHTML = '<p class="loading">No photos or videos yet. Upload your first one!</p>';
                return;
            }

            gallery.innerHTML = media.map(item => `
                <div class="photo-item">
                    ${item.media_type === 'video'
                        ? `<video src="/api/photos/${item.id}" controls></video>`
                        : `<img src="/api/photos/${item.id}" alt="${item.caption || 'Chicken photo'}">`
                    }
                    ${item.caption ? `<div class="caption">${item.caption}</div>` : ''}
                    <div class="date">${formatDate(item.date)}</div>
                </div>
            `).join('');
        } else {
            gallery.innerHTML = '<p class="loading">Failed to load media.</p>';
        }
    } catch (error) {
        gallery.innerHTML = '<p class="loading">Network error loading media.</p>';
    }
}

function getActivityDataType(activityType) {
    if (activityType.includes('Egg')) return 'egg';
    if (activityType.includes('Treats') || activityType.includes('Scraps')) return 'feeding';
    if (activityType.includes('Free Range')) return 'free_range';
    if (activityType.includes('Health')) return 'health';
    if (activityType.includes('Chick')) return 'chicks';
    if (activityType.includes('Rudy')) return 'rudy';
    if (activityType.includes('Photo') || activityType.includes('Video')) return 'photo';
    return 'other';
}

// Map chicken names to their egg images
const chickenEggImages = {
    'Mamma Mia': '/images/egg_mamma_mia.png',
    'Brown Betty': '/images/egg_brown_betty.png',
    'Madame Pompadour': '/images/egg_madame_pompadour.png'
};

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
        const response = await fetch('/api/activity', { credentials: 'include' });
        if (response.ok) {
            const activities = await response.json();

            if (activities.length === 0) {
                feed.innerHTML = '<p class="loading">No activity yet. Start logging!</p>';
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
                                    ${activity.photo_id ? (
                                        activity.media_type === 'video'
                                            ? `<video src="/api/photos/${activity.photo_id}"
                                                   class="activity-photo-thumb"
                                                   controls></video>`
                                            : `<img src="/api/photos/${activity.photo_id}"
                                                   alt="${activity.details}"
                                                   class="activity-photo-thumb"
                                                   loading="lazy">`
                                    ) : ''}
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

async function loadWeather() {
    const weatherDiv = document.getElementById('weather');

    try {
        const response = await fetch('/api/weather', { credentials: 'include' });
        if (response.ok) {
            const weather = await response.json();
            const humidityText = typeof weather.humidity === 'number'
                ? `${weather.humidity}%`
                : '—';
            const windText = typeof weather.wind === 'number'
                ? `${weather.wind} mph`
                : '—';
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

// Load weather on page load
loadWeather();
loadChickMilestone();

// ===== EXPENSE TRACKING FUNCTIONALITY =====

// FAB (Floating Action Button) Toggle
const fab = document.getElementById('fab');
const fabMenu = document.getElementById('fab-menu');

fab.addEventListener('click', () => {
    fab.classList.toggle('open');
    fabMenu.classList.toggle('hidden');
});

// FAB Menu Item Clicks
document.querySelectorAll('.fab-menu-item').forEach(item => {
    item.addEventListener('click', () => {
        const expenseType = item.dataset.expenseType;

        // Close FAB menu
        fab.classList.remove('open');
        fabMenu.classList.add('hidden');

        // Open corresponding modal
        openModal(`${expenseType}-modal`);

        // Set today's date in the form
        const today = getCurrentDateCST();
        const modalId = `${expenseType}-modal`;
        const dateInput = document.querySelector(`#${modalId} input[type="date"]`);
        if (dateInput) {
            dateInput.value = today;
        }
    });
});

// Modal Functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        // Reset the form inside the modal
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

// Modal Close Button Handlers
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        closeModal(modalId);
    });
});

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});

// Feed Purchase Form Submission
document.getElementById('feed-purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        date: formData.get('date'),
        item: formData.get('item'),
        quantity: formData.get('quantity') || null,
        cost: parseFloat(formData.get('cost')),
        supplier: formData.get('supplier') || null,
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/feed-purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal('feed-modal');
            showMessage('success', 'Feed purchase logged successfully!');
            // Reload expenses if on expenses tab
            if (document.getElementById('expenses-tab').classList.contains('active')) {
                loadExpenses();
            }
        } else {
            showMessage('error', 'Failed to log feed purchase. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Medication Form Submission
document.getElementById('medication-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const chickenId = formData.get('chicken_id');
    const data = {
        date: formData.get('date'),
        medication_name: formData.get('medication_name'),
        chicken_id: chickenId ? parseInt(chickenId) : null,
        quantity: formData.get('quantity') || null,
        cost: parseFloat(formData.get('cost')),
        purpose: formData.get('purpose') || null,
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/medication', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal('medication-modal');
            showMessage('success', 'Medication logged successfully!');
            // Reload expenses if on expenses tab
            if (document.getElementById('expenses-tab').classList.contains('active')) {
                loadExpenses();
            }
        } else {
            showMessage('error', 'Failed to log medication. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Supplies Form Submission
document.getElementById('supplies-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        date: formData.get('date'),
        item: formData.get('item'),
        cost: parseFloat(formData.get('cost')),
        category: formData.get('category') || null,
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/supplies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal('supplies-modal');
            showMessage('success', 'Supplies purchase logged successfully!');
            // Reload expenses if on expenses tab
            if (document.getElementById('expenses-tab').classList.contains('active')) {
                loadExpenses();
            }
        } else {
            showMessage('error', 'Failed to log supplies. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Load Expenses Data
async function loadExpenses() {
    const expensesList = document.getElementById('expenses-list');
    expensesList.innerHTML = '<p class="loading">Loading expenses...</p>';

    try {
        // Fetch all three expense types in parallel
        const [feedRes, medRes, suppliesRes] = await Promise.all([
            fetch('/api/feed-purchases', { credentials: 'include' }),
            fetch('/api/medication', { credentials: 'include' }),
            fetch('/api/supplies', { credentials: 'include' })
        ]);

        if (feedRes.ok && medRes.ok && suppliesRes.ok) {
            const feedData = await feedRes.json();
            const medData = await medRes.json();
            const suppliesData = await suppliesRes.json();

            // Add type to each record
            const allExpenses = [
                ...feedData.map(item => ({ ...item, expense_type: 'feed' })),
                ...medData.map(item => ({ ...item, expense_type: 'medication' })),
                ...suppliesData.map(item => ({ ...item, expense_type: 'supplies' }))
            ];

            // Sort by date (newest first)
            allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Calculate totals
            const feedTotal = feedData.reduce((sum, item) => sum + item.cost, 0);
            const medTotal = medData.reduce((sum, item) => sum + item.cost, 0);
            const suppliesTotal = suppliesData.reduce((sum, item) => sum + item.cost, 0);

            // Update summary cards
            document.getElementById('feed-total').textContent = `$${feedTotal.toFixed(2)}`;
            document.getElementById('medication-total').textContent = `$${medTotal.toFixed(2)}`;
            document.getElementById('supplies-total').textContent = `$${suppliesTotal.toFixed(2)}`;

            // Display expenses
            if (allExpenses.length === 0) {
                expensesList.innerHTML = '<p class="loading">No expenses logged yet. Use the + button to add your first expense!</p>';
                return;
            }

            expensesList.innerHTML = allExpenses.map(expense => {
                let details = '';

                if (expense.expense_type === 'feed') {
                    details = expense.quantity ? `Quantity: ${expense.quantity}` : '';
                    if (expense.supplier) details += (details ? ' | ' : '') + `Supplier: ${expense.supplier}`;
                } else if (expense.expense_type === 'medication') {
                    details = expense.chicken_name ? `For: ${expense.chicken_name}` : 'For: All chickens';
                    if (expense.purpose) details += ` | ${expense.purpose}`;
                } else if (expense.expense_type === 'supplies') {
                    details = expense.category ? `Category: ${expense.category}` : '';
                }

                const itemName = expense.item || expense.medication_name || 'Unknown';

                return `
                    <div class="expense-item" data-type="${expense.expense_type}">
                        <div class="expense-header">
                            <div class="expense-name">${itemName}</div>
                            <div class="expense-cost">$${expense.cost.toFixed(2)}</div>
                        </div>
                        ${details ? `<div class="expense-details">${details}</div>` : ''}
                        ${expense.notes ? `<div class="expense-details">${expense.notes}</div>` : ''}
                        <div class="expense-date">${formatDate(expense.date)}</div>
                        <span class="expense-type">${expense.expense_type}</span>
                    </div>
                `;
            }).join('');
        } else {
            expensesList.innerHTML = '<p class="loading">Failed to load expenses.</p>';
        }
    } catch (error) {
        expensesList.innerHTML = '<p class="loading">Network error loading expenses.</p>';
    }
}

// Blog Form Submission
document.getElementById('blog-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        date: formData.get('date'),
        title: formData.get('title') || null,
        content: formData.get('content'),
        is_auto_generated: false
    };

    try {
        const response = await fetch('/api/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage('success', 'Blog post published successfully!');
            e.target.reset();
            loadBlogPosts();
        } else {
            showMessage('error', 'Failed to publish blog post. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Auto-Generate Blog Button
document.getElementById('auto-generate-btn').addEventListener('click', async () => {
    const dateInput = document.getElementById('blog-date');
    const titleInput = document.getElementById('blog-title');
    const contentInput = document.getElementById('blog-content');

    if (!dateInput.value) {
        showMessage('error', 'Please select a date first!');
        return;
    }

    const btn = document.getElementById('auto-generate-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const response = await fetch('/api/blog/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ date: dateInput.value })
        });

        if (response.ok) {
            const data = await response.json();
            titleInput.value = data.title;
            contentInput.value = data.content;
            showMessage('success', 'Blog post generated! Feel free to edit before posting.');
        } else {
            const error = await response.json();
            showMessage('error', error.error || 'Failed to generate blog post.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// Load Blog Posts
// Blog pagination state
let adminBlogOffset = 0;
const ADMIN_BLOG_LIMIT = 5;

async function loadBlogPosts(append = false) {
    const feed = document.getElementById('blog-feed');

    if (!append) {
        adminBlogOffset = 0;
        feed.innerHTML = '<p class="loading">Loading blog posts...</p>';
    }

    try {
        const response = await fetch(`/api/blog?limit=${ADMIN_BLOG_LIMIT}&offset=${adminBlogOffset}`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const posts = data.posts;

            if (posts.length === 0 && adminBlogOffset === 0) {
                feed.innerHTML = '<p class="loading">No blog posts yet. Write your first one!</p>';
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
                const existingBtn = feed.querySelector('.load-more-btn');
                if (existingBtn) existingBtn.remove();
                feed.insertAdjacentHTML('beforeend', postsHtml);
            } else {
                feed.innerHTML = postsHtml;
            }

            if (data.hasMore) {
                feed.insertAdjacentHTML('beforeend', `
                    <button class="load-more-btn" onclick="loadMoreAdminBlogPosts()">
                        Load More Posts (${data.total - adminBlogOffset - posts.length} remaining)
                    </button>
                `);
            }

            adminBlogOffset += posts.length;
        } else {
            feed.innerHTML = '<p class="loading">Failed to load blog posts.</p>';
        }
    } catch (error) {
        feed.innerHTML = '<p class="loading">Network error loading blog posts.</p>';
    }
}

function loadMoreAdminBlogPosts() {
    loadBlogPosts(true);
}

// Update tab switching to load expenses
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        if (tabName === 'expenses') {
            loadExpenses();
        } else if (tabName === 'blog') {
            loadBlogPosts();
            // Set default date to today
            document.getElementById('blog-date').value = getCurrentDateCST();
        }
    });
});
