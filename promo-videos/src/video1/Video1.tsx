import React from "react";
import { AbsoluteFill } from "remotion";
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

// Scene durations (in frames at 30fps)
// Net total after transitions: 1125 frames (~37.5s)
// 8 transitions × 20 frames = 160 frames overlap
// Raw sequence sum: 1125 + 160 = 1285 frames
const SCENE_DURATIONS = {
  intro:        100,  // 3.33s
  dashboard:    160,  // 5.33s
  invoices:     150,  // 5.00s
  templates:    140,  // 4.67s
  designer:     150,  // 5.00s  WYSIWYG canvas scene
  contacts:     120,  // 4.00s
  integrations: 155,  // 5.17s  Site Builder scene (3 phases)
  workflows:    135,  // 4.50s
  outro:        175,  // 5.83s
};
// Raw sum: 1285 → net: 1285 - 160 = 1125 ✓

const TRANSITION_DURATION = 20;

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
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        background: "#ffffff",
      }}
    >
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
