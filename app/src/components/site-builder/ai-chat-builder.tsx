import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Image as ImageIcon, X, Sparkles, Plus, MessageSquare, FileText } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useChatGenerateSite } from "@/hooks/service-hooks/use-chat-generate-site";
import { useUploadFile } from "@/hooks/service-hooks/use-upload-file";
import { useBrandSite, useUpdateBrandSite } from "@/hooks/repository-hooks/use-brand-site";
import { StreamingText } from "./streaming-text";
import { ProcessingStepAnimation, type ProcessingStep } from "./processing-step-animation";
import { HtmlPreviewDrawer } from "./html-preview-drawer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  timestamp: string;
  isTyping?: boolean;
  processingStep?: ProcessingStep; // For showing animations during processing
  isHtmlPreview?: boolean; // Mark HTML preview messages for special rendering
}

interface AIChatBuilderProps {
  brandSiteId: string | null;
  organizationId: string;
  onSiteUpdated?: () => void;
}

interface UploadingImage {
  id: string;
  file: File;
  progress: number;
  preview: string;
}

export function AIChatBuilder({
  brandSiteId,
  organizationId,
}: AIChatBuilderProps) {
  const { t } = useTranslation();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>("index"); // "index" = home page, "all" = entire site
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const uploadFile = useUploadFile();
  const chatGenerateSite = useChatGenerateSite();
  const { data: brandSite } = useBrandSite(brandSiteId);
  
  // Debug: Log brandSite updates
  useEffect(() => {
    if (brandSite) {
      console.log("📦 brandSite updated:", {
        id: brandSite.id,
        status: brandSite.status,
        hasFiles: !!brandSite.files,
        filesCount: brandSite.files ? Object.keys(brandSite.files).length : 0,
        fileKeys: brandSite.files ? Object.keys(brandSite.files) : [],
        hasConversations: !!brandSite.conversations,
        conversationsCount: brandSite.conversations?.length || 0,
      });
    }
  }, [brandSite]);
  const updateBrandSite = useUpdateBrandSite();
  
  // Helper function to save conversation to Firestore
  const saveConversation = useMemo(() => async (conversationId: string, conversationMessages: ChatMessage[], title?: string) => {
    if (!brandSiteId) return;

    const conversations = brandSite?.conversations || [];
    const existingIndex = conversations.findIndex(c => c.id === conversationId);
    
    // Generate title from first user message if not provided
    const conversationTitle = title || conversationMessages
      .find(m => m.role === "user")?.content
      .substring(0, 50) || "New Conversation";

    const conversationData = {
      id: conversationId,
      title: conversationTitle,
      messages: conversationMessages.filter(m => !m.isTyping), // Remove typing indicators
      createdAt: existingIndex >= 0 
        ? conversations[existingIndex].createdAt 
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedConversations: typeof conversations;
    if (existingIndex >= 0) {
      updatedConversations = [...conversations];
      updatedConversations[existingIndex] = conversationData;
    } else {
      updatedConversations = [...conversations, conversationData];
    }

    await updateBrandSite.mutateAsync({
      id: brandSiteId,
      data: {
        conversations: updatedConversations,
      },
    });
  }, [brandSiteId, brandSite?.conversations, updateBrandSite]);
  
  // Track processing step based on brand site status
  const getProcessingStep = useMemo(() => (): ProcessingStep | undefined => {
    if (!brandSite?.status) return undefined;
    if (brandSite.status === "pending") return "initializing";
    if (brandSite.status === "generating") return "generating";
    if (brandSite.status === "deploying") return "deploying";
    if (brandSite.status === "success") return "complete";
    return undefined;
  }, [brandSite?.status]);

  // Get pages from brand site
  const pages = useMemo(() => {
    return (brandSite?.pages as Array<{ id: string; title: string; slug: string }>) || [];
  }, [brandSite?.pages]);
  const currentPage = selectedPageSlug === "all" ? null : (pages.find(p => p.slug === selectedPageSlug) || pages[0]);
  
  // Update selected page when pages change (e.g., when a new page is added)
  useEffect(() => {
    // Only update if current selection is invalid and not "all"
    if (selectedPageSlug !== "all" && pages.length > 0 && !pages.find(p => p.slug === selectedPageSlug)) {
      // Current selection is invalid, default to index or first page
      const indexPage = pages.find(p => p.slug === "index");
      setSelectedPageSlug(indexPage ? "index" : pages[0].slug);
    }
  }, [pages, selectedPageSlug]);

  // Load conversations from brandSite (only on initial load or when brandSite changes)
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  
  useEffect(() => {
    // Only auto-load conversations on initial mount, not when currentConversationId changes
    if (hasLoadedConversations) return;
    
    if (!brandSite?.conversations || brandSite.conversations.length === 0) {
      // Check if there's a context (initial user description) from site creation
      const initialContext = (brandSite as { context?: string })?.context;
      
      if (initialContext) {
        // Create initial conversation with AI message first, then user's description
        const conversationId = `conv-initial-${Date.now()}`;
        setCurrentConversationId(conversationId);
        
        const initialMessages: ChatMessage[] = [
          {
            id: "welcome",
            role: "assistant",
            content: t("siteBuilder.aiChatBuilder.welcomeWithContext"),
            timestamp: new Date().toISOString(),
          },
          {
            id: `user-initial-${Date.now()}`,
            role: "user",
            content: initialContext,
            timestamp: new Date().toISOString(),
          },
        ];
        
        setMessages(initialMessages);
        
        // Save this conversation to Firestore
        saveConversation(conversationId, initialMessages, t("siteBuilder.aiChatBuilder.initialWebsiteCreation")).catch((err: unknown) => {
          console.error("Failed to save initial conversation:", err);
        });
      } else {
        // No context, show welcome message
        setCurrentConversationId(null);
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: t("siteBuilder.aiChatBuilder.welcomeWithoutContext"),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      
      setHasLoadedConversations(true);
      return;
    }

    // Load the most recent conversation by default (only on initial load)
    const sortedConversations = [...brandSite.conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const latestConversation = sortedConversations[0];
    
    if (latestConversation) {
      setCurrentConversationId(latestConversation.id);
      setMessages(latestConversation.messages.map(msg => ({
        ...msg,
        isTyping: false, // Remove typing indicators when loading
      })));
    }
    
      setHasLoadedConversations(true);
  }, [brandSite?.conversations, brandSiteId, hasLoadedConversations, brandSite, saveConversation, t]);

  // Watch for conversation updates from Firestore (when async processing completes or streaming)
  useEffect(() => {
    if (!brandSite?.conversations || brandSite.conversations.length === 0) {
      return;
    }

    // If currentConversationId is set, use that conversation
    // Otherwise, check all conversations for streaming messages (in case conversationId hasn't been set yet)
    let conversation: typeof brandSite.conversations[0] | undefined;
    
    if (currentConversationId) {
      conversation = brandSite.conversations.find(c => c.id === currentConversationId);
      if (!conversation) {
        console.log("⚠️ Conversation not found", {
          currentConversationId,
          availableIds: brandSite.conversations.map(c => c.id),
        });
        return;
      }
    } else {
      // No currentConversationId - check all conversations for streaming messages
      // This handles the case where streaming starts before currentConversationId is set
      const conversationsWithStreaming = brandSite.conversations.filter(c => 
        c.messages?.some((m: { id?: string; role: string }) => m.id?.startsWith("assistant-streaming"))
      );
      
      if (conversationsWithStreaming.length > 0) {
        // Use the most recently updated conversation with streaming
        conversation = conversationsWithStreaming.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        
        // Set currentConversationId to this conversation
        if (conversation) {
          console.log("🔍 Found streaming conversation, setting currentConversationId", {
            conversationId: conversation.id,
          });
          setCurrentConversationId(conversation.id);
        }
      } else {
        // No streaming messages found, nothing to do
        return;
      }
    }
    
    if (!conversation) {
      return;
    }

    // Update messages if conversation was updated (e.g., AI response added or streamed)
    const conversationMessages = conversation.messages.map(msg => ({
      ...msg,
      isTyping: false,
    }));
    
    console.log("🟢 Conversation messages:", {
      count: conversationMessages.length,
      messages: conversationMessages.map(m => ({
        id: m.id,
        role: m.role,
        contentLength: m.content?.length || 0,
        preview: m.content?.substring(0, 50),
      })),
    });
    
    // Check if there's a streaming message being updated
    const streamingMessage = conversationMessages.find(m => m.id?.startsWith("assistant-streaming"));
    
    console.log("🟢 Streaming message check:", {
      found: !!streamingMessage,
      id: streamingMessage?.id,
      contentLength: streamingMessage?.content?.length || 0,
      preview: streamingMessage?.content?.substring(0, 100),
      role: streamingMessage?.role,
    });
    // If we have a streaming message, always update to show latest content
    if (streamingMessage) {
      console.log("🟢 Streaming message detected:", {
        id: streamingMessage.id,
        contentLength: streamingMessage.content.length,
        preview: streamingMessage.content.substring(0, 50),
      });
      
      setMessages((prev) => {
        // Remove any existing typing indicators
        const withoutTyping = prev.filter(m => !m.isTyping);
        
        // Check if streaming message already exists
        const existingIndex = withoutTyping.findIndex(m => m.id === streamingMessage.id);
        
        if (existingIndex >= 0) {
          // Update existing streaming message
          const updated = [...withoutTyping];
          updated[existingIndex] = { ...streamingMessage, isTyping: false };
          console.log("🔄 Updated streaming message:", updated[existingIndex].content.substring(0, 50));
          return updated;
        } else {
          // Add new streaming message
          console.log("➕ Added new streaming message");
          return [...withoutTyping, { ...streamingMessage, isTyping: false }];
        }
      });
      return;
    }
    
    // For non-streaming messages, update if conversation has more messages or content changed
    setMessages((prev) => {
      // Remove typing indicators for comparison
      const prevWithoutTyping = prev.filter(m => !m.isTyping);
      
      // If conversation has more messages, update
      if (conversationMessages.length > prevWithoutTyping.length) {
        console.log("📨 New messages detected:", conversationMessages.length - prevWithoutTyping.length);
        return conversationMessages;
      }
      
      // If same length, check for content changes
      if (conversationMessages.length === prevWithoutTyping.length) {
        const hasContentChange = conversationMessages.some((msg, idx) => {
          const localMsg = prevWithoutTyping[idx];
          return !localMsg || localMsg.content !== msg.content || localMsg.id !== msg.id;
        });
        
        if (hasContentChange) {
          console.log("🔄 Content changed in messages");
          return conversationMessages;
        }
      }
      
      // No changes needed
      return prev;
    });
  }, [brandSite?.conversations, currentConversationId, brandSite]);

  // Watch for HTML streaming updates in files field (for live preview during generation)
  // This works for initial site generation (no conversation needed)
  useEffect(() => {
    // Check if site is generating
    if (brandSite?.status !== "generating" && brandSite?.status !== "pending" && brandSite?.status !== "deploying") {
      // Remove HTML streaming messages when generation is complete
      setMessages((prev) => prev.filter(m => m.id !== "html-streaming-preview"));
      return;
    }

    if (!brandSite?.files || Object.keys(brandSite.files).length === 0) {
      return;
    }
    
    console.log("🔍 Checking for HTML files in brandSite.files", {
      filesCount: Object.keys(brandSite.files).length,
      fileKeys: Object.keys(brandSite.files),
      status: brandSite.status,
    });

    // Find HTML files (could be index/index.html, index.html, or other pages)
    const htmlFiles = Object.entries(brandSite.files).filter(([path]) => 
      path.endsWith(".html") || path.endsWith("/index.html")
    );
    
    if (htmlFiles.length === 0) {
      return;
    }

    // Get the largest HTML file (likely the main page being generated)
    const [largestPath, largestHtml] = htmlFiles.reduce((max, [path, html]) => 
      html.length > max[1].length ? [path, html] : max,
      ["", ""]
    );

    if (!largestHtml || largestHtml.length < 100) {
      return; // Wait for substantial content
    }

    // Calculate approximate progress based on HTML length
    // Typical HTML is 10-50KB, so we estimate progress
    const estimatedTotalSize = 30000; // ~30KB average
    const currentSize = largestHtml.length;
    const progressPercent = Math.min(100, Math.round((currentSize / estimatedTotalSize) * 100));
    
    // Extract page name from path for display
    const pageName = largestPath.includes("/") 
      ? largestPath.split("/")[0] 
      : largestPath.replace(".html", "");
    
    console.log("📝 HTML streaming update detected", {
      path: largestPath,
      pageName,
      size: currentSize,
      progress: progressPercent,
      status: brandSite.status,
      preview: largestHtml.substring(0, 100),
    });
    
    setMessages((prev) => {
      // Use a stable ID for HTML streaming messages so they update in place
      // Use a single ID for all HTML streaming to prevent duplicates
      const HTML_STREAMING_MESSAGE_ID = "html-streaming-preview";
      
      // Remove any existing HTML streaming messages first to prevent duplicates
      const filteredPrev = prev.filter(m => m.id !== HTML_STREAMING_MESSAGE_ID);
      
      // Show the actual HTML content being generated
      // Remove markdown code block markers if present (```html and ```)
      let displayHtml = largestHtml;
      if (displayHtml.startsWith("```html")) {
        displayHtml = displayHtml.replace(/^```html\s*/, "");
      }
      if (displayHtml.endsWith("```")) {
        displayHtml = displayHtml.replace(/\s*```$/, "");
      }
      
      // Show the full HTML content being generated
      const htmlContent = `\`\`\`html\n${displayHtml}\n\`\`\`\n\n`;
      
      const htmlStreamingMessage: ChatMessage = {
        id: HTML_STREAMING_MESSAGE_ID,
        role: "assistant",
        content: htmlContent,
        timestamp: new Date().toISOString(),
        isTyping: false,
        isHtmlPreview: true, // Mark as HTML preview for special rendering
      };
      
      // Always add/update at the end to ensure it's the latest
      return [...filteredPrev, htmlStreamingMessage];
    });
  }, [brandSite?.files, brandSite?.status]);

  // Add typing message with animation when site is generating (for initial site creation)
  useEffect(() => {
    if (!brandSite?.status || !currentConversationId) return;
    
    const currentStep = getProcessingStep();
    if (!currentStep || currentStep === "complete") {
      // Remove typing message when complete
      setMessages((prev) => prev.filter(m => !m.isTyping || m.id?.startsWith("typing-site-gen")));
      return;
    }

    // Check if we need to add a typing message for site generation
    setMessages((prev) => {
      const hasTypingMessage = prev.some(m => m.isTyping && m.id?.startsWith("typing-site-gen"));
      const lastMessage = prev[prev.length - 1];
      const isUserMessage = lastMessage?.role === "user";
      
      // If last message is user and site is generating, add typing indicator
      if (isUserMessage && !hasTypingMessage && (brandSite.status === "pending" || brandSite.status === "generating" || brandSite.status === "deploying")) {
        const typingMessage: ChatMessage = {
          id: `typing-site-gen-${Date.now()}`,
          role: "assistant",
          content: t("siteBuilder.aiChatBuilder.generatingSite"),
          timestamp: new Date().toISOString(),
          isTyping: true,
          processingStep: currentStep,
        };
        return [...prev, typingMessage];
      } else if (hasTypingMessage) {
        // Update existing typing message with current step
        return prev.map((msg) =>
          msg.isTyping && msg.id?.startsWith("typing-site-gen")
            ? { ...msg, processingStep: currentStep }
            : msg
        );
      }
      return prev;
    });
  }, [brandSite?.status, currentConversationId, getProcessingStep, brandSite, t]);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (!messagesContainer) return;

    const isNearBottom = 
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 200;
    
    // Only auto-scroll if user is already near the bottom (not if they scrolled up)
    if (isNearBottom) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("siteBuilder.aiChatBuilder.toasts.pleaseUploadImage"));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("siteBuilder.aiChatBuilder.toasts.imageTooLarge"));
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Add to uploading images
    const uploadingImage: UploadingImage = {
      id: uploadId,
      file,
      progress: 0,
      preview,
    };
    setUploadingImages((prev) => [...prev, uploadingImage]);

    let progressInterval: NodeJS.Timeout | null = null;
    
    try {
      // Simulate progress updates
      progressInterval = setInterval(() => {
        setUploadingImages((prev) =>
          prev.map((img) => {
            if (img.id === uploadId) {
              const newProgress = Math.min(img.progress + 10, 90);
              return { ...img, progress: newProgress };
            }
            return img;
          })
        );
      }, 200);

      // Update initial progress
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, progress: 10 } : img
        )
      );

      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via backend cloud function (create operation must be on backend)
      const result = await uploadFile.mutateAsync({
        organizationId,
        fileName: file.name,
        fileData,
        contentType: file.type,
      });

      // Clear progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      // Update progress to 100%
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, progress: 100 } : img
        )
      );

      // Small delay to show 100% before moving to attachments
      setTimeout(() => {
        if (result.url) {
          setAttachments((prev) => [...prev, result.url]);
          // Remove from uploading and cleanup preview URL
          setUploadingImages((prev) => {
            const updated = prev.filter((img) => img.id !== uploadId);
            URL.revokeObjectURL(preview);
            return updated;
          });
          toast.success(t("siteBuilder.aiChatBuilder.toasts.imageUploaded"));
        }
      }, 300);
    } catch (error) {
      // Clear progress interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Remove from uploading on error
      setUploadingImages((prev) => {
        const updated = prev.filter((img) => img.id !== uploadId);
        URL.revokeObjectURL(preview);
        return updated;
      });
      // Error toast is handled by the hook
      console.error("Upload error:", error);
    }
  };

  const removeAttachment = (index: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUploadingImage = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setUploadingImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const openPreview = (url: string) => {
    setPreviewImage(url);
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (!brandSiteId) {
      toast.error(t("siteBuilder.aiChatBuilder.toasts.generateSiteFirst"));
      return;
    }

    // Create new conversation if this is the first message
    const conversationId = currentConversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!currentConversationId) {
      console.log("📝 Setting currentConversationId before sending message", { conversationId });
      setCurrentConversationId(conversationId);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    const currentAttachments = [...attachments];
    setAttachments([]);

    // Save user message immediately
    await saveConversation(conversationId, updatedMessages);

    // Add typing indicator with processing step
    const currentStep = getProcessingStep();
    const typingMessage: ChatMessage = {
      id: `typing-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isTyping: true,
      processingStep: currentStep || "analyzing",
    };
    const messagesWithTyping = [...updatedMessages, typingMessage];
    setMessages(messagesWithTyping);

    // Build conversation history from updatedMessages (includes the new user message)
    // Filter out typing indicators and map to the format expected by the backend
    const conversationHistory = updatedMessages
      .filter((m) => !m.isTyping)
      .map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

    chatGenerateSite.mutate(
      {
        brandSiteId,
        message: userMessage.content,
        attachments: currentAttachments,
        conversationHistory,
        ...(conversationId && { conversationId }),
        ...(selectedPageSlug !== "all" && { pageSlug: selectedPageSlug }),
      } as {
        brandSiteId: string;
        message: string;
        attachments: string[];
        conversationHistory: Array<{ role: "user" | "assistant"; content: string; attachments?: string[] }>;
        conversationId?: string;
        pageSlug?: string;
      },
      {
        onSuccess: async () => {
          // Keep typing indicator visible - it will be replaced when streaming message arrives
          // The backend will create a streaming message that we'll pick up via polling
          console.log("✅ Chat request sent, waiting for streaming response...");
        },
        onError: async (error) => {
          // Remove typing indicator
          const messagesWithoutTyping = messagesWithTyping.filter((m) => !m.isTyping);

          // Add error message
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: t("siteBuilder.aiChatBuilder.toasts.error", {
              message: error instanceof Error ? error.message : t("siteBuilder.aiChatBuilder.toasts.unknownError"),
            }),
            timestamp: new Date().toISOString(),
          };
          const finalMessages = [...messagesWithoutTyping, errorMessage];
          setMessages(finalMessages);

          // Save conversation with error message
          await saveConversation(conversationId, finalMessages);
        },
      },
    );
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: t("siteBuilder.aiChatBuilder.welcomeWithoutContext"),
        timestamp: new Date().toISOString(),
      },
    ]);
    setAttachments([]);
    // Reset scroll position to top
    setTimeout(() => {
      const messagesContainer = messagesEndRef.current?.parentElement;
      if (messagesContainer) {
        messagesContainer.scrollTop = 0;
      }
    }, 0);
  };

  const handleSelectConversation = (conversationId: string) => {
    const conversation = brandSite?.conversations?.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setMessages(conversation.messages.map(msg => ({
        ...msg,
        isTyping: false,
      })));
      setAttachments([]);
      // Reset scroll position to top when switching conversations
      setTimeout(() => {
        const messagesContainer = messagesEndRef.current?.parentElement;
        if (messagesContainer) {
          messagesContainer.scrollTop = 0;
        }
      }, 0);
    }
  };

  const conversations = brandSite?.conversations || [];
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="shrink-0 border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t("siteBuilder.aiChatBuilder.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPageSlug} onValueChange={setSelectedPageSlug}>
              <SelectTrigger className="w-[200px]">
                <FileText className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t("siteBuilder.aiChatBuilder.selectPage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="font-medium">{t("siteBuilder.aiChatBuilder.entireSite")}</span>
                </SelectItem>
                {pages.length > 0 && pages.map((page) => (
                  <SelectItem key={page.id} value={page.slug}>
                    {page.title} {page.slug === "index" ? t("siteBuilder.aiChatBuilder.home") : `(/${page.slug})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              {t("siteBuilder.aiChatBuilder.newChat")}
            </Button>
          </div>
        </div>
        {selectedPageSlug === "all" ? (
          <p 
            className="text-xs text-muted-foreground mt-1"
            dangerouslySetInnerHTML={{ __html: t("siteBuilder.aiChatBuilder.editingEntireSite") }}
          />
        ) : currentPage && (
          <p 
            className="text-xs text-muted-foreground mt-1"
            dangerouslySetInnerHTML={{ 
              __html: t("siteBuilder.aiChatBuilder.editingPage", {
                title: currentPage.title,
                slug: currentPage.slug !== "index" ? ` (/${currentPage.slug})` : "",
              })
            }}
          />
        )}
        {sortedConversations.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {sortedConversations.map((conv) => (
              <Button
                key={conv.id}
                variant={currentConversationId === conv.id ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectConversation(conv.id);
                }}
                className="flex items-center gap-1 whitespace-nowrap"
              >
                <MessageSquare className="h-3 w-3" />
                {conv.title || t("siteBuilder.aiChatBuilder.untitled")}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.isTyping ? (
                  <div className="space-y-4">
                    {message.processingStep && (
                      <div className="flex justify-center py-2">
                        <ProcessingStepAnimation
                          step={message.processingStep}
                          size={80}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("siteBuilder.aiChatBuilder.aiThinking")}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {message.attachments.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={t("siteBuilder.aiChatBuilder.attachment", { index: idx + 1 })}
                            className="max-w-full h-auto rounded border"
                            style={{ maxHeight: "200px" }}
                          />
                        ))}
                      </div>
                    )}
                    {message.content ? (
                      message.isHtmlPreview ? (
                        <HtmlPreviewDrawer
                          htmlContent={message.content}
                          isStreaming={brandSite?.status === "generating" || brandSite?.status === "pending" || brandSite?.status === "deploying"}
                          processingStep={getProcessingStep() || "generating"}
                        />
                      ) : (
                        <StreamingText
                          text={message.content}
                          speed={1}
                          interval={50}
                          shouldStream={message.role === "assistant"}
                          className="whitespace-pre-wrap"
                        />
                      )
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Uploading and uploaded images */}
        {(uploadingImages.length > 0 || attachments.length > 0) && (
          <div className="px-4 py-3 border-t">
            <div className="flex gap-2 flex-wrap">
              {/* Uploading images */}
              {uploadingImages.map((uploading) => (
                <div
                  key={uploading.id}
                  className="relative group w-20 h-20 rounded-lg border-2 border-dashed border-muted overflow-visible"
                >
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <img
                      src={uploading.preview}
                      alt="Uploading"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Progress overlay */}
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-white mb-1" />
                    <span className="text-xs text-white font-medium">
                      {uploading.progress}%
                    </span>
                  </div>
                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md"
                    onClick={(e) => removeUploadingImage(uploading.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              {/* Uploaded images */}
              {attachments.map((url, index) => (
                <div
                  key={index}
                  className="relative group w-20 h-20 rounded-lg border overflow-visible cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => openPreview(url)}
                >
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <img
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Remove button on hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md"
                    onClick={(e) => removeAttachment(index, e)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4 space-y-2">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("siteBuilder.aiChatBuilder.inputPlaceholder")}
              disabled={chatGenerateSite.isPending || !brandSiteId}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
              disabled={chatGenerateSite.isPending || !brandSiteId || uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleSend}
              disabled={chatGenerateSite.isPending || !brandSiteId || (!input.trim() && attachments.length === 0)}
            >
              {chatGenerateSite.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          {previewImage && (
            <img
              src={previewImage}
              alt={t("siteBuilder.aiChatBuilder.preview")}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

