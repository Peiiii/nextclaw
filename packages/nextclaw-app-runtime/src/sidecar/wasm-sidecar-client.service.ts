import { readFile } from "node:fs/promises";

type WasmRuntime = {
  instantiate(
    wasmBytes: Buffer,
    imports: Record<string, unknown>,
  ): Promise<{
    instance: {
      exports: Record<string, unknown>;
    };
  }>;
};

export class WasmSidecarClientService {
  runExport = async (params: {
    wasmPath: string;
    exportName: string;
    args: number[];
  }): Promise<number> => {
    const { wasmPath, exportName, args } = params;
    const wasmBytes = await readFile(wasmPath);
    const wasmRuntime = (globalThis as typeof globalThis & { WebAssembly?: WasmRuntime })
      .WebAssembly;
    if (!wasmRuntime) {
      throw new Error("当前 Node 运行时不支持 WebAssembly。");
    }
    const instance = await wasmRuntime.instantiate(wasmBytes, {});
    const exported = instance.instance.exports[exportName];
    if (typeof exported !== "function") {
      throw new Error(`Wasm 导出不存在或不可调用：${exportName}`);
    }
    const result = exported(...args);
    if (typeof result !== "number") {
      throw new Error(`Wasm 导出 ${exportName} 必须返回 number。`);
    }
    return result;
  };
}
