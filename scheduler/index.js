// Scheduled jobs for The Clucking Times (times Central):
//   Sunday and Wednesday 9:30 PM: publish the blog edition (POST /api/blog/scheduled)
//   Monday and Friday 6 AM: request the recipe and the Eggconomy so they're written
// The SCHEDULER_TOKEN secret must match the one set on the Pages project.

function centralNow(time) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(time)).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, hour: Number(parts.hour) };
}

async function run(env, time) {
    const now = centralNow(time);

    if (now.hour === 21 && (now.weekday === 'Sun' || now.weekday === 'Wed')) {
        const response = await fetch(`${env.SITE_URL}/api/blog/scheduled?date=${now.date}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.SCHEDULER_TOKEN}` }
        });
        console.log(`Blog edition ${now.date}: HTTP ${response.status} ${await response.text()}`);
        return;
    }

    if (now.hour === 6 && (now.weekday === 'Mon' || now.weekday === 'Fri')) {
        for (const endpoint of ['recipe', 'eggconomy']) {
            const response = await fetch(`${env.SITE_URL}/api/${endpoint}`);
            console.log(`/api/${endpoint}: HTTP ${response.status}`);
        }
        return;
    }

    console.log(`Nothing scheduled for ${now.weekday} ${now.hour}:00 Central (other daylight-time trigger)`);
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(run(env, event.scheduledTime));
    }
};
