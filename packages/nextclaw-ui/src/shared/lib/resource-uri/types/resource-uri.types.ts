export type ParsedResourceUri = {
  authority: string;
  pathSegments: string[];
  pathname: string;
  raw: string;
  scheme: string;
  searchParams: URLSearchParams;
};

export type ResourceUriRouteDefinition<TTarget> = {
  areEquivalent?: (left: string, right: string) => boolean;
  id: string;
  match: (uri: ParsedResourceUri) => boolean;
  resolve: (uri: ParsedResourceUri) => TTarget;
};

export type ResourceUriResolverOptions<TTarget> = {
  getNormalizedUri: (target: TTarget) => string;
};
