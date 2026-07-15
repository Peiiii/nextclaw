import type {
  CreateProjectInput,
  NextclawKernel,
  ProjectRecord,
} from "@nextclaw/kernel";

export type ProjectCommandOptions = {
  json?: boolean;
};

export type ProjectCreateCommandOptions = ProjectCommandOptions & {
  path?: string;
  template?: "empty" | "knowledge-base";
};

export class ProjectCommands {
  constructor(private readonly createKernel: () => NextclawKernel) {}

  list = async (options: ProjectCommandOptions = {}): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const projects = await kernel.projectManager.listProjects();
      if (options.json) {
        console.log(JSON.stringify({ projects, total: projects.length }, null, 2));
        return;
      }
      if (projects.length === 0) {
        console.log("No projects registered.");
        return;
      }
      for (const project of projects) {
        console.log(`${project.name}\t${project.template ?? "existing"}\t${project.rootPath}`);
      }
    });
  };

  templates = async (options: ProjectCommandOptions = {}): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const templates = kernel.projectManager.listTemplates();
      if (options.json) {
        console.log(JSON.stringify({ templates }, null, 2));
        return;
      }
      for (const template of templates) {
        console.log(`${template.id}\t${template.description}`);
      }
    });
  };

  create = async (
    name: string,
    options: ProjectCreateCommandOptions = {},
  ): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const input: CreateProjectInput = {
        name,
        ...(options.path ? { rootPath: options.path } : {}),
        ...(options.template ? { template: options.template } : {}),
      };
      const project = await kernel.projectManager.createProject(input);
      this.printCreatedProject(project, Boolean(options.json));
    });
  };

  private printCreatedProject = (project: ProjectRecord, json: boolean): void => {
    if (json) {
      console.log(JSON.stringify(project, null, 2));
      return;
    }
    console.log(`Created project "${project.name}" at ${project.rootPath}`);
  };

  private withKernel = async <T>(action: (kernel: NextclawKernel) => Promise<T>): Promise<T> => {
    const kernel = this.createKernel();
    try {
      return await action(kernel);
    } finally {
      await kernel.dispose();
    }
  };
}
