import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sanitizeTranslationHtml } from "@/utils/html-sanitizer";

interface OrganizationFormData {
  name: string;
  description: string;
  website: string;
}

interface CreateOrgStepProps {
  formData: OrganizationFormData;
  setFormData: (data: OrganizationFormData) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  setStoreFormData?: (data: Partial<OrganizationFormData>) => void;
}

export function CreateOrgStep({
  formData,
  setFormData,
  onBack,
  onSubmit,
  isLoading = false,
  setStoreFormData,
}: CreateOrgStepProps) {
  const { t } = useTranslation();
  
  const handleChange = (field: keyof OrganizationFormData, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    if (setStoreFormData) {
      setStoreFormData({ [field]: value });
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-4"
          >
            <Building2 className="w-8 h-8 text-white" />
          </motion.div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground break-words px-2">
            {t("onboarding.createOrg.title")}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground break-words px-2">
            {t("onboarding.createOrg.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-sm font-medium text-foreground">
                {t("onboarding.createOrg.orgName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="orgName"
                placeholder={t("onboarding.createOrg.orgNamePlaceholder")}
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgDescription" className="text-sm font-medium text-foreground">
                {t("onboarding.createOrg.descriptionLabel")}
              </Label>
              <Textarea
                id="orgDescription"
                placeholder={t("onboarding.createOrg.descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgWebsite" className="text-sm font-medium text-foreground">
                {t("onboarding.createOrg.website")}
              </Label>
              <Input
                id="orgWebsite"
                type="url"
                placeholder={t("onboarding.createOrg.websitePlaceholder")}
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="bg-accent rounded-lg p-4 max-w-xl mx-auto">
            {/* HTML is sanitized before rendering to prevent XSS */}
            <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeTranslationHtml(t("onboarding.createOrg.proTip")) }} />
          </div>

          <div className="flex justify-between pt-4 hidden md:flex">
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="rounded-xl"
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              {t("onboarding.buttons.back")}
            </Button>
            <Button
              onClick={onSubmit}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
              disabled={isLoading || !formData.name.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  {t("onboarding.createOrg.creating")}
                </>
              ) : (
                <>
                  {t("onboarding.createOrg.createButton")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
