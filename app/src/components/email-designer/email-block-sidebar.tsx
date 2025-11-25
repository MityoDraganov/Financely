import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Text, MousePointerClick, Minus, ScanLine, ImageIcon } from "lucide-react";

type BlockType = "text" | "button" | "divider" | "spacer" | "image";

type EmailBlockSidebarProps = {
  onAddBlock: (type: BlockType) => void;
};

const blockOptions: { type: BlockType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", icon: Text },
  { type: "button", icon: MousePointerClick },
  { type: "divider", icon: Minus },
  { type: "spacer", icon: ScanLine },
  { type: "image", icon: ImageIcon },
];

export function EmailBlockSidebar({ onAddBlock }: EmailBlockSidebarProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-none bg-card/80 shadow-none h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          {t("emailDesigner.blocks.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2">
        {blockOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Button
              key={option.type}
              variant="outline"
              className="justify-start gap-2"
              onClick={() => onAddBlock(option.type)}
            >
              <Icon className="h-4 w-4" />
              {t(`emailDesigner.blocks.${option.type}` as const)}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}


