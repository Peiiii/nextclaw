import { AppCheckService } from "@nextclaw-cli/cli/app/services/app-check.service.js";
import { AppTestService } from "@nextclaw-cli/cli/app/services/development/app-test.service.js";
import { ServiceAppDevService } from "@nextclaw-cli/cli/app/services/service-app-dev.service.js";

export class AppTestCommandController {
  private readonly appTestService: AppTestService;

  constructor(serviceAppDevService = new ServiceAppDevService()) {
    this.appTestService = new AppTestService(
      new AppCheckService(undefined, undefined, serviceAppDevService),
      serviceAppDevService,
    );
  }

  test = async (target: string, options: { json?: boolean }): Promise<void> => {
    const report = await this.appTestService.test(target);
    process.stdout.write(
      options.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : this.format(report),
    );
    if (!report.ok) process.exitCode = 1;
  };

  private format = (
    report: Awaited<ReturnType<AppTestService["test"]>>,
  ): string =>
    [
      `NextClaw App test ${report.ok ? "passed" : "failed"}: ${report.target}`,
      ...report.steps.map(
        (step) =>
          `${step.ok ? "ok" : "failed"} ${step.action}${step.message ? `: ${step.message}` : ""}`,
      ),
      ...report.issues.map(
        (issue) => `failed [${issue.code}] ${issue.message}`,
      ),
      "",
    ].join("\n");
}
