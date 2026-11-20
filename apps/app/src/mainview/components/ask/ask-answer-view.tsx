import type { Ref } from "react";

import { AnimatePresence, motion } from "motion/react";

import type { CardViewKind } from "@/lib/card-data";

import { ProgressHairline } from "@/components/motion/progress-hairline";
import { useMotionPreset } from "@/lib/motion";

import type { CardIntro, CardSlots } from "./ask-card";
import type { ErrorAction } from "./ask-error";
import type { AskState, AskTransition } from "./ask-reducer";

import { AskCard } from "./ask-card";
import { AskError } from "./ask-error";
import { shownTurn } from "./ask-reducer";

const STALE_OPACITY = 0.6;

const INTROS: Record<AskTransition, CardIntro> = {
  fresh: "play",
  refine: "update",
  restore: "skip",
  step: "update",
};

export interface AskCardPresentation {
  slots?: CardSlots;
  ref?: Ref<HTMLElement>;
}

type AnswerKind = "card" | "refining" | "refine-error";

interface AskAnswerViewProps {
  kind: AnswerKind;
  state: AskState;
  card: AskCardPresentation;
  onSelectView: (view: CardViewKind) => void;
  onErrorAction: (action: Exclude<ErrorAction, null>) => void;
}

// One element tree for the shown answer in every state, so a refine reads as
// the same card changing its mind: it dims, then morphs to the new data.
export function AskAnswerView({
  kind,
  state,
  card,
  onSelectView,
  onErrorAction,
}: AskAnswerViewProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  const turn = shownTurn(state);
  if (!turn) {
    return null;
  }
  const stale = kind === "refining";
  const failure = kind === "refine-error" ? state.failure : null;
  return (
    <>
      <AnimatePresence initial={false}>
        {failure ? (
          <motion.div exit={{ opacity: 0, transition: fadeOut }} key="error">
            <AskError
              failure={failure}
              onAction={onErrorAction}
              source={state.source}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="relative">
        <AnimatePresence>{stale ? <ProgressHairline /> : null}</AnimatePresence>
        <motion.div
          animate={{ opacity: stale ? STALE_OPACITY : 1 }}
          aria-busy={stale}
          data-testid="answer-stage"
          transition={fadeIn}
        >
          <AskCard
            intro={INTROS[state.transition]}
            onSelectView={onSelectView}
            ref={card.ref}
            result={turn.answer.result}
            slots={card.slots}
            spec={turn.answer.spec}
            view={turn.view}
          />
        </motion.div>
      </div>
    </>
  );
}
