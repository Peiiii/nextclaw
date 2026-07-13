import { Icon, type IconifyIcon } from "@iconify/react";
import defaultFileIcon from "@iconify/icons-vscode-icons/default-file";
import audioIcon from "@iconify/icons-vscode-icons/file-type-audio";
import bunIcon from "@iconify/icons-vscode-icons/file-type-bun";
import configIcon from "@iconify/icons-vscode-icons/file-type-config";
import cppIcon from "@iconify/icons-vscode-icons/file-type-cpp";
import csharpIcon from "@iconify/icons-vscode-icons/file-type-csharp";
import cssIcon from "@iconify/icons-vscode-icons/file-type-css";
import dockerIcon from "@iconify/icons-vscode-icons/file-type-docker";
import dotenvIcon from "@iconify/icons-vscode-icons/file-type-dotenv";
import eslintIcon from "@iconify/icons-vscode-icons/file-type-eslint";
import excelIcon from "@iconify/icons-vscode-icons/file-type-excel";
import fontIcon from "@iconify/icons-vscode-icons/file-type-font";
import gitIcon from "@iconify/icons-vscode-icons/file-type-git";
import goIcon from "@iconify/icons-vscode-icons/file-type-go";
import graphqlIcon from "@iconify/icons-vscode-icons/file-type-graphql";
import htmlIcon from "@iconify/icons-vscode-icons/file-type-html";
import imageIcon from "@iconify/icons-vscode-icons/file-type-image";
import javaIcon from "@iconify/icons-vscode-icons/file-type-java";
import javascriptIcon from "@iconify/icons-vscode-icons/file-type-js";
import jsonIcon from "@iconify/icons-vscode-icons/file-type-json";
import kotlinIcon from "@iconify/icons-vscode-icons/file-type-kotlin";
import licenseIcon from "@iconify/icons-vscode-icons/file-type-license";
import luaIcon from "@iconify/icons-vscode-icons/file-type-lua";
import makefileIcon from "@iconify/icons-vscode-icons/file-type-makefile";
import markdownIcon from "@iconify/icons-vscode-icons/file-type-markdown";
import npmIcon from "@iconify/icons-vscode-icons/file-type-npm";
import pdfIcon from "@iconify/icons-vscode-icons/file-type-pdf2";
import phpIcon from "@iconify/icons-vscode-icons/file-type-php";
import pnpmIcon from "@iconify/icons-vscode-icons/file-type-pnpm";
import powerpointIcon from "@iconify/icons-vscode-icons/file-type-powerpoint";
import prettierIcon from "@iconify/icons-vscode-icons/file-type-prettier";
import pythonIcon from "@iconify/icons-vscode-icons/file-type-python";
import reactJavascriptIcon from "@iconify/icons-vscode-icons/file-type-reactjs";
import reactTypescriptIcon from "@iconify/icons-vscode-icons/file-type-reactts";
import rubyIcon from "@iconify/icons-vscode-icons/file-type-ruby";
import rustIcon from "@iconify/icons-vscode-icons/file-type-rust";
import sassIcon from "@iconify/icons-vscode-icons/file-type-sass";
import shellIcon from "@iconify/icons-vscode-icons/file-type-shell";
import sqlIcon from "@iconify/icons-vscode-icons/file-type-sql";
import svelteIcon from "@iconify/icons-vscode-icons/file-type-svelte";
import svgIcon from "@iconify/icons-vscode-icons/file-type-svg";
import swiftIcon from "@iconify/icons-vscode-icons/file-type-swift";
import tailwindIcon from "@iconify/icons-vscode-icons/file-type-tailwind";
import textIcon from "@iconify/icons-vscode-icons/file-type-text";
import tomlIcon from "@iconify/icons-vscode-icons/file-type-toml";
import tsconfigIcon from "@iconify/icons-vscode-icons/file-type-tsconfig";
import typescriptIcon from "@iconify/icons-vscode-icons/file-type-typescript";
import videoIcon from "@iconify/icons-vscode-icons/file-type-video";
import viteIcon from "@iconify/icons-vscode-icons/file-type-vite";
import vitestIcon from "@iconify/icons-vscode-icons/file-type-vitest";
import vueIcon from "@iconify/icons-vscode-icons/file-type-vue";
import wordIcon from "@iconify/icons-vscode-icons/file-type-word";
import xmlIcon from "@iconify/icons-vscode-icons/file-type-xml";
import yamlIcon from "@iconify/icons-vscode-icons/file-type-yaml";
import yarnIcon from "@iconify/icons-vscode-icons/file-type-yarn";
import zipIcon from "@iconify/icons-vscode-icons/file-type-zip";
import { cn } from "@/shared/lib/utils";

type FileTypeIconProps = {
  className?: string;
  fileName: string;
  size?: "compact" | "default";
};

type FileIconVisual = {
  icon: IconifyIcon;
  name: string;
};

type BundledIcon = IconifyIcon | { default: IconifyIcon };

type FileIconRule = FileIconVisual & {
  extensions: readonly string[];
};

const SPECIAL_FILE_RULES: Array<FileIconVisual & { pattern: RegExp }> = [
  {
    icon: dockerIcon,
    name: "docker",
    pattern: /^(dockerfile|\.dockerignore)$/,
  },
  { icon: dotenvIcon, name: "dotenv", pattern: /^\.env(?:\.|$)/ },
  {
    icon: gitIcon,
    name: "git",
    pattern: /^\.git(?:attributes|ignore|modules)$/,
  },
  { icon: makefileIcon, name: "makefile", pattern: /^makefile$/ },
  { icon: licenseIcon, name: "license", pattern: /^licen[cs]e(?:\.|$)/ },
  { icon: markdownIcon, name: "markdown", pattern: /^readme(?:\.|$)/ },
  { icon: npmIcon, name: "npm", pattern: /^package(?:-lock)?\.json$/ },
  {
    icon: pnpmIcon,
    name: "pnpm",
    pattern: /^(pnpm-lock\.yaml|pnpm-workspace\.yaml)$/,
  },
  { icon: yarnIcon, name: "yarn", pattern: /^yarn\.lock$/ },
  { icon: bunIcon, name: "bun", pattern: /^bun\.lockb?$/ },
  {
    icon: tsconfigIcon,
    name: "tsconfig",
    pattern: /^tsconfig(?:\..+)?\.json$/,
  },
  { icon: viteIcon, name: "vite", pattern: /^vite\.config\./ },
  { icon: vitestIcon, name: "vitest", pattern: /^vitest(?:\..+)?\.config\./ },
  { icon: tailwindIcon, name: "tailwind", pattern: /^tailwind\.config\./ },
  {
    icon: eslintIcon,
    name: "eslint",
    pattern: /^(eslint\.config\.|\.eslintrc)/,
  },
  {
    icon: prettierIcon,
    name: "prettier",
    pattern: /^(prettier\.config\.|\.prettierrc)/,
  },
];

const FILE_ICON_RULES: FileIconRule[] = [
  { icon: reactTypescriptIcon, name: "react-typescript", extensions: ["tsx"] },
  { icon: reactJavascriptIcon, name: "react-javascript", extensions: ["jsx"] },
  {
    icon: typescriptIcon,
    name: "typescript",
    extensions: ["ts", "mts", "cts"],
  },
  {
    icon: javascriptIcon,
    name: "javascript",
    extensions: ["js", "mjs", "cjs"],
  },
  { icon: jsonIcon, name: "json", extensions: ["json", "json5", "jsonc"] },
  { icon: markdownIcon, name: "markdown", extensions: ["md", "mdx"] },
  { icon: htmlIcon, name: "html", extensions: ["html", "htm"] },
  { icon: cssIcon, name: "css", extensions: ["css", "pcss", "less"] },
  { icon: sassIcon, name: "sass", extensions: ["sass", "scss"] },
  { icon: vueIcon, name: "vue", extensions: ["vue"] },
  { icon: svelteIcon, name: "svelte", extensions: ["svelte"] },
  { icon: pythonIcon, name: "python", extensions: ["py", "pyw"] },
  { icon: goIcon, name: "go", extensions: ["go"] },
  { icon: rustIcon, name: "rust", extensions: ["rs"] },
  { icon: javaIcon, name: "java", extensions: ["java"] },
  { icon: kotlinIcon, name: "kotlin", extensions: ["kt", "kts"] },
  { icon: swiftIcon, name: "swift", extensions: ["swift"] },
  { icon: cppIcon, name: "cpp", extensions: ["c", "cc", "cpp", "h", "hpp"] },
  { icon: csharpIcon, name: "csharp", extensions: ["cs"] },
  { icon: phpIcon, name: "php", extensions: ["php"] },
  { icon: rubyIcon, name: "ruby", extensions: ["rb"] },
  { icon: luaIcon, name: "lua", extensions: ["lua"] },
  {
    icon: shellIcon,
    name: "shell",
    extensions: ["sh", "bash", "zsh", "fish", "ps1"],
  },
  { icon: graphqlIcon, name: "graphql", extensions: ["graphql", "gql"] },
  { icon: yamlIcon, name: "yaml", extensions: ["yaml", "yml"] },
  { icon: tomlIcon, name: "toml", extensions: ["toml"] },
  { icon: xmlIcon, name: "xml", extensions: ["xml"] },
  { icon: sqlIcon, name: "sql", extensions: ["sql", "sqlite", "db"] },
  { icon: svgIcon, name: "svg", extensions: ["svg"] },
  {
    icon: imageIcon,
    name: "image",
    extensions: [
      "avif",
      "bmp",
      "gif",
      "heic",
      "ico",
      "jpeg",
      "jpg",
      "png",
      "tif",
      "tiff",
      "webp",
    ],
  },
  {
    icon: audioIcon,
    name: "audio",
    extensions: ["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "weba"],
  },
  {
    icon: videoIcon,
    name: "video",
    extensions: ["avi", "m4v", "mkv", "mov", "mp4", "webm", "wmv"],
  },
  { icon: pdfIcon, name: "pdf", extensions: ["pdf"] },
  { icon: wordIcon, name: "word", extensions: ["doc", "docx", "odt", "rtf"] },
  {
    icon: excelIcon,
    name: "excel",
    extensions: ["csv", "numbers", "ods", "tsv", "xls", "xlsx"],
  },
  {
    icon: powerpointIcon,
    name: "powerpoint",
    extensions: ["odp", "ppt", "pptx"],
  },
  {
    icon: zipIcon,
    name: "archive",
    extensions: ["7z", "bz2", "gz", "rar", "tar", "tgz", "zip"],
  },
  {
    icon: fontIcon,
    name: "font",
    extensions: ["eot", "otf", "ttf", "woff", "woff2"],
  },
  {
    icon: configIcon,
    name: "config",
    extensions: ["cfg", "conf", "ini", "properties"],
  },
  { icon: textIcon, name: "text", extensions: ["log", "txt"] },
];

const DEFAULT_FILE_VISUAL: FileIconVisual = {
  icon: defaultFileIcon,
  name: "default",
};

function readFileName(value: string): string {
  return value.trim().split(/[\\/]/).filter(Boolean).pop() ?? value.trim();
}

function readFileExtension(fileName: string): string {
  return /\.([a-z0-9]{1,16})$/i.exec(fileName)?.[1]?.toLowerCase() ?? "";
}

function resolveFileIconVisual(value: string): FileIconVisual {
  const fileName = readFileName(value).toLowerCase();
  const specialVisual = SPECIAL_FILE_RULES.find(({ pattern }) =>
    pattern.test(fileName),
  );
  if (specialVisual) {
    return specialVisual;
  }

  const extension = readFileExtension(fileName);
  return (
    FILE_ICON_RULES.find(({ extensions }) => extensions.includes(extension)) ??
    DEFAULT_FILE_VISUAL
  );
}

function resolveBundledIcon(icon: IconifyIcon): IconifyIcon {
  const bundledIcon = icon as unknown as BundledIcon;
  return "body" in bundledIcon ? bundledIcon : bundledIcon.default;
}

export function FileTypeIcon({
  className,
  fileName,
  size = "default",
}: FileTypeIconProps) {
  const visual = resolveFileIconVisual(fileName);

  return (
    <Icon
      aria-hidden="true"
      data-file-type-icon={visual.name}
      icon={resolveBundledIcon(visual.icon)}
      className={cn(
        "shrink-0",
        size === "compact" ? "h-3.5 w-3.5" : "h-4 w-4",
        className,
      )}
    />
  );
}
