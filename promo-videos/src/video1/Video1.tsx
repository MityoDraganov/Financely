import React from "react";
import { AbsoluteFill, Sequence, staticFile, Audio, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont } from "@remotion/google-fonts/Inter";
import { cardOpenTransition } from "./components/CardOpenTransition";
import { IntroScene } from "./scenes/IntroScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { InvoicesScene } from "./scenes/InvoicesScene";
import { TemplatesScene } from "./scenes/TemplatesScene";
import { DesignerScene } from "./scenes/DesignerScene";
import { ContactsScene } from "./scenes/ContactsScene";
import { IntegrationsScene } from "./scenes/IntegrationsScene";
import { WorkflowsScene } from "./scenes/WorkflowsScene";
import { OutroScene } from "./scenes/OutroScene";

// Load Inter font — called at module level so it's available before first render
const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// ── Timing constants ──────────────────────────────────────────────────────────
const TRANSITION_DURATION = 20;   // frames for slide/fade/wipe transitions
const CARD_OPEN_DURATION   = 45;  // frames for card-open transition
const VOICE_DELAY          = 8;   // frames after scene start before narration begins
const POST_AUDIO           = 45;  // frames of silence after narration before next transition

// ── Voiceover file registry ───────────────────────────────────────────────────
// audioFrames: measured from ElevenLabs MP3 file sizes at 128 kbps.
// sceneDuration = VOICE_DELAY + audioFrames + POST_AUDIO (rounded to nearest 5).
const VOICE = {
  intro:        { file: "01-intro",        audioFrames: 102 },  // 3.4s
  dashboard:    { file: "02-dashboard",    audioFrames: 135 },  // 4.5s
  invoices:     { file: "03-invoices",     audioFrames: 157 },  // 5.2s
  templates:    { file: "04-templates",    audioFrames: 109 },  // 3.6s
  designer:     { file: "05-designer",     audioFrames: 164 },  // 5.5s
  contacts:     { file: "06-contacts",     audioFrames:  93 },  // 3.1s
  integrations: { file: "07-integrations", audioFrames: 150 },  // 5.0s
  workflows:    { file: "08-workflows",    audioFrames: 164 },  // 5.5s
  outro:        { file: "09-outro",        audioFrames: 178 },  // 5.9s
} as const;

// ── Scene durations ───────────────────────────────────────────────────────────
// Formula: VOICE_DELAY + audioFrames + POST_AUDIO (rounded up to a clean number)
// Raw sum: 1855 frames. Transitions overlap: 7×20 + 1×45 = 185. Net: 1670 (~55.7s)
const SCENE_DURATIONS = {
  intro:        155,  // 8 + 102 + 45 = 155  (5.2s)
  dashboard:    190,  // 8 + 135 + 45 = 188  (6.3s)
  invoices:     210,  // 8 + 157 + 45 = 210  (7.0s)
  templates:    165,  // 8 + 109 + 45 = 162  (5.5s)
  designer:     220,  // 8 + 164 + 45 = 217  (7.3s)
  contacts:     150,  // 8 +  93 + 45 = 146  (5.0s)
  integrations: 310,  // extended to show embed demo  (10.3s)
  workflows:    220,  // 8 + 164 + 45 = 217  (7.3s)
  outro:        235,  // 8 + 178 + 45 = 231  (7.8s)
};

// ── Absolute scene start offsets in the final timeline ────────────────────────
// Each offset = previous offset + previous scene duration − transition duration.
// Card-open (templates→designer) is 45 frames; all others are 20.
const SCENE_OFFSETS = {
  intro:        0,
  dashboard:    135,  // 0   + (155 - 20)
  invoices:     305,  // 135 + (190 - 20)
  templates:    495,  // 305 + (210 - 20)
  designer:     615,  // 495 + (165 - 45)  ← card-open
  contacts:     815,  // 615 + (220 - 20)
  integrations: 945,  // 815 + (150 - 20)
  workflows:   1235,  // 945 + (310 - 20)
  outro:       1435,  // 1235 + (220 - 20)
  //                     net end: 1435 + 235 = 1670 ✓
} as const;

const transitionFade      = fade();
const transitionSlideRight = slide({ direction: "from-right" });
const transitionSlideLeft  = slide({ direction: "from-left" });
const transitionWipe       = wipe({ direction: "from-right" });

const timingSpring = springTiming({
  config: { damping: 200 },
  durationInFrames: TRANSITION_DURATION,
});
const timingLinear = linearTiming({ durationInFrames: TRANSITION_DURATION });
// Longer linear timing for the card-open expansion (ease is applied inside the presentation)
const timingCardOpen = linearTiming({ durationInFrames: 45 });

export const FinancelyV1: React.FC = () => {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        background: "#ffffff",
      }}
    >
      {/* ── Background music ──────────────────────────────────────────────── */}
      {/* Looped, fades in over 1s, holds at 13% volume, fades out 1.5s before end */}
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

      {/* ── Voiceover audio track ─────────────────────────────────────────── */}
      {/* Each Sequence is hard-capped to its audioFrames so clips never bleed
          into the next scene. from = scene offset + VOICE_DELAY.             */}
      {(Object.keys(VOICE) as (keyof typeof VOICE)[]).map((key) => {
        const { file, audioFrames } = VOICE[key];
        const offset = SCENE_OFFSETS[key];
        return (
          <Sequence
            key={file}
            from={offset + VOICE_DELAY}
            durationInFrames={audioFrames}
          >
            <Audio src={staticFile(`voiceover/v1/${file}.mp3`)} />
          </Sequence>
        );
      })}

      <TransitionSeries>
        {/* Scene 1: Intro */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.intro}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionFade} timing={timingLinear} />

        {/* Scene 2: Dashboard */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.dashboard}>
          <DashboardScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        {/* Scene 3: Invoices */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.invoices}>
          <InvoicesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        {/* Scene 4: Templates listing page */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.templates}>
          <TemplatesScene />
        </TransitionSeries.Sequence>

        {/* Card-open: expands from the highlighted template card into the designer canvas */}
        <TransitionSeries.Transition
          presentation={cardOpenTransition()}
          timing={timingCardOpen}
        />

        {/* Scene 5: Designer — WYSIWYG canvas */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.designer}>
          <DesignerScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        {/* Scene 6: Contacts */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.contacts}>
          <ContactsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideRight} timing={timingSpring} />

        {/* Scene 7: Integrations / Site Builder */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.integrations}>
          <IntegrationsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionSlideLeft} timing={timingSpring} />

        {/* Scene 8: Workflows */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.workflows}>
          <WorkflowsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={transitionFade} timing={timingLinear} />

        {/* Scene 9: Outro */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.outro}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
