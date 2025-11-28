import { useEffect, useState, useRef, useCallback } from "react";
import {
	presenceService,
	UserPresence,
} from "@/services/presence/presence-service";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

export function usePresence(templateId: string | undefined) {
	const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const authUser = useFirebaseAuthUser();
	const { data: currentOrg } = useCurrentOrganization();
	const unsubscribeRef = useRef<(() => void) | null>(null);

	// Join/leave template presence
	useEffect(() => {
		if (!templateId || !authUser) {
			console.log("usePresence: Missing templateId or authUser", {
				templateId,
				authUser,
			});
			return;
		}

		let isMounted = true;

		const joinTemplate = async () => {
			try {
				//console.log("usePresence: Joining template", { templateId, authUser, currentOrg });
				await presenceService.joinTemplate(
					templateId,
					authUser,
					currentOrg
						? {
								id: currentOrg.id,
								name: currentOrg.name,
							}
						: undefined
				);
				if (isMounted) {
					//console.log("usePresence: Successfully joined template");
					setIsConnected(true);
				}
			} catch (error) {
				console.error("Failed to join template presence:", error);
			}
		};

		joinTemplate();

		return () => {
			isMounted = false;
			if (authUser) {
				presenceService
					.leaveTemplate(templateId, authUser)
					.catch(console.error);
			}
		};
	}, [templateId, authUser, currentOrg]);

	// Subscribe to presence updates
	useEffect(() => {
		if (!templateId) {
			//console.log("usePresence: No templateId, clearing active users");
			setActiveUsers([]);
			return;
		}

		// Clean up previous subscription
		if (unsubscribeRef.current) {
			// console.log("usePresence: Cleaning up previous subscription");
			unsubscribeRef.current();
		}

		// console.log("usePresence: Setting up presence subscription for template", templateId);

		unsubscribeRef.current = presenceService.subscribeToPresence(
			templateId,
			(users) => {
				// console.log("usePresence: Received presence update with", users.length, "users");
				// console.log("usePresence: Raw users data", users);

				// Filter out invalid users but keep the current user
				const validUsers = users.filter((user) => {
					const isValid =
						user &&
						user.uid &&
						user.displayName &&
						user.isActive !== false;

					if (!isValid) {
						console.log(
							"usePresence: Filtering out invalid user",
							user
						);
					}

					return isValid;
				});

				//console.log("usePresence: Filtered to", validUsers.length, "valid users");
				//console.log("usePresence: Valid users", validUsers.map(u => ({ uid: u.uid, name: u.displayName, isOnline: u.isOnline })));

				setActiveUsers(validUsers);
			}
		);

		return () => {
			console.log("usePresence: Cleaning up presence subscription");
			if (unsubscribeRef.current) {
				unsubscribeRef.current();
				unsubscribeRef.current = null;
			}
		};
	}, [templateId, authUser?.uid]);

	// Update cursor position
	const updateCursor = useCallback(
		async (cursor: { x: number; y: number }) => {
			if (!templateId || !authUser) {
				return;
			}

			try {
				await presenceService.updateCursor(
					templateId,
					authUser,
					cursor
				);
			} catch (error) {
				console.error("Failed to update cursor:", error);
			}
		},
		[templateId, authUser]
	);

	// Update selected block
	const updateSelection = useCallback(
		async (selectedBlockId: string | undefined) => {
			if (!templateId || !authUser) {
				return;
			}

			try {
				await presenceService.updateSelection(
					templateId,
					authUser,
					selectedBlockId
				);
			} catch (error) {
				console.error("Failed to update selection:", error);
			}
		},
		[templateId, authUser]
	);

	return {
		activeUsers,
		isConnected,
		updateCursor,
		updateSelection,
	};
}
