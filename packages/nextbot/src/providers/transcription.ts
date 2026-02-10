import { createReadStream, existsSync } from "node:fs";
import { basename } from "node:path";
import { FormData, fetch } from "undici";

export class GroqTranscriptionProvider {
  private apiKey?: string | null;
  private apiUrl = "https://api.groq.com/openai/v1/audio/transcriptions";

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey ?? process.env.GROQ_API_KEY ?? null;
  }

  async transcribe(filePath: string): Promise<string> {
    if (!this.apiKey) {
      return "";
    }
    if (!existsSync(filePath)) {
      return "";
    }
    const form = new FormData();
    form.append("file", createReadStream(filePath), basename(filePath));
    form.append("model", "whisper-large-v3");

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });
    if (!response.ok) {
      return "";
    }
    const data = (await response.json()) as { text?: string };
    return data.text ?? "";
  }
}
