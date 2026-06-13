/**
 * Self-Repair — AI-assisted element recovery when deterministic executor fails.
 * Called ONLY when an element is not found after retries.
 *
 * Strategy: send current screen elements + target description to AI →
 * AI suggests alternative selector/coordinates → retry with suggestion.
 *
 * Cost: ~$0.01-0.05 per repair call (only on failure, not every step).
 */

import { getApiKey, getBaseUrl, getDefaultModel, type ModelConfig } from './models.js';
import { McpClient } from './mcp-client.js';

interface RepairSuggestion {
  /** Suggested x coordinate to tap */
  x: number;
  /** Suggested y coordinate to tap */
  y: number;
  /** Explanation of what the AI found */
  reasoning: string;
  /** Confidence: high/medium/low */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Attempts to repair a failed element lookup using AI.
 * Sends the current screen state + what we're looking for → AI suggests coordinates.
 *
 * @param mcp - Connected MCP client
 * @param deviceId - Target device
 * @param target - What we're trying to find (label/text)
 * @param stepDescription - What the step is trying to do
 * @param model - Optional model override (uses default if not provided)
 * @returns Repair suggestion or null if AI can't help
 */
export async function attemptRepair(
  mcp: McpClient,
  deviceId: string,
  target: { label?: string; text?: string; type?: string },
  stepDescription: string,
  model?: ModelConfig
): Promise<RepairSuggestion | null> {
  const selectedModel = model || getDefaultModel();
  const apiKey = getApiKey(selectedModel);

  if (!apiKey) return null; // No API key = skip repair

  try {
    // Get current screen state
    const elements = await mcp.callTool('mobile_list_elements_on_screen', { device: deviceId });

    const prompt = buildRepairPrompt(target, stepDescription, elements);
    const suggestion = await callRepairAI(apiKey, selectedModel.apiModel, prompt);

    return suggestion;
  } catch {
    return null; // Repair failed silently — don't block execution
  }
}

/**
 * Builds the prompt for the repair AI call.
 */
function buildRepairPrompt(
  target: { label?: string; text?: string; type?: string },
  stepDescription: string,
  elementsRaw: string
): string {
  return `You are a mobile test repair assistant. An automated test step failed because the target element was not found.

## What we're looking for:
- Label: ${target.label || 'none'}
- Text: ${target.text || 'none'}
- Type: ${target.type || 'none'}
- Step: ${stepDescription}

## Current screen elements:
${elementsRaw.slice(0, 8000)}

## Task:
Find the closest matching element on screen. The element might have:
- A slightly different label/text (typo, case difference, truncated)
- Been replaced by a similar element
- A different position than expected

Respond ONLY with JSON (no markdown, no explanation):
{"x": number, "y": number, "reasoning": "why this element matches", "confidence": "high|medium|low"}

If nothing matches at all, respond: {"x": 0, "y": 0, "reasoning": "no match found", "confidence": "low"}`;
}

/**
 * Calls OpenAI for repair suggestion.
 */
async function callRepairAI(apiKey: string, model: string, prompt: string): Promise<RepairSuggestion | null> {
  const baseUrl = getBaseUrl(getDefaultModel());
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content?.trim();
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as RepairSuggestion;
    if (parsed.confidence === 'low' && parsed.x === 0 && parsed.y === 0) {
      return null; // AI couldn't find a match
    }
    return parsed;
  } catch {
    return null;
  }
}
