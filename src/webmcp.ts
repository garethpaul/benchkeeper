import { useEffect, useState } from 'react';
import { createTools, type ToolDefinition } from './tools';
import { desk } from './store';

type RegisteredTool = { name: string; [key: string]: unknown };
type ModelContext = {
  registerTool: (
    tool: ToolDefinition,
    options?: { signal?: AbortSignal; exposedTo?: string[] }
  ) => Promise<void> | void;
  unregisterTool?: (name: string) => void;
  getTools?: (options?: { fromOrigins?: string[] }) => Promise<RegisteredTool[]>;
  executeTool?: (tool: RegisteredTool, input: object | string) => Promise<string>;
};
declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
    modelContextTesting?: {
      listTools: () => RegisteredTool[];
      executeTool: (name: string, input: string) => Promise<string>;
    };
  }
}
export type WebMCPStatus = {
  kind: 'registering' | 'native' | 'legacy' | 'unsupported' | 'error';
  detail: string;
  count: number;
};
const nativeTools = createTools(desk, 'native-tool');
const rehearsalTools = createTools(desk, 'rehearsal');
let inputEncoding: Promise<'json-string' | 'object'> | undefined;

// Chrome 152 implements the documented JSON-string input. The September 2
// draft changes it to an object. Negotiate using ONLY a read-only tool; never
// retry a mutation, which could otherwise execute twice.
async function nativeInputEncoding(api: ModelContext, tools: RegisteredTool[]) {
  inputEncoding ??= (async () => {
    const probe = tools.find((t) => t.name === 'get_repair_event');
    if (!probe || !api.executeTool)
      throw new Error('Read-only compatibility probe is unavailable.');
    try {
      await api.executeTool(probe, '{}');
      return 'json-string' as const;
    } catch {
      await api.executeTool(probe, {});
      return 'object' as const;
    }
  })().catch((error: unknown) => {
    // Keep successful negotiation, not a transient failure. A later explicit
    // rehearsal may retry this read-only probe; mutations are never replayed.
    inputEncoding = undefined;
    throw error;
  });
  return inputEncoding;
}

export function useWebMCP(): WebMCPStatus {
  const [status, setStatus] = useState<WebMCPStatus>({
    kind: 'registering',
    detail: 'Checking browser support',
    count: 0
  });
  useEffect(() => {
    const api = document.modelContext ?? navigator.modelContext;
    const current = !!document.modelContext;
    if (!api?.registerTool) {
      setStatus({
        kind: 'unsupported',
        detail:
          'Manual planning works. Enable WebMCP testing in a supported Chrome browser for agent tools.',
        count: 0
      });
      return;
    }
    const controller = new AbortController();
    const registered = new Set<string>();
    let mounted = true;
    let count = 0;
    function release() {
      controller.abort();
      // Chrome 146 ignores the registration signal. Only unregister names
      // successfully registered by this effect, never a colliding owner's tool.
      if (!current && api?.unregisterTool) {
        for (const name of registered) {
          try {
            api.unregisterTool(name);
          } catch (error) {
            // A signal or another same-page script may already have removed it.
            // Do not abandon the remaining cleanup for that known legacy case.
            if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error;
          }
        }
      }
      registered.clear();
    }
    void (async () => {
      try {
        for (const tool of nativeTools) {
          if (!mounted) break;
          const registration = api.registerTool(tool, { signal: controller.signal });
          // Legacy registration is synchronous: track it before yielding so
          // an immediate effect cleanup cannot miss a completed registration.
          if (registration) await registration;
          registered.add(tool.name);
          if (!mounted) {
            release();
            break;
          }
          count++;
        }
        if (mounted)
          setStatus({
            kind: current ? 'native' : 'legacy',
            detail: current
              ? 'document.modelContext · browser-native'
              : 'navigator.modelContext · older native API',
            count
          });
      } catch (error) {
        release();
        if (mounted)
          setStatus({
            kind: 'error',
            detail: error instanceof Error ? error.message : 'Registration failed',
            count: 0
          });
      }
    })();
    return () => {
      mounted = false;
      release();
    };
  }, []);
  return status;
}

export async function runTool(
  name: string,
  input: object
): Promise<{ path: string; output: string }> {
  const api = document.modelContext;
  if (api?.getTools && api.executeTool) {
    const tools = await api.getTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool)
      throw new Error('Native tool is not registered yet. Try again once the status is ready.');
    const encoding = await nativeInputEncoding(api, tools);
    return {
      path: 'Native document.modelContext call',
      output: await api.executeTool(
        tool,
        encoding === 'json-string' ? JSON.stringify(input) : input
      )
    };
  }
  if (navigator.modelContextTesting?.executeTool)
    return {
      path: 'Native legacy testing API call',
      output: await navigator.modelContextTesting.executeTool(name, JSON.stringify(input))
    };
  const tool = rehearsalTools.find((t) => t.name === name);
  if (!tool) throw new Error('Unknown rehearsal tool.');
  return {
    path: 'Direct-handler rehearsal — NOT native WebMCP or an AI agent',
    output: await tool.execute(input)
  };
}
export { nativeTools as toolCatalog };
