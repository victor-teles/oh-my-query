import { ArrowRightLeft } from "lucide-react";
import { useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DIALECT_GROUPS = [
  {
    dialects: [
      { label: "PostgreSQL", value: "postgresql" },
      { label: "MySQL", value: "mysql" },
      { label: "SQLite", value: "sqlite" },
      { label: "SQL Server", value: "tsql" },
      { label: "Oracle", value: "oracle" },
    ],
    label: "Databases",
  },
  {
    dialects: [
      { label: "BigQuery", value: "bigquery" },
      { label: "Snowflake", value: "snowflake" },
      { label: "Redshift", value: "redshift" },
      { label: "Databricks", value: "databricks" },
      { label: "Athena", value: "athena" },
      { label: "Teradata", value: "teradata" },
      { label: "Fabric", value: "fabric" },
    ],
    label: "Cloud & Warehouses",
  },
  {
    dialects: [
      { label: "DuckDB", value: "duckdb" },
      { label: "ClickHouse", value: "clickhouse" },
      { label: "Apache Spark", value: "spark" },
      { label: "Hive", value: "hive" },
      { label: "Trino", value: "trino" },
      { label: "Presto", value: "presto" },
      { label: "DataFusion", value: "datafusion" },
      { label: "Druid", value: "druid" },
      { label: "Drill", value: "drill" },
      { label: "Dremio", value: "dremio" },
      { label: "Exasol", value: "exasol" },
    ],
    label: "Analytics",
  },
  {
    dialects: [
      { label: "CockroachDB", value: "cockroachdb" },
      { label: "TiDB", value: "tidb" },
      { label: "SingleStore", value: "singlestore" },
      { label: "Materialize", value: "materialize" },
      { label: "RisingWave", value: "risingwave" },
      { label: "StarRocks", value: "starrocks" },
      { label: "Doris", value: "doris" },
    ],
    label: "NewSQL & Streaming",
  },
] as const;

const DIALECT_DISPLAY_NAMES: Record<string, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  sqlite: "SQLite",
};

interface DialectSelectorProps {
  value: string;
  connectionDialect: string;
  onChange: (dialect: string) => void;
}

export const DialectSelector = ({
  value,
  connectionDialect,
  onChange,
}: DialectSelectorProps) => {
  const isTranspiling = value !== connectionDialect;

  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) {
        onChange(v);
      }
    },
    [onChange]
  );

  const targetLabel =
    DIALECT_DISPLAY_NAMES[connectionDialect] ?? connectionDialect;

  return (
    <div className="flex items-center gap-1">
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {DIALECT_GROUPS.map((group, idx) => (
            <SelectGroup key={group.label}>
              {idx > 0 && <SelectSeparator />}
              <SelectLabel>{group.label}</SelectLabel>
              {group.dialects.map((dialect) => (
                <SelectItem key={dialect.value} value={dialect.value}>
                  {dialect.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {isTranspiling && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="flex items-center text-amber-500">
                <ArrowRightLeft className="size-3" />
              </span>
            }
          />
          <TooltipContent>Transpiling to {targetLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
