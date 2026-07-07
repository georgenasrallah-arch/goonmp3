export async function analyzeMedia(url: string) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "https://goonmp3-api.loca.lt").trim();

  const response = await fetch(`${apiBaseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error("Unable to analyze the supplied URL.");
  }

  return response.json();
}
