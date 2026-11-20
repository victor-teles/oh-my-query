import { createFileRoute } from "@tanstack/react-router";

import { BoardView } from "@/components/board/board-view";

export const Route = createFileRoute("/board/$boardId")({
  component: BoardRoute,
});

function BoardRoute() {
  const { boardId } = Route.useParams();
  return <BoardView boardId={boardId} key={boardId} />;
}
