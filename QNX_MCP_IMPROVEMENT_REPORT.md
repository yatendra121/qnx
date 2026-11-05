# QNX MCP Server: Improvement Report

| | |
|---|---|
| **Date** | 2026-11-05 |
| **Source of findings** | `QNX_MCP_USER_EVALUATION.md` (B1–B17, 13 scenarios) and new end-user testing |
| **Scope** | `packages/mcp`, plus a test cache setting in the workspace's Vite configs. No library source was changed |
| **Code status** | **On branch `fix/mcp-evaluation-findings`, not merged or deployed** |

## Status

| | Local build (this work) | Live `https://qnx-mcp-server.vercel.app/mcp` |
|---|---|---|
| **Code** | New | **Old code, still reporting 0.8.15** |
| **End-user suite** | **160/160** on each of Node 22, 24 and 26, on 3 instances behind a load balancer | **31/160**, tested from outside on 2026-11-05 |
| **Fixed?** | Yes, for everything marked Pass below | **No. None of these fixes are live** |

**The live endpoint is not fixed.** Everything marked "Local" was tested against a local build, not the live URL. The live result can only change after deployment, and the fixes then need retesting there.

**How to read 31/160:**
- It isn't a fair overall score for the old server. Many scenarios need capabilities that were never there, such as `diagnose-error`.
- I wrote both the fixes and this suite, so an independent rerun of your evaluation after deployment would be stronger evidence.

## 1. Issues and root causes

| Root cause | Findings | Where the fault lies |
|---|---|---|
| **Sessions lived in one instance's memory.** Vercel runs several instances, so a request reaching another one got a 404. Every tool is a pure function, so sessions held nothing useful. | B1 | Server |
| **Previews were hand-written copies of library behaviour,** and tests checked their shape, never the real result. | B2, B6, B8–B11, B13, B14 | Server |
| **Docs covered only the happy path.** README warnings never reached the server. | B3, B15, B17 | Server |
| **Library traps went unmentioned.** The behaviour comes from the libraries, and the server's fault was not warning about it. | B5, B7, B16 | Library behaviour, server docs |
| **The migration tool returned fixed text** that ignored the developer's code and changed status codes and error handling. | B4 | Server |
| **No tool could take in the developer's problem:** no error, code or question. | Scenarios 9–11 | Missing feature |
| **Failures weren't detectable:** no `isError`, and HTML error pages. | B12, low-severity items | Server |

### Found during this work, not in the evaluation

| Issue | Root cause | Outcome |
|---|---|---|
| **3 published packages were undiscoverable:** `@qnx/core-helpers`, `@qnx/interfaces`, `@qnx/message` | No tool covered them | Added `get-package-info` |
| **Library bug: the `Request` type in `@qnx/interfaces` isn't an Express request** | In the published `.d.ts`, the bundler renamed Express's `Request` but left `AuthRequest extends Request`, so it extends the global Fetch `Request`. It has no `params` or `query`, and `asyncValidatorHandler<Request>` fails with TS2344 | Library left unchanged. The server documents it, diagnoses it, and gives a tested alternative |
| **Node 26 words the broken-PEM error differently:** `Found a character that cannot be part of a valid base64 string` | Node 26 decodes base64 natively. Only the consumer suite on Node 26 caught this | Added to `diagnose-error` and the docs |
| **`review-code` and the migration tool could be blocked by crafted input** (about 8.4 s per request) | Scans ran from every match to the end of a 190 KB input, on a public endpoint | Scans and matches are now bounded. The worst of 58 hostile cases is 248 ms, and a test guards it |
| **Some "known errors" were missing:** `Invalid keyData`, `Invalid key length` | Found by probing real failures across Node versions | Added |

### Mistakes in my own earlier fixes, caught by this round

- The client docs said `ApiErrors` and `ApiErrorCode` "aren't exported". The published types do export them.
- The `safeHandler` example didn't compile under `--strict`.
- My earlier summary said "80 of 80" parallel calls in the 56-check retest. That retest made 84 calls, and the 80 came from a unit test. All succeeded, but the label was wrong.

## 2. Changes implemented

**Reliability**
- The HTTP server is now stateless, with a new server and transport per request, and answers in plain JSON.
- A raw client no longer needs a handshake. MCP clients can still call `initialize`, and a client holding an old session ID keeps working.

**Accuracy**
- `build-api-response` and `build-api-error` now run the real `@qnx/response` and `@qnx/errors` code.
- `build-file-log-entry` can't import `@qnx/winston`, because importing it creates a `logs` folder. It mirrors the logger instead, and a test compares it with real file output.
- `build-crypto-snippet` rejects combinations that would throw at runtime, and no longer invents a payload.

**Honest guidance**
- Corrected logging, client success checks, the 401 default and migrations that changed behaviour.
- Added warnings about stack traces reaching clients and about auth tokens never expiring.

**Error handling**
- Failed checks now return `isError` with what to change.
- Malformed JSON returns JSON-RPC `-32700`.
- Unknown paths and oversized bodies return JSON.
- An unknown stdio scope exits with a clear message.

**Discovery**
- The server now sends `instructions` on connect.
- Every tool has a title and read-only annotations.
- `listChanged` is now `false`, because the tool list never changes.
- CORS is enabled, and `/` describes the server.

**Tests that keep it honest**
- 306 unit and contract tests run generated code against the real libraries.
- A rerunnable consumer suite lives in `packages/mcp/e2e`.

## 3. Tools and capabilities

| Tool | Status | What it gives a developer |
|---|---|---|
| `get-package-info` | **New** | All 9 packages, install commands, peer dependencies, and every export with its signature |
| `diagnose-error` | **New** | Cause and fix for a pasted error. Says "No known match" rather than guessing |
| `search-docs` | **New** | Free-text search across docs, guides and known errors |
| `review-code` | **New** | Known mistakes in pasted code, with line numbers and fixes |
| `get-guide` | **New** | Tested guides: `crud-api`, `server-and-client`, `auth-session`, `production-checklist` |
| `transform-to-async-handler` | Improved | Accepts your code, keeps status codes, and lists behaviour changes |
| `build-api-response`, `build-api-error` | Improved | Run the real libraries and validate input |
| `build-crypto-snippet` | Improved | Checked combinations. Code compiles under `--strict` |
| `build-file-log-entry` | Improved | Matches real file output, and shows how to log an Error |
| `build-client-response` | Improved | Reports what getters really return |
| `build-console-log`, `list-mcp-tools` | Improved | `list-mcp-tools` now groups tools by task and lists only what the endpoint offers |
| 6 `get-*-docs` tools | Improved | New topics: install, setup, troubleshooting, logging errors, handling responses, server errors, API reference |

The full endpoint goes from 14 tools to 19, and scoped endpoints from 3–4 to 8–9.

**Components and composables:** the `@qnx/*` packages have none. They are Node.js and TypeScript libraries, and the server now says so directly when asked. "Public exports" covers functions, classes, constants and types.

## 4. Previously failed test cases

"Local" is the final build. "Live" is the old code, tested on 2026-11-05. IDs refer to `packages/mcp/e2e/consumer.mjs`.

### Findings

| ID | Finding | Local | Live | Evidence |
|---|---|---|---|---|
| B1 | Parallel calls fail | **Pass** | **Fail** | R1, R2 |
| B2 | Documented logging loses the error | **Pass** | **Fail** | T5, findings section |
| B3 | Client patterns misclassify responses | **Pass** | **Fail** | T2 |
| B4 | Migrations change behaviour | **Pass** | **Fail** | T8, T9, and unit tests running before and after |
| B5 | Stack traces reach clients, no warning | **Pass** (warned, with a workaround) | **Fail** | T7 |
| B6 | Snippets can't run | **Pass** | **Fail** | T4, V1 |
| B7 | Tokens never expire, unstated | **Pass** (stated, with a workaround) | **Fail** | T3 |
| B8 | 401 documented as 500 | **Pass** | **Fail** | Findings section |
| B9 | `build-api-error` differs from real classes | **Pass** | **Fail** | Findings section, V1 |
| B10 | `silly` previewed as written | **Pass** | **Fail** | Findings section |
| B11 | Required fields not enforced | **Pass** | **Fail** | T6, V1 |
| B12 | Failures lack `isError` | **Pass** | **Fail** | V1 |
| B13 | Snippets fail `tsc --strict` | **Pass** | **Fail** | T4 |
| B14 | `jweEncrypt` options wrong | **Pass** | **Fail** | Findings section, T4 |
| B15 | Incomplete install guidance | **Pass** | **Fail** | I1 |
| B16 | Library traps undocumented | **Pass** | **Fail** | X6, findings section |
| B17 | No key generation guidance | **Pass** | **Fail** | T3, X2 |

**Live reliability without retries** (final run): 2 parallel 5/6, 5 parallel 11/15, 10 parallel 8/30, 20 parallel 12/60, a realistic batch of 6 calls 8/24, sequential 60/60. The same suite locally: all succeeded.

### Low-severity items

| Item | Local | Live |
|---|---|---|
| No `all` for response docs | **Pass** | Fail |
| Contradictory `toSymmetricSecret` guidance, short example secret | **Pass** (unit test) | Not rechecked |
| Auth example missing an import | **Pass** | Fail |
| Malformed JSON returns HTML | **Pass** | Fail |
| Unknown path returns HTML | **Pass** | Fail |
| No CORS | **Pass** | Fail |
| Home link returns 404 | **Pass** | Fail |
| `listChanged: true` with no notifications | **Pass** (unit test) | Fail |
| Stdio accepts an unknown scope | **Pass** (packed install) | Not applicable to the URL |
| `build-client-response` shows `null` for `undefined` | **Pass** (replayed) | Not rechecked |
| **Unknown arguments silently ignored** | **Not changed** (deliberate, see section 6) | Same |

### The 13 scenarios from the evaluation

| # | Task | Evaluation | Local | Live |
|---|---|---|---|---|
| 1 | CRUD API with validation | Pass | **Pass** (T1, also compiles under `--strict`; also run on Express 4) | No guide. Basic docs still respond |
| 2 | Connect a frontend | Fail | **Pass** (T2) | Fail |
| 3 | Login with encrypted sessions | Partial | **Pass** (T3) | Fail |
| 4 | RS256 signing | Fail | **Pass** (T4) | Fail |
| 5 | Log production errors | Fail | **Pass** (T5) | Fail |
| 6 | Migrate legacy routes | Fail | **Pass** (T8, T9) | Fail |
| 7 | Harden error handling | Fail | **Pass** (T7) | Fail |
| 8 | Diagnose a missing JWT key | Partial | **Pass** (X1) | Fail |
| 9 | Diagnose a PEM with literal `\n` | Fail | **Pass** on Node 22, 24, 26 (X2) | Fail |
| 10 | `DELETE` returns 404 | Fail | **Pass** (X6) | Fail |
| 11 | Paste code for improvements | Fail | **Pass, within limits** (B1, B2) | Fail |
| 12 | Choose `@qnx/log` or `@qnx/winston` | Pass | **Pass** via `get-console-log-docs`. `search-docs` returns the package overview first, not the comparison | Not rechecked directly |
| 13 | Change validation status to 422 | Pass | **Pass** (T10) | Fails in the suite, which finds it through `search-docs`. The docs themselves are unchanged there |

## 5. End-user consumer testing

The suite connects with the official SDK and uses only what the endpoint returns. Commands it returns are really run in fresh projects. Code it returns is written to files, compiled with `tsc --strict` and run against packages from npm.

| Section | What a developer does | Local | Live |
|---|---|---|---|
| Connect and discover | Connect, learn what exists, try scoped endpoints and protocol versions | 18/18 | 2/18 |
| Reliability | Parallel and sequential calls, no retries | 6/6 | 1/6 |
| Install | Run the server's install command with `--legacy-peer-deps`, then import | 9/9 | 0/9 |
| Find exports | Check every export in each published `.d.ts` is documented, and search by name | 16/16 | 3/16 |
| Build features | CRUD API, frontend, login with generated keys, crypto, logging, previews against real Express, hardening, migration, small packages | 19/19 | 1/19 |
| Troubleshoot | Produce a real error, paste it in, and apply the fix where one can be applied | 21/21 | 0/21 |
| Find bugs | Review planted bugs on the right lines, apply fixes, review again | 2/2 | 0/2 |
| Invalid input | Missing and wrong parameters, malformed JSON, oversized bodies | 30/30 | 8/30 |
| Existing tools | All 14 original tools and every original option | 16/16 | **16/16** |
| Previous findings | Specific checks from the evaluation | 23/23 | 0/23 |
| **Total** | | **160/160** | **31/160** |

The live server does still connect reliably one call at a time, and all its original tools and options respond.

### Other regression checks (local)

| Check | Result |
|---|---|
| Evaluator's own 63 `build-*` cases replayed | 38 succeeded, 25 rejected with `isError`, no crashes, **no differences between HTTP and stdio** |
| Evaluator's own 44 docs calls replayed | All succeeded, identical on both transports |
| Unit and contract tests | 306 pass on Node 22, 24 and 26 |
| Clean checkout, no `dist` folders, as CI runs | Lint, typecheck, tests and both builds pass, for the MCP package |
| Packed stdio package installed from a tarball | Installs and runs. Unknown scope exits 1 |
| Deployment simulation | Clean install from the generated `package.json`, run from a read-only folder: all routes respond, 19 tools, no `logs` folder |
| CRUD guide on Express 4.22 | All 5 requests correct |
| Library source files changed | None. The test cache setting in `vite.config.base.ts` and the `app` and `my-lib` Vite configs did change |

The evaluator's Node 22 and the Node 26 gap are now covered. Express 4 was tested only for the CRUD guide.

## 6. Remaining limitations

**Not verified**
- **The live endpoint with these fixes.** The load balancer and read-only folder only simulate Vercel.
- **Graphical MCP hosts** such as Claude Desktop or Cursor. Only the official SDK and raw HTTP were used.
- **A real person or AI assistant new to the server.** The suite scripts developer tasks, so it can't judge how understandable the answers are.
- CommonJS consumers, Windows and Linux, real yarn or pnpm installs, and networks with a TLS-inspecting proxy.
- **A few `diagnose-error` entries** were matched from the error text rather than reproduced: read-only filesystem failures, `ERR_HTTP_HEADERS_SENT`, and old-server session errors.

**Limits of the tools**
- `review-code` and code migration use pattern matching, not a parser. They can miss problems or flag fine code, and each says so in its output. Migration gives line-by-line conversions, not a rewritten file.
- `diagnose-error` only knows its list of errors, plus related docs. That is deliberate: an unknown error gets "No known match", not an invented cause.
- `search-docs` is keyword search, so it doesn't understand questions the way a person would.
- There are no MCP resources or prompts, and no per-API version notes. Docs state the release they match and link to release notes.
- **Unknown arguments are still ignored,** to keep existing clients working rather than making a harmless extra field an error.
- The public endpoint has no rate limiting. Each request is bounded by a 1 MB body limit and the bounded scans.

**Behaviour that needs a library change** (documented with workarounds, as asked, and not changed)
- `@qnx/interfaces`: the `Request` type bug above.
- `@qnx/response`: stack traces reach clients, with no option to turn this off.
- `@qnx/crypto`: `generateAuthToken` has no expiry option.
- `@qnx/winston`: `{ error: err }` writes `{}`, importing it fails on a read-only filesystem, and its README still shows the faulty example.
- `@qnx/client`: no `serverError` getter or success helper.

**Fixed separately: flaky test runs**
- `app:test`, and occasionally other projects, failed with `ENOTEMPTY` on `node_modules/.vitest-cache`. All projects shared that one cache folder, and a process deletes it when it thinks the lockfile changed, even while others are writing to it.
- It happened often on the original development machine because of a leftover `packages/mcp/node_modules/.pnpm/lock.yaml` from an old standalone install. That file gives `mcp` a different hash, so the cache was wiped on every run. A real lockfile change could trigger the same failure on a clean install: 1 of 8 runs failed in that test.
- A clean CI install has no leftover, and all 5 clean runs passed. CI wasn't affected as things stand.
- Each project now has its own cache folder (`vitestModuleCachePath` in `vite.config.base.ts`). Repeated full runs after the fix: 0 of 10 failed on the development machine and 0 of 8 failed on a clean install with a simulated lockfile change.

### Behaviour changes to expect after deployment

- `GET` and `DELETE` on `/mcp` return 405, and no session IDs are issued.
- Bad input to `build-*` tools now returns `isError` rather than invented output. `custom-error` without `statusCode`, for example, used to preview a 400.
- `build-client-response` no longer lists unset getters as `null` in `methods`. They appear in `returnUndefined`.
- The published package now depends on `@qnx/response`.
- All 14 original tool names and all their original options are unchanged.

## 7. Deployment requirements

1. **Open a PR** for `fix/mcp-evaluation-findings`, ideally merged after [yatendra121/qnx#59](https://github.com/yatendra121/qnx/pull/59). The branch doesn't depend on #59 and its tests pass on `main`, but the server's docs say `@qnx/response` needs `@qnx/errors` 0.8.8 or later, which is only true once #59 is merged.
2. **Include the version plan,** which is already on the branch. It's a patch release, matching how recent releases were done.
3. **Merge to `main`.** Changes under `packages/mcp/**` trigger the Deploy MCP HTTP workflow. Its last run, on 2026-11-04, succeeded, so the deploy credentials currently work.
4. **Verify the live endpoint.** Only this step can show that it's fixed:

   ```bash
   pnpm --filter @qnx/mcp e2e https://qnx-mcp-server.vercel.app/mcp
   ```

   Expect 160/160. Then rerun your own evaluation.
5. **Publish a release** so that stdio users of `npx -y @qnx/mcp` get the fixes. The hosted deployment doesn't update them.

No new infrastructure, secrets or shared storage are needed, and the server adds no new third-party dependencies. `MCP_AUTH_TOKEN` stays optional.

## 8. Readiness assessment

| Dimension | Before (evaluation) | Local build | Live today |
|---|---|---|---|
| Connection and setup | Strong | Strong | Strong one call at a time |
| Reliability | Weak on hosted | Strong in simulation | **Weak** |
| Accuracy | Mixed | Strong: generated code runs against real packages | **Mixed** |
| API learning | Good, with gaps | Strong: all 9 packages, every export | **Gaps** |
| Bug finding and diagnosis | Absent | Useful for known `@qnx/*` issues, not general bugs | **Absent** |
| Migration | Harmful | Useful, needs review | **Harmful** |
| Production guidance | Weak | Good, with library limits stated | **Weak** |

**Live endpoint: not ready for real-world use as a trusted tool.** Parallel calls fail often, and following some of its guidance still produces defects.

**Local build: ready to deploy, and a good candidate for real-world use once the live checks pass.** In testing, scripted tasks could connect, discover packages, install, build features and troubleshoot using only its output. That supports your success criteria but doesn't yet prove them, because no real developer or AI host has used it, and it hasn't run on Vercel.

## Appendix: reproducing these results

| What | How |
|---|---|
| Consumer suite on any endpoint | `pnpm --filter @qnx/mcp e2e <url>` |
| Unit and contract tests | `npx nx run @qnx/mcp:test` |
| Scenario definitions | `packages/mcp/e2e/consumer.mjs` |
