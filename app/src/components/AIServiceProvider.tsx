import { useEffect } from "react";
import { getAIService } from "@/services/ai/ai-service";
import { GeminiProvider } from "@/services/ai/gemini-provider";

/**
 * Component that initializes AI services on app startup
 * This should be mounted once at the app root
 */
export function AIServiceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize AI service with Gemini provider
    const aiService = getAIService();
    
    // Get Gemini API key from environment
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (geminiApiKey) {
      const geminiProvider = new GeminiProvider({
        apiKey: geminiApiKey,
        model: "gemini-2.5-flash",
      });
      
      aiService.registerProvider(geminiProvider);
      aiService.setDefaultProvider("gemini");
      
      console.log("AI Service initialized with Gemini provider");
    } else {
      console.warn("VITE_GEMINI_API_KEY not found. AI features will not be available.");
    }
  }, []);

  return <>{children}</>;
}

