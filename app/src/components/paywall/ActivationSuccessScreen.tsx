import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface ActivationSuccessScreenProps {
  organizationName: string;
  onContinue: () => void;
}

export function ActivationSuccessScreen({
  organizationName,
  onContinue,
}: ActivationSuccessScreenProps) {
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
          <CardTitle className="text-base font-semibold">Subscription Active</CardTitle>
          <CardDescription className="text-sm">
            Current subscription status for <span className="font-medium text-foreground">{organizationName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <div className="relative">
                 <Check className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600" />
                 <Input value="Active" className="pl-9 text-green-700 font-medium" disabled />
              </div>
              <p className="text-[0.8rem] text-muted-foreground">
                All features are enabled.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Input value="Monthly" disabled />
              <p className="text-[0.8rem] text-muted-foreground">
                Next invoice will be sent automatically.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={onContinue}>
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
