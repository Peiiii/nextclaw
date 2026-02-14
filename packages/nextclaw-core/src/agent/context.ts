import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "./memory.js";
import { SkillsLoader } from "./skills.js";
import { APP_NAME } from "../config/brand.js";

export type Message = Record<string, unknown>;

const BOOTSTRAP_FILES = ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "IDENTITY.md"];

export class ContextBuilder {
  private memory: MemoryStore;
  private skills: SkillsLoader;

  constructor(private workspace: string) {
    this.memory = new MemoryStore(workspace);
    this.skills = new SkillsLoader(workspace, join(fileURLToPath(new URL("..", import.meta.url)), "skills"));
  }

  buildSystemPrompt(skillNames?: string[]): string {
    const parts: string[] = [];
    parts.push(this.getIdentity());

    const bootstrap = this.loadBootstrapFiles();
    if (bootstrap) {
      parts.push(bootstrap);
    }

    const memory = this.memory.getMemoryContext();
    if (memory) {
      parts.push(`# Memory\n\n${memory}`);
    }

    const alwaysSkills = this.skills.getAlwaysSkills();
    if (alwaysSkills.length) {
      const alwaysContent = this.skills.loadSkillsForContext(alwaysSkills);
      if (alwaysContent) {
        parts.push(`# Active Skills\n\n${alwaysContent}`);
      }
    }

    if (skillNames && skillNames.length) {
      const requestedContent = this.skills.loadSkillsForContext(skillNames);
      if (requestedContent) {
        parts.push(`# Requested Skills\n\n${requestedContent}`);
      }
    }

    const skillsSummary = this.skills.buildSkillsSummary();
    if (skillsSummary) {
      parts.push(`# Skills\n\nThe following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.\nSkills with available="false" need dependencies installed first - you can try installing them with apt/brew.\n\n${skillsSummary}`);
    }

    return parts.join("\n\n---\n\n");
  }

  buildMessages(params: {
    history: Message[];
    currentMessage: string;
    skillNames?: string[];
    media?: string[];
    channel?: string;
    chatId?: string;
  }): Message[] {
    const messages: Message[] = [];
    let systemPrompt = this.buildSystemPrompt(params.skillNames);
    if (params.channel && params.chatId) {
      systemPrompt += `\n\n## Current Session\nChannel: ${params.channel}\nChat ID: ${params.chatId}`;
    }
    messages.push({ role: "system", content: systemPrompt });
    messages.push(...params.history);

    const userContent = this.buildUserContent(params.currentMessage, params.media ?? []);
    messages.push({ role: "user", content: userContent });

    return messages;
  }

  addToolResult(messages: Message[], toolCallId: string, toolName: string, result: string): Message[] {
    messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      name: toolName,
      content: result
    });
    return messages;
  }

  addAssistantMessage(
    messages: Message[],
    content: string | null,
    toolCalls?: Message[] | null,
    reasoningContent?: string | null
  ): Message[] {
    const msg: Message = { role: "assistant", content: content ?? "" };
    if (toolCalls?.length) {
      msg.tool_calls = toolCalls;
    }
    if (reasoningContent) {
      msg.reasoning_content = reasoningContent;
    }
    messages.push(msg);
    return messages;
  }

  private getIdentity(): string {
    const now = new Date().toLocaleString();
    return `# ${APP_NAME} 🤖\n\nYou are ${APP_NAME}, a helpful AI assistant. You have access to tools that allow you to:\n- Read, write, and edit files\n- Execute shell commands\n- Search the web and fetch web pages\n- Send messages to users on chat channels\n- Spawn subagents for complex background tasks\n\n## Current Time\n${now}\n\n## Runtime\n${process.platform} ${process.arch}, Node ${process.version}\n\n## Workspace\nYour workspace is at: ${this.workspace}\n- Memory files: ${this.workspace}/memory/MEMORY.md\n- Daily notes: ${this.workspace}/memory/YYYY-MM-DD.md\n- Custom skills: ${this.workspace}/skills/{skill-name}/SKILL.md\n\nIMPORTANT: When responding to direct questions or conversations, reply directly with your text response.\nOnly use the 'message' tool when you need to send a message to a specific chat channel (like WhatsApp).\nFor normal conversation, just respond with text - do not call the message tool.\n\nAlways be helpful, accurate, and concise. When using tools, explain what you're doing.\nWhen remembering something, write to ${this.workspace}/memory/MEMORY.md`;
  }

  private loadBootstrapFiles(): string {
    const parts: string[] = [];
    for (const filename of BOOTSTRAP_FILES) {
      const filePath = join(this.workspace, filename);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        parts.push(`## ${filename}\n\n${content}`);
      }
    }
    return parts.join("\n\n");
  }

  private buildUserContent(text: string, media: string[]): string | Message[] {
    if (!media.length) {
      return text;
    }
    const images: Message[] = [];
    for (const path of media) {
      const mime = guessImageMime(path);
      if (!mime) {
        continue;
      }
      try {
        const b64 = readFileSync(path).toString("base64");
        images.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
      } catch {
        continue;
      }
    }
    if (!images.length) {
      return text;
    }
    return [...images, { type: "text", text }];
  }
}

function guessImageMime(path: string): string | null {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return null;
}
