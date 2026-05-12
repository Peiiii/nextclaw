import { fetchNcpSessionSkills } from './utils/ncp-session.utils';
import { nextclawClient } from './managers/client.manager';

vi.mock('./managers/client.manager', () => ({
  nextclawClient: {
    sessions: {
      listSkills: vi.fn()
    }
  }
}));

describe('api/ncp-session', () => {
  beforeEach(() => {
    vi.mocked(nextclawClient.sessions.listSkills).mockReset();
    vi.mocked(nextclawClient.sessions.listSkills).mockResolvedValue({
      sessionId: 'session-1',
      total: 0,
      refs: [],
      records: []
    });
  });

  it('does not send an empty projectRoot query when no override is provided', async () => {
    await fetchNcpSessionSkills('session-1', { projectRoot: null });

    expect(nextclawClient.sessions.listSkills).toHaveBeenCalledWith('session-1', { projectRoot: null });
  });

  it('sends projectRoot only when the override is non-empty', async () => {
    await fetchNcpSessionSkills('session-1', { projectRoot: ' /tmp/project-alpha ' });

    expect(nextclawClient.sessions.listSkills).toHaveBeenCalledWith('session-1', {
      projectRoot: ' /tmp/project-alpha '
    });
  });
});
