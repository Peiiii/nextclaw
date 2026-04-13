const hasJsxInFunction = (functionNode) => {
  let found = false;

  const visit = (node) => {
    if (!node || found) {
      return;
    }
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      found = true;
      return;
    }
    if (node !== functionNode && (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    )) {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "parent") {
        continue;
      }
      if (!value) {
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

  if (functionNode.body) {
    visit(functionNode.body);
  }

  return found;
};

const isPascalCaseName = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);

const resolveComponentName = (node) => {
  if (node.type === "FunctionDeclaration" && node.id?.type === "Identifier") {
    return node.id.name;
  }
  if ((node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && node.id?.type === "Identifier") {
    return node.id.name;
  }

  let current = node.parent;
  while (current) {
    if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
      return current.id.name;
    }
    if (current.type === "AssignmentExpression" && current.left.type === "Identifier") {
      return current.left.name;
    }
    if (current.type === "Property" && current.key.type === "Identifier" && !current.computed) {
      return current.key.name;
    }
    current = current.parent;
  }

  return null;
};

const collectPropsMemberAccesses = (functionNode, propsName) => {
  const memberExpressions = [];

  const visit = (node) => {
    if (!node) {
      return;
    }
    if (node !== functionNode && (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    )) {
      return;
    }
    if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      node.object.name === propsName &&
      !node.computed
    ) {
      memberExpressions.push(node);
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "parent") {
        continue;
      }
      if (!value) {
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

const reactComponentPropsDestructuringRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require React components to destructure props instead of repeatedly reading props.foo"
    },
    schema: [],
    messages: {
      destructureProps: "Destructure component props at the parameter boundary instead of reading '{{propsName}}.*' inside {{componentName}}."
    }
  },
  create(context) {
    const inspectFunction = (node) => {
      const componentName = resolveComponentName(node);
      if (!componentName || !isPascalCaseName(componentName) || !hasJsxInFunction(node)) {
        return;
      }

      const propsParam = node.params[0];
      if (!propsParam || propsParam.type !== "Identifier") {
        return;
      }

      const memberExpressions = collectPropsMemberAccesses(node, propsParam.name);
      if (memberExpressions.length === 0) {
        return;
      }

      context.report({
        node: propsParam,
        messageId: "destructureProps",
        data: {
          componentName,
          propsName: propsParam.name
        }
      });
    };

    return {
      FunctionDeclaration: inspectFunction,
      FunctionExpression: inspectFunction,
      ArrowFunctionExpression: inspectFunction
    };
  }
};

export default reactComponentPropsDestructuringRule;
