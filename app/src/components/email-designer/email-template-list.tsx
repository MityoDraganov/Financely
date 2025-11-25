import { EmailTemplate } from "@/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

type EmailTemplateListProps = {
  templates: EmailTemplate[];
  selectedTemplateId?: string;
  onSelect: (templateId: string) => void;
  onCreate: () => void;
  isCreating?: boolean;
};

export function EmailTemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onCreate,
  isCreating,
}: EmailTemplateListProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full flex flex-col border-none bg-card/80 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg font-semibold text-foreground">
          {t("emailDesigner.templates.title")}
        </CardTitle>
        <Button size="sm" onClick={onCreate} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
          {t("emailDesigner.actions.create")}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        {templates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 text-muted-foreground">
            <Mail className="h-10 w-10 mb-3 opacity-70" />
            <p className="text-sm">{t("emailDesigner.templates.empty")}</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-2 p-4">
              {templates.map((template) => {
                const isSelected = template.id === selectedTemplateId;
                return (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template.id)}
                    className={`text-left rounded-lg border bg-background/40 px-4 py-3 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{template.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {template.subject}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}


