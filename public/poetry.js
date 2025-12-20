// Load and display a random poem
async function loadPoem() {
    const display = document.getElementById('poem-display');
    display.innerHTML = '<p class="loading">Composing a poem...</p>';

    try {
        const response = await fetch('/api/poetry');
        if (response.ok) {
            const data = await response.json();

            // Apply squirrel class if it's a squirrel poem
            const containerClass = data.isChicken ? 'poem-container' : 'poem-container squirrel';

            display.className = containerClass;
            display.innerHTML = `
                <div class="poem-subject">${data.isChicken ? '🐔' : '🐿️'} ${data.subject}</div>
                <div class="poem-form">${data.form}</div>
                <div class="poem-description">${data.description}</div>
                <div class="poem-text">${data.poem}</div>
                <button class="refresh-btn" onclick="loadPoem()">✨ Another Poem</button>
            `;
        } else {
            display.innerHTML = '<p class="loading">Failed to load poem. Please try again.</p>';
        }
    } catch (error) {
        display.innerHTML = '<p class="loading">Network error loading poem. Please try again.</p>';
    }
}

// Load a poem on page load
loadPoem();
