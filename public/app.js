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
        }
    });
});

// Chicken button selection for egg logging (allows multiple selections)
document.querySelectorAll('.chicken-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Toggle selection on clicked button
        btn.classList.toggle('selected');
    });
});

// Photo preview
document.getElementById('photo-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photo-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
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
                body: JSON.stringify({
                    chicken_id: chickenId,
                    date: new Date().toISOString().split('T')[0],
                    notes: notes || null
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
        date: new Date().toISOString().split('T')[0],
        feed_type: formData.get('feed_type'),
        description: formData.get('description'),
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/feeding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    const data = {
        date: new Date().toISOString().split('T')[0],
        duration_minutes: parseInt(formData.get('duration_minutes')),
        notes: formData.get('notes') || null
    };

    try {
        const response = await fetch('/api/free-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showMessage('success', 'Free range time logged successfully!');
            e.target.reset();
        } else {
            showMessage('error', 'Failed to log free range. Please try again.');
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
        date: new Date().toISOString().split('T')[0],
        chicken_id: chickenId ? parseInt(chickenId) : null,
        observation_type: formData.get('observation_type'),
        description: formData.get('description'),
        notes: null
    };

    try {
        const response = await fetch('/api/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// Photo Form Submission
document.getElementById('photo-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('photo-file');
    const caption = document.getElementById('photo-caption').value;

    if (!fileInput.files[0]) {
        showMessage('error', 'Please select a photo to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('caption', caption || '');
    formData.append('date', new Date().toISOString().split('T')[0]);

    try {
        const response = await fetch('/api/photos', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showMessage('success', 'Photo uploaded successfully!');
            e.target.reset();
            document.getElementById('photo-preview').innerHTML = '';
            loadPhotos();
        } else {
            showMessage('error', 'Failed to upload photo. Please try again.');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Chat Form Submission
document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('chat-input');
    const question = input.value.trim();

    if (!question) return;

    // Add user message to chat
    addChatMessage('user', question);
    input.value = '';

    // Add loading message
    const loadingDiv = addChatMessage('assistant', 'Thinking...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        if (response.ok) {
            const data = await response.json();
            loadingDiv.remove();
            addChatMessage('assistant', data.answer);
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
    messageDiv.innerHTML = `<p>${content}</p>`;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageDiv;
}

async function loadPhotos() {
    const gallery = document.getElementById('photos-gallery');
    gallery.innerHTML = '<p class="loading">Loading photos...</p>';

    try {
        const response = await fetch('/api/photos');
        if (response.ok) {
            const photos = await response.json();

            if (photos.length === 0) {
                gallery.innerHTML = '<p class="loading">No photos yet. Upload your first photo!</p>';
                return;
            }

            gallery.innerHTML = photos.map(photo => `
                <div class="photo-item">
                    <img src="/api/photos/${photo.id}" alt="${photo.caption || 'Chicken photo'}">
                    ${photo.caption ? `<div class="caption">${photo.caption}</div>` : ''}
                    <div class="date">${formatDate(photo.date)}</div>
                </div>
            `).join('');
        } else {
            gallery.innerHTML = '<p class="loading">Failed to load photos.</p>';
        }
    } catch (error) {
        gallery.innerHTML = '<p class="loading">Network error loading photos.</p>';
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
                feed.innerHTML = '<p class="loading">No activity yet. Start logging!</p>';
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

async function loadWeather() {
    const weatherDiv = document.getElementById('weather');

    try {
        const response = await fetch('/api/weather');
        if (response.ok) {
            const weather = await response.json();
            weatherDiv.innerHTML = `
                🌡️ ${weather.temperature}°F |
                ${weather.description} |
                💧 ${weather.humidity}%
            `;
        } else {
            weatherDiv.innerHTML = '<span class="loading">Weather unavailable</span>';
        }
    } catch (error) {
        weatherDiv.innerHTML = '<span class="loading">Weather unavailable</span>';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}

// Load weather on page load
loadWeather();
