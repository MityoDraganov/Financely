import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useExternalSources } from "@/hooks/use-external-sources";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Loader2, CheckCircle2, XCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const sourceTypeSchema = z.object({
  type: z.enum(["rest-api", "graphql", "webhook"]),
});

const authConfigSchema = z.object({
  authType: z.enum(["none", "api-key", "basic", "bearer", "oauth2"]),
  apiKeyHeader: z.string().optional(),
  apiKeyValue: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tokenUrl: z.string().optional(),
  scope: z.string().optional(),
});

const connectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  endpoint: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  query: z.string().optional(),
  headers: z.string().optional(),
});

const refreshSchema = z.object({
  refreshStrategy: z.enum(["on-demand", "scheduled", "event-driven"]),
  schedule: z.string().optional(),
  ttl: z.number().min(60, "TTL must be at least 60 seconds"),
});

type WizardFormData = z.infer<typeof sourceTypeSchema> &
  z.infer<typeof authConfigSchema> &
  z.infer<typeof connectionSchema> &
  z.infer<typeof refreshSchema>;

interface ConnectionWizardProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: () => void;
}

function formatDataForDisplay(data: unknown): string {
  try {
    if (typeof data === "string") {
      return data;
    }
    if (data === null || data === undefined) {
      return "";
    }
    const jsonString = JSON.stringify(data, null, 2);
    return jsonString ?? "";
  } catch {
    if (data === null || data === undefined) {
      return "";
    }
    try {
      return JSON.stringify(data);
    } catch {
      return "[Unable to display data]";
    }
  }
}

export function ConnectionWizard({ open, onOpenChange, onSuccess }: ConnectionWizardProps) {
  const [step, setStep] = useState(1);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; data?: unknown } | null>(null);
  const { createSource, testConnection } = useExternalSources();
  const { data: organization } = useCurrentOrganization();

  const fullSchema = sourceTypeSchema
    .merge(authConfigSchema)
    .merge(connectionSchema)
    .merge(refreshSchema);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      type: "rest-api",
      authType: "none",
      refreshStrategy: "on-demand",
      ttl: 300,
      name: "",
      endpoint: "",
    },
    mode: "onChange",
  });

  const sourceType = form.watch("type");
  const authType = form.watch("authType");
  const refreshStrategy = form.watch("refreshStrategy");

  if (!open && step !== 1) {
    setTimeout(() => {
      setStep(1);
      setTestResult(null);
      form.reset();
    }, 100);
  }

  const handleTestConnection = async () => {
    if (!organization?.id) return;

    const values = form.getValues();
    let headers: Record<string, string> = {};
    try {
      headers = values.headers ? JSON.parse(values.headers) : {};
    } catch {
      toast.error("Invalid JSON in custom headers.");
      return;
    }

    const authConfig: {
      type: "none" | "api-key" | "basic" | "bearer" | "oauth2";
      apiKeyHeader?: string;
      apiKeyValue?: string;
      username?: string;
      password?: string;
      token?: string;
      clientId?: string;
      clientSecret?: string;
      tokenUrl?: string;
      scope?: string;
    } = {
      type: values.authType,
    };

    if (values.authType === "api-key") {
      authConfig.apiKeyHeader = values.apiKeyHeader || "X-API-Key";
      authConfig.apiKeyValue = values.apiKeyValue;
    } else if (values.authType === "basic") {
      authConfig.username = values.username;
      authConfig.password = values.password;
    } else if (values.authType === "bearer") {
      authConfig.token = values.token;
    } else if (values.authType === "oauth2") {
      authConfig.clientId = values.clientId;
      authConfig.clientSecret = values.clientSecret;
      authConfig.tokenUrl = values.tokenUrl;
      authConfig.scope = values.scope;
    }

    const result = await testConnection.mutateAsync({
      organizationId: organization.id,
      data: {
        name: values.name,
        type: values.type,
        endpoint: values.endpoint || "",
        authConfig: authConfig as unknown as {
          type: "api-key" | "basic" | "bearer" | "oauth2";
          apiKeyHeader?: string;
          apiKeyValue?: string;
          username?: string;
          password?: string;
          token?: string;
          clientId?: string;
          clientSecret?: string;
          tokenUrl?: string;
          scope?: string;
        },
        query: values.query,
        headers,
      },
    });

    setTestResult(result);
  };

  const handleSubmit = async () => {
    if (!organization?.id) return;

    const values = form.getValues();
    let headers: Record<string, string> = {};
    try {
      headers = values.headers ? JSON.parse(values.headers) : {};
    } catch {
      toast.error("Invalid JSON in custom headers.");
      return;
    }

    const authConfig: {
      type: "none" | "api-key" | "basic" | "bearer" | "oauth2";
      apiKeyHeader?: string;
      apiKeyValue?: string;
      username?: string;
      password?: string;
      token?: string;
      clientId?: string;
      clientSecret?: string;
      tokenUrl?: string;
      scope?: string;
    } = {
      type: values.authType,
    };

    if (values.authType === "api-key") {
      authConfig.apiKeyHeader = values.apiKeyHeader || "X-API-Key";
      authConfig.apiKeyValue = values.apiKeyValue;
    } else if (values.authType === "basic") {
      authConfig.username = values.username;
      authConfig.password = values.password;
    } else if (values.authType === "bearer") {
      authConfig.token = values.token;
    } else if (values.authType === "oauth2") {
      authConfig.clientId = values.clientId;
      authConfig.clientSecret = values.clientSecret;
      authConfig.tokenUrl = values.tokenUrl;
      authConfig.scope = values.scope;
    }

            await createSource.mutateAsync({
              organizationId: organization.id,
              data: {
                name: values.name,
                type: values.type,
                endpoint: values.endpoint || "",
                authConfig: authConfig as unknown as {
                  type: "api-key" | "basic" | "bearer" | "oauth2";
                  apiKeyHeader?: string;
                  apiKeyValue?: string;
                  username?: string;
                  password?: string;
                  token?: string;
                  clientId?: string;
                  clientSecret?: string;
                  tokenUrl?: string;
                  scope?: string;
                },
                refreshStrategy: values.refreshStrategy,
                cacheConfig: {
                  ttl: values.ttl,
                  invalidationStrategy: "time-based",
                },
                enabled: true,
                schedule: values.refreshStrategy === "scheduled" ? values.schedule : undefined,
                query: values.query,
                headers: Object.keys(headers).length > 0 ? headers : undefined,
              },
            });

    form.reset();
    setStep(1);
    setTestResult(null);
    onOpenChange(false);
    onSuccess?.();
  };

  const canProceed = () => {
    if (step === 1) return form.watch("type");
    if (step === 2) {
      const values = form.getValues();
      if (values.authType === "none") return true;
      if (values.authType === "api-key") return !!values.apiKeyValue;
      if (values.authType === "basic") return !!values.username && !!values.password;
      if (values.authType === "bearer") return !!values.token;
      if (values.authType === "oauth2") return !!values.clientId && !!values.clientSecret && !!values.tokenUrl;
      return false;
    }
    if (step === 3) {
      const values = form.getValues();
      const sourceType = form.watch("type");
      // Webhook doesn't require endpoint
      if (sourceType === "webhook") {
        return !!values.name;
      }
      return !!values.name && !!values.endpoint;
    }
    if (step === 4) return testResult?.success === true;
    if (step === 5) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add External Data Source</DialogTitle>
          <DialogDescription>
            Step {step} of 5: {step === 1 && "Select Source Type"}
            {step === 2 && "Configure Authentication"}
            {step === 3 && "Configure Connection"}
            {step === 4 && "Test Connection"}
            {step === 5 && "Review & Save"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="rest-api">REST API</SelectItem>
                          <SelectItem value="graphql">GraphQL</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {sourceType === "rest-api" && "Standard REST API endpoint"}
                        {sourceType === "graphql" && "GraphQL API endpoint"}
                        {sourceType === "webhook" && "Webhook-based data source"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="authType"
                  render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select authentication type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None (Public API)</SelectItem>
                              <SelectItem value="api-key">API Key</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select "None" for public APIs that don't require authentication
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                  )}
                />

                {authType === "none" && (
                  <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                    No authentication required. This source will be accessed without credentials.
                  </div>
                )}

                {authType === "api-key" && (
                  <>
                    <FormField
                      control={form.control}
                      name="apiKeyHeader"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Name</FormLabel>
                          <FormControl>
                            <Input placeholder="X-API-Key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="apiKeyValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter API key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {authType === "basic" && (
                  <>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {authType === "bearer" && (
                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bearer Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter bearer token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {authType === "oauth2" && (
                  <>
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="clientSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Secret</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter client secret" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tokenUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://api.example.com/oauth/token" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scope (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="read write" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My API Source" {...field} />
                      </FormControl>
                      <FormDescription>A friendly name for this data source</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.example.com/data" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {sourceType === "graphql" && (
                  <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GraphQL Query</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="query { data { id name } }"
                            className="font-mono text-sm"
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="headers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Headers (JSON, optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"X-Custom-Header": "value"}'
                          className="font-mono text-sm"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Additional HTTP headers as JSON object</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refreshStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refresh Strategy</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on-demand">On-Demand</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="event-driven">Event-Driven</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {refreshStrategy === "on-demand" && "Fetch data when needed"}
                        {refreshStrategy === "scheduled" && "Fetch data on a schedule"}
                        {refreshStrategy === "event-driven" && "Update via webhook events"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {refreshStrategy === "scheduled" && (
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron Schedule</FormLabel>
                        <FormControl>
                          <Input placeholder="0 */6 * * *" {...field} />
                        </FormControl>
                        <FormDescription>Cron expression (e.g., "0 */6 * * *" for every 6 hours)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="ttl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cache TTL (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={60}
                          {...field}
                                  onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormDescription>How long to cache data before refreshing</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Test Connection</h3>
                    <p className="text-sm text-muted-foreground">
                      Verify that the connection works before saving
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult.success
                        ? "Connection test successful! Data retrieved successfully."
                        : `Connection test failed: ${testResult.error}`}
                    </AlertDescription>
                  </Alert>
                )}

                {testResult?.success && testResult.data !== undefined && (
                  <div className="rounded-md bg-muted p-4">
                    <Label className="text-sm font-semibold mb-2 block">Sample Data:</Label>
                    <pre className="text-xs overflow-auto max-h-48">
                      {formatDataForDisplay(testResult.data)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Review Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{form.watch("name")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{form.watch("type")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Endpoint:</span>
                    <span className="font-medium break-all">{form.watch("endpoint")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth Type:</span>
                    <span className="font-medium">{form.watch("authType")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Refresh Strategy:</span>
                    <span className="font-medium">{form.watch("refreshStrategy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cache TTL:</span>
                    <span className="font-medium">{form.watch("ttl")} seconds</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              {step < 5 ? (
                <Button
                  type="button"
                  onClick={async () => {
                    let fieldsToValidate: (keyof WizardFormData)[] = [];
                    
                    if (step === 1) {
                      fieldsToValidate = ["type"];
                    } else if (step === 2) {
                      const authType = form.watch("authType");
                      fieldsToValidate = ["authType"];
                      if (authType === "none") {
                        // No additional fields to validate for "none"
                      } else if (authType === "api-key") {
                        fieldsToValidate.push("apiKeyValue");
                      } else if (authType === "basic") {
                        fieldsToValidate.push("username", "password");
                      } else if (authType === "bearer") {
                        fieldsToValidate.push("token");
                      } else if (authType === "oauth2") {
                        fieldsToValidate.push("clientId", "clientSecret", "tokenUrl");
                      }
                    } else if (step === 3) {
                      const sourceType = form.watch("type");
                      fieldsToValidate = ["name"];
                      if (sourceType !== "webhook") {
                        fieldsToValidate.push("endpoint");
                      }
                    }
                    
                    const isValid = await form.trigger(fieldsToValidate);
                    if (isValid && canProceed()) {
                      setStep(step + 1);
                    }
                  }}
                  disabled={!canProceed()}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={createSource.isPending}
                >
                  {createSource.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Source"
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

