import { Loader2, CheckCircle2, AlertCircle, Info, Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

interface CustomDomainInputProps {
  customDomain: string;
  onCustomDomainChange: (value: string) => void;
  onAddDomain: () => void;
  isAdding: boolean;
  domainStatus?: string;
  dnsConfigured?: boolean;
  dnsInstructions?: {
    type: "A" | "CNAME";
    name: string;
    value: string;
    ttl?: number;
  };
  message?: string;
}

export function CustomDomainInput({
  customDomain,
  onCustomDomainChange,
  onAddDomain,
  isAdding,
  domainStatus,
  dnsConfigured,
  dnsInstructions,
  message,
}: CustomDomainInputProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-gray-200 pt-4 space-y-4">
      <div>
        <Label>Custom Domain (Optional)</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Connect your own domain to your site. DNS configuration may be required.
        </p>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="example.com or www.example.com"
          value={customDomain}
          onChange={(e) => onCustomDomainChange(e.target.value)}
          className="flex-1"
          disabled={isAdding || !!domainStatus}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onAddDomain}
          disabled={isAdding || !customDomain || !!domainStatus}
        >
          {isAdding ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : domainStatus ? (
            "Domain Added"
          ) : (
            "Add Domain"
          )}
        </Button>
      </div>

      {/* Status Messages */}
      {message && (
        <Alert
          variant={dnsConfigured ? "default" : "default"}
          className={dnsConfigured ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}
        >
          {dnsConfigured ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Info className="h-4 w-4 text-blue-600" />
          )}
          <AlertDescription className={dnsConfigured ? "text-green-800" : "text-blue-800"}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* DNS Instructions */}
      {!dnsConfigured && dnsInstructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">DNS Configuration Required</CardTitle>
            <CardDescription className="text-xs">
              Add the following DNS record to your domain's DNS settings. If your DNS provider doesn't support CNAME for apex domains, use ALIAS/ANAME records instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted p-3 rounded-md space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-semibold">{dnsInstructions.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{dnsInstructions.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(dnsInstructions!.name)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Value:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold break-all text-right">{dnsInstructions.value}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => copyToClipboard(dnsInstructions!.value)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {dnsInstructions.ttl && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TTL:</span>
                  <span className="font-semibold">{dnsInstructions.ttl}</span>
                </div>
              )}
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Important:</strong> DNS changes can take up to 48 hours to propagate. 
                Firebase will automatically provision an SSL certificate once DNS is configured correctly (may take 24-48 hours).
                {dnsInstructions.type === "CNAME" && dnsInstructions.name === "@" && (
                  <span className="block mt-1">
                    <strong>Note for apex domains:</strong> Some DNS providers don't support CNAME for apex domains. 
                    If your provider doesn't support CNAME, use an ALIAS or ANAME record pointing to the same value.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Domain Status */}
      {domainStatus && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Domain Status:</strong> {domainStatus}
            {domainStatus === "PENDING" && (
              <span className="block mt-1 text-xs text-muted-foreground">
                SSL certificate is being provisioned. This may take 24-48 hours.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

