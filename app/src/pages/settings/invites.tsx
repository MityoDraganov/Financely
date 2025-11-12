import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Copy, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Calendar,
  UserPlus,
} from "lucide-react";
import { useInvites } from "@/hooks/useInvites";

export default function InvitesPage() {
  const [expirationDays, setExpirationDays] = useState(7);
  
  const {
    invites,
    isLoading: loading,
    createInvite,
    revokeInvite,
    copyToClipboard,
    refetch,
    isCreating: creating,
    isRevoking,
    error,
  } = useInvites();
  console.log(error)

  const handleCreateInvite = async () => {
    await createInvite(expirationDays);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "used":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "expired":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "revoked":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-green-100 text-green-800">Sent</Badge>;
      case "used":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Used</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Invites</h1>
          <p className="text-gray-600 mt-1">
            Create and manage invite codes for your team members
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Create Invite Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Create New Invite
          </CardTitle>
          <CardDescription>
            Generate a unique invite code that can be used once to join your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiration">Expiration (days)</Label>
              <Input
                id="expiration"
                type="number"
                min="1"
                max="30"
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                placeholder="7"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCreateInvite} 
                disabled={creating}
                className="w-full"
              >
                {creating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invite
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invites List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Invites</CardTitle>
          <CardDescription>
            Manage your organization's invite codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading invites...</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invites yet</h3>
              <p className="text-gray-500 mb-4">Create your first invite to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(invite.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {invite.code}
                          </code>
                          {getStatusBadge(invite.status)}
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                          </div>
                          {invite.usedAt && (
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Used: {new Date(invite.usedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(invite.code)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                      {(invite.status === "active" || invite.status === "sent") && !isExpired(invite.expiresAt) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeInvite(invite.id)}
                          disabled={isRevoking}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {isRevoking ? "Revoking..." : "Revoke"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
