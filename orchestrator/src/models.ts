/**
 * Model registry — single source of truth for all AI model options.
 * Maps user-facing choices → provider, model ID, API key env var, cost estimate.
 *
 * To add a new model: add an entry here. Everything else picks it up automatically.
 */

export interface ModelConfig {
  /** User-facing ID (used in CLI --model flag) */
  id: string;
  /** Display label in interactive menu */
  label: string;
  /** Provider name */
  provider: 'openai';
  /** Exact model ID sent to the API */
  apiModel: string;
  /** Environment variable name for the API key */
  envKey: string;
  /** Environment variable name for custom base URL (optional) */
  baseUrlEnvKey: string;
  /** Default base URL if env not set */
  defaultBaseUrl: string;
  /** Cost hint shown to user */
  costHint: string;
}

/**
 * All available models.
 * Order = display order in menu.
 */
export const MODELS: ModelConfig[] = [
  {
    id: 'gpt-3.5',
    label: 'GPT-3.5 Turbo',
    provider: 'openai',
    apiModel: 'gpt-3.5-turbo',
    envKey: 'OPENAI_API_KEY',
    baseUrlEnvKey: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1',
    costHint: '~$0.05-0.15 per generate (cheapest)',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    apiModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    baseUrlEnvKey: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1',
    costHint: '~$0.15-0.50 per generate (recommended)',
  },
];

/** Default model if none selected */
export const DEFAULT_MODEL_ID = 'gpt-4o-mini';

/**
 * Finds a model config by its ID.
 * @param id - Model ID (e.g., 'gpt-4o-mini')
 * @returns Model config or undefined
 */
export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * Gets the default model config.
 */
export function getDefaultModel(): ModelConfig {
  return MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

/**
 * Validates that the required API key env var is set for a model.
 * @param model - Model config
 * @returns true if key is set, false otherwise
 */
export function hasApiKey(model: ModelConfig): boolean {
  return !!process.env[model.envKey];
}

/**
 * Gets the API key value for a model.
 * @param model - Model config
 * @returns API key string or undefined
 */
export function getApiKey(model: ModelConfig): string | undefined {
  return process.env[model.envKey];
}

/**
 * Gets the base URL for a model (custom or default).
 * @param model - Model config
 * @returns Base URL string
 */
export function getBaseUrl(model: ModelConfig): string {
  return process.env[model.baseUrlEnvKey] || model.defaultBaseUrl;
}
