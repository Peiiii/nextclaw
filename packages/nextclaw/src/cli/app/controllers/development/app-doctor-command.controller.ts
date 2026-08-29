import {
  AppRuntimeToolchainService,
  type AppRuntimeToolchainProfile,
} from "@nextclaw/app-runtime";

export class AppDoctorCommandController {
  constructor(
    private readonly toolchainService = new AppRuntimeToolchainService(),
  ) {}

  doctor = async (options: {
    profile?: string;
    json?: boolean;
  }): Promise<void> => {
    const profile = this.parseProfile(options.profile ?? "wasi");
    const result = await this.toolchainService.doctor(profile);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(
        [
          `NextClaw App doctor (${options.profile ?? "wasi"}): ${result.ok ? "ready" : "not ready"}`,
          ...result.tools.flatMap((tool) => [
            `${tool.ok ? "ok" : "missing"} ${tool.name}${tool.version ? `: ${tool.version}` : ""}`,
            ...(!tool.ok ? [`  Fix: ${tool.installHint}`] : []),
          ]),
          "",
        ].join("\n"),
      );
    }
    if (!result.ok) process.exitCode = 1;
  };

  private parseProfile = (profile: string): AppRuntimeToolchainProfile => {
    if (profile === "wasi") return "wasi-component";
    if (profile === "wasi-http" || profile === "all") return profile;
    throw new Error(
      `Unsupported App doctor profile: ${profile}. Use wasi, wasi-http, or all.`,
    );
  };
}
