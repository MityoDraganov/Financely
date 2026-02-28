import { Composition, Folder } from "remotion";
import { FinancelyV1 }   from "./video1/Video1";
import { FinancelyV2BG } from "./video2/Video2";

// V1: Raw 1855 frames − (7×20 + 1×45) transitions = 1670 (~55.7s @ 30fps)
const TOTAL_FRAMES_V1 = 1670;
// V2BG: contacts scene +20 frames to prevent BG narration overlap → +20 cascade to outro
const TOTAL_FRAMES_V2BG = 1690;
const FPS = 30;

export const RemotionRoot = () => {
  return (
    <Folder name="Financely-Promos">
      <Composition
        id="FinancelyV1"
        component={FinancelyV1}
        durationInFrames={TOTAL_FRAMES_V1}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="FinancelyV2BG"
        component={FinancelyV2BG}
        durationInFrames={TOTAL_FRAMES_V2BG}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
