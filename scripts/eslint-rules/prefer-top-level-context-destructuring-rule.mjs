const DEFAULT_OBJECT_NAMES = ["params", "options", "context"];
const DEFAULT_MIN_ACCESSES = 4;

const isFunctionNode = (node) =>
  node?.type === "FunctionDeclaration" ||
  node?.type === "FunctionExpression" ||
  node?.type === "ArrowFunctionExpression";

const resolveFunctionName = (node) => {
  if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id?.type === "Identifier") {
    return node.id.name;
  }

  let current = node.parent;
  while (current) {
    if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
      return current.id.name;
    }
    if (current.type === "Property" && current.key.type === "Identifier" && !current.computed) {
      return current.key.name;
    }
    if (current.type === "MethodDefinition" && current.key.type === "Identifier" && !current.computed) {
      return current.key.name;
    }
    current = current.parent;
  }

  return "this function";
};

const collectRootMemberAccesses = (functionNode, paramName) => {
  const memberExpressions = [];

  const visit = (node) => {
    if (!node) {
      return;
    }
    if (node.type === "ChainExpression") {
      visit(node.expression);
      return;
    }
    if (node !== functionNode && isFunctionNode(node)) {
      return;
    }
    if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      node.object.name === paramName &&
      !node.computed
    ) {
      memberExpressions.push(node);
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "parent" || !value) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.type === "string") {
            visit(item);
          }
        }
        continue;
      }
      if (typeof value.type === "string") {
        visit(value);
      }
    }
  };

  visit(functionNode.body);
  return memberExpressions;
};

const preferTopLevelContextDestructuringRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require repeated reads of params/options/context-style objects to be replaced with top-level destructuring"
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          objectNames: {
            type: "array",
            items: { type: "string" }
          },
          minAccesses: {
            type: "integer",
            minimum: 2
          }
        }
      }
    ],
    messages: {
      preferTopLevelDestructuring:
        "Destructure top-level fields from '{{paramName}}' inside {{functionName}} instead of reading '{{paramName}}.*' {{count}} times."
    }
  },
  create(context) {
    const configuredNames = context.options[0]?.objectNames;
    const objectNames = new Set(
      Array.isArray(configuredNames) && configuredNames.length > 0
        ? configuredNames.filter((name) => typeof name === "string")
        : DEFAULT_OBJECT_NAMES
    );
    const configuredMinAccesses = context.options[0]?.minAccesses;
    const minAccesses =
      typeof configuredMinAccesses === "number" && configuredMinAccesses >= 2
        ? Math.trunc(configuredMinAccesses)
        : DEFAULT_MIN_ACCESSES;

    const inspectFunction = (node) => {
      for (const param of node.params) {
        if (param.type !== "Identifier" || !objectNames.has(param.name)) {
          continue;
        }

        const memberExpressions = collectRootMemberAccesses(node, param.name);
        if (memberExpressions.length < minAccesses) {
          continue;
        }

        context.report({
          node: param,
          messageId: "preferTopLevelDestructuring",
          data: {
            paramName: param.name,
            functionName: resolveFunctionName(node),
            count: String(memberExpressions.length)
          }
        });
      }
    };

    return {
      FunctionDeclaration: inspectFunction,
      FunctionExpression: inspectFunction,
      ArrowFunctionExpression: inspectFunction
    };
  }
};

export default preferTopLevelContextDestructuringRule;
