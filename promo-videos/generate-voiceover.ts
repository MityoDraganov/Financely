/**
 * generate-voiceover.ts
 *
 * Generates per-scene voiceover MP3s using ElevenLabs TTS and writes them to
 * public/voiceover/v1/ so Remotion can serve them via staticFile().
 *
 * Usage:
 *   node --env-file=.env --strip-types generate-voiceover.ts
 *
 * Requires ELEVENLABS_API_KEY in .env
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Voice config ──────────────────────────────────────────────────────────────
// "Adam" — clear, professional, neutral male. Good for SaaS narration.
const VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const MODEL_ID = "eleven_multilingual_v2";

const VOICE_SETTINGS = {
  stability: 0.6,         // consistent delivery
  similarity_boost: 0.75,
  style: 0.2,             // slight expressiveness, stays professional
};

// ── Scene scripts ─────────────────────────────────────────────────────────────
// Timed to fit within each scene's net duration at 30fps.
// Scene durations (net after transitions): intro 3.3s, dashboard 5.3s, etc.
const SCENES = [
  {
    id: "01-intro",
    text: "Financely. Run your business, beautifully.",
  },
  {
    id: "02-dashboard",
    text: "See your revenue, expenses, and key metrics — all at a glance.",
  },
  {
    id: "03-invoices",
    text: "Create, send, and track professional invoices in seconds. No spreadsheets needed.",
  },
  {
    id: "04-templates",
    text: "Start from a polished template or build your own from scratch.",
  },
  {
    id: "05-designer",
    text: "Customize every detail with the drag-and-drop designer. Your brand, your rules.",
  },
  {
    id: "06-contacts",
    text: "Manage clients and leads with a built-in CRM.",
  },
  {
    id: "07-integrations",
    text: "Build embeddable widgets and forms. Add them to any website in minutes.",
  },
  {
    id: "08-workflows",
    text: "Automate repetitive tasks with powerful workflows. Less work, more growth.",
  },
  {
    id: "09-outro",
    text: "Financely. Everything you need to run a modern business. Start free today.",
  },
] as const;

// ── Output dir ────────────────────────────────────────────────────────────────
const OUTPUT_DIR = join(process.cwd(), "public", "voiceover", "v1");

// ── API call ──────────────────────────────────────────────────────────────────
async function generateScene(id: string, text: string): Promise<void> {
  process.stdout.write(`  Generating ${id}…`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `ElevenLabs error [${id}]: HTTP ${response.status} — ${body}`,
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const outPath = join(OUTPUT_DIR, `${id}.mp3`);
  writeFileSync(outPath, audioBuffer);

  console.log(` ✓  (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set.\n" +
        "Add it to .env and run: node --env-file=.env --strip-types generate-voiceover.ts",
    );
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\nVoice: Adam (${VOICE_ID})`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (const scene of SCENES) {
    await generateScene(scene.id, scene.text);
  }

  console.log("\n✅  All voiceover files generated successfully!");
  console.log("   Restart Remotion Studio to pick up the new audio files.\n");
}

main().catch((err: unknown) => {
  console.error("\n❌ ", err);
  process.exit(1);
});
