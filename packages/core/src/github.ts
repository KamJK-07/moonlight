/**
 * A small, direct GitHub REST API client — no octokit dependency, since
 * everything used here is a handful of well-documented endpoints and a
 * hand-rolled client keeps the surface easy to audit. Uses the platform's
 * global `fetch` (Node 18+, React Native, and Electron's renderer all
 * provide one).
 */

import { utf8ToBase64, base64ToUtf8 } from './base64';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

export class GithubApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`GitHub API error ${status}: ${body.slice(0, 200)}`);
    this.name = 'GithubApiError';
  }
}

export interface GithubRepoSummary {
  fullName: string; // "owner/repo"
  name: string;
  owner: string;
  private: boolean;
  updatedAt: string;
}

export type GithubActivityType = 'commit' | 'pull_request' | 'issue';

export interface GithubActivityItem {
  id: string;
  type: GithubActivityType;
  repo: string; // "owner/repo"
  title: string;
  url: string;
  date: string; // ISO
  state?: 'open' | 'closed' | 'merged';
}

export interface GithubIssueSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  body: string | null;
}

export interface GithubMilestone {
  id: string;
  title: string;
  dueOn: string | null; // ISO date, or null if the milestone has no due date
  url: string;
  repo: string;
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export class GithubClient {
  constructor(
    private token: string,
    private fetchImpl: FetchLike = globalThis.fetch,
  ) {
    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available on this platform.');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new GithubApiError(res.status, body);
    }
    return (await res.json()) as T;
  }

  async getViewerLogin(): Promise<string> {
    const user = await this.request<{ login: string }>('/user');
    return user.login;
  }

  async listRepos(): Promise<GithubRepoSummary[]> {
    const repos = await this.request<
      Array<{ full_name: string; name: string; owner: { login: string }; private: boolean; updated_at: string }>
    >('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator');
    return repos.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      updatedAt: r.updated_at,
    }));
  }

  /** Recent commits on the repo's default branch, newest first. */
  async listRecentCommits(fullName: string, limit = 10): Promise<GithubActivityItem[]> {
    const commits = await this.request<
      Array<{ sha: string; html_url: string; commit: { message: string; author: { date: string } | null } }>
    >(`/repos/${fullName}/commits?per_page=${limit}`);
    return commits.map((c) => ({
      id: c.sha,
      type: 'commit' as const,
      repo: fullName,
      title: c.commit.message.split('\n')[0] ?? c.sha.slice(0, 7),
      url: c.html_url,
      date: c.commit.author?.date ?? new Date().toISOString(),
    }));
  }

  async listPullRequests(
    fullName: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit = 10,
  ): Promise<GithubActivityItem[]> {
    const prs = await this.request<
      Array<{
        id: number;
        html_url: string;
        title: string;
        updated_at: string;
        state: 'open' | 'closed';
        merged_at: string | null;
      }>
    >(`/repos/${fullName}/pulls?state=${state}&per_page=${limit}&sort=updated&direction=desc`);
    return prs.map((pr) => ({
      id: String(pr.id),
      type: 'pull_request' as const,
      repo: fullName,
      title: pr.title,
      url: pr.html_url,
      date: pr.updated_at,
      state: pr.merged_at ? 'merged' : pr.state,
    }));
  }

  async listIssues(fullName: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GithubIssueSummary[]> {
    const issues = await this.request<
      Array<{ number: number; title: string; state: 'open' | 'closed'; html_url: string; body: string | null; pull_request?: unknown }>
    >(`/repos/${fullName}/issues?state=${state}&per_page=100`);
    // The issues endpoint also returns PRs; filter those out.
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, body: i.body }));
  }

  async listMilestones(fullName: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GithubMilestone[]> {
    const milestones = await this.request<
      Array<{ id: number; title: string; due_on: string | null; html_url: string; open_issues: number; closed_issues: number }>
    >(`/repos/${fullName}/milestones?state=${state}`);
    return milestones.map((m) => ({ id: String(m.id), title: m.title, dueOn: m.due_on, url: m.html_url, repo: fullName }));
  }

  async createIssue(fullName: string, title: string, body?: string): Promise<GithubIssueSummary> {
    const issue = await this.request<{ number: number; title: string; state: 'open' | 'closed'; html_url: string; body: string | null }>(
      `/repos/${fullName}/issues`,
      { method: 'POST', body: JSON.stringify({ title, body }) },
    );
    return { number: issue.number, title: issue.title, state: issue.state, url: issue.html_url, body: issue.body };
  }

  async setIssueState(fullName: string, number: number, state: 'open' | 'closed'): Promise<void> {
    await this.request(`/repos/${fullName}/issues/${number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state }),
    });
  }

  async getFileContent(fullName: string, path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const file = await this.request<{ content: string; sha: string }>(
        `/repos/${fullName}/contents/${path}`,
      );
      return { content: base64ToUtf8(file.content.replace(/\s/g, '')), sha: file.sha };
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async putFileContent(
    fullName: string,
    path: string,
    content: string,
    sha: string | undefined,
    message: string,
  ): Promise<{ sha: string }> {
    const body: { message: string; content: string; sha?: string } = {
      message,
      content: utf8ToBase64(content),
    };
    if (sha !== undefined) {
      body.sha = sha;
    }
    const res = await this.request<{ content: { sha: string } }>(`/repos/${fullName}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return { sha: res.content.sha };
  }

  /** Merges commit + PR activity across repos into one reverse-chronological feed. */
  async fetchActivityFeed(repoFullNames: string[], perRepo = 5): Promise<GithubActivityItem[]> {
    const results = await Promise.all(
      repoFullNames.map(async (repo) => {
        const [commits, prs] = await Promise.all([
          this.listRecentCommits(repo, perRepo).catch(() => []),
          this.listPullRequests(repo, 'all', perRepo).catch(() => []),
        ]);
        return [...commits, ...prs];
      }),
    );
    return results.flat().sort((a, b) => b.date.localeCompare(a.date));
  }
}
