import { useTranslation } from "react-i18next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Sparkles, 
  Layout, 
  Image as ImageIcon, 
  FileText, 
  Receipt,
  Grid3x3,
  MousePointerClick,
  Mail,
  Link2,
} from "lucide-react";
import { EmailSection } from "@/core";
import { getPatternsForSection, Pattern } from "@/core/patterns/email-patterns";
import { cn } from "@/lib/utils";

type PatternSelectorProps = {
  section: EmailSection;
  onSelectPattern: (pattern: Pattern) => void;
  className?: string;
};

const patternIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "brand-header": Layout,
  "brand-nav-header": Layout,
  "announcement-header": Mail,
  "hero-centered": Sparkles,
  "hero-image-right": ImageIcon,
  "invoice-summary": Receipt,
  "two-column-content": Grid3x3,
  "three-features": Grid3x3,
  "cta-block": MousePointerClick,
  "classic-footer": Link2,
  "minimal-footer": FileText,
};

export function PatternSelector({ section, onSelectPattern, className }: PatternSelectorProps) {
  const { t } = useTranslation();
  const patterns = getPatternsForSection(section);

  if (patterns.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="px-2 pt-3">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t("emailDesigner.patterns.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("emailDesigner.patterns.description")}
        </p>
      </div>
      <div className="space-y-2 px-2 pb-3">
        {patterns.map((pattern) => {
          const Icon = patternIcons[pattern.id] || Layout;
          return (
            <Card
              key={pattern.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => onSelectPattern(pattern)}
            >
              <CardHeader className="p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {pattern.label}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 line-clamp-2">
                      {pattern.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

