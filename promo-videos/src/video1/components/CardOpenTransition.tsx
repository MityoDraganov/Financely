/**
 * CardOpenTransition — custom Remotion TransitionPresentation that mimics
 * a user clicking a template card to open it in the designer.
 *
 * Exit  : TemplatesScene fades + gets a quick white "click" flash on the card.
 * Enter : DesignerScene expands from the card's bounding box to fill the screen.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

export type CardOpenProps = {
  /** Pixel rect of the "clicked" card in the 1920×1080 coordinate space */
  cardLeft:   number;
  cardTop:    number;
  cardWidth:  number;
  cardHeight: number;
};

// cubic ease-out  (fast start, slows as it fills the screen)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// very quick ease-in for the flash overlay
const easeInQuad = (t: number) => t * t;

const CardOpenComponent: React.FC<
  TransitionPresentationComponentProps<CardOpenProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { cardLeft, cardTop, cardWidth, cardHeight } = passedProps;
  const W = 1920;
  const H = 1080;

  // ── Exiting scene (TemplatesScene) ────────────────────────────────────────
  if (presentationDirection === "exiting") {
    // Scene dims as the entering frame expands over it
    const sceneOpacity = interpolate(presentationProgress, [0, 0.55, 1], [1, 0.7, 0]);

    // White "click" flash on the card area — very brief spike early in transition
    const flashRaw = interpolate(
      presentationProgress,
      [0, 0.06, 0.22, 0.5],
      [0,  0.75,  0,    0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const flashOpacity = easeInQuad(flashRaw);

    // Slight scale-down on the exiting scene (like being "pushed back")
    const scale = interpolate(presentationProgress, [0, 1], [1, 0.97]);

    return (
      <AbsoluteFill
        style={{
          opacity: sceneOpacity,
          transform: `scale(${scale})`,
          transformOrigin: `${cardLeft + cardWidth / 2}px ${cardTop + cardHeight / 2}px`,
        }}
      >
        {children}

        {/* Click flash overlay — covers just the card area */}
        <div
          style={{
            position: "absolute",
            top:    cardTop,
            left:   cardLeft,
            width:  cardWidth,
            height: cardHeight,
            background: "#ffffff",
            opacity: flashOpacity,
            borderRadius: 8,
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  // ── Entering scene (DesignerScene) ────────────────────────────────────────
  // Apply ease-out so the expansion is fast at first (responsive click feel)
  // then gently eases to fill the screen.
  const p = easeOut(presentationProgress);

  const insetTop    = interpolate(p, [0, 1], [cardTop,                  0]);
  const insetRight  = interpolate(p, [0, 1], [W - cardLeft - cardWidth, 0]);
  const insetBottom = interpolate(p, [0, 1], [H - cardTop - cardHeight, 0]);
  const insetLeft   = interpolate(p, [0, 1], [cardLeft,                 0]);
  const radius      = interpolate(p, [0, 1], [10,                       0]);

  return (
    <AbsoluteFill
      style={{
        clipPath: `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px round ${radius}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Pass the pixel rect of the highlighted card in TemplatesScene.
 *
 * Layout math (1920×1080, sidebar=220px, padding=32px):
 *   cardLeft   = 252    (sidebar + padding)
 *   cardTop    ≈ 240    (26 top-pad + header≈51 + gap22 + section≈52 + gap18 + banner≈46 + gap22)
 *   cardWidth  = 810    ((contentWidth 1636 − gap 16) / 2 columns)
 *   cardHeight ≈ 316    (preview 200 + border 1 + content 115)
 */
export const cardOpenTransition = (
  props: CardOpenProps = {
    cardLeft:   252,
    cardTop:    240,
    cardWidth:  810,
    cardHeight: 316,
  }
): TransitionPresentation<CardOpenProps> => ({
  component: CardOpenComponent,
  props,
});
