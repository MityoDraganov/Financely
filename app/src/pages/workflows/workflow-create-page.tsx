import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WorkflowBuilderWrapper from "@/components/workflow/workflow-builder-wrapper";

export default function WorkflowCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/workflows");
  };

  return (
    <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <Card className="border-border/70 bg-muted/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("workflows.builder.create")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("workflows.builder.description.create")}</p>
          </div>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("workflows.execution.back")}
          </Button>
        </CardContent>
      </Card>

      <WorkflowBuilderWrapper editingWorkflow={null} onCancelEdit={handleBack} />
    </div>
  );
}
