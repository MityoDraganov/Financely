import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
	title: string;
	value: string | number;
	description?: string;
	icon: LucideIcon;
	isLoading?: boolean;
	className?: string;
}

export function MetricCard({
	title,
	value,
	description,
	icon: Icon,
	isLoading = false,
	className,
}: MetricCardProps) {
	return (
		<Card
			className={cn(
				"rounded-sm border border-border bg-card shadow-sm py-1 px-2",
				className
			)}
		>
			<CardContent className="p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5 mb-1.5">
							<Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
							<p className="text-xs font-medium text-muted-foreground truncate">
								{title}
							</p>
						</div>
						<div className="text-lg font-semibold text-foreground mb-0.5">
							{isLoading ? (
								<Skeleton className="h-5 w-20" />
							) : (
								value
							)}
						</div>
						{description && (
							<p className="text-xs text-muted-foreground line-clamp-1">
								{description}
							</p>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

