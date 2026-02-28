/**
 * generate-voiceover-bg.ts
 *
 * Generates Bulgarian voiceover MP3s using ElevenLabs TTS and writes them to
 * public/voiceover/v2/ so Remotion can serve them via staticFile().
 *
 * Usage:
 *   npm run voiceover:bg
 *   — or directly: node --env-file=.env ./node_modules/.bin/tsx generate-voiceover-bg.ts
 *
 * Requires ELEVENLABS_API_KEY in .env
 *
 * After generation, check the console for KB sizes and update VOICE_BG.audioFrames
 * in src/video2/Video2.tsx using:
 *   audioFrames = Math.round(fileSizeKB * 1024 / 128000 * 8 * 30)  (128kbps @ 30fps)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Voice config ──────────────────────────────────────────────────────────────
// "Adam" — eleven_multilingual_v2 supports Bulgarian natively.
const VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const MODEL_ID = "eleven_multilingual_v2";

const VOICE_SETTINGS = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.2,
};

// ── Bulgarian scene scripts ───────────────────────────────────────────────────
const SCENES = [
  {
    id: "01-intro",
    text: "Financely. Управлявай бизнеса си по-умно.",
  },
  {
    id: "02-dashboard",
    text: "Вижте приходите, разходите и ключовите показатели — всичко с един поглед.",
  },
  {
    id: "03-invoices",
    text: "Създавайте и изпращайте фактури за секунди. Без Excel, без главоболие.",
  },
  {
    id: "04-templates",
    text: "Изберете готов шаблон или направете свой от нулата.",
  },
  {
    id: "05-designer",
    text: "Персонализирайте всеки детайл с интерактивния редактор. Вашата марка, вашите правила.",
  },
  {
    id: "06-contacts",
    text: "Всички клиенти и контакти — организирани с вградена CRM система.",
  },
  {
    id: "07-integrations",
    text: "Създайте персонализирани форми и уиджети и ги добавете към сайта си за минути.",
  },
  {
    id: "08-workflows",
    text: "Автоматизирайте повтарящите се задачи с мощни работни процеси. По-малко работа, повече растеж.",
  },
  {
    id: "09-outro",
    text: "Financely. Всичко, от което се нуждае един модерен бизнес. Започнете безплатно днес.",
  },
] as const;

// ── Output dir ────────────────────────────────────────────────────────────────
const OUTPUT_DIR = join(process.cwd(), "public", "voiceover", "v2");

// ── API call ──────────────────────────────────────────────────────────────────
async function generateScene(id: string, text: string): Promise<number> {
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

  const kb = audioBuffer.length / 1024;
  const estimatedFrames = Math.round((audioBuffer.length / 128000) * 8 * 30);
  console.log(` ✓  (${kb.toFixed(1)} KB  →  ~${estimatedFrames} frames)`);
  return estimatedFrames;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set.\n" +
        "Add it to .env and run: npm run voiceover:bg",
    );
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\nVoice: Adam (${VOICE_ID})  |  Language: Bulgarian`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const results: { id: string; frames: number }[] = [];
  for (const scene of SCENES) {
    const frames = await generateScene(scene.id, scene.text);
    results.push({ id: scene.id, frames });
  }

  console.log("\n✅  All Bulgarian voiceover files generated successfully!");
  console.log("\n📋  Update VOICE_BG.audioFrames in src/video2/Video2.tsx:\n");
  for (const { id, frames } of results) {
    const key = id.replace(/^\d+-/, "");
    console.log(`  ${key.padEnd(12)}: { file: "${id}", audioFrames: ${frames} },`);
  }
  console.log("\n   Restart Remotion Studio to pick up the new audio files.\n");
}

main().catch((err: unknown) => {
  console.error("\n❌ ", err);
  process.exit(1);
});
