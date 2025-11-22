import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
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
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
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
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('settings.users.invites.status.active')}</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('settings.users.invites.status.sent')}</Badge>;
      case "used":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">{t('settings.users.invites.status.used')}</Badge>;
      case "expired":
        return <Badge variant="secondary">{t('settings.users.invites.status.expired')}</Badge>;
      case "revoked":
        return <Badge variant="destructive">{t('settings.users.invites.status.revoked')}</Badge>;
      default:
        return <Badge variant="outline">{t('settings.users.invites.status.unknown')}</Badge>;
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('settings.users.invites.pageTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('settings.users.invites.pageDescription')}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('settings.users.invites.refresh')}
        </Button>
      </div>

      {/* Create Invite Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t('settings.users.invites.createNewInvite.title')}</CardTitle>
          <CardDescription className="text-sm">
            {t('settings.users.invites.createNewInvite.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiration">{t('settings.users.invites.createNewInvite.expiration')}</Label>
              <Input
                id="expiration"
                type="number"
                min="1"
                max="30"
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                placeholder={t('settings.users.invites.createNewInvite.expirationPlaceholder')}
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
                    {t('settings.users.invites.createNewInvite.creating')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('settings.users.invites.createNewInvite.createInvite')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invites List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t('settings.users.invites.activeInvites.title')}</CardTitle>
          <CardDescription className="text-sm">
            {t('settings.users.invites.activeInvites.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">{t('settings.users.invites.loading')}</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold mb-1.5">{t('settings.users.invites.noInvites.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.users.invites.noInvites.description')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                      {getStatusIcon(invite.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <code className="font-mono text-xs sm:text-sm bg-muted px-2 py-1 rounded">
                            {invite.code}
                          </code>
                          {getStatusBadge(invite.status)}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                            <span>{t('settings.users.invites.expires', { date: formatDateTable(new Date(invite.expiresAt)) })}</span>
                          </div>
                          {invite.usedAt && (
                            <div className="flex items-center">
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                              <span>{t('settings.users.invites.used', { date: formatDateTable(new Date(invite.usedAt)) })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(invite.code)}
                        className="flex-1 sm:flex-none"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        {t('settings.users.invites.copy')}
                      </Button>
                      {(invite.status === "active" || invite.status === "sent") && !isExpired(invite.expiresAt) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeInvite(invite.id)}
                          disabled={isRevoking}
                          className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          {isRevoking ? t('settings.users.invites.revoking') : t('settings.users.invites.revoke')}
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
