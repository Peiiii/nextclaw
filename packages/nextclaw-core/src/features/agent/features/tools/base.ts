export type ToolSchema = {
  type: string;
  description?: string;
  properties?: Record<string, ToolSchema>;
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: ToolSchema;
};

export abstract class Tool {
  private static typeMap: Record<string, (value: unknown) => boolean> = {
    string: (v) => typeof v === "string",
    integer: (v) => typeof v === "number" && Number.isInteger(v),
    number: (v) => typeof v === "number",
    boolean: (v) => typeof v === "boolean",
    array: Array.isArray,
    object: (v) => typeof v === "object" && v !== null && !Array.isArray(v)
  };

  abstract get name(): string;
  abstract get description(): string;
  abstract get parameters(): Record<string, unknown>;

  abstract execute(params: Record<string, unknown>, toolCallId?: string): Promise<unknown>;

  isAvailable = (): boolean => true;

  validateParams = (params: Record<string, unknown>): string[] => {
    const schema = this.parameters as ToolSchema;
    if (schema?.type !== "object") {
      throw new Error(`Schema must be object type, got ${schema?.type ?? "unknown"}`);
    }
    const schemaErrors = this.validateValue(params, schema, "");
    if (schemaErrors.length > 0) {
      return schemaErrors;
    }
    return this.validateSemanticParams(params);
  };

  validateArgs = (params: Record<string, unknown>): string[] => this.validateParams(params);

  toSchema = (): Record<string, unknown> => {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters
      }
    };
  };

  private validateValue = (value: unknown, schema: ToolSchema, path: string): string[] => {
    const label = path || "parameter";
    if (schema.type in Tool.typeMap && !Tool.typeMap[schema.type](value)) {
      return [`${label} should be ${schema.type}`];
    }

    const errors: string[] = [];
    errors.push(...this.validateLiteralConstraints(value, schema, label));
    errors.push(...this.validateObjectChildren(value, schema, path));
    errors.push(...this.validateArrayItems(value, schema, label));
    return errors;
  };

  private validateLiteralConstraints = (value: unknown, schema: ToolSchema, label: string): string[] => {
    const errors: string[] = [];
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${label} must be one of ${JSON.stringify(schema.enum)}`);
    }
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${label} must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${label} must be <= ${schema.maximum}`);
      }
    }
    if (typeof value === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${label} must be at least ${schema.minLength} chars`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${label} must be at most ${schema.maxLength} chars`);
      }
    }
    return errors;
  };

  private validateObjectChildren = (value: unknown, schema: ToolSchema, path: string): string[] => {
    if (schema.type !== "object") {
      return [];
    }
    const errors: string[] = [];
    const typedValue = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in typedValue)) {
        errors.push(`missing required ${path ? `${path}.${key}` : key}`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, val] of Object.entries(typedValue)) {
      const propSchema = properties[key] as ToolSchema | undefined;
      if (propSchema) {
        errors.push(...this.validateValue(val, propSchema, path ? `${path}.${key}` : key));
      }
    }
    return errors;
  };

  private validateArrayItems = (value: unknown, schema: ToolSchema, label: string): string[] => {
    if (schema.type !== "array" || !schema.items) {
      return [];
    }
    const errors: string[] = [];
    (value as unknown[]).forEach((item, index) => {
      errors.push(...this.validateValue(item, schema.items as ToolSchema, `${label}[${index}]`));
    });
    return errors;
  };

  protected validateSemanticParams = (_params: Record<string, unknown>): string[] => [];
}
