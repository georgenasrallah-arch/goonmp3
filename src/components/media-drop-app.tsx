"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, Download, Moon, Sparkles, SunMedium, UploadCloud, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type ThemeMode = "dark" | "light";
type ViewStep = "analyze" | "preview" | "download";

type AudioOption = {
  bitrate: number;
  label: string;
  estimatedSizeMb: number;
};

type VideoOption = {
  label: string;
  resolution: string;
  estimatedSizeMb: number;
};

type MediaAnalysis = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  source: string;
  description: string;
  audioOptions: AudioOption[];
  videoOptions: VideoOption[];
  downloadUrl: string;
};

type HistoryItem = {
  id: string;
  title: string;
  source: string;
  timestamp: string;
};

type Toast = {
  id: number;
  message: string;
};

const defaultAnalysis: MediaAnalysis = {
  id: "sample",
  title: "Midnight City Reimagined",
  thumbnail:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
  duration: "03:24",
  source: "YouTube",
  description: "A polished demo result with audio and video export presets.",
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
  downloadUrl: "/downloads/demo.mp4",
};

export function MediaDropApp() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<ViewStep>("analyze");
  const [dragActive, setDragActive] = useState(false);
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<"mp3" | "mp4">("mp3");
  const [selectedAudioBitrate, setSelectedAudioBitrate] = useState(192);
  const [selectedVideoResolution, setSelectedVideoResolution] = useState("720p");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("mediadrop-theme") as ThemeMode | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
    const storedHistory = window.localStorage.getItem("mediadrop-history");
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch {
        window.localStorage.removeItem("mediadrop-history");
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("mediadrop-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("mediadrop-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleAnalyze();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setTheme((current) => (current === "dark" ? "light" : "dark"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [url, analysis]);

  useEffect(() => {
    if (!downloading) return;
    const timer = window.setInterval(() => {
      setDownloadProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          setDownloading(false);
          setDownloadComplete(true);
          return 100;
        }
        return current + 8;
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [downloading]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 2200);
    return () => window.clearTimeout(id);
  }, [toasts]);

  const estimatedSize = useMemo(() => {
    if (!analysis) return 0;
    if (selectedFormat === "mp3") {
      const matching = analysis.audioOptions.find((option) => option.bitrate === selectedAudioBitrate);
      return matching?.estimatedSizeMb ?? analysis.audioOptions[1].estimatedSizeMb;
    }
    const matching = analysis.videoOptions.find((option) => option.resolution === selectedVideoResolution);
    return matching?.estimatedSizeMb ?? analysis.videoOptions[1].estimatedSizeMb;
  }, [analysis, selectedAudioBitrate, selectedFormat, selectedVideoResolution]);

  const supportNote = useMemo(() => {
    return selectedFormat === "mp3"
      ? "Optimized for fast, lightweight audio delivery."
      : "Higher resolution keeps detail intact for playback or archiving.";
  }, [selectedFormat]);

  const showToast = (message: string) => {
    setToasts((current) => [...current, { id: Date.now(), message }]);
  };

  const addHistoryEntry = (entry: MediaAnalysis) => {
    const item: HistoryItem = {
      id: entry.id,
      title: entry.title,
      source: entry.source,
      timestamp: new Date().toLocaleString(),
    };
    setHistory((current) => [item, ...current].slice(0, 6));
  };

  const handleAnalyze = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Add a supported media URL to continue.");
      showToast("Paste a URL first.");
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      if (!response.ok) {
        throw new Error("Unable to analyze the supplied URL.");
      }
      const payload = (await response.json()) as MediaAnalysis;
      setAnalysis(payload);
      setStep("preview");
      setSelectedFormat("mp3");
      setSelectedAudioBitrate(payload.audioOptions[1]?.bitrate ?? 192);
      setSelectedVideoResolution(payload.videoOptions[1]?.resolution ?? "720p");
      addHistoryEntry(payload);
      showToast("Analysis complete. Choose your preferred format.");
      queryClient.invalidateQueries({ queryKey: ["media-analysis"] });
    } catch {
      const fallback = {
        ...defaultAnalysis,
        title: trimmedUrl.length > 28 ? `${trimmedUrl.slice(0, 28)}…` : trimmedUrl,
        source: "Demo provider",
        description: "A local fallback preview for the requested media link.",
      };
      setAnalysis(fallback);
      setStep("preview");
      setSelectedFormat("mp3");
      setSelectedAudioBitrate(fallback.audioOptions[1].bitrate);
      setSelectedVideoResolution(fallback.videoOptions[1].resolution);
      addHistoryEntry(fallback);
      showToast("Using the local preview flow for this URL.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = () => {
    if (!analysis) return;
    setDownloadProgress(0);
    setDownloadComplete(false);
    setDownloading(true);
    setStep("download");
    showToast("Download started. Your file is being prepared.");
  };

  const handleCopy = async () => {
    if (!analysis) return;
    const text = `${analysis.title} · ${selectedFormat.toUpperCase()} · ${selectedFormat === "mp3" ? `${selectedAudioBitrate} kbps` : selectedVideoResolution}`;
    await navigator.clipboard.writeText(text);
    showToast("Media details copied.");
  };

  const handlePaste = async () => {
    const clipboardText = await navigator.clipboard.readText();
    setUrl(clipboardText);
    showToast("URL pasted from the clipboard.");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_46%),linear-gradient(135deg,_#050816,_#0d111f)] text-zinc-100 transition-colors">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl">
            <Sparkles className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] text-zinc-400 uppercase">goonmp3</p>
            <p className="text-sm text-zinc-500">Apple-inspired conversion studio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            className="rounded-full border border-white/10 bg-white/10 p-2.5 text-zinc-200 backdrop-blur-xl transition hover:bg-white/15"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_28px_90px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200">
                <Wand2 className="h-4 w-4" />
                AI-ready media conversion flow
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Convert Your Media
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-zinc-400">
                  Download audio or video from supported sources you own or have permission to use.
                </p>
              </div>

              <label
                className={`group flex flex-col gap-3 rounded-[26px] border p-3 transition ${dragActive ? "border-indigo-400/70 bg-indigo-500/10" : "border-white/10 bg-white/5"}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const droppedUrl = event.dataTransfer.getData("text/plain");
                  if (droppedUrl) {
                    setUrl(droppedUrl);
                    showToast("URL ready for analysis.");
                  }
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    ref={inputRef}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="Paste a supported media link"
                    className="h-14 flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 text-base text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePaste}
                      className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/15"
                    >
                      Paste
                    </button>
                    <button
                      disabled={isAnalyzing}
                      onClick={() => void handleAnalyze()}
                      className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAnalyzing ? "Analyzing…" : "Analyze"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <UploadCloud className="h-4 w-4" /> Drag and drop URLs here
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Ctrl/Cmd + K to focus</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Ctrl/Cmd + Enter to analyze</span>
                </div>
              </label>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.26em] text-zinc-500">Live preview</p>
                  <p className="mt-1 text-xl font-semibold text-white">Ready to convert</p>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
                  Secure & local-friendly
                </div>
              </div>
              <div className="mt-5 space-y-3 rounded-[24px] border border-white/10 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>Supported sources</span>
                  <span className="text-zinc-200">YouTube, Vimeo, SoundCloud</span>
                </div>
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>Export formats</span>
                  <span className="text-zinc-200">MP3 / MP4</span>
                </div>
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>History</span>
                  <span className="text-zinc-200">Saved locally</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {step === "preview" && analysis ? (
            <motion.section
              key="preview"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.4)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Media found</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">{analysis.title}</h2>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/15"
                  >
                    <Copy className="h-4 w-4" /> Copy info
                  </button>
                </div>
                <div className="mt-5 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
                  <img
                    src={analysis.thumbnail}
                    alt={analysis.title}
                    className="h-56 w-full rounded-[24px] object-cover"
                  />
                  <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Duration</span>
                      <span className="font-medium text-zinc-200">{analysis.duration}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Source</span>
                      <span className="font-medium text-zinc-200">{analysis.source}</span>
                    </div>
                    <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-sm text-indigo-100">
                      {analysis.description}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3 text-sm text-zinc-400">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Estimated file size</span>
                        <span className="font-semibold text-white">{estimatedSize.toFixed(1)} MB</span>
                      </div>
                      <p>{supportNote}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Choose format</h3>
                    <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-zinc-300">
                      {selectedFormat === "mp3" ? "Audio" : "Video"}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedFormat("mp3")}
                      className={`rounded-2xl border p-3 text-left transition ${selectedFormat === "mp3" ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      <p className="text-sm font-semibold text-white">MP3</p>
                      <p className="mt-1 text-xs text-zinc-400">Portable audio export</p>
                    </button>
                    <button
                      onClick={() => setSelectedFormat("mp4")}
                      className={`rounded-2xl border p-3 text-left transition ${selectedFormat === "mp4" ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      <p className="text-sm font-semibold text-white">MP4</p>
                      <p className="mt-1 text-xs text-zinc-400">Video export</p>
                    </button>
                  </div>

                  {selectedFormat === "mp3" ? (
                    <div className="mt-4 space-y-2">
                      {analysis.audioOptions.map((option) => (
                        <button
                          key={option.bitrate}
                          onClick={() => setSelectedAudioBitrate(option.bitrate)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${selectedAudioBitrate === option.bitrate ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                        >
                          <span className="text-sm font-medium text-white">{option.label}</span>
                          <span className="text-xs text-zinc-400">{option.estimatedSizeMb.toFixed(1)} MB</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {analysis.videoOptions.map((option) => (
                        <button
                          key={option.resolution}
                          onClick={() => setSelectedVideoResolution(option.resolution)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${selectedVideoResolution === option.resolution ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                        >
                          <span className="text-sm font-medium text-white">{option.label}</span>
                          <span className="text-xs text-zinc-400">{option.estimatedSizeMb.toFixed(1)} MB</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Download</h3>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      <Download className="h-4 w-4" /> Start download
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-zinc-400">
                    The export will be prepared with the exact settings you chose. Files are staged locally for a polished and predictable experience.
                  </p>
                </div>
              </div>
            </motion.section>
          ) : null}

          {step === "download" && analysis ? (
            <motion.section
              key="download"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-[32px] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Download status</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Preparing your {selectedFormat.toUpperCase()} export</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    A smooth, animated transfer keeps you informed while the file is assembled for download.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Speed</span>
                    <span className="font-semibold text-white">1.8 MB/s</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>ETA</span>
                    <span className="font-semibold text-white">{Math.max(1, 18 - Math.round(downloadProgress / 6))}s</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-zinc-900/70 p-5">
                <div className="mb-3 flex items-center justify-between text-sm text-zinc-400">
                  <span>Progress</span>
                  <span className="font-medium text-zinc-200">{downloadProgress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setDownloading(false);
                      setDownloadComplete(false);
                      setDownloadProgress(0);
                      setStep("preview");
                      showToast("Download canceled.");
                    }}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15"
                  >
                    Cancel
                  </button>
                  {downloadComplete ? (
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
                      Success — your file is ready.
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Download history</h3>
              <span className="text-sm text-zinc-500">Stored locally</span>
            </div>
            <div className="mt-4 space-y-3">
              {history.length ? history.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-zinc-500">{item.source} · {item.timestamp}</p>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Download className="h-4 w-4" />
                  </div>
                </div>
              )) : <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">Your recent downloads will appear here.</p>}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-2xl">
            <h3 className="text-xl font-semibold text-white">Keyboard & shortcuts</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Ctrl/Cmd + K", "Focus the URL field"],
                ["Ctrl/Cmd + Enter", "Run media analysis"],
                ["Ctrl/Cmd + D", "Toggle color theme"],
                ["Drag + Drop", "Drop a URL into the workspace"],
              ].map(([shortcut, label]) => (
                <div key={shortcut} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{shortcut}</p>
                  <p className="mt-1 text-sm text-zinc-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-full border border-white/10 bg-zinc-900/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur-xl"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
