import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { hash } from "#benchmark/measurement/usage.utils.mjs";

const warehouseNames = ["inventory", "north", "south", "west", "east"];
export const TASK_FIXTURES = {
  files: {
    version: 1, label: "连续文件核对", maxOutputTokens: 512, readOnly: true,
    files: Object.fromEntries(warehouseNames.map((name, i) => [`${name}.txt`,
      `Warehouse ${name}: quantity=${i + 11}.\n`
      + Array.from({ length: 60 }, (_, n) => `Reference row ${n}: this is a synthetic warehouse record used for a read-only diagnostic task.`).join("\n")
      + `\nNext file: ${warehouseNames[i + 1] ? `${warehouseNames[i + 1]}.txt` : "END"}`])),
    prompts: [
      "这是只读文件核对任务。从 {WORKSPACE}/inventory.txt 开始，用 {READ_TOOL} 每次读取一个文件，按文件末尾 Next file 继续，直到 END。不使用 shell、不修改文件。汇总每个文件首行 quantity。最后只给出总和和文件数量，格式 TOTAL=<总和>;FILES=<数量>。",
      "根据刚才的文件数据，最大的 quantity 是多少？不要调用工具，只回复数值。",
    ],
  },
  config: {
    version: 1, label: "配置故障诊断", maxOutputTokens: 512, readOnly: true,
    files: {
      "README.md": "The service loads defaults.json and then overrides its port with PORT from runtime.env. nginx.conf describes the reverse proxy. incident.log contains the current failure. Diagnose without modifying files.\n",
      "defaults.json": '{"host":"127.0.0.1","port":3000}\n',
      "runtime.env": "PORT=3001\n",
      "nginx.conf": "server { listen 8080; location / { proxy_pass http://127.0.0.1:3000; } }\n",
      "incident.log": "app ready: listening on 127.0.0.1:3001\nproxy error: connect ECONNREFUSED 127.0.0.1:3000; GET /health => 502\n",
    },
    prompts: [
      "这是只读配置排错任务。阅读当前工作目录 README.md 和它提到的配置、日志，找出健康检查返回 502 的原因。不调用 shell、不修改文件。最后只回复 CAUSE=<原因英文>;UPSTREAM=<代理目标端口>;APP=<应用实际端口>，端口不匹配的原因写 PORT_MISMATCH。",
      "如果只改代理配置，目标端口应该改成多少？不要再调用工具，只回复端口数字。",
    ],
  },
  repair: {
    version: 2, label: "代码修复", maxOutputTokens: 1024, readOnly: false,
    files: {
      "README.md": "Fix shipping.py without changing tests. Nonpositive weight ships free, including express. Positive weight up to and including 5 kg costs 5; above 5 kg costs 10. Express adds 2 for positive weight. Keep the existing public function.\n",
      "shipping.py": "def shipping_cost(weight, express=False):\n    if weight <= 0:\n        return 0\n    base = 5 if weight < 5 else 10\n    return base + (2 if express else 0)\n",
      "test_shipping.py": "import unittest\nfrom shipping import shipping_cost\n\nclass ShippingTests(unittest.TestCase):\n    def test_contract(self):\n        for weight, express, expected in [(-1,False,0),(0,True,0),(0.1,False,5),(4.9,False,5),(5,False,5),(5,True,7),(5.1,False,10),(20,True,12)]:\n            with self.subTest(weight=weight,express=express):\n                self.assertEqual(shipping_cost(weight,express),expected)\n\nif __name__ == \"__main__\":\n    unittest.main()\n",
    },
    prompts: ["修复当前工作目录的小型 Python 运费模块。先阅读 README.md、shipping.py 和 test_shipping.py，按需求修复 shipping.py。只修改 shipping.py，不修改测试。运行 python3 test_shipping.py 验证修复，完成后简短说明。不要使用子代理。"],
  },
};

export function fixtureIdentity(taskIds = Object.keys(TASK_FIXTURES)) {
  return hash(taskIds.map((id) => [id, TASK_FIXTURES[id]]));
}

export function prepareTaskFixture(taskId, workspace, readTool) {
  const fixture = TASK_FIXTURES[taskId];
  if (!fixture) throw new Error(`Unknown benchmark task: ${taskId}`);
  for (const [path, content] of Object.entries(fixture.files)) writeFileSync(join(workspace, path), content);
  return fixture.prompts.map((prompt) => prompt.replaceAll("{WORKSPACE}", workspace).replaceAll("{READ_TOOL}", readTool));
}

function verifyRepair(workspace, files) {
  let testsPassed = false;
  try {
    execFileSync("python3", ["test_shipping.py"], { cwd: workspace, stdio: "pipe", timeout: 5000 });
    testsPassed = true;
  } catch { /* The external verifier records failure, never treats an explanation as a fix. */ }
  return {
    testsPassed,
    sourceChanged: readFileSync(join(workspace, "shipping.py"), "utf8") !== files["shipping.py"],
    testsUnchanged: readFileSync(join(workspace, "test_shipping.py"), "utf8") === files["test_shipping.py"],
    readmeUnchanged: readFileSync(join(workspace, "README.md"), "utf8") === files["README.md"],
  };
}

export function verifyTaskFixture({ taskId, workspace, replies, calls }) {
  const { files, readOnly } = TASK_FIXTURES[taskId];
  if (!readOnly) return verifyRepair(workspace, files);
  const tools = calls.at(-1)?.toolHistory ?? [];
  const readFiles = new Set(tools.filter((tool) => ["read", "read_file"].includes(tool.function?.name)).map((tool) => {
    const args = JSON.parse(tool.function.arguments);
    return basename(args.file_path ?? args.path ?? "");
  }));
  return {
    answer: taskId === "files" ? /TOTAL\s*=\s*65\s*;\s*FILES\s*=\s*5/.test(replies[0] ?? "")
      : /CAUSE=PORT_MISMATCH;UPSTREAM=3000;APP=3001/.test((replies[0] ?? "").replaceAll(" ", "")),
    followup: replies[1]?.trim() === (taskId === "files" ? "15" : "3001"),
    requiredFilesRead: Object.keys(files).every((path) => readFiles.has(path)),
    filesUnchanged: Object.entries(files).every(([path, source]) => readFileSync(join(workspace, path), "utf8") === source),
    noShell: tools.every((tool) => !["bash", "exec", "shell", "terminal"].includes(tool.function?.name)),
  };
}
