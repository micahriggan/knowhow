import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import { execCommand } from "../execCommand";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function getPullRequest(url: string) {
  const [owner, repo, _, pullNumber] = url.split("/").slice(-4);
  const pullRequest = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(pullNumber, 10),
  });

  return pullRequest;
}

export async function getPullRequestBuildStatuses(url: string) {
  const [owner, repo, _, pullNumber] = url.split("/").slice(-4);

  const pullRequest = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: parseInt(pullNumber, 10),
  });

  const { data: statuses } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: pullRequest.data.head.sha,
  });

  return statuses;
}

export async function getRunLogs(runId: number, owner: string, repo: string) {
  const logs = await execCommand(
    `gh run view ${runId} -R ${owner}/${repo} --log`
  );
  return logs;
}

export async function getPullRequestBuildFailureLogs(url: string) {
  const [owner, repo, _, pullNumber] = url.split("/").slice(-4);
  const statuses = await getPullRequestBuildStatuses(url);
  const failures = statuses.check_runs.filter(
    (status) => status.conclusion === "failure"
  );

  if (failures.length === 0) {
    return "No failures found";
  }

  const allLogs = [];
  for (const fail of failures) {
    const [runId, __, jobId] = fail.details_url.split("/").slice(-3);
    const logs = await execCommand(
      `gh run view ${runId} -R ${owner}/${repo} --log | grep -E 'FAIL|ERROR' -A 25 -B 25`
    );
    return logs;
    allLogs.push(logs);
  }

  return allLogs;
}
