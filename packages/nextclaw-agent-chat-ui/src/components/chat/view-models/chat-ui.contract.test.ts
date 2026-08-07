import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat-ui public contract', () => {
  it('does not leak mutable host handles or styling contracts', () => {
    const file = readFileSync(
      resolve(process.cwd(), 'src/components/chat/view-models/chat-ui.types.ts'),
      'utf-8'
    );
    expect(file).not.toContain('MutableRefObject');
    expect(file).not.toContain('ClassName');
  });
});
