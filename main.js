```javascript
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
    },
    {
        id: 2,
        name: "Open Coffee Krakow",
        date: "2025-01-16T08:00:00",
        location: "Cluster Cowork",
        link: "#",
        image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=600"
    },
    {
        id: 3,
        name: "Open Coffee London",
        date: "2025-01-20T08:30:00",
        location: "Campus London",
        link: "#",
        image: "https://images.unsplash.com/photo-1542181961-9590d0c79dab?auto=format&fit=crop&q=80&w=600"
    }
];

document.querySelector('#app').innerHTML = `
    < !--App content is in index.html, this is just a placeholder if we were doing SPA-- >
        `

// Mobile Menu Toggle
const menuBtn = document.querySelector('.mobile-menu-btn');
const nav = document.querySelector('.desktop-nav');

menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    nav.classList.toggle('active');
});

// Render Events
const eventsContainer = document.getElementById('events-container');

function formatDate(dateString) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function renderEvents(events) {
    eventsContainer.innerHTML = events.map(event => `
        < article class="event-card fade-in" >
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
        </article >
    `).join('');
}

// Simulate API load
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
