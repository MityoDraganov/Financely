import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firebase } from "@/infrastructure/firebase";
import type { Invoice } from "@/core/entities/invoice";

type Props = { orgId: string; invoiceId: string };

export const InvoiceViewer: React.FC<Props> = ({ orgId, invoiceId }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const load = async () => {
      const ref = doc(firebase.firestore, "orgs", orgId, "invoices", invoiceId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const { id: _ignoredId, ...rest } = (data || {}) as Partial<Invoice>;
        setInvoice({ id: snap.id, ...(rest as Omit<Invoice, "id">) });
      } else {
        setInvoice(null);
      }
    };
    load();
  }, [orgId, invoiceId]);

  if (!invoice) return <div className="p-4">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Invoice {invoice.number}</h2>
      <div className="text-sm text-gray-700">Total: {invoice.total} {invoice.currency}</div>
      {invoice.pdfUrl && (
        <a className="text-blue-600 underline" href={invoice.pdfUrl} target="_blank" rel="noreferrer">
          View PDF
        </a>
      )}
    </div>
  );
};

export default InvoiceViewer;

