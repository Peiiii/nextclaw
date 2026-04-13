import { findFileDirectoryBasenameCollision } from "../file-directory-basename-collision-shared.mjs";

const noFileDirectoryBasenameCollisionRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow sibling file/directory basename collisions such as foo.ts beside foo/"
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          allowFilePaths: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    ],
    messages: {
      noCollision:
        "Avoid sibling file/directory basename collisions: '{{filePath}}' conflicts with directory '{{directoryPath}}'. Rename one side to keep imports and ownership unambiguous."
    }
  },
  create: (context) => ({
    Program: (node) => {
      const filename = context.filename ?? context.getFilename?.();
      if (!filename || filename === "<input>") {
        return;
      }

      const collision = findFileDirectoryBasenameCollision(filename, {
        allowFilePaths: context.options[0]?.allowFilePaths
      });
      if (!collision) {
        return;
      }

      context.report({
        node,
        messageId: "noCollision",
        data: {
          filePath: collision.filePath,
          directoryPath: collision.directoryPath
        }
      });
    }
  })
};

export default noFileDirectoryBasenameCollisionRule;
