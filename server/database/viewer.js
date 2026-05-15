/**
 * Browser database viewer for the optimized quiz schema.
 */

const { query } = require("./index");
const users = require("./users");
const videos = require("./videos");
const sessions = require("./sessions");
const rankings = require("./rankings");
const scores = require("./scores");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortText(value, limit = 48) {
  const text = String(value || "-");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function table(headers, rows, options = {}) {
  const pageSize = options.pageSize || 10;
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowHtml = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
        )
        .join("")
    : `<tr class="empty-row"><td colspan="${headers.length}" class="empty">No data yet</td></tr>`;

  return `
    <div class="table-shell" data-page-size="${escapeHtml(pageSize)}">
      <div class="table-scroll">
        <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table>
      </div>
      <div class="table-footer">
        <span class="row-count"></span>
        <div class="pagination">
          <button type="button" class="page-prev">Prev</button>
          <span class="page-status"></span>
          <button type="button" class="page-next">Next</button>
        </div>
      </div>
    </div>`;
}

async function getSummary() {
  const rows = await query(`
    SELECT
      (SELECT COUNT(*) FROM videos) as videos,
      (SELECT COUNT(*) FROM quiz_sessions) as sessions,
      (SELECT COUNT(*) FROM quiz_runs) as questions,
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM quiz_responses) as responses,
      (SELECT COALESCE(AVG(total_responses), 0) FROM quiz_runs WHERE finalized_at IS NOT NULL) as avg_participation
  `);
  return rows[0] || {};
}

async function renderDatabaseViewer() {
  const summary = await getSummary();
  const allVideos = await videos.getAllVideos(25);
  const allSessions = await sessions.getAllSessions(25);
  const allRuns = await rankings.getAllTimerRankings(50);
  const allResponses = await rankings.getAllUserResponses(100);
  const allUsers = await users.getTopUsers(25);
  const recentSession = allSessions[0]?.session_id || allSessions[0]?.id || null;
  const sessionLeaderboard = recentSession
    ? await scores.getSessionLeaderboard(recentSession, 25)
    : [];

  const runRows = allRuns.map((run) => [
    `<code>${escapeHtml(run.run_id || run.timer_id)}</code>`,
    escapeHtml(run.session_id),
    escapeHtml(`${run.duration_seconds || run.duration}s`),
    escapeHtml(run.question_type || "mcq"),
    escapeHtml(run.correct_answer || "-"),
    escapeHtml(run.total_responses || 0),
    escapeHtml(run.correct_count ?? run.total_participants ?? 0),
    `<a href="/api/rankings/${encodeURIComponent(run.run_id || run.timer_id)}">JSON</a>`,
  ]);

  const responseRows = allResponses.map((response) => [
    `<code>${escapeHtml(response.run_id || response.timer_id)}</code>`,
    escapeHtml(response.username),
    escapeHtml(response.raw_answer || response.message || "-"),
    escapeHtml(response.is_correct ? "Yes" : "No"),
    escapeHtml(response.answer_count || 1),
    escapeHtml(`${Number(response.response_time_ms || 0)} ms`),
    escapeHtml(response.question_rank || response.rank || "-"),
  ]);

  const leaderboardRows = sessionLeaderboard.map((row, index) => [
    escapeHtml(index + 1),
    escapeHtml(row.username),
    escapeHtml(row.total_points),
    escapeHtml(`${row.correct_answers}/${row.total_answers}`),
    escapeHtml(`${Math.round(row.avg_response_time_ms || 0)} ms`),
  ]);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Infinity Quiz Database</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f6f7f9; color: #1f2933; }
    header { background: #111827; color: white; padding: 22px 28px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    main { padding: 24px 28px 40px; }
    nav { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    nav a { color: #c7d2fe; text-decoration: none; font-size: 14px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .card .label { color: #64748b; font-size: 12px; text-transform: uppercase; }
    .card .value { color: #0f172a; font-size: 26px; font-weight: 700; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #eef2f7; text-align: left; font-size: 13px; vertical-align: top; }
    th { position: sticky; top: 0; z-index: 1; background: #e8edf3; color: #334155; font-weight: 700; }
    code { background: #eef2ff; color: #3730a3; padding: 2px 5px; border-radius: 4px; font-size: 12px; }
    a { color: #2563eb; }
    .empty { color: #64748b; text-align: center; padding: 18px; }
    .section { margin-top: 22px; }
    .table-shell { background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .table-scroll { max-height: 380px; overflow: auto; }
    .table-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 9px 10px; background: #f8fafc; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; }
    .pagination { display: flex; align-items: center; gap: 8px; }
    .pagination button { border: 1px solid #cbd5e1; background: white; color: #334155; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.45; cursor: not-allowed; }
    .page-status { color: #475569; min-width: 74px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>Infinity Quiz Database</h1>
    <nav>
      <a href="#summary">Summary</a>
      <a href="#sessions">Sessions</a>
      <a href="#questions">Questions</a>
      <a href="#responses">Responses</a>
      <a href="#leaderboard">Leaderboard</a>
      <a href="/api/stats">Stats JSON</a>
    </nav>
  </header>
  <main>
    <section id="summary">
      <div class="cards">
        <div class="card"><div class="label">Videos</div><div class="value">${escapeHtml(summary.videos || 0)}</div></div>
        <div class="card"><div class="label">Sessions</div><div class="value">${escapeHtml(summary.sessions || 0)}</div></div>
        <div class="card"><div class="label">Questions</div><div class="value">${escapeHtml(summary.questions || 0)}</div></div>
        <div class="card"><div class="label">Users</div><div class="value">${escapeHtml(summary.users || 0)}</div></div>
        <div class="card"><div class="label">Responses</div><div class="value">${escapeHtml(summary.responses || 0)}</div></div>
        <div class="card"><div class="label">Avg Participation</div><div class="value">${escapeHtml(Number(summary.avg_participation || 0).toFixed(1))}</div></div>
      </div>
    </section>

    <section id="videos" class="section">
      <h2>Recent Videos</h2>
      ${table(["Video", "Channel", "Title", "Views", "Questions"], allVideos.map((video) => [
        `<a href="https://youtube.com/watch?v=${encodeURIComponent(video.video_id)}" target="_blank">${escapeHtml(video.video_id)}</a>`,
        escapeHtml(video.channel_name || "-"),
        escapeHtml(shortText(video.title)),
        escapeHtml(Number(video.approx_views || 0).toLocaleString()),
        escapeHtml(video.questions_asked || 0),
      ]), { pageSize: 8 })}
    </section>

    <section id="sessions" class="section">
      <h2>Recent Sessions</h2>
      ${table(["Session ID", "Video", "Started", "Ended", "Runs", "Responses", "Correct"], allSessions.map((session) => [
        `<code>${escapeHtml(session.session_id || session.id)}</code>`,
        escapeHtml(session.video_id),
        escapeHtml(session.started_at || "-"),
        escapeHtml(session.ended_at || "Active"),
        escapeHtml(session.total_timer_runs || 0),
        escapeHtml(session.total_responses || 0),
        escapeHtml(session.total_correct || 0),
      ]), { pageSize: 8 })}
    </section>

    <section id="questions" class="section">
      <h2>Questions / Runtime Runs</h2>
      ${table(["Run ID", "Session", "Duration", "Type", "Answer", "Responses", "Correct", "Details"], runRows, { pageSize: 10 })}
    </section>

    <section id="responses" class="section">
      <h2>Recent Responses</h2>
      ${table(["Run ID", "Username", "Answer", "Correct", "Answer Count", "Time Taken", "Question Rank"], responseRows, { pageSize: 12 })}
    </section>

    <section id="leaderboard" class="section">
      <h2>Latest Session Leaderboard</h2>
      ${table(["Rank", "Username", "Points", "Correct/Total", "Avg Correct Time"], leaderboardRows, { pageSize: 10 })}
    </section>

    <section id="users" class="section">
      <h2>Most Active Users</h2>
      ${table(["Username", "First Seen", "Last Active", "Messages"], allUsers.map((user) => [
        escapeHtml(user.username),
        escapeHtml(user.first_seen || "-"),
        escapeHtml(user.last_active || "-"),
        escapeHtml(user.total_comment_count || 0),
      ]), { pageSize: 10 })}
    </section>
  </main>
  <script>
    document.querySelectorAll(".table-shell").forEach((shell) => {
      const pageSize = Number(shell.dataset.pageSize || 10);
      const rows = Array.from(shell.querySelectorAll("tbody tr:not(.empty-row)"));
      const rowCount = shell.querySelector(".row-count");
      const controls = shell.querySelector(".pagination");
      const prev = shell.querySelector(".page-prev");
      const next = shell.querySelector(".page-next");
      const status = shell.querySelector(".page-status");
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      let page = 0;

      if (rows.length <= pageSize) {
        controls.style.display = "none";
      }

      function renderPage() {
        rows.forEach((row, index) => {
          const visible = index >= page * pageSize && index < (page + 1) * pageSize;
          row.style.display = visible ? "" : "none";
        });

        const shownStart = rows.length ? page * pageSize + 1 : 0;
        const shownEnd = Math.min(rows.length, (page + 1) * pageSize);
        rowCount.textContent = rows.length
          ? "Showing " + shownStart + "-" + shownEnd + " of " + rows.length
          : "No rows";
        status.textContent = "Page " + (page + 1) + " / " + totalPages;
        prev.disabled = page === 0;
        next.disabled = page >= totalPages - 1;
      }

      prev.addEventListener("click", () => {
        page = Math.max(0, page - 1);
        renderPage();
      });
      next.addEventListener("click", () => {
        page = Math.min(totalPages - 1, page + 1);
        renderPage();
      });

      renderPage();
    });
  </script>
</body>
</html>`;
}

module.exports = {
  renderDatabaseViewer,
};
