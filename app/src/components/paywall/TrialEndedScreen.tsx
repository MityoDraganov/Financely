import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TrialEndedScreenProps {
  organizationName: string;
  onActivate: () => void;
}

export function TrialEndedScreen({
  organizationName,
  onActivate,
}: TrialEndedScreenProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Standard Settings Page Header */}
      <div className="space-y-0.5 pb-3 border-b">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Organization Status
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your organization's access and subscription status.
        </p>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Access & Billing</CardTitle>
          <CardDescription className="text-sm">
            Current subscription status for <span className="font-medium text-foreground">{organizationName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <Input value="Trial Ended (Read-Only)" disabled />
              <p className="text-[0.8rem] text-muted-foreground">
                You can view data, but editing is disabled.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Data Preservation</Label>
              <Input value="Active & Safe" disabled />
              <p className="text-[0.8rem] text-muted-foreground">
                All records are preserved securely.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={onActivate}>
              Activate Organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
