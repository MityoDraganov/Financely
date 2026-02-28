/**
 * FinancelyV2BG — Bulgarian-language version of FinancelyV1.
 *
 * Differences from Video1:
 *  • Voiceover loaded from public/voiceover/v2/ (Bulgarian audio)
 *  • IntroScene & OutroScene use Bulgarian marketing copy
 *  • SubtitleOverlay renders the Bulgarian narration on screen
 *  • Inter font loaded with cyrillic subset for Cyrillic rendering
 *  • All middle scenes (Dashboard→Workflows) are reused from video1 — UI stays English
 *
 * After generating Bulgarian audio (node --env-file=.env --strip-types generate-voiceover-bg.ts),
 * measure the actual audioFrames from the MP3 file sizes and update VOICE_BG below.
 */
import React from "react";
import { AbsoluteFill, Sequence, staticFile, Audio, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont } from "@remotion/google-fonts/Inter";
import { cardOpenTransition } from "../video1/components/CardOpenTransition";

// ── Scenes — Intro/Outro are Bulgarian versions; middle scenes reuse video1 (English UI) ──
import { IntroScene }        from "./scenes/IntroScene";
import { OutroScene }        from "./scenes/OutroScene";
import { DashboardScene }    from "../video1/scenes/DashboardScene";
import { InvoicesScene }     from "../video1/scenes/InvoicesScene";
import { TemplatesScene }    from "../video1/scenes/TemplatesScene";
import { DesignerScene }     from "../video1/scenes/DesignerScene";
import { ContactsScene }     from "../video1/scenes/ContactsScene";
import { IntegrationsScene } from "../video1/scenes/IntegrationsScene";
import { WorkflowsScene }    from "../video1/scenes/WorkflowsScene";
import { SubtitleOverlay }   from "./components/SubtitleOverlay";

// Load Inter with cyrillic subset for Bulgarian text
const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "cyrillic"],
});

// ── Timing constants (identical to Video1) ────────────────────────────────────
const TRANSITION_DURATION = 20;
const CARD_OPEN_DURATION  = 45;
const VOICE_DELAY         = 8;
const POST_AUDIO          = 45;

// ── Bulgarian voiceover registry ─────────────────────────────────────────────
// audioFrames are estimates matching the English version.
// After running `generate-voiceover-bg.ts`, measure actual MP3 durations:
//   audioFrames = Math.round(fileSizeBytes / 128000 * 8 * 30)  (for 128kbps @ 30fps)
// then update the values below and rerun to re-check scene durations.
const VOICE_BG = {
  intro:        { file: "01-intro",        audioFrames: 109 },
  dashboard:    { file: "02-dashboard",    audioFrames: 147 },
  invoices:     { file: "03-invoices",     audioFrames: 179 },
  templates:    { file: "04-templates",    audioFrames: 105 },
  designer:     { file: "05-designer",     audioFrames: 196 },
  contacts:     { file: "06-contacts",     audioFrames: 146 },
  integrations: { file: "07-integrations", audioFrames: 166 },
  workflows:    { file: "08-workflows",    audioFrames: 191 },
  outro:        { file: "09-outro",        audioFrames: 207 },
} as const;

// ── Scene durations ───────────────────────────────────────────────────────────
// contacts is 170 (vs 150 in V1) so BG contacts narration (146 frames) fully
// finishes before the integrations narration begins — preventing voice overlap.
const SCENE_DURATIONS = {
  intro:        155,
  dashboard:    190,
  invoices:     210,
  templates:    165,
  designer:     220,
  contacts:     170,  // +20 vs V1 to clear contacts narration before integrations starts
  integrations: 310,
  workflows:    220,
  outro:        235,
};

// ── Absolute scene start offsets ──────────────────────────────────────────────
// Derived from TransitionSeries: next_offset = prev_offset + prev_duration - transition_duration
// contacts change cascades: integrations/workflows/outro shift +20 vs V1.
const SCENE_OFFSETS = {
  intro:        0,
  dashboard:    135,   // 0   + 155 - 20
  invoices:     305,   // 135 + 190 - 20
  templates:    495,   // 305 + 210 - 20
  designer:     615,   // 495 + 165 - 45 (card-open transition)
  contacts:     815,   // 615 + 220 - 20
  integrations: 965,   // 815 + 170 - 20  ← was 945
  workflows:   1255,   // 965 + 310 - 20  ← was 1235
  outro:       1455,   // 1255 + 220 - 20 ← was 1435
} as const;

// ── Bulgarian subtitle scripts ────────────────────────────────────────────────
const SCRIPT_BG: Record<keyof typeof VOICE_BG, string> = {
  intro:        "Financely. Управлявай бизнеса си по-умно.",
  dashboard:    "Вижте приходите, разходите и ключовите показатели — всичко с един поглед.",
  invoices:     "Създавайте и изпращайте фактури за секунди. Без Excel, без главоболие.",
  templates:    "Изберете готов шаблон или направете свой от нулата.",
  designer:     "Персонализирайте всеки детайл с интерактивния редактор. Вашата марка, вашите правила.",
  contacts:     "Всички клиенти и контакти — организирани с вградена CRM система.",
  integrations: "Създайте персонализирани форми и уиджети и ги добавете към сайта си за минути.",
  workflows:    "Автоматизирайте повтарящите се задачи с мощни работни процеси. По-малко работа, повече растеж.",
  outro:        "Financely. Всичко, от което се нуждае един модерен бизнес. Започнете безплатно днес.",
};

// Subtitle entries derived from offsets + voice timing
const SUBTITLES = (Object.keys(VOICE_BG) as (keyof typeof VOICE_BG)[]).map((key) => ({
  from: SCENE_OFFSETS[key] + VOICE_DELAY,
  to:   SCENE_OFFSETS[key] + VOICE_DELAY + VOICE_BG[key].audioFrames,
  text: SCRIPT_BG[key],
}));

// ── Transitions ───────────────────────────────────────────────────────────────
const transitionFade       = fade();
const transitionSlideRight = slide({ direction: "from-right" });
const transitionSlideLeft  = slide({ direction: "from-left" });
const transitionWipe       = wipe({ direction: "from-right" });

const timingSpring   = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_DURATION });
const timingLinear   = linearTiming({ durationInFrames: TRANSITION_DURATION });
const timingCardOpen = linearTiming({ durationInFrames: CARD_OPEN_DURATION });

export const FinancelyV2BG: React.FC = () => {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily, background: "#ffffff" }}>

      {/* ── Background music ──────────────────────────────────────────────── */}
      <Audio
        src={staticFile("background-music.mp3")}
        loop
        loopVolumeCurveBehavior="extend"
        volume={(f) =>
          interpolate(
            f,
            [0, 30, durationInFrames - 45, durationInFrames],
            [0, 0.13, 0.13, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      {/* ── Bulgarian voiceover audio tracks ─────────────────────────────── */}
      {(Object.keys(VOICE_BG) as (keyof typeof VOICE_BG)[]).map((key) => {
        const { file, audioFrames } = VOICE_BG[key];
        const offset = SCENE_OFFSETS[key];
        return (
          <Sequence
            key={file}
            from={offset + VOICE_DELAY}
            durationInFrames={audioFrames}
          >
            <Audio src={staticFile(`voiceover/v2/${file}.mp3`)} />
          </Sequence>
        );
      })}

      {/* ── Scenes ───────────────────────────────────────────────────────── */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.intro}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionFade} timing={timingLinear} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.dashboard}>
          <DashboardScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.invoices}>
          <InvoicesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.templates}>
          <TemplatesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={cardOpenTransition()} timing={timingCardOpen} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.designer}>
          <DesignerScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.contacts}>
          <ContactsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.integrations}>
          <IntegrationsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideLeft} timing={timingSpring} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.workflows}>
          <WorkflowsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionFade} timing={timingLinear} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.outro}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* ── Bulgarian subtitle overlay (rendered on top of everything) ────── */}
      <SubtitleOverlay subtitles={SUBTITLES} />

    </AbsoluteFill>
  );
};
