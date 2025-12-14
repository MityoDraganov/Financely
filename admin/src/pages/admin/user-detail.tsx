import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Mail, Building2, Shield } from "lucide-react";
import { useAdminUser } from "@/hooks/admin/use-admin-users";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, error } = useAdminUser(id);
  const { data: organizations } = useAdminOrganizations();
  const queryClient = useQueryClient();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    name: "",
    email: "",
    status: "active" as "active" | "suspended" | "deleted",
  });

  // Get user's organizations
  const userOrganizations = user && organizations
    ? organizations.filter((org) => user.organizationRoles?.[org.id])
    : [];

  const updateUser = useMutation({
    mutationFn: async (updates: {
      name?: string;
      email?: string;
      status?: "active" | "suspended" | "deleted";
    }) => {
      const functions = getFunctions(firebase.app);
      const updateUserFn = httpsCallable<
        { userId: string; updates: typeof updates },
        { success: boolean; userId: string }
      >(functions, "adminUpdateUser");
      const result = await updateUserFn({ userId: id!, updates });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users", "all"] });
      setIsUpdateDialogOpen(false);
      toast.success("User updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update user: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const handleOpenUpdateDialog = () => {
    if (user) {
      setUpdateData({
        name: user.name || "",
        email: user.email || "",
        status: (user.status || "active") as "active" | "suspended" | "deleted",
      });
      setIsUpdateDialogOpen(true);
    }
  };

  const handleUpdateUser = () => {
    const updates: {
      name?: string;
      email?: string;
      status?: "active" | "suspended" | "deleted";
    } = {};

    if (updateData.name !== user?.name) updates.name = updateData.name;
    if (updateData.email !== user?.email) updates.email = updateData.email;
    if (updateData.status !== user?.status) updates.status = updateData.status;

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      return;
    }

    updateUser.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              {error ? "Error loading user" : "User not found"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "suspended":
        return "destructive";
      case "deleted":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <User className="h-8 w-8" />
                {user.name}
              </h1>
              <p className="text-muted-foreground">{user.id}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(user.status || "active")}>
            {user.status || "active"}
          </Badge>
          <Button onClick={handleOpenUpdateDialog} variant="outline">
            Edit User
          </Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-base">{user.email}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userOrganizations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clerk ID</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono">{user.clerkId}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizations">
            Organizations ({userOrganizations.length})
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Organizations</CardTitle>
              <CardDescription>
                Organizations this user is a member of
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userOrganizations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  User is not a member of any organizations
                </div>
              ) : (
                <div className="space-y-2">
                  {userOrganizations.map((org) => {
                    const role = user.organizationRoles?.[org.id] || "member";
                    return (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{org.name || "Unnamed"}</div>
                            <div className="text-sm text-muted-foreground">{org.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{role}</Badge>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/organizations/${org.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>Complete user information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <div className="text-base font-medium">{user.name}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="text-base">{user.email}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>
                    <Badge variant={getStatusBadgeVariant(user.status || "active")}>
                      {user.status || "active"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>User ID</Label>
                  <div className="text-sm font-mono">{user.id}</div>
                </div>
                <div>
                  <Label>Clerk ID</Label>
                  <div className="text-sm font-mono">{user.clerkId}</div>
                </div>
                {user.createdAt && (
                  <div>
                    <Label>Created</Label>
                    <div className="text-base">
                      {(() => {
                        if (typeof user.createdAt === "string") {
                          return new Date(user.createdAt).toLocaleDateString();
                        }
                        if (user.createdAt && typeof user.createdAt === "object" && "toLocaleDateString" in user.createdAt) {
                          return (user.createdAt as Date).toLocaleDateString();
                        }
                        return String(user.createdAt);
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update User</DialogTitle>
            <DialogDescription>
              Update user information. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="update-name">Name</Label>
              <Input
                id="update-name"
                value={updateData.name}
                onChange={(e) => setUpdateData({ ...updateData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-email">Email</Label>
              <Input
                id="update-email"
                type="email"
                value={updateData.email}
                onChange={(e) => setUpdateData({ ...updateData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-status">Status</Label>
              <Select
                value={updateData.status}
                onValueChange={(value) =>
                  setUpdateData({ ...updateData, status: value as typeof updateData.status })
                }
              >
                <SelectTrigger id="update-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

