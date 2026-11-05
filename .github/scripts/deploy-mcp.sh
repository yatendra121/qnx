#!/usr/bin/env bash
# Pushes the built MCP HTTP server to the repository the live deployment is built from.
# Each failure prints an ::error:: annotation, which is readable without signing in to GitHub.
set -euo pipefail

fail() {
    echo "::error::$1"
    exit 1
}

[ -n "${DEPLOY_REPO_TOKEN:-}" ] || fail "The DEPLOY_REPO_TOKEN secret is not set."
[ -n "${DEPLOY_REPO:-}" ] || fail "The DEPLOY_REPO secret is not set. It should look like owner/repo."
[ -d packages/mcp/http ] || fail "packages/mcp/http is missing. Build the HTTP server first."

# Fail instead of waiting for a password if the token is rejected.
export GIT_TERMINAL_PROMPT=0
remote="https://x-access-token:${DEPLOY_REPO_TOKEN}@github.com/${DEPLOY_REPO}"

git ls-remote "$remote" >/dev/null ||
    fail "Cannot read the deployment repository. Authentication failed above means DEPLOY_REPO_TOKEN was rejected. Repository not found means it has no access to the repository, DEPLOY_REPO is wrong, or the checkout saved its own token."

git clone "$remote" deploy-repo
cp -r packages/mcp/http/. deploy-repo/
cd deploy-repo

# Vercel checks the commit author, so commit as the person who triggered the run.
git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"
git config user.name "${GITHUB_ACTOR}"

git add .
if git diff --staged --quiet; then
    echo "No changes to deploy"
    exit 0
fi

git commit -m "deploy: ${GITHUB_SHA}"
git push ||
    fail "Cannot push to the deployment repository. DEPLOY_REPO_TOKEN can read it, so it probably lacks write access (Contents: write), or the branch rejects direct pushes."
