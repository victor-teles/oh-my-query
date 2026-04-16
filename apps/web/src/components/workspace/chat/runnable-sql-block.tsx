import { useTransientQuery } from "@/hooks/use-transient-query";

import {
  InlineQueryResult,
  InlineRunError,
  InlineRunningIndicator,
} from "./inline-query-result";
import { SqlCodeBlock } from "./sql-code-block";

interface RunnableSqlBlockProps {
  code: string;
  connectionId: string;
  schema?: string;
}

export const RunnableSqlBlock = ({
  code,
  connectionId,
  schema,
}: RunnableSqlBlockProps) => {
  const { run, status, result, error } = useTransientQuery({
    connectionId,
    schema,
  });

  return (
    <div>
      <SqlCodeBlock code={code} onRun={run} />
      {status === "running" ? <InlineRunningIndicator /> : null}
      {status === "success" && result ? (
        <InlineQueryResult result={result} />
      ) : null}
      {status === "error" && error ? <InlineRunError error={error} /> : null}
    </div>
  );
};
