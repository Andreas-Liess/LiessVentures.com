# Think Tank Setup

This project keeps the browser fully stateless and secret-free. The Think Tank
frontend calls only relative `/api/thinktank/*` paths. NVIDIA credentials,
Redis/KV, PDF parsing, and Google archive logging all run server-side.

## Required Vercel Storage

Create and connect a Vercel KV database in the Vercel dashboard:

1. Open Storage.
2. Create a KV database.
3. Connect it to this project.

Vercel will provide the required `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and
related variables automatically.

The code also supports the newer Upstash Redis variable names:

```text
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Note: current npm output marks `@vercel/kv` as deprecated and points new storage
setups toward Vercel Marketplace Redis/Upstash. This implementation keeps
`@vercel/kv` because the requested architecture names Vercel KV explicitly, and
the package still resolves through Upstash Redis under the hood.

## Required NVIDIA Variable

Set this in Vercel project settings:

```text
NVIDIA_API_KEY=...
```

Do not put the key in browser code. For local testing, keep temporary key files
out of Git. `.gitignore` already excludes `api/nvidea_api.txt` and
`api/nvidia_api.txt`.

## Anonymous Google Archive

When `/api/thinktank/end-scene.js` creates a manifest, it also attempts to
archive the original question and manifest output to Google Forms/Sheets.

Default behavior uses the existing Firepit Google Form endpoint with synthetic
anonymous fields:

```text
name: Think Tank Archive
email: anonymous-thinktank@liessventures.local
thought: question + consensus + open questions + manifest
analytics: JSON metadata without sessionId or user identity
```

For a separate Think Tank table, create a new Google Form and set these optional
environment variables:

```text
THINKTANK_LOG_GOOGLE_FORM_URL=https://docs.google.com/forms/d/e/.../formResponse
THINKTANK_LOG_ENTRY_PROBLEM=entry.x
THINKTANK_LOG_ENTRY_CONSENSUS=entry.x
THINKTANK_LOG_ENTRY_OPEN_QUESTIONS=entry.x
THINKTANK_LOG_ENTRY_MANIFEST=entry.x
THINKTANK_LOG_ENTRY_METADATA=entry.x
THINKTANK_LOG_ENTRY_LOG_ID=entry.x
THINKTANK_LOG_ENTRY_SESSION_NUMBER=entry.x
```

Only the fields you configure are submitted. To disable archive logging:

```text
THINKTANK_GOOGLE_LOG_DISABLED=true
```

The archive does not include a session id, email, account id, or IP address from
the app. The submitted question itself can still contain personal data if a user
types it into the problem field.

## Files

Frontend:

- `thinktank/index.html`
- `thinktank/styles.css`
- `thinktank/app.js`
- `thinktank/modules/`

The frontend currently remains in `app.js` for a behavior-preserving first pass.
`thinktank/modules/` is reserved for the next split into API client, state,
rendering, flow controller, advisor input, and between-meetings modules.

API handlers:

- `api/thinktank/create-session.js`
- `api/thinktank/orchestrate-turn.js`
- `api/thinktank/generate-message.js`
- `api/thinktank/insert-comment.js`
- `api/thinktank/end-scene.js`
- `api/thinktank/generate-between-meeting-scene.js`
- `api/thinktank/extract-pdf.js`
- `api/thinktank/get-session.js`
- `api/thinktank/start-next-session.js`
- `api/thinktank/health.js`

API internals:

- `api/thinktank/lib/shared.js`
- `api/thinktank/lib/constants.js`
- `api/thinktank/lib/kv.js`
- `api/thinktank/lib/nvidia.js`
- `api/thinktank/lib/session-store.js`
- `api/thinktank/lib/google-log.js`
- `api/thinktank/lib/prompts/`

Root-level Think Tank API files remain as compatibility wrappers only. They
re-export the new handlers and contain no duplicate implementation logic.

## Local Development

Install dependencies and run Vercel locally:

```bash
npm install
npm run dev
```

The static page is available at `/thinktank/`.

## Health Check

After deploying, open:

```text
/api/thinktank/health
```

This checks whether Redis/KV credentials are present and writable without
exposing secret values. For a deeper check that also calls NVIDIA, open:

```text
/api/thinktank/health?deep=1
```

If `/api/thinktank/create-session` fails, its JSON response includes a safe
`details.stage` field such as `nvidia_persona_generation`, `parse_personas`, or
`kv_write`.

## Meeting Cadence

Users configure the number of public meetings from 1 to 4. Each meeting has a
fixed hard cap of 8 public persona messages. The orchestrator can still end a
meeting earlier whenever the discussion has reached a natural manifest point.
After the user starts the simulation from the problem form, the browser drives
the full sequence automatically while the tab remains open.

## Goal And Framework State

Session creation stores a compact `goalBrief` on the session:

```text
actualQuestion, desiredOutput, decision, constraints, successCriteria, unknowns, problemType
```

Each persona also stores `optionalFrameworks`, a deterministic 1-3 item shortlist
from the local framework library. Frameworks are passed in user prompts only and
are explicitly optional thinking aids, not system instructions.

Between meetings, the browser automatically generates one internal scene per
persona, then starts the next meeting. On the final meeting, the session ends
after the manifest instead of continuing into another between-meetings cycle.

## Anonymous Advisor Input

The Anonymous Advisor input is visible throughout the app. Pressing Enter submits
the message; Shift+Enter inserts a newline. Submitting a message implicitly
pauses automatic AI continuation. If an AI request is already in flight, the
message is queued and inserted immediately after that request finishes.

Anonymous Advisor messages are stored in the public transcript with
`speaker: "anonymous_advisor"` and do not increment the public persona message
counter. The orchestrator and personas are instructed that Anonymous Advisor is
an in-room participant, not a controller or system voice.

After every completed AI persona message, the frontend waits 1000ms before
triggering another automatic AI request.
