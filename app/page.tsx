export default function Home() {
  return (
    <main>
      <h1>Inbox Verifier</h1>
      <p>Checks Gmail for verification / one-time codes on a Vercel Cron schedule.</p>

      <div className="card">
        <h2>Endpoints</h2>
        <ul>
          <li>
            <code>GET /api/check</code> — run a check (used by Vercel Cron).
          </li>
          <li>
            <code>POST /api/check</code> — manual trigger; send
            <code>Authorization: Bearer $CRON_SECRET</code> or <code>?key=$CRON_SECRET</code>.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Schedule</h2>
        <p>
          Configured in <code>vercel.json</code> as <code>0 */2 * * *</code> (every 2 hours, UTC).
        </p>
      </div>

      <div className="card">
        <h2>Setup</h2>
        <p>
          See <code>README.md</code> for creating Google OAuth credentials, minting refresh tokens,
          and setting the environment variables in Vercel.
        </p>
      </div>
    </main>
  );
}
