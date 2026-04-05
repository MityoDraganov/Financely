import AppLayout from "@/components/layout";
import { InvoiceDesignerAppEntity } from "@shared/designer-entities";

export default function DesignerWrapper() {
	return <InvoiceDesignerAppEntity LayoutWrapper={AppLayout} />;
}
