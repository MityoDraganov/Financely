import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TrialExpiringModalProps {
  isOpen: boolean;
  daysRemaining: number;
  organizationName: string;
  onContinue: () => void;
  onUpgrade: () => void;
}

export function TrialExpiringModal({
  isOpen,
  daysRemaining,
  organizationName,
  onContinue,
  onUpgrade,
}: TrialExpiringModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onContinue}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Trial Period Ending</DialogTitle>
          <DialogDescription>
             Your trial for <span className="font-medium text-foreground">{organizationName}</span> will expire in {daysRemaining} days.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 text-sm text-muted-foreground">
          You can continue using all features until the trial ends. After that, the organization will switch to read-only mode until activated.
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onContinue}>
            Dismiss
          </Button>
          <Button onClick={onUpgrade}>
            Activate Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
