import { GithubClient, GithubApiError } from '../src/github';

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
});
