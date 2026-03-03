# Frontend Flows

## Route Map

1. `/`
   - Marketing landing page with agenda framing and upcoming events from Supabase.
2. `/auth`
   - Magic-link authentication.
3. `/app`
   - Home dashboard with chapter events and organizer event CRUD controls.
4. `/app/events/:eventId/join`
   - Event check-in and guided 4-question signup flow.
5. `/app/organizer/events/:eventId`
   - Organizer queue console and projector controls.
6. `/app/network`
   - Chapter network graph and help request actions.
7. `/app/inbox`
   - Requests and conversation threads.
8. `/app/moderation`
   - Organizer/admin report queue and resolution controls.

## Event-Day Signup UX

1. Check-in step
   - User provides QR token and/or PIN.
   - `session-join` validates and returns access result plus attempt metadata when relevant.
2. Guided intro stepper
   - Required prompts:
     - Who I am
     - My project
     - What I need/want
     - How I can help
   - Optional:
     - Website URL
     - LinkedIn URL
     - Short bio
3. Submit step
   - `signup-upsert` persists presenter data and queue position.

## Organizer Console UX

1. Session controls
   - Open signup, close signup, previous/next chunk, projector link.
2. Queue board
   - Drag/drop reorder (`@dnd-kit`) with keyboard support.
   - Up/down buttons retained as fallback controls.
3. Active presenter panel
   - Displays presenter details, URL card, QR link card.
4. Timer controls
   - Start, pause, reset, and next presenter.
   - Pie visualization is subtle and non-numeric.

## Projector Mode

1. Clean view under organizer route with `?view=projector`.
2. Shows:
   - Current chunk lineup.
   - Active presenter summary.
   - URL card and pie timer.

## Post-Event Networking UX

1. Network graph
   - Canvas-rendered node/edge graph with filters and selection.
2. Profile action pane
   - Send:
     - "I need this person's help"
     - "I can help this person"
3. Safety actions
   - Block user
   - Report user

