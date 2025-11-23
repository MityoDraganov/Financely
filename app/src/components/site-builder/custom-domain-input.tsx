import { Loader2, CheckCircle2, Info, Copy, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CustomDomainInputProps {
  customDomain: string;
  onCustomDomainChange: (value: string) => void;
  onAddDomain: () => void;
  onRemoveDomain?: () => void;
  isAdding: boolean;
  isRemoving?: boolean;
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
  onRemoveDomain,
  isAdding,
  isRemoving = false,
  domainStatus,
  dnsConfigured,
  dnsInstructions,
  message,
}: CustomDomainInputProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    // Copy feedback handled by toast
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
          disabled={isAdding || isRemoving}
        />
        {domainStatus && onRemoveDomain ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Custom Domain</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove <strong>{customDomain}</strong>? 
                  This will remove the domain from your site configuration. 
                  You can add it again later if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onRemoveDomain}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove Domain
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
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
            ) : (
              "Add Domain"
            )}
          </Button>
        )}
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

      {/* DNS Instructions - Always show for Cloudflare hosting, or when DNS not configured */}
      {dnsInstructions && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Configuration Required</CardTitle>
            <CardDescription className="text-xs">
              {dnsConfigured ? (
                <>
                  <strong>Additional Steps Required:</strong> Even though DNS was configured in Cloudflare, you need to complete the steps below to finish setting up your custom domain.
                </>
              ) : (
                <>
                  <strong>Manual Configuration Required:</strong> Since your domain is managed by an external DNS provider (not Cloudflare), you need to manually configure the DNS record below in your DNS provider's dashboard (e.g., No-IP, GoDaddy, Namecheap, etc.).
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            {/* DNS Configuration */}
            <div className="min-w-0">
              <h4 className="font-semibold text-sm mb-2">
                Configure DNS Record
                {dnsConfigured && " (Optional - Already configured in Cloudflare)"}
              </h4>
              <div className="bg-muted p-3 rounded-md space-y-2 font-mono text-sm overflow-x-auto">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0">Type:</span>
                  <span className="font-semibold">{dnsInstructions.type}</span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0">Name:</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold break-all">{dnsInstructions.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyToClipboard(dnsInstructions!.name)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0">Value:</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold break-all text-left">{dnsInstructions.value}</span>
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
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">TTL:</span>
                    <span className="font-semibold">{dnsInstructions.ttl}</span>
                  </div>
                )}
              </div>
              {!dnsConfigured && (
                <Alert className="mt-3">
                  <Info className="h-4 w-4 shrink-0" />
                  <AlertDescription className="text-xs">
                    <strong>DNS Configuration Steps:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-2 ml-2">
                      <li>Log in to your DNS provider's dashboard (e.g., No-IP, GoDaddy, Namecheap)</li>
                      <li>Navigate to DNS Records or DNS Management</li>
                      <li>
                        Find and update the existing record for <code className="bg-muted px-1 rounded break-all">{dnsInstructions.name === "@" ? customDomain.split(".").slice(-2).join(".") : customDomain.split(".")[0]}</code> or create a new one
                      </li>
                      <li>Set the record type to <strong>{dnsInstructions.type}</strong></li>
                      <li>
                        Set the value/target to: <code className="bg-muted px-1 rounded break-all">{dnsInstructions.value}</code>
                      </li>
                      <li>Save the changes</li>
                      <li>Wait for DNS propagation (usually 5-30 minutes, can take up to 48 hours)</li>
                    </ol>
                    <div className="mt-2 pt-2 border-t">
                      <strong>Important:</strong> Make sure to update any existing DNS records pointing to old values. 
                      DNS changes can take up to 48 hours to propagate, but usually happen within minutes.
                    </div>
                    {dnsInstructions.type === "CNAME" && dnsInstructions.name === "@" && (
                      <div className="mt-2 pt-2 border-t">
                        <strong>Note for apex domains:</strong> Some DNS providers don't support CNAME for apex domains. 
                        If your provider doesn't support CNAME, use an ALIAS or ANAME record pointing to the same value.
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
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

