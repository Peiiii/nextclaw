type InlineContentElement = {
  readonly clientHeight: number;
  readonly offsetHeight: number;
  readonly scrollHeight: number;
};

export function readInlineContentHeight(
  body: InlineContentElement | null | undefined,
  documentElement: InlineContentElement,
): number {
  return Math.ceil(
    Math.max(
      body?.clientHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.scrollHeight ?? 0,
      documentElement.offsetHeight,
    ),
  );
}
