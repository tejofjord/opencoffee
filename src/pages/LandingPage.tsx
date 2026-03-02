import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface FeaturedEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  link: string;
  image: string;
}

const featuredEvents: FeaturedEvent[] = [
  {
    id: "oslo",
    name: "Open Coffee Oslo",
    date: "2026-03-12T08:30:00+01:00",
    location: "Mesh Nationaltheatret, Oslo",
    link: "https://www.meetup.com/open-coffee-oslo/events/313478558/?eventOrigin=home_next_event_you_are_hosting",
    image:
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=900",
  },
  {
    id: "krakow",
    name: "Open Coffee Krakow",
    date: "2026-03-19T08:30:00+01:00",
    location: "Cluster Cowork, Krakow",
    link: "mailto:hello@opencoffee.club?subject=Open%20Coffee%20Krakow",
    image:
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=900",
  },
  {
    id: "london",
    name: "Open Coffee London",
    date: "2026-03-26T08:30:00+00:00",
    location: "Campus London",
    link: "mailto:hello@opencoffee.club?subject=Open%20Coffee%20London",
    image:
      "https://images.unsplash.com/photo-1542181961-9590d0c79dab?auto=format&fit=crop&q=80&w=900",
  },
];

function formatEventDate(input: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

export function LandingPage() {
  const { user } = useAuth();
  const appEntry = user ? "/app" : "/auth?redirect=/app";

  return (
    <div className="landing-root">
      <div className="landing-bg-blob landing-blob-1" />
      <div className="landing-bg-blob landing-blob-2" />

      <header className="landing-header">
        <div className="landing-container landing-header-content">
          <a href="#top" className="landing-logo">
            <img src="/open_coffee_logo.png" alt="Open Coffee Logo" />
            <span>Open Coffee</span>
          </a>

          <nav className="landing-nav">
            <a href="#how-it-works">How It Works</a>
            <a href="#events">Upcoming Events</a>
            <a href="#franchise" className="landing-btn landing-btn-secondary">
              Start a Chapter
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div>
              <span className="landing-badge">Structured intros, then open networking</span>
              <h1>
                Real connections,
                <br />
                <span className="landing-text-gradient">clear agenda.</span>
              </h1>
              <p>
                Every presenter answers four prompts: who they are, their project, what they need, and
                how they can help. Then conversations continue in the app after the event.
              </p>
              <div className="landing-hero-actions">
                <a href="#events" className="landing-btn landing-btn-primary">
                  Find an Event
                </a>
                <Link to={appEntry} className="landing-btn landing-btn-text">
                  Open App →
                </Link>
              </div>
            </div>
            <div className="landing-hero-image">
              <img src="/hero_illustration.png" alt="People networking at a coffee shop" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section-padded">
          <div className="landing-container">
            <div className="landing-section-header landing-text-center">
              <h2>How It Works</h2>
              <p>Simple structure up front. High-value networking after.</p>
            </div>
            <div className="landing-features-grid">
              <article className="landing-feature-card">
                <div className="landing-icon">1</div>
                <h3>Who I Am</h3>
                <p>Share your background and context in one minute.</p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-icon">2</div>
                <h3>My Project</h3>
                <p>Explain what you are building or actively working on.</p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-icon">3</div>
                <h3>What I Need</h3>
                <p>State your current challenge so the room knows where to help.</p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-icon">4</div>
                <h3>How I Can Help</h3>
                <p>Offer what you can give back to other founders and builders.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-banner-section">
          <div className="landing-container">
            <div className="landing-banner-content">
              <h3>The Open Coffee Format</h3>
              <ul className="landing-check-list">
                <li>4-question presenter agenda for every intro.</li>
                <li>Live queue on screen in chunks of 10.</li>
                <li>Post-event app to reconnect and collaborate.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="events" className="landing-section-padded">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2>Upcoming Meetups</h2>
              <p>Join a chapter and get into the presenter queue from your phone.</p>
            </div>
            <div className="landing-events-grid">
              {featuredEvents.map((event) => {
                const date = new Date(event.date);
                return (
                  <article key={event.id} className="landing-event-card">
                    <div className="landing-event-image" style={{ backgroundImage: `url('${event.image}')` }}>
                      <div className="landing-date-badge">
                        <span className="landing-day">{date.getDate()}</span>
                        <span className="landing-month">
                          {date.toLocaleString("en-US", { month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="landing-event-details">
                      <h3>{event.name}</h3>
                      <p>{formatEventDate(event.date)}</p>
                      <p>{event.location}</p>
                      <a href={event.link} className="landing-link-btn" target="_blank" rel="noreferrer">
                        Join list →
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="franchise" className="landing-section-padded landing-section-dark">
          <div className="landing-container landing-franchise-grid">
            <div className="landing-franchise-content">
              <h2>Bring Open Coffee to your city</h2>
              <p>
                We provide the format and software. You run the local chapter and community. Oslo is
                first, but the platform is built for many chapters.
              </p>
              <a href="mailto:hello@opencoffee.club" className="landing-btn landing-btn-primary">
                Request Chapter Kit
              </a>
            </div>
            <div className="landing-franchise-visual" aria-hidden="true">
              <div className="landing-floating-circle landing-c1" />
              <div className="landing-floating-circle landing-c2" />
              <div className="landing-floating-circle landing-c3" />
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div>
            <strong>Open Coffee</strong>
            <p>Connecting startup ecosystems, one intro round at a time.</p>
          </div>
          <div className="landing-footer-links">
            <a href="#how-it-works">Format</a>
            <a href="#events">Events</a>
            <Link to={appEntry}>Open App</Link>
          </div>
        </div>
        <div className="landing-copyright">© {new Date().getFullYear()} Open Coffee Club.</div>
      </footer>
    </div>
  );
}
