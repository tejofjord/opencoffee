import './style.css'

// Mock Data for "Startup" feel until API is connected
const MOCK_EVENTS = [
    {
        id: 1,
        name: "Open Coffee Oslo",
        date: "2025-01-15T08:00:00",
        location: "Mesh Nationaltheatret",
        link: "#",
        image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=600"
    }
];

const eventsContainer = document.getElementById('events-container');

// Mobile Menu Toggle
const menuBtn = document.querySelector('.mobile-menu-btn');
const nav = document.querySelector('.desktop-nav');

if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('active');
        nav.classList.toggle('active');
    });
}

// Fetch Chapters and then their events
async function loadChapters() {
    try {
        const res = await fetch('/api/chapters');
        if (!res.ok) throw new Error("API not available");
        const chapters = await res.json();

        eventsContainer.innerHTML = ''; // Clear skeletons

        for (const chapter of chapters) {
            fetchEvents(chapter);
        }
    } catch (e) {
        console.error("Failed to load chapters", e);
        // Fallback to static mock if API fails (e.g. local dev without /api support)
        renderStaticEvents(MOCK_EVENTS);
    }
}

async function fetchEvents(chapter) {
    try {
        const res = await fetch(`/api/meetup?urlname=${chapter.urlname}`);
        const data = await res.json();

        if (data.events && data.events.length > 0) {
            renderChapterEvents(chapter.name, data.events);
        }
    } catch (e) {
        console.error(`Failed to fetch events for ${chapter.name}`, e);
    }
}

function renderChapterEvents(chapterName, events) {
    const html = events.map(event => `
        <article class="event-card fade-in">
            <div class="event-image" style="background-image: url('https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=600')">
                <div class="date-badge">
                    <span class="day">${new Date(event.dateTime).getDate()}</span>
                    <span class="month">${new Date(event.dateTime).toLocaleString('default', { month: 'short' })}</span>
                </div>
            </div>
            <div class="event-details">
                <span class="chapter-label">${chapterName}</span>
                <h3>${event.title}</h3>
                <p class="location">📍 ${event.venue?.name || 'TBD'}</p>
                <p class="time">⏰ ${new Date(event.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <a href="${event.eventUrl}" target="_blank" class="btn-link">Join →</a>
            </div>
        </article>
    `).join('');

    eventsContainer.insertAdjacentHTML('beforeend', html);
}

function renderStaticEvents(events) {
    eventsContainer.innerHTML = events.map(event => `
        <article class="event-card fade-in">
            <div class="event-image" style="background-image: url('${event.image}')">
                <div class="date-badge">
                    <span class="day">${new Date(event.date).getDate()}</span>
                    <span class="month">${new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                </div>
            </div>
            <div class="event-details">
                <h3>${event.name}</h3>
                <p class="location">📍 ${event.location}</p>
                <p class="time">⏰ ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <a href="${event.link}" class="btn-link">Join List →</a>
            </div>
        </article>
    `).join('');
}

// Initialize
setTimeout(() => {
    loadChapters();
}, 500);

// Simple Intersection Observer for scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .section-header').forEach(el => {
    el.classList.add('hidden');
    observer.observe(el);
});
