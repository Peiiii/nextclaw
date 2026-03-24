import { describe, expect, it } from "vitest";
import { buildFeishuConvertContext, convertFeishuMessageContent } from "./content-converter.js";

describe("feishu content converter", () => {
  it("strips bot mentions from text messages", () => {
    const context = buildFeishuConvertContext({
      stripBotMentions: true,
      botOpenId: "ou_bot",
      botName: "NextClaw Bot",
      mentions: [
        {
          key: "@_user_1",
          id: { open_id: "ou_bot" },
          name: "NextClaw Bot"
        }
      ]
    });

    const converted = convertFeishuMessageContent(
      JSON.stringify({ text: "@_user_1 帮我看下今天日程" }),
      "text",
      context
    );

    expect(converted.content).toBe("帮我看下今天日程");
  });

  it("converts post content to markdown-like text and preserves attachments", () => {
    const converted = convertFeishuMessageContent(
      JSON.stringify({
        title: "日报",
        content: [
          [
            { tag: "text", text: "查看 " },
            { tag: "a", text: "文档", href: "https://example.com" },
            { tag: "img", image_key: "img_123" }
          ]
        ]
      }),
      "post"
    );

    expect(converted.content).toContain("**日报**");
    expect(converted.content).toContain("[文档](https://example.com)");
    expect(converted.resources).toEqual([{ type: "image", fileKey: "img_123" }]);
  });

  it("formats todo payloads into readable text", () => {
    const converted = convertFeishuMessageContent(
      JSON.stringify({
        summary: {
          title: "发布版本",
          content: [[{ text: "补完飞书底座" }]]
        },
        due_time: 1767225600000
      }),
      "todo"
    );

    expect(converted.content).toContain("发布版本");
    expect(converted.content).toContain("补完飞书底座");
    expect(converted.content).toContain("Due:");
  });
});
