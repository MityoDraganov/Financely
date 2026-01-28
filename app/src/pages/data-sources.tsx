import { useState } from "react";
import {
  Database,
  FileText,
  Info,
  ExternalLink,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dataSourceSchemas,
  type DataSourceSchema,
  type SchemaField,
  flattenSchemaFields,
} from "@/core/data-source-schemas";
import { useExternalSources } from "@/hooks/use-external-sources";
import { ConnectionWizard } from "@/components/external-sources/connection-wizard";
import { DeleteSourceDialog } from "@/components/external-sources/delete-source-dialog";
import { RefreshCw, Loader2 } from "lucide-react";

function SchemaFieldTree({ field, level = 0 }: { field: SchemaField; level?: number }) {
  const indent = level * 16;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 py-1 text-sm"
        style={{ paddingLeft: `${indent}px` }}
      >
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
          {field.path}
        </code>
        <Badge variant="outline" className="text-xs">
          {field.type}
        </Badge>
        {field.description && (
          <span className="text-muted-foreground text-xs">{field.description}</span>
        )}
      </div>
      {field.children && field.children.length > 0 && (
        <div className="ml-4">
          {field.children.map((child, idx) => (
            <SchemaFieldTree key={idx} field={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DataSourceCard({ schema }: { schema: DataSourceSchema }) {
  const flattenedFields = flattenSchemaFields(schema.fields);

  const getIcon = (key: string) => {
    switch (key) {
      case "invoice":
        return FileText;
      case "customer":
        return Database;
      case "organization":
        return Database;
      case "payment":
        return Database;
      case "usage":
        return Database;
      case "computed":
        return Database;
      default:
        return Info;
    }
  };

  const Icon = getIcon(schema.key);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{schema.label}</CardTitle>
              <CardDescription className="mt-1">{schema.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Required Parameters</div>
          <div className="flex flex-wrap gap-2">
            {schema.requiredParams.length > 0 ? (
              schema.requiredParams.map((param) => (
                <Badge key={param} variant="secondary">
                  {param}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Used By</div>
          <div className="flex flex-wrap gap-2">
            {schema.usedBy.map((feature) => (
              <Badge key={feature} variant="outline">
                {feature}
              </Badge>
            ))}
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="schema">
            <AccordionTrigger>
              <span className="text-sm font-medium">
                Available Fields ({flattenedFields.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2 border-t">
                {schema.fields.map((field, idx) => (
                  <SchemaFieldTree key={idx} field={field} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ExternalSourcesSection() {
  const { sources, isLoading, deleteSource, refreshSource } = useExternalSources();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [_editingSource, setEditingSource] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case "inactive":
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <Clock className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      "rest-api": "REST API",
      "graphql": "GraphQL",
      "webhook": "Webhook",
    };
    return <Badge variant="secondary">{labels[type] || type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">External Data Sources</h2>
          <p className="text-muted-foreground mt-2">
            Connect external APIs and services to use their data in templates, workflows, and widgets.
            All external data is resolved server-side and cached for performance.
          </p>
        </div>
        <ConnectionWizard
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={() => {
            setEditingSource(null);
          }}
        />
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add External Source
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading external sources...</p>
          </CardContent>
        </Card>
      ) : sources.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              No External Sources
            </CardTitle>
            <CardDescription>
              Get started by adding your first external data source.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add External Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configured Sources</CardTitle>
            <CardDescription>
              Manage your external data source connections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Refresh Strategy</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.data.name}</TableCell>
                    <TableCell>{getTypeBadge(source.data.type)}</TableCell>
                    <TableCell>{getStatusBadge(source.data.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{source.data.refreshStrategy}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {source.data.lastSync
                        ? new Date(source.data.lastSync).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshSource.mutate({
                            organizationId: source.data.orgId,
                            sourceId: source.id,
                          })}
                          disabled={refreshSource.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshSource.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSource(source.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <DeleteSourceDialog
                          sourceId={source.id}
                          sourceName={source.data.name}
                          organizationId={source.data.orgId}
                          onDelete={() => deleteSource.mutate({
                            organizationId: source.data.orgId,
                            sourceId: source.id,
                          })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How External Sources Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            External data sources allow you to integrate third-party APIs and services into your
            templates, workflows, and widgets. All external data is resolved server-side before
            rendering, ensuring predictable performance and security.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>External data is fetched and normalized before template rendering</li>
            <li>Data is cached with configurable TTL to reduce API calls</li>
            <li>Refresh strategies: on-demand, scheduled, or event-driven</li>
            <li>External sources appear in the data context as external.sourceName</li>
            <li>Use binding paths like external.mySource.fieldName in templates</li>
            <li>Credentials are encrypted and never exposed to templates</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DataSourcesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-muted-foreground mt-2">
          View available data sources that can be used in templates, workflows, and widgets.
          All data is resolved server-side before rendering.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Internal Data Sources</h2>
        <div className="grid gap-6">
          {dataSourceSchemas.map((schema) => (
            <DataSourceCard key={schema.key} schema={schema} />
          ))}
        </div>
      </div>

      <div className="border-t pt-8">
        <ExternalSourcesSection />
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Data Sources Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Data sources provide a unified way to access data across templates, workflows, and widgets.
            All data resolution happens server-side before rendering, ensuring templates never fetch data themselves.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Templates declare which sources they need (e.g., invoice, customer)</li>
            <li>The system resolves all required sources before rendering</li>
            <li>Computed fields are automatically calculated (e.g., invoice totals)</li>
            <li>Binding paths use dot notation (e.g., invoice.data.items[0].total)</li>
            <li>The same binding syntax works everywhere (emails, invoices, workflows)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
