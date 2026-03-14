import { Composition } from "remotion";

import { TUTORIAL_TOTAL_DURATION } from "./data/tutorial-script";
import { TutorialVideo } from "./compositions/tutorial-video";

export function RemotionRoot() {
  return (
    <Composition
      id="TutorialVideo"
      component={TutorialVideo}
      durationInFrames={TUTORIAL_TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
