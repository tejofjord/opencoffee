export default function handler(req, res) {
    const chapters = [
        { name: "Oslo", urlname: "Open-Coffee-Oslo" },
        { name: "Krakow", urlname: "Open-Coffee-Krakow" },
        { name: "London", urlname: "Open-Coffee-London" }
    ];
    res.status(200).json(chapters);
}
