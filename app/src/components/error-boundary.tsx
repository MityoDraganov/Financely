import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	ErrorBoundaryState
> {
	constructor(props: { children: React.ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="p-6">
					<Card className="border-destructive">
						<CardHeader>
							<CardTitle className="text-destructive">Something went wrong</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								{this.state.error?.message || "An unexpected error occurred"}
							</p>
							{this.state.error?.stack && (
								<details className="text-xs text-muted-foreground">
									<summary className="cursor-pointer">Error details</summary>
									<pre className="mt-2 p-2 bg-muted rounded overflow-auto">
										{this.state.error.stack}
									</pre>
								</details>
							)}
							<Button
								onClick={() => {
									this.setState({ hasError: false, error: null });
									window.location.reload();
								}}
							>
								Reload Page
							</Button>
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}

