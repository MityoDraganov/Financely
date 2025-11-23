import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRevokedAccess } from "@/hooks/use-revoked-access";
import { useOrganizationContext } from "@/contexts/organization-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";

/**
 * Component that shows a one-time alert when a user has been revoked from an organization
 * This will show the first time the user sees they've been revoked, then never again
 */
export function RevokedAccessAlert() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shouldShowMessage, organizationId } = useRevokedAccess();
  const { organizations, switchOrganization } = useOrganizationContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowMessage) {
      setOpen(true);
    }
  }, [shouldShowMessage]);

  const handleClose = () => {
    setOpen(false);
    
    // Mark message as shown for this organization
    if (organizationId) {
      const shownKey = `financely_revoked_access_shown_${organizationId}`;
      localStorage.setItem(shownKey, "true");
    }
    
    // Switch to another organization if available
    const otherOrg = organizations.find(org => org.id !== organizationId);
    if (otherOrg) {
      switchOrganization(otherOrg.id);
      navigate("/dashboard");
    } else {
      // No other organizations, redirect to onboarding
      navigate("/onboarding", { replace: true });
    }
  };

  if (!shouldShowMessage) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-lg">
              {t('settings.users.allUsers.accessRevoked', { defaultValue: "Access Revoked" })}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-muted-foreground pt-2">
            {t('settings.users.allUsers.accessRevokedDescription', {
              defaultValue: "Your access to this organization has been revoked. You will be redirected to another organization or the onboarding page.",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleClose} className="w-full sm:w-auto">
            {t('common.understand', { defaultValue: "I Understand" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

