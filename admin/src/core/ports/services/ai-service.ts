/**
 * AI Provider Interface
 * Allows for easy extension to support multiple AI models (Gemini, OpenAI, Claude, etc.)
 */
export interface AIProvider {
  /**
   * Generate content based on a prompt
   * @param prompt - The prompt to send to the AI
   * @param options - Optional configuration for the generation
   * @returns The generated text content
   */
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  
  /**
   * Generate structured JSON content based on a prompt
   * @param prompt - The prompt to send to the AI
   * @param schema - Optional JSON schema to guide the output
   * @param options - Optional configuration for the generation
   * @returns The generated JSON object
   */
  generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T>;
  
  /**
   * Get the name of the provider (e.g., "gemini", "openai", "claude")
   */
  getName(): string;
  
  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;
}

/**
 * Options for AI content generation
 */
export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

/**
 * JSON Schema definition for structured output
 */
export interface JSONSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
}

/**
 * AI Service Interface
 * Main service for AI operations, uses providers internally
 */
export interface AIService {
  /**
   * Generate content using the default or specified provider
   */
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  
  /**
   * Generate structured JSON content
   */
  generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T>;
  
  /**
   * Register a new AI provider
   */
  registerProvider(provider: AIProvider): void;
  
  /**
   * Set the default provider to use
   */
  setDefaultProvider(providerName: string): void;
  
  /**
   * Get a specific provider by name
   */
  getProvider(providerName?: string): AIProvider | null;
  
  /**
   * List all available providers
   */
  listProviders(): string[];
}

