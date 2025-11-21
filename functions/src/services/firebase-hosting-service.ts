import { logger } from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { GoogleAuth } from "google-auth-library";
import { createHash } from "crypto";
import { gzipSync } from "zlib";

interface FirebaseHostingConfig {
  projectId: string;
}

interface HostingFile {
  path: string;
  contents: string;
}

export class FirebaseHostingService {
  private readonly projectId: string;
	private readonly hostingApiBaseUrl =
		"https://firebasehosting.googleapis.com/v1beta1";
  private readonly auth: GoogleAuth;

  constructor(config: FirebaseHostingConfig) {
    if (!config.projectId || config.projectId.trim() === "") {
			throw new Error(
				"Firebase project ID is required for Firebase Hosting service"
			);
    }
    
    this.projectId = config.projectId.trim();
    
    logger.info("Initializing Firebase Hosting Service", {
      projectId: this.projectId,
      apiBaseUrl: this.hostingApiBaseUrl,
    });

    this.auth = new GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase",
      ],
      projectId: this.projectId, // Explicitly set project ID
    });

    if (!getApps().length) {
      initializeApp();
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      logger.info("Getting access token for Firebase Hosting API", {
        projectId: this.projectId,
      });
      
      const client = await this.auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (!accessTokenResponse.token) {
        logger.error("Access token response is empty");
        throw new Error("Failed to get access token: token is empty");
      }

      logger.info("Access token obtained successfully");
      return accessTokenResponse.token;
    } catch (error) {
      logger.error("Failed to get access token for Hosting API", {
				error:
					error instanceof Error
						? {
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 500),
						  }
						: "Unknown error",
        projectId: this.projectId,
      });
			throw new Error(
				`Failed to authenticate with Firebase Hosting API: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
    }
  }

  private async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
		body?: unknown,
    maxRetries = 3,
    retryCount = 0,
  ): Promise<T> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (error) {
			logger.error(
				"Failed to get access token for Firebase Hosting API",
				{
					error:
						error instanceof Error
							? error.message
							: "Unknown error",
				}
			);
      throw new Error("Failed to authenticate with Firebase Hosting API");
    }

    const url = `${this.hostingApiBaseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    // Only add Content-Type for requests with a body
    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
    }

    logger.info("Making Firebase Hosting API request", {
      method,
      endpoint,
      url: url.replace(token, "REDACTED"),
      hasBody: body !== undefined && body !== null,
      retryCount,
      maxRetries,
    });

    try {
      // Validate URL before making request
      try {
        new URL(url);
      } catch (urlError) {
        throw new Error(`Invalid URL constructed: ${url}`);
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
				body:
					body !== undefined && body !== null
						? JSON.stringify(body)
						: undefined,
      };

      logger.debug("Firebase Hosting API request details", {
        method,
        endpoint,
        hasBody: body !== undefined && body !== null,
				bodySize:
					body !== undefined && body !== null
						? JSON.stringify(body).length
						: 0,
        bodyPreview: body !== undefined && body !== null
          ? JSON.stringify(body).substring(0, 200)
          : undefined,
      });

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        let errorJson: any = null;
        
        try {
          errorJson = JSON.parse(errorText);
          // Extract the actual error message from API response
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorText) {
            errorMessage = errorText;
          } else {
            errorMessage = `${response.status} ${response.statusText}`;
          }
        } catch {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = errorText;
          } else {
            errorMessage = `${response.status} ${response.statusText}`;
          }
        }
        
        // Check if this is a retryable error (quota/rate limit)
        const isQuotaError = 
          errorMessage.includes("Resource has been exhausted") || 
          errorMessage.includes("quota") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("rateLimitExceeded") ||
          (errorJson?.error?.status === "RESOURCE_EXHAUSTED");
        
        const isRetryable = 
          response.status === 429 || // Too Many Requests
          response.status === 503 || // Service Unavailable
          response.status === 500 || // Internal Server Error
          isQuotaError;

        if (isRetryable && retryCount < maxRetries) {
          // Calculate exponential backoff: 2^retryCount seconds, max 30 seconds
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          
          logger.warn("Firebase Hosting API error, retrying", {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            errorJson,
            errorText: errorText.substring(0, 500),
            endpoint,
            method,
            retryCount: retryCount + 1,
            maxRetries,
            delayMs: delay,
            isQuotaError,
          });

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Retry the request
          return await this.makeRequest<T>(method, endpoint, body, maxRetries, retryCount + 1);
        }
        
        // Log full error details
        logger.error("Firebase Hosting API error (after retries)", {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          errorJson: errorJson ? JSON.stringify(errorJson) : null,
          errorText: errorText.substring(0, 2000),
          endpoint,
          method,
          url: url.replace(token, "REDACTED"),
          retryCount,
          maxRetries,
          projectId: this.projectId,
          isRetryable,
          isQuotaError,
        });
        
        // Return the actual API error message
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Enhanced error logging for fetch failures
			const errorDetails =
				error instanceof Error
					? {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500),
					  }
					: { message: "Unknown error" };

      // Check if this is a retryable network error
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes("fetch") || error.message.includes("Failed to fetch"));
      
      if (isNetworkError && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        
        logger.warn("Firebase Hosting API network error, retrying", {
          error: errorDetails.message,
          endpoint,
          method,
          retryCount: retryCount + 1,
          maxRetries,
          delayMs: delay,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return await this.makeRequest<T>(method, endpoint, body, maxRetries, retryCount + 1);
      }

      logger.error("Firebase Hosting API request failed", {
        ...errorDetails,
        endpoint,
        method,
        url: url.replace(token, "REDACTED"),
        projectId: this.projectId,
        apiBaseUrl: this.hostingApiBaseUrl,
        retryCount,
      });

      // Provide more helpful error messages for common fetch failures
      if (error instanceof TypeError) {
        if (error.message.includes("fetch")) {
          throw new Error(
            `Firebase Hosting API network error: ${error.message}. ` +
            `Possible causes: Firebase Hosting API not enabled, invalid project ID, or network connectivity issues. ` +
            `Enable the API with: gcloud services enable firebasehosting.googleapis.com`
          );
        }
        if (error.message.includes("Failed to fetch")) {
          throw new Error(
            `Firebase Hosting API connection failed. ` +
            `Please verify: 1) Firebase Hosting API is enabled, 2) Project ID is correct, 3) Service account has proper permissions.`
          );
        }
      }
      
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Firebase Hosting API error: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * List all Firebase Hosting sites in the project
   * Reference: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites/list
   */
  async listAllSites(): Promise<Array<{ siteId: string; name?: string; defaultUrl?: string }>> {
    try {
      const endpoint = `/projects/${this.projectId}/sites`;
      const response = await this.makeRequest<{
        sites?: Array<{
          name: string;
          siteId?: string;
          defaultUrl?: string;
        }>;
      }>("GET", endpoint);

      return (response.sites || []).map((site) => ({
        siteId: site.siteId || site.name.split("/").pop() || "",
        name: site.name,
        defaultUrl: site.defaultUrl,
      }));
    } catch (error) {
      logger.error("Failed to list Firebase Hosting sites", {
        projectId: this.projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Extract siteId from Firebase Hosting API response.
   * The API may return siteId directly, or it may be embedded in the name field
   * (e.g., "projects/{project}/sites/{siteId}").
   */
	private extractSiteId(
		response: { name?: string; siteId?: string },
		normalizedSiteId: string
	): string {
    // If siteId is directly provided, use it
    if (response.siteId) {
      return response.siteId;
    }

    // If name is provided, extract siteId from it
    // Format: "projects/{project}/sites/{siteId}"
    if (response.name) {
      const nameMatch = response.name.match(/\/sites\/([^/]+)$/);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1];
      }
    }

    // Fallback to normalized siteId
    return normalizedSiteId;
  }

	async createSite(
		siteId: string
	): Promise<{ name: string; siteId: string }> {
    // Validate siteId is provided
		if (!siteId || typeof siteId !== "string") {
      throw new Error("Site ID is required and must be a string");
    }

    // Validate siteId format - Firebase Hosting site IDs must be lowercase alphanumeric with hyphens
		const normalizedSiteId = siteId
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");
    if (normalizedSiteId !== siteId) {
			logger.warn("Site ID normalized", {
				original: siteId,
				normalized: normalizedSiteId,
			});
    }
    
    // First, try to get the site to see if it already exists
    // Try both site-scoped and project-scoped paths
    const siteScopedEndpoint = `/sites/${normalizedSiteId}`;
    const projectScopedEndpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}`;
    
    logger.info("Checking if Firebase Hosting site exists", { 
      siteId: normalizedSiteId, 
      siteScopedEndpoint,
      projectScopedEndpoint,
    });
    
    // Try site-scoped path first (preferred)
		let siteExists = false;
		let existingSite: { name?: string; siteId?: string } | null = null;

    for (const endpoint of [siteScopedEndpoint, projectScopedEndpoint]) {
      try {
				const site = await this.makeRequest<{
          name?: string;
          siteId?: string;
        }>("GET", endpoint);
        
				if (site) {
					// Site exists, use it
					existingSite = site;
					siteExists = true;
					break; // Exit loop, site found
        }
      } catch (getError) {
        // Site doesn't exist (404) or other error - try next endpoint
				const getErrorMessage =
					getError instanceof Error
						? getError.message
						: String(getError);
        const isNotFound = 
          getErrorMessage.includes("404") || 
          getErrorMessage.toLowerCase().includes("not found") ||
          getErrorMessage.toLowerCase().includes("does not exist");
        
				if (isNotFound) {
					// 404 is expected when site doesn't exist - log at info level, not error
					logger.info(
						"Site not found at endpoint (expected if site doesn't exist)",
						{
							siteId: normalizedSiteId,
							endpoint,
						}
					);

					if (endpoint === projectScopedEndpoint) {
          // Both endpoints returned 404, site doesn't exist
						logger.info(
							"Site does not exist (checked both endpoints), will create new site",
							{
            siteId: normalizedSiteId,
							}
						);
          break; // Exit loop, proceed to create
					}
					// Continue to try next endpoint if this was site-scoped
					continue;
				} else {
					// Non-404 error occurred
					logger.warn(
						"Error checking for existing site, will try next endpoint or create",
						{
            error: getErrorMessage.substring(0, 300),
            siteId: normalizedSiteId,
            endpoint,
						}
					);
					// Continue to try next endpoint if available
					if (endpoint === siteScopedEndpoint) {
						continue; // Try project-scoped endpoint
					}
					// If both endpoints failed with non-404 errors, throw the last error
					throw getError;
				}
			}
		}

		// If site exists, return it
		if (siteExists && existingSite) {
			const extractedSiteId = this.extractSiteId(
				existingSite,
				normalizedSiteId
			);

			logger.info(
				"Firebase Hosting site already exists, using existing site",
				{
					siteId: extractedSiteId,
					name: existingSite.name,
				}
			);

			return {
				name:
					existingSite.name ||
					`projects/${this.projectId}/sites/${normalizedSiteId}`,
				siteId: extractedSiteId,
			};
    }
    
    // Site doesn't exist, create it
    // Firebase Hosting API: siteId goes in the URL query parameter, not in the request body
    // The endpoint format is: POST /projects/{project}/sites?siteId={siteId}
		const endpoint = `/projects/${
			this.projectId
		}/sites?siteId=${encodeURIComponent(normalizedSiteId)}`;
    
    try {
      // Request body should be empty - siteId is passed as a query parameter
      const response = await this.makeRequest<{
        name?: string;
        siteId?: string;
      }>("POST", endpoint); // No body - siteId is in the URL query parameter

      // Validate response structure
      if (!response) {
        logger.error("Invalid response from Firebase Hosting API", {
          response: JSON.stringify(response),
          normalizedSiteId,
        });
				throw new Error(
					"Firebase Hosting API returned invalid response: empty response"
				);
      }

      // Extract siteId from response (may be in name field or siteId field)
			const extractedSiteId = this.extractSiteId(
				response,
				normalizedSiteId
			);

      logger.info("Firebase Hosting site created", {
        siteId: extractedSiteId,
        name: response.name || `sites/${normalizedSiteId}`,
        responseKeys: Object.keys(response),
      });

      return {
				name:
					response.name ||
					`projects/${this.projectId}/sites/${normalizedSiteId}`,
        siteId: extractedSiteId,
      };
    } catch (error) {
      // Check if site already exists - handle various error message formats
      // The error may be wrapped multiple times (e.g., "Firebase Hosting API error: Firebase Hosting API error: Site ... already exists")
      // Also handle backtick format: Site `projects/.../sites/...` already exists
			const errorMessage =
				error instanceof Error ? error.message : String(error);
      
      // Extract the core error message by removing "Firebase Hosting API error:" prefixes
      // This handles cases where the error is wrapped multiple times
      let coreErrorMessage = errorMessage;
			while (
				coreErrorMessage
					.toLowerCase()
					.startsWith("firebase hosting api error:")
			) {
				coreErrorMessage = coreErrorMessage
					.substring("firebase hosting api error:".length)
					.trim();
      }
      
      const lowerErrorMessage = coreErrorMessage.toLowerCase();
      
      // Remove backticks, single quotes, and normalize the error message for better matching
      const normalizedErrorMessage = lowerErrorMessage
        .replace(/`/g, "")
        .replace(/'/g, "")
        .replace(/"/g, "")
        .trim();
      
      // More comprehensive detection of "already exists" errors
      const isAlreadyExists = 
        normalizedErrorMessage.includes("already exists") ||
        normalizedErrorMessage.includes("already_exists") ||
        normalizedErrorMessage.includes("already-exists") ||
        errorMessage.includes("ALREADY_EXISTS") ||
        errorMessage.includes("409") ||
				(normalizedErrorMessage.includes("resource") &&
					normalizedErrorMessage.includes("already")) ||
				(normalizedErrorMessage.includes("site") &&
					normalizedErrorMessage.includes("already"));
      
      logger.info("Checking if error indicates site already exists", {
        siteId: normalizedSiteId,
        errorMessage: errorMessage.substring(0, 300),
				normalizedErrorMessage: normalizedErrorMessage.substring(
					0,
					200
				),
        isAlreadyExists,
      });
      
      if (isAlreadyExists) {
				logger.info(
					"Site already exists error detected, fetching existing site info",
					{
          siteId: normalizedSiteId,
          originalError: errorMessage.substring(0, 300),
          coreErrorMessage: coreErrorMessage.substring(0, 200),
					}
				);
        
        // Try to get the existing site using both site-scoped and project-scoped paths
        // Try multiple times in case of transient errors
        const siteScopedEndpoint = `/sites/${normalizedSiteId}`;
        const projectScopedEndpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}`;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Try both endpoints for each attempt
					for (const endpoint of [
						siteScopedEndpoint,
						projectScopedEndpoint,
					]) {
            try {
							logger.info(
								`Attempting to get existing site (attempt ${attempt}/3, endpoint: ${endpoint})`,
								{
                siteId: normalizedSiteId,
                endpoint,
								}
							);
              
              const existingSite = await this.makeRequest<{
                name?: string;
                siteId?: string;
              }>("GET", endpoint);
            
              if (!existingSite) {
								throw new Error(
									"Existing site found but response is empty"
								);
              }

              // Extract siteId from response
							const extractedSiteId = this.extractSiteId(
								existingSite,
								normalizedSiteId
							);
              
							logger.info(
								"Existing site retrieved successfully after 'already exists' error",
								{
                siteId: extractedSiteId,
                name: existingSite.name,
                attempt,
                endpoint,
								}
							);
              
              return {
								name:
									existingSite.name ||
									`projects/${this.projectId}/sites/${normalizedSiteId}`,
                siteId: extractedSiteId,
              };
            } catch (getError) {
							const getErrorMessage =
								getError instanceof Error
									? getError.message
									: String(getError);
              const isNotFound = 
                getErrorMessage.includes("404") || 
								getErrorMessage
									.toLowerCase()
									.includes("not found");
              
              // If this endpoint returned 404, try the other endpoint
              if (isNotFound && endpoint === siteScopedEndpoint) {
								logger.info(
									`Site-scoped endpoint returned 404, trying project-scoped endpoint`,
									{
                  siteId: normalizedSiteId,
                  attempt,
									}
								);
                continue; // Try project-scoped endpoint
              }
              
							logger.warn(
								`Failed to get existing site (attempt ${attempt}/3, endpoint: ${endpoint})`,
								{
                error: getErrorMessage.substring(0, 300),
                siteId: normalizedSiteId,
                attempt,
                endpoint,
								}
							);
              
              // If both endpoints failed and this is the last attempt, throw error
							if (
								attempt === 3 &&
								endpoint === projectScopedEndpoint
							) {
								logger.error(
									"All attempts to get existing site failed after 'already exists' error",
									{
                  siteId: normalizedSiteId,
										lastError: getErrorMessage.substring(
											0,
											500
										),
										originalError: errorMessage.substring(
											0,
											300
										),
									}
								);
                // Instead of throwing the original error, construct a more helpful error message
                // that indicates the site exists but we couldn't retrieve it
                throw new Error(
                  `Site ${normalizedSiteId} already exists but could not be retrieved. ` +
										`Original error: ${errorMessage.substring(
											0,
											200
										)}. ` +
										`Get error: ${getErrorMessage.substring(
											0,
											200
										)}`
                );
              }
            }
          }
          
          // Wait a bit before retrying (exponential backoff)
          if (attempt < 3) {
						await new Promise((resolve) =>
							setTimeout(resolve, 1000 * attempt)
						);
          }
        }
      }
      
      // Re-throw if it's not an "already exists" error
			logger.error(
				"Site creation failed with non-'already exists' error",
				{
        siteId: normalizedSiteId,
        error: errorMessage.substring(0, 500),
					normalizedErrorMessage: normalizedErrorMessage.substring(
						0,
						200
					),
				}
			);
      throw error;
    }
  }

  async deploySite(
    siteId: string,
    files: HostingFile[],
		versionMessage?: string
  ): Promise<string> {
		const deployStartTime = Date.now();
		const errorContext: {
			stage: string;
			errors: Array<{ stage: string; error: string; timestamp: string }>;
		} = {
			stage: "validation",
			errors: [],
		};
		let normalizedSiteId: string | undefined;

		logger.debug("DeploySite: Starting deployment", {
			siteId,
			fileCount: files.length,
		});

		try {
    // Validate siteId is provided
			if (!siteId || typeof siteId !== "string") {
				const error = "Site ID is required and must be a string";
				errorContext.errors.push({
					stage: errorContext.stage,
					error,
					timestamp: new Date().toISOString(),
				});
				logger.error("DeploySite: Validation failed", { errorContext });
				throw new Error(error);
    }

    // Normalize siteId to match createSite format
			normalizedSiteId = siteId
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-");
    
		logger.debug("DeploySite: Step 1 - Preparing files", {
			siteId: normalizedSiteId,
			fileCount: files.length,
		});
		errorContext.stage = "file_preparation";
    // Step 1: Create a version (without files)
    // First, prepare files to get their hashes
    const filesByHash: Record<string, string> = {};
    const pathToHash: Record<string, string> = {};
    
    for (const file of files) {
      // Gzip the file contents
			const gzippedContents = gzipSync(
				Buffer.from(file.contents, "utf-8")
			);
      
      // Calculate SHA256 hash of the gzipped content
			const hash = createHash("sha256")
				.update(gzippedContents)
				.digest("hex");
      
      // Base64 encode the gzipped content
			const base64Contents = gzippedContents.toString("base64");
      
      // Store file by hash
      filesByHash[hash] = base64Contents;
      pathToHash[file.path] = hash;
    }

    // Create file mappings: path -> hash
    // Firebase Hosting requires all paths to start with a forward slash
    const fileMappings: Record<string, string> = {};
    for (const file of files) {
      const hash = pathToHash[file.path];
      if (hash) {
        // Normalize path to start with /
				const normalizedPath = file.path.startsWith("/")
					? file.path
					: `/${file.path}`;
        fileMappings[normalizedPath] = hash;
      }
    }

		logger.debug("DeploySite: Step 2 - Verifying site exists", {
			siteId: normalizedSiteId,
		});
		errorContext.stage = "site_verification";
    logger.info("Creating version", {
      siteId: normalizedSiteId,
      fileCount: files.length,
    });

    // Verify the site exists before creating a version
    // This helps catch issues early and provides better error messages
    try {
      const siteCheckEndpoint = `/sites/${normalizedSiteId}`;
      await this.makeRequest("GET", siteCheckEndpoint);
      logger.info("Site verified to exist before creating version", {
        siteId: normalizedSiteId,
      });
    } catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.warn(
				"Could not verify site exists via site-scoped GET, will attempt version creation anyway",
				{
        siteId: normalizedSiteId,
        error: errorMessage.substring(0, 200),
				}
			);
      // Continue anyway - the version creation will fail with a clearer error if site doesn't exist
    }

		logger.debug("DeploySite: Step 3 - Creating version", {
			siteId: normalizedSiteId,
		});
		errorContext.stage = "version_creation";
    // According to Firebase Hosting API v1beta1, use site-scoped path for version creation
    // This ensures consistency with finalize and release endpoints
    const versionEndpoint = `/sites/${normalizedSiteId}/versions`;
    
    logger.info("Creating version with site-scoped endpoint", {
      siteId: normalizedSiteId,
      versionEndpoint,
    });
    
    // Create version WITHOUT files - files will be populated separately
		let version: { name: string; status: string };
		try {
			version = await this.makeRequest<{
      name: string;
      status: string;
    }>("POST", versionEndpoint, {
      config: {
        headers: [],
        redirects: [],
        rewrites: [],
      },
    });
		} catch (versionError) {
			const error = versionError instanceof Error ? versionError.message : "Unknown version creation error";
			errorContext.errors.push({
				stage: errorContext.stage,
				error,
				timestamp: new Date().toISOString(),
			});
			logger.error("DeploySite: Version creation failed", {
				siteId: normalizedSiteId,
				error,
				errorContext,
			});
			throw versionError;
		}

    // Validate version was created successfully
    if (!version || !version.name) {
			const error = `Invalid version response: ${JSON.stringify(version)}`;
			errorContext.errors.push({
				stage: errorContext.stage,
				error,
				timestamp: new Date().toISOString(),
			});
			logger.error("DeploySite: Invalid version response", {
				siteId: normalizedSiteId,
				response: version,
				errorContext,
			});
			throw new Error(error);
    }
    
    // Log the full version name for debugging
    logger.info("Version created successfully", {
      versionName: version.name,
      versionStatus: version.status,
      fileCount: files.length,
      versionEndpoint: versionEndpoint,
    });
    
    // Extract version ID for later use
    const versionNameMatch = version.name.match(/versions\/([^/]+)$/);
    if (!versionNameMatch || !versionNameMatch[1]) {
			throw new Error(
				`Invalid version name format: ${version.name}. Expected format: .../versions/{versionId}`
			);
    }
    const versionIdFromName = versionNameMatch[1];
    
    logger.info("Version ID extracted", {
      versionId: versionIdFromName,
      fullVersionName: version.name,
    });

    // Step 2a: Note - According to Firebase Hosting API, file mappings are handled by populateFiles
    // We don't need to (and can't) set files in config - the API handles this automatically
    // after populateFiles is called. The config only contains headers, redirects, and rewrites.
    logger.info("File mappings prepared", {
      fileMappingsCount: Object.keys(fileMappings).length,
			sampleMappings: Object.entries(fileMappings)
				.slice(0, 2)
				.map(([path, hash]) => ({
        path,
        hashPrefix: hash.substring(0, 16) + "...",
      })),
    });

    // Step 2b: Populate files using populateFiles method
    // According to Firebase Hosting API documentation, populateFiles expects:
    // { "files": { "/FILE_PATH": "SHA256_HASH" } }
    // Paths must start with a forward slash, and values must be SHA256 hashes
    const populateEndpoint = `/${version.name}:populateFiles`;
    
    logger.info("Calling populateFiles with path -> hash mappings", {
      endpoint: populateEndpoint,
      fileCount: Object.keys(fileMappings).length,
			sampleMappings: Object.entries(fileMappings)
				.slice(0, 2)
				.map(([path, hash]) => ({
        path,
        hashPrefix: hash.substring(0, 16) + "...",
      })),
    });
    
    // Verify all paths start with / and all hashes are valid SHA256 format
    for (const [path, hash] of Object.entries(fileMappings)) {
			if (!path.startsWith("/")) {
        throw new Error(`File path must start with /: ${path}`);
      }
      if (!/^[a-f0-9]{64}$/i.test(hash)) {
				throw new Error(
					`Invalid hash format for path ${path}: ${hash.substring(
						0,
						32
					)}... (expected 64 hex characters)`
				);
      }
    }
    
    // Call populateFiles with path -> hash mapping
    // Paths must start with /, and values must be SHA256 hashes
    const populateResponse = await this.makeRequest<{
      uploadRequiredHashes?: string[];
      uploadUrl?: string;
      status?: string;
    }>("POST", populateEndpoint, {
      files: fileMappings, // Maps "/path/to/file" -> "sha256_hash"
    });

    logger.info("PopulateFiles response received", {
      versionName: version.name,
			uploadRequiredHashes:
				populateResponse.uploadRequiredHashes?.length || 0,
      hasUploadUrl: !!populateResponse.uploadUrl,
      status: populateResponse.status,
    });
    
    // Note: populateFiles already associates file paths with hashes
    // We don't need to update the version separately - the API handles this automatically

    // Step 3: Upload file content for all required hashes
    // The API returns uploadRequiredHashes - these are the hashes that need content uploaded
    // All files need their content uploaded, so we upload all hashes
		if (
			populateResponse.uploadRequiredHashes &&
			populateResponse.uploadRequiredHashes.length > 0
		) {
      if (!populateResponse.uploadUrl) {
				throw new Error(
					"Upload URL is missing but files require upload"
				);
      }

      logger.info("Uploading file content", {
				uploadRequiredHashes:
					populateResponse.uploadRequiredHashes.length,
        uploadUrl: populateResponse.uploadUrl.substring(0, 100) + "...",
      });

      // Get access token once for all uploads (more efficient)
      const accessToken = await this.getAccessToken();

      // Upload each file's content to the uploadUrl
      // According to Firebase Hosting API, the uploadUrl format is:
      // https://upload-firebasehosting.googleapis.com/upload/sites/SITE_ID/versions/VERSION_ID/files/SHA256_HASH
      // We need to append the hash to the base uploadUrl
      for (const requiredHash of populateResponse.uploadRequiredHashes) {
        const base64Content = filesByHash[requiredHash];
        if (!base64Content) {
					throw new Error(
						`Content for required hash ${requiredHash.substring(
							0,
							16
						)}... not found in filesByHash`
					);
        }

        // Decode base64 to get the gzipped buffer
				const gzippedBuffer = Buffer.from(base64Content, "base64");
        
        // Construct the upload URL by appending the hash
        // According to Firebase Hosting API, the format should be:
        // https://upload-firebasehosting.googleapis.com/upload/sites/SITE_ID/versions/VERSION_ID/files/SHA256_HASH
        // The uploadUrl from populateFiles response is a base URL ending with /files
        let uploadUrl = populateResponse.uploadUrl;
        
        // Ensure the URL ends with /files before appending the hash
				if (
					!uploadUrl.endsWith("/files") &&
					!uploadUrl.endsWith("/files/")
				) {
					uploadUrl = uploadUrl.endsWith("/")
						? `${uploadUrl}files`
						: `${uploadUrl}/files`;
        }
        
        // Append the hash to the URL: /files/{hash}
				uploadUrl = `${uploadUrl.replace(/\/$/, "")}/${requiredHash}`;
        
        // Ensure URL is HTTPS (required for Cloud Functions)
				if (!uploadUrl.startsWith("https://")) {
					throw new Error(
						`Upload URL must use HTTPS: ${uploadUrl.substring(
							0,
							100
						)}...`
					);
        }

        logger.info(`Uploading file content`, {
          hash: requiredHash.substring(0, 16) + "...",
          uploadUrl: uploadUrl.substring(0, 100) + "...",
          contentSize: gzippedBuffer.length,
        });
        
        try {
          // Firebase Hosting uploads require PUT with raw binary content and Authorization header
          // The content is already gzipped, so we send it as raw bytes
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
							Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/octet-stream",
              "Content-Length": gzippedBuffer.length.toString(),
            },
            body: gzippedBuffer, // Raw binary content, not base64
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            logger.error("File upload failed", {
              hash: requiredHash.substring(0, 16) + "...",
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              error: errorText.substring(0, 500),
              uploadUrl: uploadUrl.substring(0, 100) + "...",
            });
						throw new Error(
							`Failed to upload file content for hash ${requiredHash.substring(
								0,
								16
							)}...: ${uploadResponse.status} ${
								uploadResponse.statusText
							} - ${errorText.substring(0, 200)}`
						);
          }

					logger.info(
						`Uploaded file content for hash ${requiredHash.substring(
							0,
							16
						)}...`
					);
        } catch (error) {
          // Handle network errors (fetch failed, timeouts, etc.)
					if (
						error instanceof TypeError &&
						error.message.includes("fetch")
					) {
            logger.error("Network error during file upload", {
              hash: requiredHash.substring(0, 16) + "...",
              error: error.message,
              uploadUrl: uploadUrl.substring(0, 100) + "...",
            });
						throw new Error(
							`Network error uploading file content for hash ${requiredHash.substring(
								0,
								16
							)}...: ${
								error.message
							}. Check network connectivity and Firebase Hosting API access.`
						);
          }
          // Re-throw other errors
          throw error;
        }
      }
    } else {
      // If no uploadRequiredHashes, the files might already exist in Firebase Hosting
      // or the API handles them differently
			logger.info(
				"No files require explicit upload (may already exist or handled inline)"
			);
    }

		// ----------------------
    // Step 4: Finalize the version
		// ----------------------
		let finalizeVersionName = version.name;

		// Convert to site-scoped form (if needed)
		const siteScopedMatch = finalizeVersionName.match(/(\/sites\/.+)$/);
		if (siteScopedMatch && siteScopedMatch[1]) {
			finalizeVersionName = siteScopedMatch[1].substring(1);
			logger.info("Converted version name to site-scoped for finalize", {
				original: version.name,
				converted: finalizeVersionName,
			});
		}

		// Always use project-scoped path for finalize
		const finalizeEndpoint = `/projects/${this.projectId}/${finalizeVersionName}?update_mask=status`;
    
		logger.info("Finalizing version with project-scoped endpoint", {
			projectId: this.projectId,
      siteId: normalizedSiteId,
      finalizeEndpoint,
    });
    
		await new Promise((resolve) => setTimeout(resolve, 1000));
    
		await this.makeRequest("PATCH", finalizeEndpoint, {
			status: "FINALIZED",
		});

    logger.info("Version finalized successfully", {
      versionName: version.name,
      versionId: versionIdFromName,
      siteId: normalizedSiteId,
    });

		// Small delay for consistency
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// ----------------------
    // Step 5: Create a release
		// ----------------------
		let releaseVersionName = version.name;
		const releaseVersionMatch = releaseVersionName.match(/(\/sites\/.+)$/);
		if (releaseVersionMatch && releaseVersionMatch[1]) {
			releaseVersionName = releaseVersionMatch[1].substring(1);
		}

		const encodedVersionName = encodeURIComponent(
			`projects/${this.projectId}/${releaseVersionName}`
		);
		const releaseEndpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}/releases?versionName=${encodedVersionName}`;
    
		logger.info("Creating release with project-scoped endpoint", {
			projectId: this.projectId,
      siteId: normalizedSiteId,
			versionName: releaseVersionName,
      releaseEndpoint,
    });
    
    await this.makeRequest("POST", releaseEndpoint, {
      message: versionMessage || `Deploy ${new Date().toISOString()}`,
    });
    
    logger.info("Release created successfully", {
      siteId: normalizedSiteId,
      versionId: versionIdFromName,
    });

    logger.info("Firebase Hosting site deployed", {
      siteId: normalizedSiteId,
      version: version.name,
      fileCount: files.length,
    });

		logger.debug("DeploySite: Step 6 - Getting site URL", {
			siteId: normalizedSiteId,
		});
		errorContext.stage = "get_site_url";
		
		// Wait a bit for the site to be fully ready after release
		await new Promise(resolve => setTimeout(resolve, 3000));
		
		// Retry getting the site URL with exponential backoff
		// If it fails, use fallback URL pattern
		let siteUrl: string | null = null;
		let lastError: Error | null = null;
		
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				siteUrl = await this.getSiteUrl(normalizedSiteId);
				logger.info("DeploySite: Site URL retrieved successfully", {
					siteId: normalizedSiteId,
					attempt,
					siteUrl,
				});
				break; // Success, exit retry loop
			} catch (urlError) {
				lastError = urlError instanceof Error ? urlError : new Error(String(urlError));
				const isNotFound = lastError.message.includes("404") || lastError.message.toLowerCase().includes("not found");
				
				if (attempt === 3 || !isNotFound) {
					// Last attempt or non-404 error - will use fallback
					break;
				}
				
				// Wait before retry (exponential backoff)
				const waitTime = 2000 * attempt;
				logger.warn(`DeploySite: Site URL not available yet, retrying (attempt ${attempt}/3)`, {
					siteId: normalizedSiteId,
					attempt,
					waitTime,
					error: lastError.message.substring(0, 200),
				});
				await new Promise(resolve => setTimeout(resolve, waitTime));
			}
		}
		
		// If we still don't have a URL, use fallback pattern
		if (!siteUrl) {
			// Firebase Hosting sites follow the pattern: https://{siteId}.web.app
			const fallbackUrl = `https://${normalizedSiteId}.web.app`;
			logger.warn("DeploySite: Could not retrieve site URL from API, using fallback pattern", {
				siteId: normalizedSiteId,
				error: lastError ? lastError.message : "Unknown error",
				fallbackUrl,
			});
			
			// Log the error but don't fail - we can construct the URL
			errorContext.errors.push({
				stage: errorContext.stage,
				error: `Could not retrieve site URL: ${lastError ? lastError.message : "Unknown error"}. Using fallback URL.`,
				timestamp: new Date().toISOString(),
			});
			
			// Use fallback URL
			siteUrl = fallbackUrl;
		}

		const totalDuration = Date.now() - deployStartTime;
		logger.info("DeploySite: Deployment completed successfully", {
			siteId: normalizedSiteId,
			siteUrl,
			totalDuration,
			totalDurationSeconds: Math.round(totalDuration / 1000),
			stages: {
				file_preparation: "✓",
				site_verification: "✓",
				version_creation: "✓",
				populate_files: "✓",
				file_upload: "✓",
				finalize: "✓",
				release: "✓",
				get_site_url: "✓",
			},
		});

    return siteUrl;
		} catch (error: unknown) {
			const totalDuration = Date.now() - deployStartTime;
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			const normalizedSiteIdForError = (normalizedSiteId !== undefined ? normalizedSiteId : (siteId || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-"));
			
			// Ensure error is recorded in context
			if (!errorContext.errors.some((e: { stage: string; error: string; timestamp: string }) => e.error === errorMessage && e.stage === errorContext.stage)) {
				errorContext.errors.push({
					stage: errorContext.stage,
					error: errorMessage,
					timestamp: new Date().toISOString(),
				});
			}

			// Create summarized error for deploySite
			const errorSummary = {
				method: "deploySite",
				siteId: normalizedSiteIdForError,
				totalDuration,
				totalDurationSeconds: Math.round(totalDuration / 1000),
				failedAtStage: errorContext.stage,
				errorCount: errorContext.errors.length,
				errors: errorContext.errors,
				finalError: errorMessage,
				errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
			};

			logger.error("DeploySite: Deployment failed - Summary", errorSummary);
			throw error;
		}
  }

  async getSiteUrl(siteId: string): Promise<string> {
    if (!siteId || typeof siteId !== "string") {
      throw new Error("Site ID is required and must be a string");
    }

    const normalizedSiteId = siteId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const siteScopedEndpoint = `/sites/${normalizedSiteId}`;
    const projectScopedEndpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}`;
  
    // Try up to 3 times with exponential backoff
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const site = await this.makeRequest<{ defaultUrl: string }>(
          "GET",
          siteScopedEndpoint
        );
  
        if (site?.defaultUrl) {
          logger.info("Fetched site URL successfully", {
            siteId: normalizedSiteId,
            defaultUrl: site.defaultUrl,
            attempt,
          });
    return site.defaultUrl;
  }
  
        throw new Error("defaultUrl missing from site response");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isNotFound =
          message.includes("404") ||
          message.toLowerCase().includes("not found");
  
        logger.warn("getSiteUrl attempt failed", {
          siteId: normalizedSiteId,
          attempt,
          error: message.substring(0, 200),
        });
  
        // If site-scoped fails with 404, try project-scoped as fallback
        if (isNotFound) {
          try {
            const site = await this.makeRequest<{ defaultUrl: string }>(
              "GET",
              projectScopedEndpoint
            );
            if (site?.defaultUrl) {
              logger.info("Fetched site URL via project-scoped endpoint", {
                siteId: normalizedSiteId,
                defaultUrl: site.defaultUrl,
                attempt,
              });
              return site.defaultUrl;
            }
          } catch (projectError) {
            logger.warn("Project-scoped endpoint also failed", {
              siteId: normalizedSiteId,
              attempt,
              error: projectError instanceof Error ? projectError.message : String(projectError),
            });
          }
        }
  
        if (attempt < maxAttempts) {
          const delay = 1000 * attempt; // 1s, 2s, 3s
          logger.info(`Retrying getSiteUrl in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          logger.error("All getSiteUrl attempts failed", {
            siteId: normalizedSiteId,
            finalError: message.substring(0, 300),
          });
          throw new Error(`Failed to fetch defaultUrl for site ${normalizedSiteId}: ${message}`);
        }
      }
    }
  
    throw new Error(`Unexpected state: getSiteUrl failed for ${normalizedSiteId}`);
  }
  

  async addCustomDomain(
    siteId: string,
		domain: string
  ): Promise<{ domain: string; status: string }> {
    // Normalize siteId
		const normalizedSiteId = siteId
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");
    
    // According to Firebase Hosting API v1beta1 documentation:
    // POST /v1beta1/projects/{project}/sites/{site}/customDomains?customDomainId={domain}
    // - customDomainId (query parameter, REQUIRED): The ID of the CustomDomain, which is the domain name
    // - Request body: Contains an instance of CustomDomain (can be empty or have optional fields)
    // Reference: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains/create
    
    const endpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}/customDomains?customDomainId=${encodeURIComponent(domain)}`;
    
    // The request body should contain a CustomDomain instance
    // Since customDomainId is in the query parameter, the body can be empty or contain optional fields
    // Based on the API, the body should be a CustomDomain object (can be empty {})
    const body: {} = {};
    
    try {
      // The API returns an Operation, not a CustomDomain directly
      // We'll need to poll or wait for the operation to complete
      const response = await this.makeRequest<{
        name: string;
        done: boolean;
        response?: {
          name: string;
          domain: string;
          status: string;
          certPreference?: string;
          redirectTarget?: string;
          updateTime?: string;
        };
        error?: {
          code: number;
          message: string;
        };
      }>("POST", endpoint, body);

      logger.info("Custom domain creation initiated", {
        siteId,
        domain,
        operationName: response.name,
        done: response.done,
      });

      // If the operation is done, extract the domain info from response
      if (response.done && response.response) {
        return {
          domain: response.response.domain,
          status: response.response.status,
        };
      }

      // If operation is not done, we need to poll for completion
      // For now, return a pending status
      // In production, you might want to implement polling or return the operation name
      if (response.error) {
        throw new Error(`Firebase Hosting API error: ${response.error.message}`);
      }

      // Operation is in progress - return pending status
      // The actual domain will be created asynchronously
      return {
        domain: domain,
        status: "PENDING", // Operation is in progress
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to add custom domain to Firebase Hosting", {
        siteId,
        domain,
        endpoint,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Get domain status from Firebase Hosting
   * Reference: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains/get
   */
  async getDomainStatus(
    siteId: string,
    domain: string
  ): Promise<{ domain: string; status: string } | null> {
    try {
      const normalizedSiteId = siteId
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-");
      // Format: GET /v1beta1/projects/{project}/sites/{site}/customDomains/{domain}
      const endpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}/customDomains/${encodeURIComponent(domain)}`;
      const response = await this.makeRequest<{
        name: string;
        domain: string;
        status: string;
        certPreference?: string;
        redirectTarget?: string;
        updateTime?: string;
      }>("GET", endpoint);

      return {
        domain: response.domain,
        status: response.status,
      };
    } catch (error) {
      logger.warn("Failed to get domain status", {
        siteId,
        domain,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * List all domains for a site
   * Reference: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains/list
   */
  async listDomains(siteId: string): Promise<Array<{ domain: string; status: string }>> {
    try {
      const normalizedSiteId = siteId
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-");
      // Format: GET /v1beta1/projects/{project}/sites/{site}/customDomains
      const endpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}/customDomains`;
      const response = await this.makeRequest<{
        customDomains?: Array<{
          name: string;
          domain: string;
          status: string;
          certPreference?: string;
          redirectTarget?: string;
          updateTime?: string;
        }>;
      }>("GET", endpoint);

      return (response.customDomains || []).map((cd) => ({
        domain: cd.domain,
        status: cd.status,
      }));
    } catch (error) {
      logger.warn("Failed to list domains", {
        siteId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

	/**
	 * Deploy a version to a separate preview site (for viewing without making live)
	 * Creates a separate Firebase Hosting site for this version and returns the preview URL
	 */
	async deployToPreviewChannel(
		siteId: string,
		files: HostingFile[],
		channelId: string,
		versionMessage?: string
	): Promise<string> {
		// Create a unique site ID for this preview version
		// Format: original-site-id-v{version} or original-site-id-preview-{channelId}
		const normalizedSiteId = siteId
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");
		
		const previewSiteId = `${normalizedSiteId}-preview-${channelId}`.substring(0, 63); // Firebase site IDs have a 63 char limit

		logger.info("Deploying to preview site", {
			originalSiteId: normalizedSiteId,
			previewSiteId,
			channelId,
			fileCount: files.length,
		});

		// Create or get the preview site
		let previewSite;
		try {
			previewSite = await this.createSite(previewSiteId);
			logger.info("Preview site created/retrieved", {
				previewSiteId: previewSite.siteId,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error("Failed to create preview site", {
				previewSiteId,
				error: errorMessage,
			});
			throw new Error(`Failed to create preview site: ${errorMessage}`);
		}

		// Use the siteId from the response (works for both new and existing sites)
		const actualPreviewSiteId = previewSite.siteId || previewSiteId;

		// Deploy to the preview site (same as regular deployment)
		const previewUrl = await this.deploySite(
			actualPreviewSiteId,
			files,
			versionMessage || `Preview version ${channelId}`,
		);

		logger.info("Preview site deployment completed", {
			originalSiteId: normalizedSiteId,
			previewSiteId: actualPreviewSiteId,
			channelId,
			previewUrl,
		});

		return previewUrl;
	}

	/**
	 * Delete a Firebase Hosting site
	 * Reference: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites/delete
	 * @param siteId - The site ID to delete
	 */
	async deleteSite(siteId: string): Promise<void> {
		if (!siteId || typeof siteId !== "string") {
			throw new Error("Site ID is required and must be a string");
		}

		const normalizedSiteId = siteId
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");

		// Check if this is the default site (cannot be deleted)
		if (normalizedSiteId === this.projectId) {
			logger.warn("Cannot delete default Firebase Hosting site", {
				siteId: normalizedSiteId,
				projectId: this.projectId,
				note: "Default site (with same ID as project) cannot be deleted via API",
			});
			// Don't throw - just log and return (treat as success since we can't delete it anyway)
			return;
		}

		logger.info("Deleting Firebase Hosting site", {
			siteId: normalizedSiteId,
			projectId: this.projectId,
		});

		// Use project-scoped endpoint (correct format per Firebase Hosting API docs)
		// DELETE /v1beta1/projects/{project}/sites/{siteId}
		const projectScopedEndpoint = `/projects/${this.projectId}/sites/${normalizedSiteId}`;
		
		// Also try site-scoped as fallback (some operations support both)
		const siteScopedEndpoint = `/sites/${normalizedSiteId}`;

		// Try project-scoped first (correct format), then site-scoped as fallback
		for (const endpoint of [projectScopedEndpoint, siteScopedEndpoint]) {
			try {
				await this.makeRequest("DELETE", endpoint);
				logger.info("Firebase Hosting site deleted successfully", {
					siteId: normalizedSiteId,
					endpoint,
					projectId: this.projectId,
				});
				return;
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				
				// Check if error is 404 (site not found - already deleted or never existed)
				const isNotFound = 
					errorMessage.includes("404") || 
					errorMessage.toLowerCase().includes("not found") ||
					errorMessage.toLowerCase().includes("does not exist");

				if (isNotFound) {
					logger.info("Firebase Hosting site does not exist (already deleted or never created)", {
						siteId: normalizedSiteId,
						endpoint,
						projectId: this.projectId,
						note: "Treating 404 as success - site is already deleted",
					});
					return; // Treat 404 as success - site is already deleted
				}

				// If this is the last endpoint, throw the error
				if (endpoint === siteScopedEndpoint) {
					logger.error("Failed to delete Firebase Hosting site (both endpoints failed)", {
						siteId: normalizedSiteId,
						projectId: this.projectId,
						projectScopedEndpoint,
						siteScopedEndpoint,
						error: errorMessage,
					});
					throw error;
				}

				// Try next endpoint
				logger.debug("Failed to delete with project-scoped endpoint, trying site-scoped", {
					siteId: normalizedSiteId,
					projectId: this.projectId,
					error: errorMessage.substring(0, 200),
				});
			}
		}
	}
}
