import { useState } from "react";
import { TrialExpiringModal } from "@/components/paywall/TrialExpiringModal";
import { TrialEndedScreen } from "@/components/paywall/TrialEndedScreen";
import { ActivationSuccessScreen } from "@/components/paywall/ActivationSuccessScreen";
import { Button } from "@/components/ui/button";

export default function PaywallPreview() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="p-8 space-y-12 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Paywall Screens Preview</h1>
        <p className="text-muted-foreground">
          This page demonstrates the paywall/trial screens.
        </p>
      </div>

      <section className="space-y-4 border p-6 rounded-lg bg-background">
        <h2 className="text-2xl font-semibold">1. Trial Expiring Modal</h2>
        <p>Click the button below to open the modal.</p>
        <Button onClick={() => setModalOpen(true)}>Open Trial Expiring Modal</Button>
        <TrialExpiringModal
          isOpen={modalOpen}
          organizationName="Acme Corp"
          daysRemaining={3}
          onUpgrade={() => {
            alert("Activate clicked");
            setModalOpen(false);
          }}
          onContinue={() => setModalOpen(false)}
        />
      </section>

      <section className="space-y-4 border p-6 rounded-lg bg-background">
        <h2 className="text-2xl font-semibold">2. Trial Ended Screen (Read-Only)</h2>
        <div className="border rounded-lg overflow-hidden">
          <TrialEndedScreen
            organizationName="Acme Corp"
            onActivate={() => alert("Activate clicked")}
          />
        </div>
      </section>

      <section className="space-y-4 border p-6 rounded-lg bg-background">
        <h2 className="text-2xl font-semibold">3. Activation Success Screen</h2>
        <div className="border rounded-lg overflow-hidden">
          <ActivationSuccessScreen
            organizationName="Acme Corp"
            onContinue={() => alert("Continue clicked")}
          />
        </div>
      </section>
    </div>
  );
}
