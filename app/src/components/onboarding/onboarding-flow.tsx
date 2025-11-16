import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  CheckCircle2, 
  Sparkles, 
  Shield, 
  Zap, 
  Users,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Palette,
  Mail,
  SkipForward,
  Bot,
  Workflow,
  FileText,
  Target
} from "lucide-react";
import { useCreateOrganization, useAddOrganizationMember, useUpdateUserRole, useCreateUser, useUserByClerkId } from "@/hooks";
import { useAcceptInvite, useInvites } from "@/hooks/use-invites";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { InviteUserDialog } from "@/components/invite/invite-user-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { Badge } from "@/components/ui/badge";
import { useOrganizationMembers } from "@/hooks/use-organization-members";

interface OrganizationFormData {
  name: string;
  description: string;
  website: string;
}

const STEPS = {
  WELCOME: 0,
  CHOOSE_PATH: 1,
  BENEFITS: 2,
  CREATE_ORG: 3,
  BRANDING: 4,
  INVITES: 5,
  JOIN_ORG: 6,
  SUCCESS: 7,
};

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: "",
    description: "",
    website: "",
  });
  const [inviteCode, setInviteCode] = useState("");
  const [brandingData, setBrandingData] = useState({
    primaryColor: "#2563eb",
    secondaryColor: "#6b7280",
    accentColor: "#10b981",
  });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Check for pending invite code on mount
  useEffect(() => {
    const pendingCode = sessionStorage.getItem('pendingInviteCode');
    if (pendingCode) {
      setInviteCode(pendingCode);
      // Clear the pending code
      sessionStorage.removeItem('pendingInviteCode');
      // Skip to join organization step
      setCurrentStep(STEPS.JOIN_ORG);
    }
  }, []);

  const { user: clerkUser } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  const createUser = useCreateUser();
  const createOrganization = useCreateOrganization();
  const addMember = useAddOrganizationMember();
  const updateUserRole = useUpdateUserRole();
  const acceptInvite = useAcceptInvite();
  const { data: organization } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const { data: invites = [] } = useInvites(organization?.id);
  const { data: members = [] } = useOrganizationMembers(organization?.id);
  
  // Check if there are any additional users (invited or accepted) besides the current user
  const hasAdditionalUsers = invites.length > 0 || (members.length > 1);

  const progress = ((currentStep + 1) / Object.keys(STEPS).length) * 100;

  const handleNext = () => {
    if (currentStep === STEPS.WELCOME) {
      setCurrentStep(STEPS.CHOOSE_PATH);
    } else if (currentStep < STEPS.SUCCESS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChooseCreate = () => {
    setCurrentStep(STEPS.BENEFITS);
  };

  const handleChooseJoin = () => {
    setCurrentStep(STEPS.JOIN_ORG);
  };

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    try {
      await acceptInvite.mutateAsync(inviteCode);
      setCurrentStep(STEPS.SUCCESS);
    } catch (error) {
      toast.error("Failed to join organization. Please check your invite code.");
      console.error("Error joining organization:", error);
    }
  };

  const handleCreateOrganization = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter an organization name");
      return;
    }

    if (!clerkUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      // Step 1: Ensure user exists in database
      let userId = dbUser?.id;
      if (!dbUser) {
        const userData = {
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          name: clerkUser.fullName || clerkUser.firstName || "User",
          // Only include avatarUrl if it exists and is not empty
          ...(clerkUser.imageUrl && { avatarUrl: clerkUser.imageUrl }),
          // Provide default values for required fields
          status: "active" as const,
          organizationRoles: {},
          preferences: {
            theme: "system" as const,
            language: "en",
            timezone: "UTC",
          },
        };
        userId = await createUser.mutateAsync(userData);
      }

      if (!userId) {
        throw new Error("Failed to create user");
      }

      // Step 2: Create organization
      const orgData = {
        name: formData.name,
        // Only include optional fields if they have values
        ...(formData.description && { description: formData.description }),
        ...(formData.website && { website: formData.website }),
        // Provide default values for required fields
        status: "active" as const,
        memberIds: [],
        subscription: {
          plan: "free" as const,
          status: "active" as const,
        },
        settings: {
          brandColors: {
            primary: "#2563eb",
            secondary: "#6b7280",
            accent: "#10b981",
          },
          security: {
            ssoEnabled: false,
          },
          customRoles: [],
          defaultCurrency: "USD",
          defaultLanguage: "en",
          defaultTimezone: "UTC",
          invoicePrefix: "INV",
          invoiceNumberStart: 1,
          features: {
            customTemplates: true,
            pdfGeneration: true,
            emailSending: true,
            apiAccess: false,
          },
          ai: {
            autoProposalSuggestions: false,
          },
        },
        usage: {
          templateCount: 0,
          invoiceCount: 0,
          memberCount: 0,
          storageBytes: 0,
        },
      };
      const orgId = await createOrganization.mutateAsync(orgData);

      // Step 3: Add current user as member
      await addMember.mutateAsync({
        organizationId: orgId,
        userId: userId,
      });

      // Step 4: Set user as owner
      await updateUserRole.mutateAsync({
        userId: userId,
        organizationId: orgId,
        role: "owner",
      });

      toast.success("Organization created successfully!");
      setCurrentStep(STEPS.BRANDING);
    } catch (error) {
      toast.error("Failed to create organization. Please try again.");
      console.error("Error creating organization:", error);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  const handleBrandingSave = async () => {
    if (!organization) {
      setCurrentStep(STEPS.INVITES);
      return;
    }

    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...organization.settings,
            brandColors: {
              primary: brandingData.primaryColor,
              secondary: brandingData.secondaryColor,
              accent: brandingData.accentColor,
            },
            branding: {
              ...(organization.settings?.branding || {}),
              brandImages: organization.settings?.branding?.brandImages || [],
            },
          },
        },
      });
      toast.success("Branding saved!");
      setCurrentStep(STEPS.INVITES);
    } catch {
      toast.error("Failed to save branding. Continuing anyway...");
      setCurrentStep(STEPS.INVITES);
    }
  };

  const handleBrandingSkip = () => {
    setCurrentStep(STEPS.INVITES);
  };

  const handleInvitesSkip = () => {
    setCurrentStep(STEPS.SUCCESS);
  };

  const handleInvitesContinue = () => {
    setCurrentStep(STEPS.SUCCESS);
  };

  // Render buttons based on current step
  const renderButtons = () => {
    if (currentStep === STEPS.WELCOME) {
  return (
        <div className="flex justify-center">
          <Button
            onClick={handleNext}
            size="lg"
            className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-8 rounded-xl w-full sm:w-auto"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      );
    }

    if (currentStep === STEPS.CHOOSE_PATH) {
      return null; // No buttons, cards are clickable
    }

    if (currentStep === STEPS.BENEFITS) {
      return (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button
            onClick={handleBack}
            variant="outline"
            size="lg"
            className="rounded-xl w-full sm:w-auto bg-white border-gray-300 text-gray-700 hover:bg-gray-50 md:bg-transparent md:border-border"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            size="lg"
            className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-8 rounded-xl w-full sm:w-auto"
          >
            Create Your Workspace
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      );
    }

    if (currentStep === STEPS.CREATE_ORG) {
      const isLoading = createOrganization.isPending || addMember.isPending;
      return (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button
            onClick={handleBack}
            variant="outline"
            size="lg"
            className="rounded-xl w-full sm:w-auto bg-white border-gray-300 text-gray-700 hover:bg-gray-50 md:bg-transparent md:border-border"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Back
          </Button>
          <Button
            onClick={handleCreateOrganization}
            size="lg"
            className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-8 rounded-xl w-full sm:w-auto"
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Organization
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      );
    }

    if (currentStep === STEPS.BRANDING) {
      return (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button
            onClick={handleBrandingSkip}
            variant="outline"
            size="lg"
            className="rounded-xl w-full sm:w-auto bg-white border-gray-300 text-gray-700 hover:bg-gray-50 md:bg-transparent md:border-border"
          >
            <SkipForward className="mr-2 w-5 h-5" />
            Skip for Now
          </Button>
          <Button
            onClick={handleBrandingSave}
            size="lg"
            className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-8 rounded-xl w-full sm:w-auto"
            disabled={updateOrganization.isPending}
          >
            {updateOrganization.isPending ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      );
    }

    if (currentStep === STEPS.INVITES) {
      return (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          {!hasAdditionalUsers && (
            <Button
              onClick={handleInvitesSkip}
              variant="outline"
              size="lg"
              className="rounded-xl w-full sm:w-auto bg-white border-gray-300 text-gray-700 hover:bg-gray-50 md:bg-transparent md:border-border"
            >
              <SkipForward className="mr-2 w-5 h-5" />
              Skip for Now
            </Button>
          )}
          {hasAdditionalUsers && (
            <Button
              onClick={handleInvitesContinue}
              size="lg"
              className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-8 rounded-xl w-full sm:w-auto"
            >
              Continue
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </div>
      );
    }

    if (currentStep === STEPS.JOIN_ORG) {
      const isLoading = acceptInvite.isPending;
      return (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isLoading}
            className="flex items-center gap-2 w-full sm:w-auto bg-white border-gray-300 text-gray-700 hover:bg-gray-50 md:bg-transparent md:border-border"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleJoinOrganization}
            disabled={isLoading || !inviteCode.trim()}
            className="flex items-center gap-2 bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                Join Organization
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      );
    }

    if (currentStep === STEPS.SUCCESS) {
      return (
        <div className="flex justify-center">
          <Button
            onClick={handleComplete}
            size="lg"
            className="bg-white text-[#166534] hover:bg-gray-100 md:bg-[#166534] md:hover:bg-[#0e4424] md:text-white px-12 rounded-xl w-full sm:w-auto"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 min-h-screen w-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex flex-col md:flex-row md:items-center md:justify-center overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      {/* Sticky Header - Progress Bar (Mobile Only) */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-[#166534] to-[#0e4424] backdrop-blur-sm pt-4 px-4 pb-4 md:hidden">
        <div className="w-full max-w-4xl mx-auto">
          <Progress value={progress} className="h-2 bg-white/20 [&>div]:bg-white" />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto w-full md:overflow-visible md:flex-none">
        <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-6">
          {/* Progress bar for desktop */}
          <div className="hidden md:block mb-8">
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>

        <AnimatePresence mode="wait">
          {currentStep === STEPS.WELCOME && (
              <WelcomeStep 
                key="welcome" 
                userName={clerkUser?.firstName || "there"}
                onNext={handleNext}
              />
          )}

          {currentStep === STEPS.CHOOSE_PATH && (
            <ChoosePathStep key="choose" onCreate={handleChooseCreate} onJoin={handleChooseJoin} />
          )}

          {currentStep === STEPS.BENEFITS && (
              <BenefitsStep 
                key="benefits"
                onNext={handleNext}
                onBack={handleBack}
              />
          )}

          {currentStep === STEPS.CREATE_ORG && (
            <CreateOrgStep
              key="create"
              formData={formData}
              setFormData={setFormData}
              onBack={handleBack}
              onSubmit={handleCreateOrganization}
              isLoading={createOrganization.isPending || addMember.isPending}
            />
          )}

            {currentStep === STEPS.BRANDING && (
              <BrandingStep
                key="branding"
                brandingData={brandingData}
                setBrandingData={setBrandingData}
                onSkip={handleBrandingSkip}
                onSave={handleBrandingSave}
                isLoading={updateOrganization.isPending}
              />
            )}

            {currentStep === STEPS.INVITES && (
              <InviteStep 
                key="invites"
                onSkip={handleInvitesSkip}
                onInvite={() => setInviteDialogOpen(true)}
                onContinue={handleInvitesContinue}
                invites={invites}
                hasAdditionalUsers={hasAdditionalUsers}
            />
          )}

          {currentStep === STEPS.JOIN_ORG && (
            <JoinOrgStep
              key="join"
              inviteCode={inviteCode}
              setInviteCode={setInviteCode}
              onBack={handleBack}
              onSubmit={handleJoinOrganization}
              isLoading={acceptInvite.isPending}
            />
          )}

          {currentStep === STEPS.SUCCESS && (
              <SuccessStep 
                key="success" 
                orgName={formData.name}
                onComplete={handleComplete}
              />
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Sticky Footer - Buttons (Mobile Only) */}
      {(() => {
        const buttons = renderButtons();
        return buttons && (
          <div className="sticky bottom-0 z-20 bg-gradient-to-br from-[#166534] to-[#0e4424] backdrop-blur-sm pt-4 pb-4 px-4 border-t border-white/10 md:hidden">
            <div className="w-full max-w-4xl mx-auto">
              {buttons}
      </div>
          </div>
        );
      })()}

      {/* Invite Dialog */}
      {currentStep === STEPS.INVITES && (
        <InviteUserDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />
      )}
    </div>
  );
}

function ChoosePathStep({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#166534]/10">
            <Building2 className="h-8 w-8 text-[#166534]" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 break-words">
            Choose Your Path
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 break-words">
            How would you like to get started with Financely?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Create Organization Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={onCreate}
            >
              <Card className="border-2 border-transparent group-hover:border-[#166534]/20 transition-all duration-200 h-full">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#166534]/10 group-hover:bg-[#166534]/20 transition-colors">
                    <Building2 className="h-6 w-6 text-[#166534]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Organization</h3>
                  <p className="text-gray-600 mb-4">
                    Start fresh with your own organization and invite team members
                  </p>
                  <Button className="w-full bg-[#166534] hover:bg-[#0e4424]">
                    Create New Organization
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Join Organization Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={onJoin}
            >
              <Card className="border-2 border-transparent group-hover:border-[#166534]/20 transition-all duration-200 h-full">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#166534]/10 group-hover:bg-[#166534]/20 transition-colors">
                    <Users className="h-6 w-6 text-[#166534]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Join Organization</h3>
                  <p className="text-gray-600 mb-4">
                    Join an existing organization using an invite code
                  </p>
                  <Button className="w-full bg-[#166534] hover:bg-[#0e4424]">
                    Join with Code
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function JoinOrgStep({ 
  inviteCode, 
  setInviteCode, 
  onBack, 
  onSubmit, 
  isLoading 
}: { 
  inviteCode: string; 
  setInviteCode: (code: string) => void; 
  onBack: () => void; 
  onSubmit: () => void; 
  isLoading: boolean; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#166534]/10">
            <Users className="h-8 w-8 text-[#166534]" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 break-words">
            Join Organization
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 break-words px-2">
            Enter the invite code you received to join an existing organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="inviteCode" className="text-sm font-medium text-gray-700">
                Invite Code
              </Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="Enter invite code (e.g., ABC123)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-between pt-6 hidden md:flex">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isLoading || !inviteCode.trim()}
              className="flex items-center gap-2 bg-[#166534] hover:bg-[#0e4424]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join Organization
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function WelcomeStep({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center space-y-4 pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-14 h-14 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex items-center justify-center"
          >
            <Sparkles className="w-full h-full text-white p-3 lg:p-5" />
          </motion.div>
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 break-words px-2">
            Welcome to Financely, {userName}! 🎉
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto break-words px-2">
            We're thrilled to have you here! Let's take just 2 minutes to set up your workspace and get you started on automating your finance operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center space-y-2 p-4 rounded-lg bg-gray-50">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#166534]" />
              </div>
              <h3 className="font-semibold text-gray-900">Lightning Fast</h3>
              <p className="text-sm text-gray-600">Create invoices in seconds, not hours</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-lg bg-gray-50">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#166534]" />
              </div>
              <h3 className="font-semibold text-gray-900">Secure & Compliant</h3>
              <p className="text-sm text-gray-600">Bank-grade security for your data</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-lg bg-gray-50">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-[#166534]" />
              </div>
              <h3 className="font-semibold text-gray-900">Team Collaboration</h3>
              <p className="text-sm text-gray-600">Work together seamlessly</p>
            </div>
          </div>

          <div className="flex justify-center pt-4 hidden md:flex">
            <Button
              onClick={onNext}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function BenefitsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const benefits = [
    {
      icon: Bot,
      title: "AI-Powered Automation",
      description: "Generate proposals from leads, convert to invoices, and build websites—all with AI",
      highlight: "80% time saved",
    },
    {
      icon: Target,
      title: "End-to-End Revenue Cycle",
      description: "Capture leads → Generate proposals → Create invoices → Get paid. All automated.",
      highlight: "10x faster",
    },
    {
      icon: Workflow,
      title: "Smart Workflows",
      description: "Automated approvals, payment reminders, and renewals. Your business runs itself.",
      highlight: "Zero manual work",
    },
    {
      icon: FileText,
      title: "Professional Invoices",
      description: "Drag-and-drop designer creates beautiful, compliant invoices with instant PDFs",
      highlight: "Get paid faster",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-5">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 break-words px-2">
            Everything you need to grow
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600 break-words px-2 mt-2">
            The complete platform that automates your revenue cycle from lead to payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.2 }}
                className="group p-4 rounded-lg border border-gray-200 bg-white hover:border-[#166534]/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#166534]/10 flex items-center justify-center shrink-0 group-hover:bg-[#166534]/20 transition-colors">
                    <benefit.icon className="w-5 h-5 text-[#166534]" />
                </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{benefit.title}</h3>
                      {benefit.highlight && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#166534]/10 text-[#166534] rounded-full whitespace-nowrap shrink-0">
                          {benefit.highlight}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{benefit.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#166534]" />
              <span className="text-xs text-gray-600 font-medium">Bank-grade security</span>
              </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600 font-medium">GDPR compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#166534]" />
              <span className="text-xs text-gray-600 font-medium">Team ready</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2 hidden md:flex">
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              Back
            </Button>
            <Button
              onClick={onNext}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
            >
              Create Your Workspace
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateOrgStep({
  formData,
  setFormData,
  onBack,
  onSubmit,
  isLoading,
}: {
  formData: OrganizationFormData;
  setFormData: (data: OrganizationFormData) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="mx-auto w-16 h-16 rounded-full bg-[#166534] flex items-center justify-center mb-4"
          >
            <Building2 className="w-8 h-8 text-white" />
          </motion.div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 break-words px-2">
            Create Your Organization
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 break-words px-2">
            Tell us a bit about your company to personalize your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-sm font-medium text-gray-900">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="orgName"
                placeholder="Acme Corporation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgDescription" className="text-sm font-medium text-gray-900">
                Description (Optional)
              </Label>
              <Textarea
                id="orgDescription"
                placeholder="What does your organization do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgWebsite" className="text-sm font-medium text-gray-900">
                Website (Optional)
              </Label>
              <Input
                id="orgWebsite"
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 max-w-xl mx-auto">
            <p className="text-sm text-blue-900">
              💡 <strong>Pro tip:</strong> You can invite team members and customize your workspace later from settings.
            </p>
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
              Back
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
                  Creating...
                </>
              ) : (
                <>
                  Create Organization
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

function BrandingStep({
  brandingData,
  setBrandingData,
  onSkip,
  onSave,
  isLoading,
}: {
  brandingData: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  setBrandingData: (data: typeof brandingData) => void;
  onSkip: () => void;
  onSave: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-visible">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#166534]/10">
            <Palette className="h-8 w-8 text-[#166534]" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 break-words px-2">
            Customize Your Branding
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 break-words px-2">
            Set up your organization's colors and branding. You can always change this later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">Primary Color</Label>
                <ColorPicker
                  label=""
                  value={brandingData.primaryColor}
                  onChange={(color) => setBrandingData({ ...brandingData, primaryColor: color })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">Secondary Color</Label>
                <ColorPicker
                  label=""
                  value={brandingData.secondaryColor}
                  onChange={(color) => setBrandingData({ ...brandingData, secondaryColor: color })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">Accent Color</Label>
                <ColorPicker
                  label=""
                  value={brandingData.accentColor}
                  onChange={(color) => setBrandingData({ ...brandingData, accentColor: color })}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💡 <strong>Tip:</strong> You can customize more branding options later in Settings.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 hidden md:flex">
            <Button
              onClick={onSkip}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              <SkipForward className="mr-2 w-5 h-5" />
              Skip for Now
            </Button>
            <Button
              onClick={onSave}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Continue
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

function InviteStep({ 
  onSkip, 
  onInvite,
  onContinue,
  invites,
  hasAdditionalUsers
}: { 
  onSkip: () => void; 
  onInvite: () => void;
  onContinue: () => void;
  invites: Array<{ id: string; email: string; role: string; status: string }>;
  hasAdditionalUsers: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#166534]/10">
            <Users className="h-8 w-8 text-[#166534]" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 break-words px-2">
            Invite Your Team
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-gray-600 break-words px-2">
            Invite team members to collaborate. You can always invite more people later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="text-center space-y-4">
              <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to invite your team?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click the button below to send invitations to your team members via email.
                </p>
                <Button
                  onClick={onInvite}
                  size="lg"
                  className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl mt-4"
                >
                  <Users className="mr-2 w-5 h-5" />
                  Invite Members
                </Button>
              </div>
            </div>

            {invites.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900">Invited Members</h4>
                <div className="space-y-2">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#166534]/10 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-[#166534]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                          <p className="text-xs text-gray-500">
                            {invite.status === "sent" ? "Invitation sent" : "Pending"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {invite.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💡 <strong>Tip:</strong> You can invite team members anytime from Settings → Team Members.
              </p>
            </div>
          </div>

          <div className={`flex flex-col sm:flex-row ${hasAdditionalUsers ? 'justify-end' : 'justify-between'} gap-4 pt-4 hidden md:flex`}>
            {!hasAdditionalUsers && (
              <Button
                onClick={onSkip}
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                <SkipForward className="mr-2 w-5 h-5" />
                Skip for Now
              </Button>
            )}
            {hasAdditionalUsers && (
              <Button
                onClick={onContinue}
                size="lg"
                className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
              >
                Continue
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SuccessStep({ orgName, onComplete }: { orgName: string; onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
        <CardContent className="text-center space-y-6 py-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center"
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 break-words px-2">All Set! 🎉</h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-md mx-auto break-words px-2">
              Your workspace <strong>{orgName}</strong> is ready to go. Let's start creating amazing invoices!
            </p>
          </div>

          <div className="grid gap-3 max-w-md mx-auto text-left">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Organization created</p>
                <p className="text-sm text-gray-600">You're set as the owner</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Ready to create invoices</p>
                <p className="text-sm text-gray-600">Access our template designer</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Invite your team</p>
                <p className="text-sm text-gray-600">Collaborate on projects together</p>
              </div>
            </div>
          </div>

          <Button
            onClick={onComplete}
            size="lg"
            className="bg-[#166534] hover:bg-[#0e4424] text-white px-12 rounded-xl mt-4 hidden md:flex mx-auto"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}


