import { JumpScene } from './JumpScene';
import { ActionBar, AttemptsPanel, JumpControls } from './JumpControls';
import { HintsCard, LearningPanel, PredictionCard, ResultsPanel } from './JumpPanels';
import { ChallengeQuestionCard, ObjectiveBar, TransferCard } from './ChallengePanels';

export function JumpLab() {
  return (
    <div className="lab-grid">
      <div className="lab-main">
        <ObjectiveBar />
        <section className="card scene-card" aria-label="Jump simulation">
          <JumpScene />
          <ActionBar />
        </section>
        <JumpControls />
        <AttemptsPanel />
      </div>
      <aside className="lab-side" aria-label="Prediction, results and learning">
        <PredictionCard />
        <ResultsPanel />
        <ChallengeQuestionCard />
        <TransferCard />
        <HintsCard />
        <LearningPanel />
      </aside>
    </div>
  );
}
