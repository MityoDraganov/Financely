import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users as UsersIcon, Mail, Building2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { Link } from "react-router-dom";
import { User } from "@/core";

export function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: users, isLoading, error } = useAdminUsers();
  const { data: organizations } = useAdminOrganizations();

  // Create org lookup map
  const orgMap = useMemo(() => {
    if (!organizations) return {};
    const map: Record<string, { name: string; id: string }> = {};
    organizations.forEach((org) => {
      map[org.id] = { name: org.name || "Unnamed", id: org.id };
    });
    return map;
  }, [organizations]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!users || !searchQuery) {
      return users || [];
    }

    const searchLower = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.id.toLowerCase().includes(searchLower) ||
        user.clerkId?.toLowerCase().includes(searchLower)
    );
  }, [users, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!users) {
      return {
        total: 0,
        active: 0,
        suspended: 0,
        withOrganizations: 0,
      };
    }

    const withOrgs = users.filter(
      (user) => user.organizationRoles && Object.keys(user.organizationRoles).length > 0
    ).length;

    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      withOrganizations: withOrgs,
    };
  }, [users]);

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

  const getUserOrganizations = (user: User) => {
    if (!user.organizationRoles || Object.keys(user.organizationRoles).length === 0) {
      return [];
    }
    return Object.keys(user.organizationRoles).map((orgId) => ({
      orgId,
      role: user.organizationRoles[orgId],
      orgName: orgMap[orgId]?.name || "Unknown",
    }));
  };

  if (error) {
    console.error(error);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage all users on the platform</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suspended}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withOrganizations}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {stats.total} user{stats.total !== 1 ? "s" : ""} found
            {searchQuery && ` (${filteredUsers.length} filtered)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const userOrgs = getUserOrganizations(user);
                    const createdAt = user.createdAt
                      ? typeof user.createdAt === "string"
                        ? new Date(user.createdAt)
                        : user.createdAt
                      : null;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
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
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`mailto:${user.email}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(user.status || "active")}>
                            {user.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {userOrgs.length === 0 ? (
                              <span className="text-sm text-muted-foreground">None</span>
                            ) : (
                              userOrgs.slice(0, 2).map((org) => (
                                <div key={org.orgId} className="flex items-center gap-1">
                                  <Link
                                    to={`/organizations/${org.orgId}`}
                                    className="text-sm text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {org.orgName}
                                  </Link>
                                  <Badge variant="outline" className="text-xs">
                                    {org.role}
                                  </Badge>
                                </div>
                              ))
                            )}
                            {userOrgs.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{userOrgs.length - 2} more
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {createdAt ? (
                            <div className="text-sm text-muted-foreground">
                              {createdAt.toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/users/${user.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

