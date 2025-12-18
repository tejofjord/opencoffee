export default async function handler(req, res) {
    const { urlname } = req.query;

    if (!urlname) {
        return res.status(400).json({ error: "urlname is required" });
    }

    // NOTE: In production, one would use a real Meetup OAuth token from process.env.MEETUP_TOKEN
    // For now, if no token is provided, we return a helpful error or mock data
    const MEETUP_TOKEN = process.env.MEETUP_TOKEN;

    if (!MEETUP_TOKEN) {
        // Return mock data if no token is set, to keep the UI "live" for testing
        return res.status(200).json({
            mock: true,
            events: [
                {
                    title: `Coffee Meetup in ${urlname}`,
                    dateTime: new Date(Date.now() + 86400000 * 7).toISOString(),
                    eventUrl: "https://meetup.com",
                    venue: { name: "Local Coworking Space" }
                }
            ]
        });
    }

    const query = `
    query($urlname: String!) {
      groupByUrlname(urlname: $urlname) {
        upcomingEvents(input: { first: 3 }) {
          edges {
            node {
              id
              title
              dateTime
              eventUrl
              venue {
                name
              }
            }
          }
        }
      }
    }
  `;

    try {
        const response = await fetch("https://api.meetup.com/gql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MEETUP_TOKEN}`
            },
            body: JSON.stringify({
                query,
                variables: { urlname }
            })
        });

        const data = await response.json();
        const events = data?.data?.groupByUrlname?.upcomingEvents?.edges.map(e => e.node) || [];

        res.status(200).json({ events });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch from Meetup" });
    }
}
