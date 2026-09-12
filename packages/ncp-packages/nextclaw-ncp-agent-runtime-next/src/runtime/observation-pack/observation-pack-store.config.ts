/**
 * ObservationPack：大工具输出归档到内存，上下文只保留 handle。
 *
 * 核心机制：每次 normalizeToolCallResult 调用前记录原始 result 字节数；
 * 若超过阈值则将完整结果归档，并把 result 替换为简短 handle。
 * 后续 agent 通过 `nextclaw_observations.get(observationId)` 按需读取完整内容。
 */
export class ObservationStore {
  private readonly byId = new Map<string, { result: unknown; resultBytes: number }>();
  private nextId = 1;

  store = (result: unknown, resultBytes: number): string => {
    const id = `obs-${this.nextId++}`;
    this.byId.set(id, { result, resultBytes });
    return id;
  };

  get = (id: string): { result: unknown; resultBytes: number } | null => {
    return this.byId.get(id) ?? null;
  };

  delete = (id: string): boolean => {
    return this.byId.delete(id);
  };

  clear = (): void => {
    this.byId.clear();
    this.nextId = 1;
  };

  get size(): number {
    return this.byId.size;
  }
}
