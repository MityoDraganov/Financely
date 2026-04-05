import AppLayout from "@/components/layout";
import {
	EmailDesignerAppEntity,
} from "@shared/designer-entities";

export default function EmailDesignerWrapper() {
	return (
		<EmailDesignerAppEntity
			LayoutWrapper={AppLayout}
		/>
	);
}
