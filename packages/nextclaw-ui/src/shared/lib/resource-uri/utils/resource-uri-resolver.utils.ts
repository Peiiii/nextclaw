import type {
  ParsedResourceUri,
  ResourceUriResolverOptions,
  ResourceUriRouteDefinition,
} from '@/shared/lib/resource-uri/types/resource-uri.types';
import { parseResourceUri } from '@/shared/lib/resource-uri/utils/resource-uri.utils';

export class ResourceUriResolver<TTarget> {
  constructor(
    private readonly routeDefinitions: ResourceUriRouteDefinition<TTarget>[],
    private readonly options: ResourceUriResolverOptions<TTarget>,
  ) {}

  resolve = (uri: string): TTarget => {
    const parsed = parseResourceUri(uri);
    return this.findDefinition(parsed).resolve(parsed);
  };

  normalize = (uri: string): string => {
    return this.options.getNormalizedUri(this.resolve(uri));
  };

  areEquivalent = (left: string, right: string): boolean => {
    const definition = this.findDefinition(parseResourceUri(left));
    return definition.areEquivalent?.(left, right) ?? this.normalize(left) === this.normalize(right);
  };

  private findDefinition = (uri: ParsedResourceUri): ResourceUriRouteDefinition<TTarget> => {
    const definition = this.routeDefinitions.find((routeDefinition) => routeDefinition.match(uri));
    if (!definition) {
      throw new Error(`Unsupported resource URI: ${uri.raw}`);
    }
    return definition;
  };
}
