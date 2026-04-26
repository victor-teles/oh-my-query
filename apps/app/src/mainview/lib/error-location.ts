export interface ErrorLocation {
  line?: number;
  column?: number;
  position?: number;
}

const POSITION = /\bat\s+position\s+(\d+)/i;
const LINE_COL_PAREN = /\(\s*line\s+(\d+),\s*col(?:umn)?\s+(\d+)\s*\)/i;
const LINE_COL = /\bline\s+(\d+)(?:[,\s]+col(?:umn)?\s+(\d+))?/i;
const PG_LINE = /^LINE\s+(\d+):/m;

export const parseErrorLocation = (error: string): ErrorLocation | null => {
  const positionMatch = POSITION.exec(error);
  if (positionMatch?.[1]) {
    return { position: Number(positionMatch[1]) };
  }

  const lineColParen = LINE_COL_PAREN.exec(error);
  if (lineColParen?.[1] && lineColParen[2]) {
    return {
      column: Number(lineColParen[2]),
      line: Number(lineColParen[1]),
    };
  }

  const lineCol = LINE_COL.exec(error);
  if (lineCol?.[1]) {
    return {
      column: lineCol[2] ? Number(lineCol[2]) : undefined,
      line: Number(lineCol[1]),
    };
  }

  const pgLine = PG_LINE.exec(error);
  if (pgLine?.[1]) {
    return { line: Number(pgLine[1]) };
  }

  return null;
};

export const formatLocationLabel = (location: ErrorLocation): string => {
  if (location.line !== undefined) {
    return location.column !== undefined
      ? `line ${location.line}, col ${location.column}`
      : `line ${location.line}`;
  }
  if (location.position !== undefined) {
    return `position ${location.position}`;
  }
  return "location";
};
