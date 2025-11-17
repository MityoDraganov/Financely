import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Send, Image as ImageIcon, X, Sparkles, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useChatGenerateSite } from "@/hooks/service-hooks/use-chat-generate-site";
import { useUploadFile } from "@/hooks/service-hooks/use-upload-file";
import { useBrandSite, useUpdateBrandSite } from "@/hooks/repository-hooks/use-brand-site";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  timestamp: string;
  isTyping?: boolean;
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
  onSiteUpdated,
}: AIChatBuilderProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const uploadFile = useUploadFile();
  const chatGenerateSite = useChatGenerateSite();
  const { data: brandSite } = useBrandSite(brandSiteId);
  const updateBrandSite = useUpdateBrandSite();

  // Load conversations from brandSite (only on initial load or when brandSite changes)
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  
  useEffect(() => {
    // Only auto-load conversations on initial mount, not when currentConversationId changes
    if (hasLoadedConversations) return;
    
    if (!brandSite?.conversations || brandSite.conversations.length === 0) {
      // No conversations yet, start fresh
      setCurrentConversationId(null);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm your AI site builder. I can help you create or update your website. What would you like to do?\n",
          timestamp: new Date().toISOString(),
        },
      ]);
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
  }, [brandSite?.conversations, brandSiteId, hasLoadedConversations]);

  // Helper function to save conversation to Firestore
  const saveConversation = async (conversationId: string, conversationMessages: ChatMessage[], title?: string) => {
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
  };

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
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB");
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
          toast.success("Image uploaded");
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
      toast.error("Please generate a site first");
      return;
    }

    // Create new conversation if this is the first message
    const conversationId = currentConversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!currentConversationId) {
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

    // Add typing indicator
    const typingMessage: ChatMessage = {
      id: `typing-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isTyping: true,
    };
    const messagesWithTyping = [...updatedMessages, typingMessage];
    setMessages(messagesWithTyping);

    chatGenerateSite.mutate(
      {
        brandSiteId,
        message: userMessage.content,
        attachments: currentAttachments,
        conversationHistory: messages
          .filter((m) => !m.isTyping)
          .map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
      },
      {
        onSuccess: async (data) => {
          // Remove typing indicator
          const messagesWithoutTyping = messagesWithTyping.filter((m) => !m.isTyping);

          // Add AI response
          const aiMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.response || "I've updated your site. Check the preview!",
            timestamp: new Date().toISOString(),
          };
          const finalMessages = [...messagesWithoutTyping, aiMessage];
          setMessages(finalMessages);

          // Save conversation with AI response
          await saveConversation(conversationId, finalMessages);

          if (data.updated) {
            onSiteUpdated?.();
          }
        },
        onError: async (error) => {
          // Remove typing indicator
          const messagesWithoutTyping = messagesWithTyping.filter((m) => !m.isTyping);

          // Add error message
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        content: "Hello! I'm your AI site builder. I can help you create or update your website. What would you like to do?\n",
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Chat Builder
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewConversation}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
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
                {conv.title || "Untitled"}
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
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                ) : (
                  <>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {message.attachments.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Attachment ${idx + 1}`}
                            className="max-w-full h-auto rounded border"
                            style={{ maxHeight: "200px" }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.content}</div>
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
              placeholder="Type your message or request..."
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
          <p className="text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

