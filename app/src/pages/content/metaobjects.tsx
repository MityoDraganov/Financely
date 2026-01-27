import { useState, useMemo } from "react";
import { Search, Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetaobjectDefinitionCard } from "@/components/content/metaobject-definition-card";
import { MetaobjectDefinitionForm } from "@/components/content/metaobject-definition-form";
import { useMetaobjectDefinitions, useCreateMetaobjectDefinition, useUpdateMetaobjectDefinition, useDeleteMetaobjectDefinition } from "@/hooks/repository-hooks/use-metaobjects";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateMetaobjectDefinitionInput, UpdateMetaobjectDefinitionInput } from "@/core";
import { toast } from "sonner";

export default function MetaobjectsPage() {
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: definitions = [], isLoading } = useMetaobjectDefinitions(currentOrganization?.id);
  const createDefinition = useCreateMetaobjectDefinition();
  const updateDefinition = useUpdateMetaobjectDefinition();
  const deleteDefinition = useDeleteMetaobjectDefinition();

  const filteredDefinitions = useMemo(() => {
    return definitions.filter((def) => {
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const name = (def.name || "").toLowerCase();
        const description = (def.description || "").toLowerCase();
        return name.includes(searchLower) || description.includes(searchLower);
      }
      return true;
    });
  }, [definitions, searchTerm]);

  const editingDefinition = editingId ? definitions.find((d) => d.id === editingId) : undefined;

  const handleCreate = async (data: CreateMetaobjectDefinitionInput | UpdateMetaobjectDefinitionInput) => {
    if (!currentOrganization?.id) {
      toast.error("Organization is required");
      return;
    }

    const createData = data as CreateMetaobjectDefinitionInput;

    try {
      await createDefinition.mutateAsync({
        organizationId: currentOrganization.id,
        name: createData.name,
        description: createData.description,
        fieldDefinitions: createData.fieldDefinitions,
        access: {
          admin: "MERCHANT_READ_WRITE",
          storefront: "PRIVATE",
        },
      });
      toast.success("Metaobject definition created successfully");
      setIsCreating(false);
    } catch {
      toast.error("Failed to create metaobject definition");
    }
  };

  const handleUpdate = async (data: UpdateMetaobjectDefinitionInput) => {
    if (!editingId) {
      return;
    }

    try {
      await updateDefinition.mutateAsync({
        id: editingId,
        data,
      });
      toast.success("Metaobject definition updated successfully");
      setEditingId(null);
    } catch {
      toast.error("Failed to update metaobject definition");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDefinition.mutateAsync(id);
      toast.success("Metaobject definition deleted successfully");
    } catch {
      toast.error("Failed to delete metaobject definition");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (isCreating) {
    return (
      <MetaobjectDefinitionForm
        onSubmit={handleCreate}
        onCancel={() => setIsCreating(false)}
        isPending={createDefinition.isPending}
      />
    );
  }

  if (editingDefinition) {
    return (
      <MetaobjectDefinitionForm
        initialData={editingDefinition}
        onSubmit={handleUpdate}
        onCancel={() => setEditingId(null)}
        isPending={updateDefinition.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search metaobject definitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Definition
        </Button>
      </div>

      {filteredDefinitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No metaobject definitions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDefinitions.map((def) => (
            <MetaobjectDefinitionCard
              key={def.id}
              definition={def}
              onDelete={handleDelete}
              onEdit={(id) => setEditingId(id)}
              isDeleting={deleteDefinition.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
