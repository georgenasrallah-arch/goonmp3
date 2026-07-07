import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.post("/api/analyze", (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    return res.status(400).json({ error: "A media URL is required." });
  }

  const normalized = url.trim();
  const mediaId = randomUUID();

  return res.json({
    id: mediaId,
    title: "Converted Media Preview",
    thumbnail:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    duration: "03:24",
    source: "Supported source",
    description: "Metadata returned from the backend abstraction layer.",
    audioOptions: [
      { bitrate: 128, label: "MP3 · 128 kbps", estimatedSizeMb: 3.2 },
      { bitrate: 192, label: "MP3 · 192 kbps", estimatedSizeMb: 4.8 },
      { bitrate: 320, label: "MP3 · 320 kbps", estimatedSizeMb: 8.1 },
    ],
    videoOptions: [
      { label: "MP4 · 360p", resolution: "360p", estimatedSizeMb: 12.4 },
      { label: "MP4 · 720p", resolution: "720p", estimatedSizeMb: 24.8 },
      { label: "MP4 · 1080p", resolution: "1080p", estimatedSizeMb: 43.1 },
    ],
    downloadUrl: `/downloads/${mediaId}`,
    sourceUrl: normalized,
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`GoonMP3 API listening on http://0.0.0.0:${port}`);
});
