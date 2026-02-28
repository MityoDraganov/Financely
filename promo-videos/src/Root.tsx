import { Composition, Folder } from "remotion";
import { FinancelyV1 } from "./video1/Video1";

// Total: 1285 raw frame sequence - 8×20 transition frames = 1125 net frames (~37.5s @ 30fps)
const TOTAL_FRAMES = 1125;
const FPS = 30;

export const RemotionRoot = () => {
  return (
    <Folder name="Financely-Promos">
      <Composition
        id="FinancelyV1"
        component={FinancelyV1}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
