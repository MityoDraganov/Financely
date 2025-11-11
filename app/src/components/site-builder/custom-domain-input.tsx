import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CustomDomainInputProps {
  customDomain: string;
  onCustomDomainChange: (value: string) => void;
  onAddDomain: () => void;
  isAdding: boolean;
}

export function CustomDomainInput({
  customDomain,
  onCustomDomainChange,
  onAddDomain,
  isAdding,
}: CustomDomainInputProps) {
  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      <Label>Custom Domain (Optional)</Label>
      <div className="flex gap-2">
        <Input
          placeholder="example.com"
          value={customDomain}
          onChange={(e) => onCustomDomainChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onAddDomain}
          disabled={isAdding || !customDomain}
        >
          {isAdding ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Domain"
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Connect your custom domain to your generated site. Make sure your domain DNS is configured correctly.
      </p>
    </div>
  );
}

