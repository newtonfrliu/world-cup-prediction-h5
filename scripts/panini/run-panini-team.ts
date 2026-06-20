import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

function getCountryArg() {
  const index = process.argv.indexOf("--country");
  const country = index >= 0 ? process.argv[index + 1] : "";

  if (!country) {
    throw new Error("Missing required argument: --country CountryName");
  }

  return country;
}

function run(script: string, country: string) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, script), "--country", country],
    {
      cwd: root,
      stdio: "inherit",
      shell: false,
    },
  );

  if (result.status !== 0) {
    console.error(`${script} failed with exit code ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const country = getCountryArg();

  run("scripts/panini/fetch-panini-team.ts", country);
  run("scripts/panini/process-panini-team.ts", country);
  run("scripts/panini/generate-team-review-html.ts", country);
}

main();
