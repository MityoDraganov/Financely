import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Layers, Plus, Check, Loader2, FileText, Mail, Star } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";
import { useMarketplaceTemplates } from "@/hooks/repository-hooks/use-marketplace-templates";
import { MarketplaceTemplate } from "@/core";

const DEFAULT_TEMPLATES = [
  {
    id: "default-invoice",
    title: "Professional Invoice",
    description: "A clean, professional invoice template for any business",
    type: "invoice" as const,
    tags: ["invoice", "professional"],
  },
  {
    id: "default-proposal",
    title: "Service Proposal",
    description: "A structured proposal to win new clients",
    type: "invoice" as const,
    tags: ["proposal", "services"],
  },
  {
    id: "default-welcome-email",
    title: "Client Welcome Email",
    description: "A warm onboarding email to send to new clients",
    type: "email" as const,
    tags: ["email", "welcome"],
  },
];

interface TemplateSuggestionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

function TemplateCard({
  id,
  title,
  description,
  type,
  isSelected,
  isRecommended,
  onToggle,
  imageUrl,
}: {
  id: string;
  title: string;
  description: string;
  type: "invoice" | "email";
  isSelected: boolean;
  isRecommended?: boolean;
  onToggle: (id: string) => void;
  imageUrl?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50"
      }`}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail or icon */}
        <div className="shrink-0 w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : type === "email" ? (
            <Mail className="w-4 h-4 text-muted-foreground" />
          ) : (
            <FileText className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            {isRecommended && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5" />
                Suggested
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          <span className="mt-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">
            {type === "email" ? "Email template" : "Document template"}
          </span>
        </div>

        {/* Toggle indicator */}
        <div
          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>
    </motion.button>
  );
}

export function TemplateSuggestionsStep({ onNext, onBack }: TemplateSuggestionsStepProps) {
  const { businessData, selectedTemplates, setSelectedTemplates } = useOnboardingStore(
    useShallow((state) => ({
      businessData: state.businessData,
      selectedTemplates: state.selectedTemplates,
      setSelectedTemplates: state.setSelectedTemplates,
    }))
  );

  // Build search string from AI keywords
  const searchQuery = businessData.templateKeywords?.slice(0, 3).join(" ") || businessData.industry || "";

  const { data: marketplaceData, isLoading } = useMarketplaceTemplates(
    searchQuery
      ? { search: searchQuery, pageSize: 5, sort: "popular" }
      : undefined
  );

  const marketplaceTemplates: MarketplaceTemplate[] = marketplaceData?.templates ?? [];

  const toggle = (id: string) => {
    if (selectedTemplates.includes(id)) {
      setSelectedTemplates(selectedTemplates.filter((t) => t !== id));
    } else {
      setSelectedTemplates([...selectedTemplates, id]);
    }
  };

  const selectedCount = selectedTemplates.length;

  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Step 5 of 5</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Add starter templates
        </h2>
        <p className="text-muted-foreground text-base max-w-md">
          Pick the templates you'll use most. You can always add more from the marketplace later.
        </p>
      </div>

      <div className="space-y-5 max-w-md">
        {/* Marketplace suggestions */}
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding templates for your business…
            </motion.div>
          ) : marketplaceTemplates.length > 0 ? (
            <motion.div
              key="marketplace"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">Recommended for you</p>
                {businessData.businessType && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {businessData.businessType}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {marketplaceTemplates.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <TemplateCard
                      id={t.id}
                      title={t.title}
                      description={t.shortDescription || t.description || ""}
                      type={t.type}
                      isSelected={selectedTemplates.includes(t.id)}
                      isRecommended
                      onToggle={toggle}
                      imageUrl={t.previewImages?.[0]}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Default templates */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {marketplaceTemplates.length > 0 ? "Starter defaults" : "Starter templates"}
          </p>
          <div className="space-y-2">
            {DEFAULT_TEMPLATES.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <TemplateCard
                  id={t.id}
                  title={t.title}
                  description={t.description}
                  type={t.type}
                  isSelected={selectedTemplates.includes(t.id)}
                  onToggle={toggle}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="rounded-xl gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          size="lg"
          className="rounded-xl px-8 gap-2"
        >
          {selectedCount > 0 ? (
            <>
              <Plus className="w-4 h-4" />
              Add {selectedCount} template{selectedCount !== 1 ? "s" : ""} & continue
            </>
          ) : (
            <>
              Skip for now
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
