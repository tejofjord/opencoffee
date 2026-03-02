import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { invokeFunction } from "../lib/functions";

interface PublicEvent {
  id: string;
  chapterId: string;
  chapterName: string;
  chapterSlug: string | null;
  title: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  status: "draft" | "published" | "cancelled";
}

interface PublicEventsResponse {
  events: PublicEvent[];
}

const fallbackImages = [
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1542181961-9590d0c79dab?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&q=80&w=900",
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
  const [featuredEvents, setFeaturedEvents] = useState<PublicEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await invokeFunction<{ limit: number }, PublicEventsResponse>("public-events", {
          limit: 8,
        });
        setFeaturedEvents((response.events ?? []).slice(0, 6));
      } catch (err) {
        setEventsError(err instanceof Error ? err.message : "Could not load events");
      }
    })();
  }, []);

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
              <h2>Upcoming Events</h2>
              <p>Join a chapter and get into the presenter queue from your phone.</p>
            </div>

            {eventsError ? <p className="error">{eventsError}</p> : null}

            <div className="landing-events-grid">
              {featuredEvents.length === 0 ? <p className="muted">No upcoming events published yet.</p> : null}
              {featuredEvents.map((event, index) => {
                const date = new Date(event.startsAt);
                return (
                  <article key={event.id} className="landing-event-card">
                    <div
                      className="landing-event-image"
                      style={{ backgroundImage: `url('${fallbackImages[index % fallbackImages.length]}')` }}
                    >
                      <div className="landing-date-badge">
                        <span className="landing-day">{date.getDate()}</span>
                        <span className="landing-month">
                          {date.toLocaleString("en-US", { month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="landing-event-details">
                      <h3>{event.title}</h3>
                      <p>{formatEventDate(event.startsAt)}</p>
                      <p>{event.venue || event.chapterName}</p>
                      <Link to={`/auth?redirect=${encodeURIComponent(`/app/events/${event.id}/join`)}`} className="landing-link-btn">
                        Join list →
                      </Link>
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
              <a href="mailto:hello@opencoff.ee" className="landing-btn landing-btn-primary">
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
