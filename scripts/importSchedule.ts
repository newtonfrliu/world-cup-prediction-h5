import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database";

type SqlValue = string | number | null;
type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];

const sqlFilePath = path.join(process.cwd(), "world_cup_2026_schedule_seed.sql");
const envFilePath = path.join(process.cwd(), ".env.local");

const matchColumns = new Set<keyof MatchInsert>([
  "id",
  "home_team",
  "away_team",
  "start_time",
  "odds_home",
  "odds_draw",
  "odds_away",
  "stage",
  "venue",
  "result",
  "status",
  "created_at",
]);

function loadLocalEnv() {
  if (!existsSync(envFilePath)) {
    return;
  }

  const envText = readFileSync(envFilePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function splitTopLevelValues(valuesSql: string) {
  const rows: string[] = [];
  let depth = 0;
  let inString = false;
  let rowStart = -1;

  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];
    const nextChar = valuesSql[index + 1];

    if (char === "'" && inString && nextChar === "'") {
      index += 1;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "(") {
      if (depth === 0) {
        rowStart = index + 1;
      }

      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0 && rowStart !== -1) {
        rows.push(valuesSql.slice(rowStart, index));
        rowStart = -1;
      }
    }
  }

  return rows;
}

function splitRowValues(rowSql: string) {
  const values: string[] = [];
  let inString = false;
  let valueStart = 0;

  for (let index = 0; index < rowSql.length; index += 1) {
    const char = rowSql[index];
    const nextChar = rowSql[index + 1];

    if (char === "'" && inString && nextChar === "'") {
      index += 1;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      continue;
    }

    if (char === "," && !inString) {
      values.push(rowSql.slice(valueStart, index).trim());
      valueStart = index + 1;
    }
  }

  values.push(rowSql.slice(valueStart).trim());
  return values;
}

function parseSqlValue(value: string): SqlValue {
  if (/^null$/i.test(value)) {
    return null;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return value;
}

function parseMatches(sql: string) {
  const inserts: MatchInsert[] = [];
  const insertPattern =
    /insert\s+into\s+(?:(?:"?public"?\.)?)"?matches"?\s*\(([\s\S]*?)\)\s*values\s*([\s\S]*?);/gi;

  for (const match of sql.matchAll(insertPattern)) {
    const columns = match[1]
      .split(",")
      .map((column) => column.trim().replaceAll('"', ""))
      .filter(Boolean);
    const rows = splitTopLevelValues(match[2]);

    for (const row of rows) {
      const values = splitRowValues(row).map(parseSqlValue);
      const record: Partial<MatchInsert> = {};

      columns.forEach((column, index) => {
        if (matchColumns.has(column as keyof MatchInsert)) {
          const key = column as keyof MatchInsert;
          record[key] = values[index] as never;
        }
      });

      inserts.push(record as MatchInsert);
    }
  }

  return inserts;
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const sql = await readFile(sqlFilePath, "utf8");
  const matches = parseMatches(sql);

  if (matches.length === 0) {
    throw new Error("No INSERT INTO matches rows found.");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  const { error: deleteError } = await supabase
    .from("matches")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await supabase.from("matches").insert(matches);

  if (insertError) {
    throw insertError;
  }

  console.log(`Imported ${matches.length} matches`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

export {};
