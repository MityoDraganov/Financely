import { useEffect, useState } from "react";
import { EmailTemplateBlock } from "@/core";
import { Sparkles, CheckCircle2 } from "lucide-react";

type AIProgressiveRendererProps = {
	blocks: EmailTemplateBlock[];
	onBlockAdded?: (block: EmailTemplateBlock, index: number) => void;
	renderDelay?: number; // Delay between blocks in ms
	children: (visibleBlocks: EmailTemplateBlock[], isComplete: boolean) => React.ReactNode;
};

/**
 * Component that progressively renders blocks with visual feedback
 * Shows blocks appearing one by one with animations
 */
export function AIProgressiveRenderer({
	blocks,
	onBlockAdded,
	renderDelay = 300,
	children,
}: AIProgressiveRendererProps) {
	const [visibleBlocks, setVisibleBlocks] = useState<EmailTemplateBlock[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isComplete, setIsComplete] = useState(false);

	useEffect(() => {
		if (blocks.length === 0) {
			setVisibleBlocks([]);
			setCurrentIndex(0);
			setIsComplete(false);
			return;
		}

		// Reset if blocks changed completely
		if (blocks.length !== visibleBlocks.length && currentIndex >= blocks.length) {
			setVisibleBlocks([]);
			setCurrentIndex(0);
			setIsComplete(false);
		}

		// Add blocks progressively
		if (currentIndex < blocks.length) {
			const timer = setTimeout(() => {
				const nextBlock = blocks[currentIndex];
				setVisibleBlocks((prev) => [...prev, nextBlock]);
				onBlockAdded?.(nextBlock, currentIndex);
				setCurrentIndex((prev) => prev + 1);
			}, renderDelay);

			return () => clearTimeout(timer);
		} else if (currentIndex === blocks.length && blocks.length > 0) {
			setIsComplete(true);
		}
	}, [blocks, currentIndex, visibleBlocks.length, renderDelay, onBlockAdded]);

	return (
		<div className="relative">
			{children(visibleBlocks, isComplete)}
			{!isComplete && blocks.length > 0 && (
				<div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
					<div className="flex flex-col items-center gap-2">
						<Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
						<p className="text-sm text-muted-foreground">
							Adding block {currentIndex + 1} of {blocks.length}...
						</p>
					</div>
				</div>
			)}
			{isComplete && blocks.length > 0 && (
				<div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
					<CheckCircle2 className="h-4 w-4" />
				</div>
			)}
		</div>
	);
}

