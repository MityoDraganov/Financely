// AI Service interfaces and types
export interface JSONSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
}

export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface AIProvider {
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T>;
  getName(): string;
  isAvailable(): boolean;
}

export interface AIService {
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T>;
  registerProvider(provider: AIProvider): void;
  setDefaultProvider(providerName: string): void;
  getProvider(providerName?: string): AIProvider | null;
  listProviders(): string[];
}

/**
 * Default AI Service Implementation for Firebase Functions
 * Manages multiple AI providers and routes requests to them
 */
export class DefaultAIService implements AIService {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProviderName: string | null = null;

  /**
   * Register a new AI provider
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.getName(), provider);
    
    // Set as default if no default is set
    if (!this.defaultProviderName) {
      this.defaultProviderName = provider.getName();
    }
  }

  /**
   * Set the default provider to use
   */
  setDefaultProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} is not registered`);
    }
    this.defaultProviderName = providerName;
  }

  /**
   * Get a specific provider by name, or the default provider
   */
  getProvider(providerName?: string): AIProvider | null {
    const name = providerName || this.defaultProviderName;
    if (!name) {
      return null;
    }
    return this.providers.get(name) || null;
  }

  /**
   * List all available providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Generate content using the default or specified provider
   */
  async generate(prompt: string, options?: AIGenerationOptions): Promise<string> {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error("No AI provider is available. Please register a provider first.");
    }
    
    if (!provider.isAvailable()) {
      throw new Error(`AI provider ${provider.getName()} is not available. Please check configuration.`);
    }
    
    return provider.generate(prompt, options);
  }

  /**
   * Generate structured JSON content
   */
  async generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T> {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error("No AI provider is available. Please register a provider first.");
    }
    
    if (!provider.isAvailable()) {
      throw new Error(`AI provider ${provider.getName()} is not available. Please check configuration.`);
    }
    
    return provider.generateJSON<T>(prompt, schema, options);
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

/**
 * Get or create the AI service instance
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new DefaultAIService();
  }
  return aiServiceInstance;
}

