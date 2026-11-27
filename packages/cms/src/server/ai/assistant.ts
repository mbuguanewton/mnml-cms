import 'server-only';
import { isStepCount, streamText, type ModelMessage, type ToolSet } from 'ai';
import type { AssistantEvent } from '../../api.js';
import { fillTools, readTools, RESERVED, statusOf } from './tools.js';
import { systemPrompt, withValues } from './prompt.js';
import type { Fill } from './fill.js';
import type { AssistantEngine, AssistantOptions } from './types.js';

const FILL = ['fill_field', 'fill_entry'];

/** Names of `tools` a site may not use, because the assistant's own tools have them. */
function checkTools(tools: ToolSet) {
  const clash = Object.keys(tools).filter((n) => RESERVED.includes(n));
  if (clash.length) throw new Error(`ai tools can't be named ${clash.join(', ')}: the assistant has tools with those names.`);
}

/**
 * Makes the assistant for `createCms({ ai })`. This file is the only one that imports the `ai` package, so a site that
 * doesn't turn the assistant on doesn't need it.
 *
 *   ai: assistant({ model: 'anthropic/claude-sonnet-5-5' })
 */
export function assistant(options: AssistantOptions): AssistantEngine {
  const name = options.name?.trim() || undefined;
  const tone = options.tone?.trim() || undefined;
  if (!options.model || (typeof options.model !== 'string' && typeof options.model !== 'object'))
    throw new Error("assistant needs a model: an AI Gateway id like 'anthropic/claude-sonnet-5-5', or an AI SDK model.");
  if ((name?.length ?? 0) > 40) throw new Error('assistant name is up to 40 characters.');
  if ((tone?.length ?? 0) > 300) throw new Error('assistant tone is up to 300 characters.');
  if (options.tools && typeof options.tools !== 'function') checkTools(options.tools);
  const steps = Math.max(1, Math.floor(options.maxSteps ?? 6));

  return {
    name,
    async *run({ ctx, content, input, signal }): AsyncGenerator<AssistantEvent> {
      const { key, slug, values } = input.page;
      const canFill = !!key && Object.hasOwn(ctx.config, key);
      const fills: Fill[] = [];

      const custom = typeof options.tools === 'function' ? options.tools({ page: { key, slug } }) : (options.tools ?? {});
      checkTools(custom);
      const tools: ToolSet = {
        ...custom,
        ...readTools(ctx, content),
        ...(canFill ? fillTools(ctx, { key: key!, slug, values, onFill: (f) => fills.push(f) }) : {}),
      };

      // A conversation has to open with a question.
      const asked = input.messages.map((m): ModelMessage => ({ role: m.role, content: m.content }));
      while (asked.length > 1 && asked[0].role === 'assistant') asked.shift();
      const last = asked[asked.length - 1];
      if (canFill && last?.role === 'user' && typeof last.content === 'string') last.content = withValues(ctx, input, last.content);

      const result = streamText({
        model: options.model,
        system: systemPrompt(ctx, input, { name, tone }),
        messages: asked,
        tools,
        stopWhen: isStepCount(steps),
        abortSignal: signal,
      });

      let finish: string | undefined;
      for await (const part of result.fullStream) {
        if (signal?.aborted) return;
        if (part.type === 'text-delta') yield { type: 'text', text: part.text };
        else if (part.type === 'tool-call') {
          if (!FILL.includes(part.toolName)) yield { type: 'status', text: statusOf(part.toolName) };
        } else if (part.type === 'tool-result' || part.type === 'tool-error') {
          // A fill tool has finished (it queued what passed): send it to the form.
          while (fills.length) yield { type: 'fill', ...fills.shift()! };
        } else if (part.type === 'finish-step') finish = part.finishReason;
        // The route logs it and tells the editor the request failed, without the provider's message.
        else if (part.type === 'error') throw part.error;
      }
      while (fills.length) yield { type: 'fill', ...fills.shift()! };
      // The last step was a tool call, so the step limit stopped it before an answer.
      if (finish === 'tool-calls') yield { type: 'error', message: 'Stopped: the assistant used all its steps without finishing. Ask again, more narrowly.' };
    },
  };
}
