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
        } else if (tabName === 'flock') {
            loadFlockEditor();
        }
    });
});

// Natural-language quick entry. Parsing is read-only; saving happens only after confirmation.
const quickEntryForm = document.getElementById('quick-entry-form');
const quickEntryInput = document.getElementById('quick-entry-input');
const quickEntryResult = document.getElementById('quick-entry-result');
let pendingQuickEntry = null;

quickEntryInput.addEventListener('input', () => {
    if (!pendingQuickEntry) return;
    pendingQuickEntry = null;
    quickEntryResult.replaceChildren();
});

quickEntryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = quickEntryInput.value.trim();
    if (!message) return;

    pendingQuickEntry = null;
    quickEntryResult.replaceChildren();
    const status = document.createElement('p');
    status.className = 'loading';
    status.textContent = 'Preparing a draft…';
    quickEntryResult.append(status);

    const submitButton = quickEntryForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    quickEntryInput.disabled = true;
    try {
        const response = await fetch('/api/quick-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message, today: getCurrentDateCST() })
        });
        const result = await response.json();
        quickEntryResult.replaceChildren();
        if (!response.ok) throw new Error(result.error || 'Could not prepare this entry.');

        if (!result.ready) {
            const clarification = document.createElement('p');
            clarification.className = 'quick-entry-clarification';
            clarification.textContent = result.clarification || 'Could you add a little more detail?';
            quickEntryResult.append(clarification);
            return;
        }

        pendingQuickEntry = result.action;
        renderQuickEntryReview(result.action);
    } catch (error) {
        quickEntryResult.replaceChildren();
        const errorMessage = document.createElement('p');
        errorMessage.className = 'quick-entry-error';
        errorMessage.textContent = error.message || 'Network error. Please try again.';
        quickEntryResult.append(errorMessage);
    } finally {
        submitButton.disabled = false;
        quickEntryInput.disabled = false;
    }
});

function renderQuickEntryReview(action) {
    const labels = {
        egg: 'Egg',
        feeding: 'Feeding',
        free_range: 'Free-range session',
        health: 'Health observation',
        note: 'Flock note'
    };
    const details = [
        ['Type', labels[action.type] || action.type],
        ['Date', action.date]
    ];

    if (action.type === 'egg') {
        const names = action.chicken_names || action.chicken_ids.map(id => ({ 1: 'Mamma Mia', 2: 'Brown Betty', 3: 'Madame Pompadour' }[id] || `Chicken ${id}`));
        details.push(['Chicken', names.join(', ')]);
        if (action.time) details.push(['Time', action.time]);
        if (action.notes) details.push(['Notes', action.notes]);
    } else if (action.type === 'feeding') {
        details.push(['Food', action.description], ['Category', action.feed_type === 'scrap' ? 'Kitchen scraps' : 'Treat']);
        if (action.time) details.push(['Time', action.time]);
        if (action.notes) details.push(['Notes', action.notes]);
    } else if (action.type === 'free_range') {
        details.push(['Start', action.time_start], ['End', action.time_end]);
        if (action.notes) details.push(['Notes', action.notes]);
    } else if (action.type === 'health') {
        details.push(['Chicken', action.chicken_name || (action.chicken_id ? `Chicken ${action.chicken_id}` : 'General flock')]);
        details.push(['Observation', action.observation_type], ['Description', action.description]);
        if (action.time) details.push(['Time', action.time]);
        if (action.notes) details.push(['Notes', action.notes]);
    } else {
        details.push(['Note', action.content]);
    }

    const review = document.createElement('div');
    review.className = 'quick-entry-review';
    const heading = document.createElement('h3');
    heading.textContent = 'Review before saving';
    review.append(heading);

    const list = document.createElement('dl');
    for (const [label, value] of details) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        list.append(row);
    }
    review.append(list);

    const actions = document.createElement('div');
    actions.className = 'quick-entry-actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary';
    saveButton.textContent = 'Confirm and Save';
    saveButton.addEventListener('click', saveQuickEntry);
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.textContent = 'Discard';
    cancelButton.addEventListener('click', () => {
        pendingQuickEntry = null;
        quickEntryResult.replaceChildren();
    });
    actions.append(saveButton, cancelButton);
    review.append(actions);
    quickEntryResult.replaceChildren(review);
}

async function saveQuickEntry() {
    if (!pendingQuickEntry) return;
    const action = pendingQuickEntry;
    const saveButton = quickEntryResult.querySelector('.quick-entry-actions .btn-primary');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
        const requests = [];
        if (action.type === 'egg') {
            for (const chickenId of action.chicken_ids) {
                requests.push(fetch('/api/eggs', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                    body: JSON.stringify({ chicken_id: chickenId, date: action.date, time: action.time, notes: action.notes })
                }));
            }
        } else {
            const endpoint = { feeding: '/api/feeding', free_range: '/api/free-range', health: '/api/health', note: '/api/notes' }[action.type];
            requests.push(fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(action)
            }));
        }

        const responses = await Promise.all(requests);
        const failed = responses.find(response => !response.ok);
        if (failed) {
            const error = await failed.json().catch(() => ({}));
            throw new Error(error.error || 'The entry could not be saved. Please check History before retrying.');
        }

        pendingQuickEntry = null;
        const success = document.createElement('p');
        success.className = 'quick-entry-success';
        success.textContent = 'Saved. You can enter another update whenever you’re ready.';
        quickEntryResult.replaceChildren(success);
        quickEntryInput.value = '';
        if (document.getElementById('history-tab').classList.contains('active')) loadActivity();
    } catch (error) {
        saveButton.disabled = false;
        saveButton.textContent = 'Confirm and Save';
        const message = document.createElement('p');
        message.className = 'quick-entry-error';
        message.textContent = error.message || 'Network error. Check History before retrying.';
        quickEntryResult.append(message);
    }
}

// Chicken button selection for egg logging (allows multiple selections)
document.querySelector('.chicken-buttons').addEventListener('click', (event) => {
    const button = event.target.closest('.chicken-btn');
    if (!button) return;
    button.classList.toggle('selected');
    button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
});

async function loadEggLayers() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Could not load egg layers');
        const data = await response.json();
        const layers = data.activeFlock.filter(chicken => !chicken.is_rooster && !chicken.is_placeholder
            && chicken.egg_color && !['pending', 'n/a'].includes(chicken.egg_color.toLowerCase()));
        const buttons = layers.map(chicken => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chicken-btn';
            button.dataset.chicken = chicken.id;
            button.dataset.color = chicken.egg_color;
            button.setAttribute('aria-pressed', 'false');
            button.append(document.createTextNode(chicken.name), document.createElement('br'));
            const color = document.createElement('small');
            color.textContent = chicken.egg_color;
            button.append(color);
            return button;
        });
        if (buttons.length) document.querySelector('.chicken-buttons').replaceChildren(...buttons);
    } catch (error) {
        showMessage('error', 'Could not refresh the egg-layer list. Reload to see newly laying hens.');
    }
}

loadEggLayers();

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
    const weight = document.getElementById('egg-weight').value;

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
                    time: time || null,
                    weight_g: weight ? Number(weight) : null
                })
            })
        );

        const responses = await Promise.all(promises);

        if (responses.every(r => r.ok)) {
            const count = selectedChickens.length;
            showMessage('success', `${count} egg${count > 1 ? 's' : ''} logged successfully!`);
            e.target.reset();
            document.querySelectorAll('.chicken-btn').forEach(button => {
                button.classList.remove('selected');
                button.setAttribute('aria-pressed', 'false');
            });
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

// Notes Form Submission
const notesForm = document.getElementById('notes-form');
if (notesForm) {
    notesForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = {
            date: getCurrentDateCST(),
            content: formData.get('content'),
            is_headline: formData.get('is_headline') === 'on'
        };

        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showMessage('success', data.is_headline ? 'Headline posted to the front page!' : 'Note added successfully!');
                e.target.reset();
                loadRecentNotes();
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
    formData.append('chicken_ids', selectedTagIds(document.getElementById('photo-tag-picker')).join(','));

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
            renderTagPicker(document.getElementById('photo-tag-picker'), []);
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

let galleryFilter = 'all';

async function loadPhotos() {
    const gallery = document.getElementById('photos-gallery');
    gallery.innerHTML = '<p class="loading">Loading media...</p>';

    try {
        const [response, chickens] = await Promise.all([
            fetch(`/api/photos?limit=60${galleryFilter === 'untagged' ? '&untagged=1' : ''}`, { credentials: 'include' }),
            loadAdminChickens()
        ]);
        if (response.ok) {
            const media = await response.json();

            if (media.length === 0) {
                gallery.innerHTML = galleryFilter === 'untagged'
                    ? '<p class="loading">Every photo is tagged. 🎉</p>'
                    : '<p class="loading">No photos or videos yet. Upload your first one!</p>';
                return;
            }

            gallery.replaceChildren(...media.map(item => renderGalleryItem(item, chickens)));
        } else {
            gallery.innerHTML = '<p class="loading">Failed to load media.</p>';
        }
    } catch (error) {
        gallery.innerHTML = '<p class="loading">Network error loading media.</p>';
    }
}

function renderGalleryItem(item, chickens) {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-item';
    const media = document.createElement(item.media_type === 'video' ? 'video' : 'img');
    media.src = `/api/photos/${item.id}`;
    if (item.media_type === 'video') {
        media.controls = true;
        media.preload = 'metadata';
    } else {
        media.alt = item.caption || 'Chicken photo';
        media.loading = 'lazy';
    }
    wrapper.append(media);

    if (item.caption) {
        const caption = document.createElement('div');
        caption.className = 'caption';
        caption.textContent = item.caption;
        wrapper.append(caption);
    }

    const tagBox = document.createElement('div');
    tagBox.className = 'photo-tags';
    const picker = document.createElement('div');
    picker.className = 'tag-picker';
    renderTagPicker(picker, item.chickens || [], chickens);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn-secondary btn-small';
    save.textContent = item.chickens?.some(tag => tag.source === 'caption') ? 'Confirm tags' : 'Save tags';
    save.addEventListener('click', async () => {
        save.disabled = true;
        try {
            const response = await fetch(`/api/photos/${item.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ chicken_ids: selectedTagIds(picker) })
            });
            if (!response.ok) throw new Error();
            picker.querySelectorAll('.tag-auto').forEach(badge => badge.remove());
            save.textContent = 'Saved ✓';
            if (galleryFilter === 'untagged' && selectedTagIds(picker).length) {
                wrapper.classList.add('photo-item--done');
            }
        } catch {
            showMessage('error', 'Could not save tags. Please try again.');
            save.textContent = 'Save tags';
        } finally {
            save.disabled = false;
        }
    });
    picker.addEventListener('click', () => { save.textContent = 'Save tags'; });
    tagBox.append(picker, save);
    wrapper.append(tagBox);

    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = formatDate(item.date);
    wrapper.append(date);
    return wrapper;
}

document.querySelectorAll('[data-gallery-filter]').forEach(button => {
    button.addEventListener('click', () => {
        galleryFilter = button.dataset.galleryFilter;
        document.querySelectorAll('[data-gallery-filter]').forEach(other => {
            const active = other === button;
            other.classList.toggle('chip--active', active);
            other.setAttribute('aria-pressed', String(active));
        });
        loadPhotos();
    });
});

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

// Chicken name -> egg image, filled from the chickens table (Flock tab) before the feed renders
let chickenEggImages = {};

async function loadEggImages() {
    try {
        const chickens = await loadAdminChickens();
        chickenEggImages = {};
        chickens.filter(chicken => chicken.egg_image_url).forEach(chicken => {
            chickenEggImages[chicken.name] = chicken.egg_image_url;
            if (chicken.display_name) chickenEggImages[chicken.display_name] = chicken.egg_image_url;
        });
    } catch {
        // Fall back to the plain egg emoji
    }
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
        const [response] = await Promise.all([fetch('/api/activity', { credentials: 'include' }), loadEggImages()]);
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
                        <div class="activity-date">${formatDate(post.date)}
                            <button type="button" class="chip blog-delete" data-id="${post.id}">Delete</button>
                        </div>
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

document.getElementById('blog-feed').addEventListener('click', async (e) => {
    const btn = e.target.closest('.blog-delete');
    if (!btn || !confirm('Delete this post from the public blog?')) return;
    btn.disabled = true;
    try {
        const response = await fetch('/api/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: Number(btn.dataset.id), delete: true })
        });
        if (!response.ok) throw new Error();
        showMessage('success', 'Post deleted.');
        loadBlogPosts();
    } catch (error) {
        btn.disabled = false;
        showMessage('error', 'Could not delete the post.');
    }
});

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
            loadAdminRecipe();
            // Set default date to today
            document.getElementById('blog-date').value = getCurrentDateCST();
        }
    });
});

// ---------- Chickens: shared list, selects, photo tag pickers ----------

let adminChickensPromise = null;

function loadAdminChickens({ force = false } = {}) {
    if (force || !adminChickensPromise) {
        adminChickensPromise = fetch('/api/chickens', { credentials: 'include' })
            .then(response => (response.ok ? response.json() : Promise.reject(new Error('Could not load chickens'))))
            .catch(error => {
                adminChickensPromise = null;
                throw error;
            });
    }
    return adminChickensPromise;
}

async function populateChickenSelects() {
    try {
        const chickens = await loadAdminChickens();
        const active = chickens.filter(chicken => chicken.status === 'active');
        document.querySelectorAll('[data-chicken-select]').forEach(select => {
            const current = select.value;
            const general = select.querySelector('option[value=""]');
            const options = active.map(chicken => new Option(chicken.display_name, chicken.id));
            select.replaceChildren(...(general ? [general] : []), ...options);
            select.value = current;
        });
        renderTagPicker(document.getElementById('photo-tag-picker'), [], chickens);
    } catch (error) {
        showMessage('error', 'Could not load the chicken list. Reload to try again.');
    }
}

// Former flock members are listed last so old photos can still be tagged with them.
function renderTagPicker(container, selectedTags, chickens) {
    if (!container) return;
    if (!chickens) {
        loadAdminChickens().then(list => renderTagPicker(container, selectedTags, list)).catch(() => {});
        return;
    }
    const selected = new Map(selectedTags.map(tag => [tag.id, tag]));
    const ordered = [...chickens].sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
    container.replaceChildren(...ordered.map(chicken => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip tag-chip';
        button.dataset.chickenId = chicken.id;
        const isSelected = selected.has(chicken.id);
        button.setAttribute('aria-pressed', String(isSelected));
        button.textContent = chicken.display_name;
        if (chicken.status === 'former') button.classList.add('tag-chip--former');
        if (isSelected && selected.get(chicken.id).source === 'caption') {
            const auto = document.createElement('span');
            auto.className = 'tag-auto';
            auto.textContent = 'auto';
            button.append(auto);
        }
        button.addEventListener('click', () => {
            button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
        });
        return button;
    }));
}

function selectedTagIds(container) {
    return Array.from(container.querySelectorAll('.tag-chip[aria-pressed="true"]')).map(button => Number(button.dataset.chickenId));
}

// ---------- Recent notes & headlines ----------

async function loadRecentNotes() {
    const list = document.getElementById('recent-notes-list');
    if (!list) return;
    try {
        const response = await fetch('/api/notes', { credentials: 'include' });
        if (!response.ok) throw new Error();
        const notes = (await response.json()).slice(0, 15);
        list.replaceChildren(...notes.map(note => {
            const row = document.createElement('div');
            row.className = 'note-row';
            const text = document.createElement('p');
            text.className = 'note-row-text';
            text.textContent = `${formatDate(note.date)}: ${note.content}`;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'chip';
            const setLabel = on => {
                toggle.setAttribute('aria-pressed', String(on));
                toggle.textContent = on ? '📰 Headline' : 'Make headline';
            };
            setLabel(Boolean(note.is_headline));
            toggle.addEventListener('click', async () => {
                const next = toggle.getAttribute('aria-pressed') !== 'true';
                toggle.disabled = true;
                try {
                    const result = await fetch('/api/notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id: note.id, is_headline: next })
                    });
                    if (!result.ok) throw new Error();
                    setLabel(next);
                } catch {
                    showMessage('error', 'Could not update the headline.');
                } finally {
                    toggle.disabled = false;
                }
            });
            row.append(text, toggle);
            return row;
        }));
        if (!notes.length) list.innerHTML = '<p class="loading">No notes yet.</p>';
    } catch {
        list.innerHTML = '<p class="loading">Could not load notes.</p>';
    }
}

// ---------- Meters (shown only while a meter in functions/api/_meters.js is active) ----------

async function setupMeterCard() {
    try {
        const response = await fetch('/api/meters', { credentials: 'include' });
        if (!response.ok) return;
        const { meters } = await response.json();
        const meter = meters.find(item => item.active);
        if (!meter) return;

        document.getElementById('meter-card').hidden = false;
        document.getElementById('meter-title').textContent = `${meter.emoji} ${meter.title}`;
        document.getElementById('meter-score').replaceChildren(
            ...meter.levels.map(level => new Option(`${level.score} – ${level.label}: ${level.description}`, level.score))
        );
        document.getElementById('meter-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            const response = await fetch('/api/meters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    meter: meter.key,
                    date: getCurrentDateCST(),
                    score: Number(formData.get('score')),
                    notes: formData.get('notes') || null
                })
            });
            if (response.ok) {
                showMessage('success', `${meter.title} logged!`);
                event.target.reset();
            } else {
                showMessage('error', `Failed to log ${meter.title}.`);
            }
        });
    } catch {
        // The meter card stays hidden if meters cannot be loaded.
    }
}

// ---------- Flock profile editor ----------

const FLOCK_FIELDS = [
    { name: 'display_name', label: 'Display name', hint: 'Shown publicly instead of the record name (e.g. Velma → Vinnie)' },
    { name: 'role_label', label: 'Role badge', hint: 'e.g. Mom of the chicks' },
    { name: 'egg_color', label: 'Egg color', hint: 'Use "pending" before laying, "N/A" for roosters; add "(provisional)" if unsure' },
    { name: 'bio', label: 'Bio', type: 'textarea' },
    { name: 'tagline', label: 'Tagline / current chapter', type: 'textarea' },
    { name: 'avatar_url', label: 'Avatar image path', hint: 'e.g. /images/Vinnie.png' },
    { name: 'egg_image_url', label: 'Egg image path', hint: 'e.g. /images/egg_peppercorn.png' },
    { name: 'hatch_date', label: 'Hatch date', type: 'date' },
    { name: 'ticker', label: 'Stock ticker', hint: 'For the Eggconomy page, e.g. PEPR (leave blank for non-layers)' },
    { name: 'sort_order', label: 'Display order', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: [['active', 'Current flock'], ['former', 'Former flock']] },
    { name: 'departed_date', label: 'Departed on', type: 'date' },
    { name: 'departure_note', label: 'Departure note', type: 'textarea' },
    { name: 'is_rooster', label: 'Rooster', type: 'checkbox' }
];

function buildFlockField(field, chicken) {
    const group = document.createElement('div');
    group.className = field.type === 'checkbox' ? 'checkbox-row' : 'form-group';
    const id = `flock-${chicken.id}-${field.name}`;
    let input;
    if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 2;
    } else if (field.type === 'select') {
        input = document.createElement('select');
        field.options.forEach(([value, label]) => input.append(new Option(label, value)));
    } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
    }
    input.id = id;
    input.name = field.name;
    if (field.type === 'checkbox') {
        input.checked = Boolean(chicken[field.name]);
    } else {
        input.value = field.name === 'display_name' && chicken.display_name === chicken.name ? '' : (chicken[field.name] ?? '');
    }

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = field.label;
    if (field.type === 'checkbox') {
        group.append(input, label);
    } else {
        group.append(label, input);
        if (field.hint) {
            const hint = document.createElement('small');
            hint.className = 'form-hint';
            hint.textContent = field.hint;
            group.append(hint);
        }
    }
    return group;
}

async function loadFlockEditor() {
    const editor = document.getElementById('flock-editor');
    try {
        const chickens = await loadAdminChickens({ force: true });
        editor.replaceChildren(...chickens.map(chicken => {
            const details = document.createElement('details');
            details.className = 'flock-editor-item';
            const summary = document.createElement('summary');
            const avatar = document.createElement('img');
            avatar.src = chicken.avatar_url;
            avatar.alt = '';
            summary.append(avatar, document.createTextNode(
                `${chicken.display_name}${chicken.display_name !== chicken.name ? ` (${chicken.name})` : ''}${chicken.status === 'former' ? ' · former' : ''}`
            ));
            const form = document.createElement('form');
            FLOCK_FIELDS.forEach(field => form.append(buildFlockField(field, chicken)));
            const save = document.createElement('button');
            save.type = 'submit';
            save.className = 'btn btn-primary';
            save.textContent = `Save ${chicken.display_name}`;
            form.append(save);
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const body = { id: chicken.id };
                FLOCK_FIELDS.forEach(field => {
                    const input = form.elements[field.name];
                    body[field.name] = field.type === 'checkbox' ? input.checked : input.value;
                });
                if (!body.display_name) body.display_name = null;
                save.disabled = true;
                try {
                    const response = await fetch('/api/chickens', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(body)
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showMessage('success', `${chicken.display_name} updated.`);
                    await loadAdminChickens({ force: true });
                    populateChickenSelects();
                    loadEggLayers();
                } catch (error) {
                    showMessage('error', error.message || 'Could not save profile.');
                } finally {
                    save.disabled = false;
                }
            });
            details.append(summary, form);
            return details;
        }));
    } catch (error) {
        editor.innerHTML = '<p class="loading">Could not load the flock.</p>';
    }
}

document.getElementById('add-chicken-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
        const response = await fetch('/api/chickens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                name: formData.get('name'),
                egg_color: formData.get('egg_color') || (formData.get('is_rooster') ? 'N/A' : 'pending'),
                is_rooster: formData.get('is_rooster') === 'on'
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        showMessage('success', `${formData.get('name')} added to the flock!`);
        event.target.reset();
        loadFlockEditor();
        populateChickenSelects();
    } catch (error) {
        showMessage('error', error.message || 'Could not add chicken.');
    }
});

populateChickenSelects();
loadRecentNotes();
setupMeterCard();

// Weekly recipe (Clucky's Kitchen)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

function renderAdminRecipe(recipe) {
    document.getElementById('admin-recipe').innerHTML = `
        <p><strong>${escapeHtml(recipe.title)}</strong></p>
        <p class="form-hint">${escapeHtml(recipe.intro || '')}</p>
        <p><a href="/blog.html#recipes" target="_blank" rel="noopener">View on the site →</a></p>
    `;
}

async function loadAdminRecipe() {
    try {
        const response = await fetch('/api/recipe', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.details || data.error);
        renderAdminRecipe(data);
    } catch (error) {
        document.getElementById('admin-recipe').innerHTML = `<p class="loading">Recipe unavailable: ${escapeHtml(error.message)}</p>`;
    }
}

document.getElementById('swap-recipe-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!confirm("Replace this week's recipe with a new one?")) return;
    button.disabled = true;
    button.textContent = 'Cooking up another...';
    try {
        const response = await fetch('/api/recipe', { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        renderAdminRecipe(data);
        showMessage('success', `New recipe: ${data.title}`);
    } catch (error) {
        showMessage('error', `Could not swap the recipe: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Swap for another recipe';
    }
});

// Palace Blotter
async function loadBlotterAdmin() {
    const list = document.getElementById('blotter-admin-list');
    if (!list) return;
    try {
        const response = await fetch('/api/blotter?limit=20', { credentials: 'include' });
        if (!response.ok) throw new Error();
        const { entries } = await response.json();
        if (!entries.length) {
            list.innerHTML = '<p class="form-hint">No incidents yet.</p>';
            return;
        }
        list.replaceChildren(...entries.map(entry => {
            const row = document.createElement('div');
            row.className = 'note-row';
            const text = document.createElement('p');
            text.className = 'note-row-text';
            text.textContent = `${formatDate(entry.date)}${entry.time ? ` ${entry.time}` : ''}: ${entry.suspect ? `${entry.suspect}. ` : ''}${entry.description}${entry.outcome ? ` (${entry.outcome})` : ''}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'chip';
            remove.textContent = 'Delete';
            remove.addEventListener('click', async () => {
                if (!confirm('Delete this blotter entry?')) return;
                const result = await fetch('/api/blotter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id: entry.id, delete: true })
                });
                if (result.ok) loadBlotterAdmin();
                else showMessage('error', 'Could not delete that entry.');
            });
            row.append(text, remove);
            return row;
        }));
    } catch {
        list.innerHTML = '<p class="form-hint">Could not load incidents.</p>';
    }
}

const blotterForm = document.getElementById('blotter-form');
if (blotterForm) {
    document.getElementById('blotter-date').value = getCurrentDateCST();
    loadBlotterAdmin();
    blotterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            const response = await fetch('/api/blotter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error((await response.json()).error);
            showMessage('success', 'Incident filed with the Palace Blotter.');
            e.target.reset();
            document.getElementById('blotter-date').value = getCurrentDateCST();
            loadBlotterAdmin();
        } catch (error) {
            showMessage('error', `Could not file the report: ${error.message || 'network error'}`);
        }
    });
}

// The site owner's own visits are not counted on the public site (see countVisit in blog.js).
try {
    localStorage.setItem('ct-owner', '1');
} catch {
    // Storage blocked; the visit counter falls back to the logged-in session check
}

// Eggs out and stock counts (Eggconomy reserves and trade)
async function postOutflow(data) {
    const response = await fetch('/api/egg-outflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Request failed');
}

async function loadOutflows() {
    const list = document.getElementById('outflow-list');
    if (!list) return;
    try {
        const response = await fetch('/api/egg-outflows', { credentials: 'include' });
        if (!response.ok) throw new Error();
        const entries = await response.json();
        if (!entries.length) {
            list.innerHTML = '<p class="form-hint">Nothing logged yet.</p>';
            return;
        }
        list.replaceChildren(...entries.map(entry => {
            const row = document.createElement('div');
            row.className = 'note-row';
            const text = document.createElement('p');
            text.className = 'note-row-text';
            text.textContent = entry.kind === 'stock'
                ? `${formatDate(entry.date)}: counted ${entry.count} on hand`
                : `${formatDate(entry.date)}: ${entry.count} ${entry.kind_label.toLowerCase()}${entry.notes ? ` (${entry.notes})` : ''}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'chip';
            remove.textContent = 'Delete';
            remove.addEventListener('click', async () => {
                if (!confirm('Delete this entry?')) return;
                try {
                    await postOutflow({ id: entry.id, delete: true });
                    loadOutflows();
                } catch {
                    showMessage('error', 'Could not delete that entry.');
                }
            });
            row.append(text, remove);
            return row;
        }));
    } catch {
        list.innerHTML = '<p class="form-hint">Could not load entries.</p>';
    }
}

const outflowForm = document.getElementById('outflow-form');
if (outflowForm) {
    document.getElementById('outflow-date').value = getCurrentDateCST();
    loadOutflows();
    outflowForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await postOutflow(data);
            showMessage('success', data.kind === 'dogs' ? 'Write-off recorded. The dogs thank you.' : 'Eggs out logged.');
            e.target.reset();
            document.getElementById('outflow-date').value = getCurrentDateCST();
            loadOutflows();
        } catch (error) {
            showMessage('error', `Could not log that: ${error.message}`);
        }
    });

    document.getElementById('stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const count = document.getElementById('stock-count').value;
        try {
            await postOutflow({ date: getCurrentDateCST(), kind: 'stock', count });
            showMessage('success', `Stock count saved: ${count} eggs on hand.`);
            e.target.reset();
            loadOutflows();
        } catch (error) {
            showMessage('error', `Could not save the count: ${error.message}`);
        }
    });
}
