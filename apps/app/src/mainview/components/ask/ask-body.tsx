import type { CardViewKind } from "@/lib/card-data";

import type { AskCardPresentation } from "./ask-answer-view";
import type { ErrorAction } from "./ask-error";
import type { AskState } from "./ask-reducer";
import type { StatusLabel } from "./ask-status";
import type { AskBody as AskBodyKind } from "./use-phase-display";

import { AskAnswerView } from "./ask-answer-view";
import { AskError } from "./ask-error";
import { AskSkeleton } from "./ask-skeleton";
import { AskStatus } from "./ask-status";

interface AskBodyProps {
  kind: AskBodyKind;
  state: AskState;
  label: StatusLabel;
  card: AskCardPresentation;
  onSelectView: (view: CardViewKind) => void;
  onErrorAction: (action: Exclude<ErrorAction, null>) => void;
}

export function AskBody({
  kind,
  state,
  label,
  card,
  onSelectView,
  onErrorAction,
}: AskBodyProps) {
  switch (kind) {
    case "working": {
      return (
        <>
          <AskStatus busy label={label} />
          <AskSkeleton />
        </>
      );
    }
    case "stopped": {
      return <AskStatus busy={false} label={label} />;
    }
    case "error": {
      return state.failure ? (
        <AskError
          failure={state.failure}
          onAction={onErrorAction}
          source={state.source}
        />
      ) : null;
    }
    case "card":
    case "refining":
    case "refine-error": {
      return (
        <AskAnswerView
          card={card}
          kind={kind}
          onErrorAction={onErrorAction}
          onSelectView={onSelectView}
          state={state}
        />
      );
    }
    default: {
      return null;
    }
  }
}
