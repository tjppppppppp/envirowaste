// Foundable's agent-ready SDK: tools a page offers an AI assistant in the visitor's browser, which calls them by name
// instead of filling the page's form, through WebMCP (`document.modelContext`) where the browser has it. Elsewhere it
// offers nothing, and the page is the same for everyone. Foundable's code, laid by the agent-ready package: import it,
// never copy or change it.

/** One tool: its name, what it does, the fields it takes and what running it answers. */
export interface AgentTool {
  /** Letters, digits, `_`, `-` or `.`, unique on the page: `book_appointment`. */
  name: string;
  /** What it does and what it answers, in a sentence or two. */
  description: string;
  /** The fields it takes, as JSON Schema: `{ type: "object", properties: { email: { type: "string" } }, required: ["email"] }`. */
  input?: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  /** True for a tool that only reads (free times); one that books, sends or orders is consequential. */
  readOnly?: boolean;
  /** Does what the page's form or button does and answers what the page would show: the confirmation and its link, or the refusal. */
  run(input: Record<string, unknown>, signal: AbortSignal): string | object | Promise<string | object>;
}

interface ModelContext {
  registerTool(tool: object, options: { signal: AbortSignal }): unknown;
}

/**
 * Offers the tools while the page shows what they do and returns what takes them back, a `useEffect`'s cleanup:
 * `useEffect(() => registerAgentTools([...]), [])`. A tool that throws answers its error's words, as WebMCP has a tool
 * report its own failure; one the browser refuses (a name the page already offers) is left out.
 */
export function registerAgentTools(tools: readonly AgentTool[]): () => void {
  const leave = new AbortController();
  const context = typeof document === "undefined" ? undefined : (document as Document & { modelContext?: ModelContext }).modelContext;
  if (typeof context?.registerTool !== "function") return () => leave.abort();
  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input ?? { type: "object", properties: {} },
        annotations: tool.readOnly ? { readOnlyHint: true } : { consequentialHint: true },
        execute: async (input: Record<string, unknown> | undefined, options?: { signal?: AbortSignal }) => {
          try {
            return await tool.run(input ?? {}, options?.signal ?? leave.signal);
          } catch (error) {
            // An Error or a database's plain `{ message }`, whichever realm made it.
            const message = (error as { message?: unknown } | null)?.message;
            return { error: typeof message === "string" ? message : String(error) };
          }
        },
      }, { signal: leave.signal })).catch(() => undefined);
    } catch {
      // A browser whose WebMCP takes another shape gets none of the tools; the page works as it did.
    }
  }
  return () => leave.abort();
}
