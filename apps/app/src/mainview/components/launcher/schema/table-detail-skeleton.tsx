const LIST_ROWS = [0.7, 0.55, 0.8, 0.5, 0.65, 0.6];
const DETAIL_ROWS = [0.5, 0.75, 0.6, 0.7, 0.45, 0.65, 0.55];

function Bar({ width }: { width: number }) {
  return (
    <span
      className="block h-2.5 rounded-full bg-row-hover"
      style={{ width: `${width * 100}%` }}
    />
  );
}

export function TableListSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-4 px-4 pt-3"
      data-testid="table-skeleton"
    >
      {LIST_ROWS.map((width) => (
        <Bar key={width} width={width} />
      ))}
    </div>
  );
}

export function TableDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-3 pt-3">
      {DETAIL_ROWS.map((width) => (
        <Bar key={width} width={width} />
      ))}
    </div>
  );
}
