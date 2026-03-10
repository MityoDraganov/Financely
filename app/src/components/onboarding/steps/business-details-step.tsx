import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Building2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "BG", name: "Bulgaria" },
  { code: "RO", name: "Romania" },
  { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" },
];

const CURRENCIES = [
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "PLN", label: "PLN — Polish Zloty" },
  { code: "CZK", label: "CZK — Czech Koruna" },
  { code: "HUF", label: "HUF — Hungarian Forint" },
  { code: "RON", label: "RON — Romanian Leu" },
  { code: "BGN", label: "BGN — Bulgarian Lev" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "INR", label: "INR — Indian Rupee" },
];

interface BusinessDetailsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function BusinessDetailsStep({ onNext, onBack }: BusinessDetailsStepProps) {
  const { formData, businessData, setFormData, setBusinessData } = useOnboardingStore(
    useShallow((state) => ({
      formData: state.formData,
      businessData: state.businessData,
      setFormData: state.setFormData,
      setBusinessData: state.setBusinessData,
    }))
  );

  const [logoPreview, setLogoPreview] = useState<string>(businessData.logoUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setBusinessData({ logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview("");
    setBusinessData({ logoUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canContinue = formData.name.trim().length > 0;

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
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Step 2 of 5</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Business details
        </h2>
        <p className="text-muted-foreground text-base max-w-md">
          Tell us who this workspace belongs to. This sets up your identity on documents.
        </p>
      </div>

      <div className="space-y-5 max-w-md">
        {/* Business name */}
        <div className="space-y-1.5">
          <Label htmlFor="org-name" className="text-sm font-medium">
            Business name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="org-name"
            placeholder="Acme Inc."
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            className="rounded-xl h-11"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Appears on invoices and proposals as the sender
          </p>
        </div>

        {/* Country + Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Country</Label>
            <Select
              value={businessData.country}
              onValueChange={(value) => setBusinessData({ country: value })}
            >
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(({ code, name }) => (
                  <SelectItem key={code} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Currency</Label>
            <Select
              value={businessData.currency}
              onValueChange={(value) => setBusinessData({ currency: value })}
            >
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logo upload */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
          {logoPreview ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-10 h-10 object-contain rounded-lg bg-white border border-border"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Logo uploaded</p>
                <p className="text-xs text-muted-foreground">Applied to preview</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 w-7 h-7 rounded-lg"
                onClick={removeLogo}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upload logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG up to 2MB</p>
              </div>
            </button>
          )}
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
          disabled={!canContinue}
          size="lg"
          className="rounded-xl px-8 gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
