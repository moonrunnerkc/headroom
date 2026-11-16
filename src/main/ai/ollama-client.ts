import { z } from 'zod';
import type { LocalModel } from '../../shared/ai-types';

/** Fixed loopback endpoint. OLLAMA_HOST and other remote hosts are deliberately not honored. */
export const OLLAMA_ORIGIN = 'http://127.0.0.1:11434';
const MAX_RESPONSE_BYTES = 512_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class OllamaError extends Error {
  constructor(
    readonly code: 'runtime-unavailable' | 'model-not-local' | 'http-error' | 'malformed-output',
    message: string,
  ) {
    super(message);
  }
}

const tagsSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      remote_host: z.string().optional(),
      remote_model: z.string().optional(),
      details: z
        .object({ family: z.string().optional(), parameter_size: z.string().optional() })
        .optional(),
    }),
  ),
});

const showSchema = z.object({
  capabilities: z.array(z.string()).optional(),
  remote_host: z.string().optional(),
  remote_model: z.string().optional(),
});

const psSchema = z.object({
  models: z.array(
    z.object({ name: z.string(), size_vram: z.number().optional(), size: z.number() }),
  ),
});

const generateSchema = z.object({
  response: z.string(),
  done: z.boolean(),
  done_reason: z.string().optional(),
});

export function createOllamaClient(fetchImpl: FetchLike) {
  async function request(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${OLLAMA_ORIGIN}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
        // Redirects could leave loopback; refuse them outright.
        redirect: 'error',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (signal?.aborted === true) throw error;
      throw new OllamaError(
        'runtime-unavailable',
        'Ollama is not reachable at 127.0.0.1:11434. Start Ollama and try again.',
      );
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES)
      throw new OllamaError('http-error', 'Ollama returned an unexpectedly large response.');
    if (!response.ok)
      throw new OllamaError('http-error', `Ollama returned HTTP ${response.status}.`);
    try {
      return JSON.parse(text);
    } catch {
      throw new OllamaError('malformed-output', 'Ollama returned a response that is not JSON.');
    }
  }

  /** Installed models that run locally and can generate text. Cloud-proxied models are excluded. */
  async function listLocalModels(): Promise<LocalModel[]> {
    const parsed = tagsSchema.safeParse(await request('/api/tags', undefined));
    if (!parsed.success)
      throw new OllamaError('malformed-output', 'Ollama returned an unexpected model list.');
    const candidates = parsed.data.models.filter(
      (m) => m.remote_host === undefined && m.remote_model === undefined,
    );
    const usable: LocalModel[] = [];
    for (const model of candidates) {
      if ((await inspectModel(model.name)).problem === null) {
        usable.push({
          name: model.name,
          family: model.details?.family ?? 'unknown',
          parameterSize: model.details?.parameter_size ?? 'unknown',
          sizeBytes: model.size,
        });
      }
    }
    return usable;
  }

  /** Whether the model is a local completion model, and whether it has a thinking mode to disable. */
  async function inspectModel(
    name: string,
    signal?: AbortSignal,
  ): Promise<{ problem: string | null; thinking: boolean }> {
    const parsed = showSchema.safeParse(await request('/api/show', { model: name }, signal));
    if (!parsed.success)
      return { problem: 'Ollama returned unexpected model details.', thinking: false };
    const capabilities = parsed.data.capabilities ?? [];
    const thinking = capabilities.includes('thinking');
    if (parsed.data.remote_host !== undefined || parsed.data.remote_model !== undefined) {
      return { problem: 'This model is served remotely, not on this Mac.', thinking };
    }
    if (!capabilities.includes('completion'))
      return { problem: 'This model cannot generate text.', thinking };
    return { problem: null, thinking };
  }

  async function generate(
    input: {
      model: string;
      system: string;
      prompt: string;
      format: unknown;
      maxTokens: number;
      disableThinking: boolean;
    },
    signal: AbortSignal,
  ): Promise<string> {
    const parsed = generateSchema.safeParse(
      await request(
        '/api/generate',
        {
          model: input.model,
          system: input.system,
          prompt: input.prompt,
          format: input.format,
          stream: false,
          // Thinking models otherwise spend the token budget on hidden reasoning.
          ...(input.disableThinking ? { think: false } : {}),
          options: { num_predict: input.maxTokens, temperature: 0.2 },
        },
        signal,
      ),
    );
    if (!parsed.success || !parsed.data.done)
      throw new OllamaError('malformed-output', 'Ollama returned an incomplete generation.');
    if (parsed.data.done_reason === 'length') {
      throw new OllamaError(
        'malformed-output',
        'The model reached its output limit before finishing.',
      );
    }
    return parsed.data.response;
  }

  /** After generation, confirm the model is resident in this machine's memory. */
  async function confirmLoadedLocally(name: string, signal?: AbortSignal): Promise<boolean> {
    const parsed = psSchema.safeParse(await request('/api/ps', undefined, signal));
    return parsed.success && parsed.data.models.some((m) => m.name === name && m.size > 0);
  }

  return { listLocalModels, inspectModel, generate, confirmLoadedLocally };
}

export type OllamaClient = ReturnType<typeof createOllamaClient>;
