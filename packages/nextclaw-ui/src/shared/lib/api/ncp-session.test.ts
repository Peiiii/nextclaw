import { fetchNcpSessionSkills } from './ncp-session';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    get: vi.fn()
  }
}));

describe('api/ncp-session', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-1',
        total: 0,
        refs: [],
        records: []
      }
    });
  });

  it('does not send an empty projectRoot query when no override is provided', async () => {
    await fetchNcpSessionSkills('session-1', { projectRoot: null });

    expect(api.get).toHaveBeenCalledWith('/api/ncp/sessions/session-1/skills');
  });

  it('sends projectRoot only when the override is non-empty', async () => {
    await fetchNcpSessionSkills('session-1', { projectRoot: ' /tmp/project-alpha ' });

    expect(api.get).toHaveBeenCalledWith(
      '/api/ncp/sessions/session-1/skills?projectRoot=%2Ftmp%2Fproject-alpha'
    );
  });
});
