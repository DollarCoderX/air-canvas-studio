// Free, keyless Pollinations endpoints (browser-callable, rate-limited).
export async function askPollinations(prompt: string, system: string): Promise<string> {
  const full = `${system}\n\n${prompt}`.slice(0, 3500);
  const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(full)}`);
  if (!res.ok) throw new Error(`AI unavailable (${res.status})`);
  const text = (await res.text()).trim();
  if (!text) throw new Error("Empty reply");
  return text;
}

export function pollinationsImageUrl(prompt: string) {
  const seed = Math.floor(Math.random() * 100000);
  return `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=768&height=512&seed=${seed}&nologo=true`;
}
