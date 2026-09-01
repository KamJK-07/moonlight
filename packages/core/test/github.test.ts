import { GithubClient, GithubApiError } from '../src/github';
import { utf8ToBase64 } from '../src/base64';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('GithubClient', () => {
  it('sends bearer auth and the pinned API version on every request', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ login: 'kameron' }));
    const client = new GithubClient('secret-token', fetchMock);
    await client.getViewerLogin();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    );
  });

  it('throws GithubApiError with the status code on a non-ok response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ message: 'Bad credentials' }, false, 401));
    const client = new GithubClient('bad-token', fetchMock);
    await expect(client.getViewerLogin()).rejects.toThrow(GithubApiError);
    await expect(client.getViewerLogin()).rejects.toMatchObject({ status: 401 });
  });

  it('maps repo list responses into GithubRepoSummary', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse([
        { full_name: 'kameron/worklight', name: 'worklight', owner: { login: 'kameron' }, private: true, updated_at: '2026-08-30T00:00:00Z' },
      ]),
    );
    const client = new GithubClient('t', fetchMock);
    const repos = await client.listRepos();
    expect(repos).toEqual([
      { fullName: 'kameron/worklight', name: 'worklight', owner: 'kameron', private: true, updatedAt: '2026-08-30T00:00:00Z' },
    ]);
  });

  it('filters pull requests out of the issues list', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse([
        { number: 1, title: 'Real issue', state: 'open', html_url: 'u1', body: null },
        { number: 2, title: 'Actually a PR', state: 'open', html_url: 'u2', body: null, pull_request: {} },
      ]),
    );
    const client = new GithubClient('t', fetchMock);
    const issues = await client.listIssues('kameron/worklight');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.number).toBe(1);
  });

  it('merges commits and PRs across repos into one feed, newest first', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/commits')) {
        return Promise.resolve(
          jsonResponse([
            { sha: 'abc1234', html_url: 'c1', commit: { message: 'Old commit', author: { date: '2026-08-01T00:00:00Z' } } },
          ]),
        );
      }
      if (url.includes('/pulls')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, html_url: 'p1', title: 'New PR', updated_at: '2026-08-30T00:00:00Z', state: 'open', merged_at: null },
          ]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    const client = new GithubClient('t', fetchMock);
    const feed = await client.fetchActivityFeed(['kameron/worklight']);
    expect(feed.map((item) => item.title)).toEqual(['New PR', 'Old commit']);
  });

  it('maps milestone responses into GithubMilestone', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse([
        { id: 9, title: 'v1.0', due_on: '2026-09-15T07:00:00Z', html_url: 'm1', open_issues: 2, closed_issues: 1 },
        { id: 10, title: 'Backlog', due_on: null, html_url: 'm2', open_issues: 3, closed_issues: 0 },
      ]),
    );
    const client = new GithubClient('t', fetchMock);
    const milestones = await client.listMilestones('kameron/worklight');
    expect(milestones).toEqual([
      { id: '9', title: 'v1.0', dueOn: '2026-09-15T07:00:00Z', url: 'm1', repo: 'kameron/worklight' },
      { id: '10', title: 'Backlog', dueOn: null, url: 'm2', repo: 'kameron/worklight' },
    ]);
  });

  it('does not let one failing repo take down the whole activity feed', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('good-repo')) {
        return Promise.resolve(
          url.includes('/commits')
            ? jsonResponse([{ sha: 's', html_url: 'u', commit: { message: 'ok', author: { date: '2026-08-30T00:00:00Z' } } }])
            : jsonResponse([]),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'not found' }, false, 404));
    });
    const client = new GithubClient('t', fetchMock);
    const feed = await client.fetchActivityFeed(['kameron/broken-repo', 'kameron/good-repo']);
    expect(feed).toHaveLength(1);
    expect(feed[0]?.title).toBe('ok');
  });

  describe('getFileContent', () => {
    it('decodes base64 content (with embedded newlines) and returns the sha', async () => {
      const encoded = utf8ToBase64('{"hello":"world 🚀"}');
      const wrapped = `${encoded.slice(0, 10)}\n${encoded.slice(10)}\n`;
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ content: wrapped, sha: 'abc123' }));
      const client = new GithubClient('t', fetchMock);
      const result = await client.getFileContent('kameron/data', 'moonlight-data.json');
      expect(result).toEqual({ content: '{"hello":"world 🚀"}', sha: 'abc123' });
    });

    it('returns null on a 404 instead of throwing', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ message: 'Not Found' }, false, 404));
      const client = new GithubClient('t', fetchMock);
      const result = await client.getFileContent('kameron/data', 'moonlight-data.json');
      expect(result).toBeNull();
    });

    it('re-throws non-404 errors', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ message: 'Bad credentials' }, false, 401));
      const client = new GithubClient('t', fetchMock);
      await expect(client.getFileContent('kameron/data', 'moonlight-data.json')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('putFileContent', () => {
    it('base64-encodes the content and omits sha when creating a new file', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ content: { sha: 'new-sha' } }));
      const client = new GithubClient('t', fetchMock);
      const result = await client.putFileContent(
        'kameron/data',
        'moonlight-data.json',
        '{"a":1}',
        undefined,
        'Sync from Moonlight',
      );
      expect(result).toEqual({ sha: 'new-sha' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/repos/kameron/data/contents/moonlight-data.json');
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ message: 'Sync from Moonlight', content: utf8ToBase64('{"a":1}') });
      expect(body.sha).toBeUndefined();
    });

    it('includes sha when updating an existing file', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ content: { sha: 'updated-sha' } }));
      const client = new GithubClient('t', fetchMock);
      const result = await client.putFileContent(
        'kameron/data',
        'moonlight-data.json',
        '{"a":2}',
        'old-sha',
        'Sync from Moonlight',
      );
      expect(result).toEqual({ sha: 'updated-sha' });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        message: 'Sync from Moonlight',
        content: utf8ToBase64('{"a":2}'),
        sha: 'old-sha',
      });
    });
  });
});
