import { useState } from "react";
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
  Loader2
} from "lucide-react";
import { useCreateOrganization, useAddOrganizationMember, useUpdateUserRole, useCreateUser, useUserByClerkId } from "@/hooks";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";

interface OrganizationFormData {
  name: string;
  description: string;
  website: string;
}

const STEPS = {
  WELCOME: 0,
  BENEFITS: 1,
  CREATE_ORG: 2,
  SUCCESS: 3,
};

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: "",
    description: "",
    website: "",
  });

  const { user: clerkUser } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  const createUser = useCreateUser();
  const createOrganization = useCreateOrganization();
  const addMember = useAddOrganizationMember();
  const updateUserRole = useUpdateUserRole();

  const progress = ((currentStep + 1) / Object.keys(STEPS).length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.SUCCESS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
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
      setCurrentStep(STEPS.SUCCESS);
    } catch (error) {
      toast.error("Failed to create organization. Please try again.");
      console.error("Error creating organization:", error);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen w-full h-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex items-center justify-center p-6">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="w-full max-w-4xl relative z-10">
        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>

        <AnimatePresence mode="wait">
          {currentStep === STEPS.WELCOME && (
            <WelcomeStep key="welcome" onNext={handleNext} userName={clerkUser?.firstName || "there"} />
          )}

          {currentStep === STEPS.BENEFITS && (
            <BenefitsStep key="benefits" onNext={handleNext} onBack={handleBack} />
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

          {currentStep === STEPS.SUCCESS && (
            <SuccessStep key="success" onComplete={handleComplete} orgName={formData.name} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, userName }: { onNext: () => void; userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex items-center justify-center"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <CardTitle className="text-4xl font-bold text-gray-900">
            Welcome to Financely, {userName}! 🎉
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 max-w-2xl mx-auto">
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

          <div className="flex justify-center pt-4">
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
      icon: Building2,
      title: "Professional Invoices",
      description: "Create beautiful, legally compliant invoices with our drag-and-drop designer",
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: CheckCircle2,
      title: "Smart Approvals",
      description: "Route proposals through your approval workflow automatically",
      color: "bg-green-100 text-green-600",
    },
    {
      icon: Zap,
      title: "Never Miss a Renewal",
      description: "Automated reminders ensure you never miss a contract renewal",
      color: "bg-purple-100 text-purple-600",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-3xl font-bold text-gray-900">
            Everything you need to streamline finance ops
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">
            Financely brings together all your finance workflows in one place
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-12 h-12 rounded-lg ${benefit.color} flex items-center justify-center flex-shrink-0`}>
                  <benefit.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#166534]/10 to-[#0e4424]/10 rounded-lg p-6 border border-[#166534]/20">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-[#166534] flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Your data is safe with us</h4>
                <p className="text-sm text-gray-600">
                  We use industry-leading encryption and security practices. Your financial data never leaves your control.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
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
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="mx-auto w-16 h-16 rounded-full bg-[#166534] flex items-center justify-center mb-4"
          >
            <Building2 className="w-8 h-8 text-white" />
          </motion.div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Create Your Organization
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">
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

          <div className="flex justify-between pt-4">
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

function SuccessStep({ onComplete, orgName }: { onComplete: () => void; orgName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-white/20 bg-white/95 backdrop-blur-sm shadow-2xl">
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
            <h2 className="text-4xl font-bold text-gray-900">All Set! 🎉</h2>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
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
            className="bg-[#166534] hover:bg-[#0e4424] text-white px-12 rounded-xl mt-4"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

