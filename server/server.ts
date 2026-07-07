import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const downloadsDir = path.join(process.cwd(), "downloads");
const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

fs.mkdirSync(downloadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/downloads", express.static(downloadsDir));

function isSupportedSource(url: string) {
  return /youtube\.com|youtu\.be|soundcloud\.com|vimeo\.com/i.test(url);
}

function spawnYtDlp(args: string[]) {
  const pythonCommand = process.platform === "win32" ? "py" : (process.env.PYTHON ?? "python3");

  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(pythonCommand, ["-m", "yt_dlp", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function runYtDlp(url: string) {
  const prefix = `media-${randomUUID()}`;
  const outputPath = path.join(downloadsDir, `${prefix}.%(ext)s`);

  const metadata = await spawnYtDlp([
    "--no-playlist",
    "--skip-download",
    "--print",
    "title",
    "--print",
    "thumbnail",
    "--print",
    "duration",
    url,
  ]);

  if (metadata.code !== 0) {
    throw new Error(metadata.stderr.trim() || "Unable to retrieve metadata for this URL.");
  }

  const lines = metadata.stdout.split(/\r?\n/).filter(Boolean);
  const [title, thumbnail, duration] = lines;

  const ffmpegPath = "C:/Users/georg/AppData/Local/Temp/ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe";
  const ffprobePath = "C:/Users/georg/AppData/Local/Temp/ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe";

  const download = await spawnYtDlp([
    "--no-playlist",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--format",
    "bestaudio/best",
    "--ffmpeg-location",
    "C:/Users/georg/AppData/Local/Temp/ffmpeg/ffmpeg-master-latest-win64-gpl/bin",
    "--output",
    outputPath,
    url,
  ]);

  if (download.code !== 0) {
    throw new Error(download.stderr.trim() || "Unable to download this URL.");
  }

  const files = await fs.promises.readdir(downloadsDir);
  const outputFile = files.find((file) => file.startsWith(prefix) && !file.endsWith(".part") && !file.endsWith(".webm.part"));
  if (!outputFile) {
    throw new Error("The media file could not be created.");
  }

  const extension = path.extname(outputFile).slice(1) || "webm";
  return {
    title: title || "Extracted media",
    thumbnail: thumbnail || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    duration: duration || "—",
    downloadUrl: `${publicBaseUrl}/downloads/${outputFile}`,
    extension,
  };
}

app.post("/api/analyze", async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    return res.status(400).json({ error: "A media URL is required." });
  }

  const normalized = url.trim();
  const mediaId = randomUUID();

  if (!isSupportedSource(normalized)) {
    return res.status(400).json({ error: "Only supported platform URLs are accepted." });
  }

  try {
    const data = await runYtDlp(normalized);
    return res.json({
      id: mediaId,
      title: data.title || "Extracted media",
      thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
      duration: data.duration || "—",
      source: "Supported source",
      description: "Extracted from a supported platform using the backend.",
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
      downloadUrl: data.downloadUrl,
      extension: data.extension,
      sourceUrl: normalized,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Extraction failed." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`GoonMP3 API listening on http://0.0.0.0:${port}`);
});
