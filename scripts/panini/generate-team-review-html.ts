import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ReviewStatus = "pending" | "approved" | "usable_low_quality" | "rejected";

type ProcessedRecord = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  source_url: string | null;
  source_path: string | null;
  processed_path: string | null;
  public_path: string | null;
  score: number;
  width: number | null;
  height: number | null;
  review_flags: string[];
  error?: string;
};

type ProcessedSummary = {
  generated_at: string;
  total_records: number;
  processed_count: number;
  missing_count: number;
  records: ProcessedRecord[];
};

type ReviewStatusRecord = {
  player_slug: string;
  player_name: string;
  output_path: string | null;
  source_url: string | null;
  review_flag: boolean;
  status: ReviewStatus;
  note: string;
};

type Candidate = {
  image_url: string;
  source_page: string;
  width: number | null;
  height: number | null;
  score_breakdown: Record<string, number>;
  total_score: number;
  local_path?: string;
};

type SourceRecord = {
  player_slug: string;
  candidates: Candidate[];
};

const root = process.cwd();
const statusOrder: Record<ReviewStatus, number> = {
  pending: 0,
  rejected: 1,
  usable_low_quality: 2,
  approved: 3,
};

function getCountryArg() {
  const index = process.argv.indexOf("--country");
  const country = index >= 0 ? process.argv[index + 1] : "";

  if (!country) {
    throw new Error("Missing required argument: --country CountryName");
  }

  return country;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function htmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toFileUrl(relativePath: string | null) {
  if (!relativePath) {
    return "";
  }

  return `../../..//${relativePath}`.replace(/\\/g, "/").replace("//", "/");
}

function getStatusLabel(status: ReviewStatus) {
  const labels: Record<ReviewStatus, string> = {
    approved: "APPROVED",
    pending: "PENDING",
    rejected: "REJECTED",
    usable_low_quality: "USABLE LOW QUALITY",
  };

  return labels[status];
}

function getFlagLabel(flag: string) {
  const labels: Record<string, string> = {
    "image width < 600": "image width < 600",
    "ratio 异常": "ratio abnormal",
    "score < 70": "low confidence",
    "无 Panini 关键词命中": "no panini keyword",
    "missing dimensions": "missing dimensions",
    "missing source image": "missing source image",
    "processing failed": "processing failed",
  };

  return labels[flag] ?? flag;
}

function ensureReviewStatus(summary: ProcessedSummary, reviewStatusPath: string) {
  const existing = existsSync(reviewStatusPath)
    ? JSON.parse(readFileSync(reviewStatusPath, "utf8")) as ReviewStatusRecord[]
    : [];
  const existingBySlug = new Map(existing.map((record) => [record.player_slug, record]));
  const nextRecords = summary.records.map((record) => {
    const existingRecord = existingBySlug.get(record.player_slug);

    if (existingRecord) {
      return existingRecord;
    }

    const reviewFlag = record.review_flags.length > 0;

    return {
      player_slug: record.player_slug,
      player_name: record.player_name,
      output_path: record.public_path,
      source_url: record.source_url,
      review_flag: reviewFlag,
      status: reviewFlag ? "pending" : "approved",
      note: record.review_flags.join(", "),
    } satisfies ReviewStatusRecord;
  });

  writeFileSync(reviewStatusPath, `${JSON.stringify(nextRecords, null, 2)}\n`, "utf8");

  return nextRecords;
}

function main() {
  const country = getCountryArg();
  const countrySlug = slugify(country);
  const processedRoot = path.join(root, "processed", "panini", countrySlug);
  const summaryPath = path.join(processedRoot, "processed-summary.json");
  const reviewStatusPath = path.join(root, "data", `panini-${countrySlug}-review-status.json`);
  const sourcesPath = path.join(root, "data", `panini-${countrySlug}-sources.json`);
  const reviewPath = path.join(processedRoot, "review.html");

  if (!existsSync(summaryPath)) {
    throw new Error("processed-summary.json not found. Run process-panini-team first.");
  }

  mkdirSync(processedRoot, { recursive: true });

  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as ProcessedSummary;
  const statusRecords = ensureReviewStatus(summary, reviewStatusPath);
  const sourceRecords = existsSync(sourcesPath)
    ? JSON.parse(readFileSync(sourcesPath, "utf8")) as SourceRecord[]
    : [];
  const statusBySlug = new Map(statusRecords.map((record) => [record.player_slug, record]));
  const sourceBySlug = new Map(sourceRecords.map((record) => [record.player_slug, record]));
  const decoratedRecords = summary.records
    .map((record) => {
      const statusRecord = statusBySlug.get(record.player_slug);
      const sourceRecord = sourceBySlug.get(record.player_slug);
      const candidate = sourceRecord?.candidates.find((item) => item.local_path === record.source_path)
        ?? sourceRecord?.candidates[0];

      return {
        ...record,
        status: statusRecord?.status ?? (record.review_flags.length > 0 ? "pending" : "approved"),
        note: statusRecord?.note ?? record.review_flags.join(", "),
        candidate,
      };
    })
    .sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return a.shirt_number - b.shirt_number;
    });

  const approvedCount = decoratedRecords.filter((record) => record.status === "approved").length;
  const pendingCount = decoratedRecords.filter((record) => record.status === "pending").length;
  const rejectedCount = decoratedRecords.filter((record) => record.status === "rejected").length;
  const usableCount = decoratedRecords.filter((record) => record.status === "usable_low_quality").length;

  const cards = decoratedRecords
    .map((record) => {
      const sourceSrc = toFileUrl(record.source_path);
      const processedSrc = record.processed_path
        ? path.basename(record.processed_path)
        : "";
      const flags = record.review_flags.length > 0
        ? record.review_flags.map(getFlagLabel)
        : ["OK"];
      const scoreBreakdown = record.candidate?.score_breakdown ?? {};
      const scoreRows = Object.keys(scoreBreakdown).length > 0
        ? Object.entries(scoreBreakdown)
            .map(([key, value]) => `<tr><td>${htmlEscape(key)}</td><td>${htmlEscape(value)}</td></tr>`)
            .join("")
        : `<tr><td colspan="2">No score breakdown</td></tr>`;

      return `
        <article class="card status-${htmlEscape(record.status)}" data-status="${htmlEscape(record.status)}">
          <header class="card-header">
            <div>
              <h2>#${htmlEscape(record.shirt_number)} ${htmlEscape(record.player_name)}</h2>
              <p>${htmlEscape(record.player_name_en)} · ${htmlEscape(record.position)} · score ${htmlEscape(record.score)}</p>
            </div>
            <span class="status-badge status-${htmlEscape(record.status)}">${getStatusLabel(record.status)}</span>
          </header>
          <ul class="flags">
            ${flags.map((flag) => `<li>${htmlEscape(flag)}</li>`).join("")}
          </ul>
          <div class="images">
            <figure>
              <figcaption>Raw</figcaption>
              ${sourceSrc ? `<img src="${htmlEscape(sourceSrc)}" loading="lazy" />` : `<div class="empty">missing</div>`}
            </figure>
            <figure>
              <figcaption>Processed 1024x1536</figcaption>
              ${processedSrc ? `<img src="${htmlEscape(processedSrc)}" loading="lazy" />` : `<div class="empty">missing</div>`}
            </figure>
          </div>
          <details>
            <summary>Source / score details</summary>
            <dl>
              <dt>source_url</dt>
              <dd>${record.source_url ? `<a href="${htmlEscape(record.source_url)}" target="_blank" rel="noreferrer">${htmlEscape(record.source_url)}</a>` : "missing"}</dd>
              <dt>source_page</dt>
              <dd>${record.candidate?.source_page ? `<a href="${htmlEscape(record.candidate.source_page)}" target="_blank" rel="noreferrer">${htmlEscape(record.candidate.source_page)}</a>` : "missing"}</dd>
              <dt>dimensions</dt>
              <dd>${htmlEscape(record.width)} x ${htmlEscape(record.height)}</dd>
              <dt>note</dt>
              <dd>${htmlEscape(record.note || "-")}</dd>
              ${record.error ? `<dt>error</dt><dd>${htmlEscape(record.error)}</dd>` : ""}
            </dl>
            <table>
              <thead>
                <tr><th>score_breakdown</th><th>value</th></tr>
              </thead>
              <tbody>${scoreRows}</tbody>
              <tfoot>
                <tr><th>total_score</th><th>${htmlEscape(record.score)}</th></tr>
              </tfoot>
            </table>
          </details>
        </article>
      `;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panini ${htmlEscape(country)} Review</title>
  <style>
    body { margin: 0; background: #f6f1e7; color: #071b3a; font-family: Arial, "Microsoft YaHei", sans-serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 18px 56px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 24px 0 14px; }
    .metric, .card { border: 1px solid rgba(7,27,58,.12); border-radius: 16px; background: white; box-shadow: 0 12px 30px rgba(7,27,58,.08); }
    .metric { padding: 16px; font-weight: 900; }
    .metric span { display: block; margin-top: 8px; color: #e63535; font-size: 26px; }
    .filters { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px 18px; padding: 12px 18px; background: rgba(246,241,231,.92); backdrop-filter: blur(12px); }
    .filters button { flex: 0 0 auto; border: 1px solid rgba(7,27,58,.16); border-radius: 999px; background: #fff; color: #071b3a; padding: 10px 14px; font-weight: 900; cursor: pointer; }
    .filters button.active { background: #071b3a; color: #fff; }
    .card { margin: 20px 0; padding: 18px; }
    .card.status-pending { border-color: #f6c84c; box-shadow: 0 12px 34px rgba(246,200,76,.2); }
    .card.status-rejected { border-color: #e63535; box-shadow: 0 12px 34px rgba(230,53,53,.18); }
    .card.status-approved { border-color: #38a169; }
    .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .card h2 { margin: 0; font-size: 22px; }
    .card p { margin: 6px 0 0; color: #4a6280; font-weight: 700; }
    .status-badge { flex: 0 0 auto; border-radius: 999px; padding: 8px 10px; font-size: 12px; font-weight: 1000; letter-spacing: .08em; }
    .status-badge.status-approved { background: #e3f9e5; color: #0f7b3f; }
    .status-badge.status-pending { background: #fff4bd; color: #8a5a00; }
    .status-badge.status-rejected { background: #fde8e8; color: #9b1c1c; }
    .status-badge.status-usable_low_quality { background: #e0f2fe; color: #075985; }
    .flags { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
    .flags li { border-radius: 999px; background: #f1f5f9; color: #4a6280; padding: 6px 9px; font-size: 12px; font-weight: 900; }
    .images { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 16px; }
    figure { margin: 0; border-radius: 14px; background: #f1f5f9; padding: 10px; }
    figcaption { margin-bottom: 8px; font-size: 12px; font-weight: 900; color: #627d98; text-transform: uppercase; letter-spacing: .08em; }
    img { display: block; width: 100%; max-height: 560px; object-fit: contain; border-radius: 10px; background: #f6f1e7; }
    .empty { min-height: 240px; display: grid; place-items: center; color: #829ab1; font-weight: 900; }
    details { margin-top: 16px; border-radius: 14px; background: #f8fafc; padding: 12px; }
    summary { cursor: pointer; font-weight: 1000; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; margin: 16px 0 0; font-size: 13px; }
    dt { color: #627d98; font-weight: 900; }
    dd { margin: 0; overflow-wrap: anywhere; font-weight: 700; }
    table { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 13px; background: white; border-radius: 12px; overflow: hidden; }
    th, td { border-bottom: 1px solid #e4e7eb; padding: 8px 10px; text-align: left; }
    tfoot th { color: #e63535; }
    a { color: #d64545; }
  </style>
</head>
<body>
  <main>
    <h1>Panini ${htmlEscape(country)} Review</h1>
    <p>Generated at ${htmlEscape(summary.generated_at)}</p>
    <section class="summary">
      <div class="metric">Total<span>${summary.total_records}</span></div>
      <div class="metric">Approved<span>${approvedCount}</span></div>
      <div class="metric">Pending<span>${pendingCount}</span></div>
      <div class="metric">Rejected<span>${rejectedCount}</span></div>
      <div class="metric">Usable low quality<span>${usableCount}</span></div>
    </section>
    <nav class="filters" aria-label="Review filters">
      <button type="button" class="active" data-filter="all">All (${decoratedRecords.length})</button>
      <button type="button" data-filter="approved">Approved (${approvedCount})</button>
      <button type="button" data-filter="pending">Pending (${pendingCount})</button>
      <button type="button" data-filter="rejected">Rejected (${rejectedCount})</button>
    </nav>
    <section id="cards">${cards}</section>
  </main>
  <script>
    const buttons = Array.from(document.querySelectorAll(".filters button"));
    const cards = Array.from(document.querySelectorAll(".card"));
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        buttons.forEach((item) => item.classList.toggle("active", item === button));
        cards.forEach((card) => {
          card.style.display = filter === "all" || card.dataset.status === filter ? "" : "none";
        });
      });
    });
  </script>
</body>
</html>`;

  writeFileSync(reviewPath, html, "utf8");
  console.log(`Review: ${path.relative(root, reviewPath)}`);
  console.log(`Review status: ${path.relative(root, reviewStatusPath)}`);
}

main();
