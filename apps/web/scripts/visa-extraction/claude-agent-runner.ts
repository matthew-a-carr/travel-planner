// Dev-only runner: extract one (nationality, destination)'s visa rules via the
// Claude Agent SDK using a Claude subscription (CLAUDE_CODE_OAUTH_TOKEN). Never
// imported by the app — only by scripts/extract-visa-rules.ts. SPEC-019/ADR 062.

import { query } from '@anthropic-ai/claude-agent-sdk';
import { EXTRACTION_SYSTEM_PROMPT } from '../../src/infrastructure/visa-extraction/extraction-schema';

export async function extractWithClaudeAgent(
  prompt: string,
  jsonSchema: Record<string, unknown>,
): Promise<unknown> {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Set CLAUDE_CODE_OAUTH_TOKEN (run `claude setup-token`) to use --runner=claude.',
    );
  }

  const response = query({
    prompt,
    options: {
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      outputFormat: { type: 'json_schema', schema: jsonSchema },
      allowedTools: ['WebSearch', 'WebFetch'],
      permissionMode: 'bypassPermissions',
      maxTurns: 8,
    },
  });

  for await (const message of response) {
    if (message.type === 'result') {
      if (message.subtype === 'success' && message.structured_output !== undefined) {
        return message.structured_output;
      }
      throw new Error(`Claude Agent SDK did not return structured output (${message.subtype}).`);
    }
  }
  throw new Error('Claude Agent SDK produced no result message.');
}
