import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  orgId: string;
  proposalId: string;
  token: string;
  apiBase: string; // functions region base URL if needed
};

export const ApprovalPage: React.FC<Props> = ({ orgId, proposalId, token, apiBase }) => {
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const url = `${apiBase}/previewProposal?orgId=${encodeURIComponent(orgId)}&proposalId=${encodeURIComponent(proposalId)}`;
        const res = await fetch(url);
        const data = await res.json();
        setPreview(data);
      } catch (_) {
        setPreview(null);
      }
    };
    load();
  }, [orgId, proposalId, apiBase]);

  const submit = async (decision: "approve" | "reject") => {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/approveProposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, proposalId, token, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      alert(decision === "approve" ? `Approved. Invoice ${data.invoiceId}` : "Rejected");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Proposal Approval</h2>
      {preview && (
        <div className="text-sm text-gray-700">
          <div>Total: {preview.total}</div>
          <div>Currency: {preview.currency}</div>
          <div>Status: {preview.status}</div>
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="flex gap-2">
        <Button onClick={() => submit("approve")} disabled={!!submitting}>
          {submitting === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button variant="secondary" onClick={() => submit("reject")} disabled={!!submitting}>
          {submitting === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </div>
  );
};

export default ApprovalPage;

