import { EmailTemplateBlock, EmailTemplateDesignTokens } from "@/core";

/**
 * Convert EmailTemplate blocks to HTML
 */
export function blocksToHTML(
	blocks: EmailTemplateBlock[],
	designTokens: EmailTemplateDesignTokens,
	subject?: string,
	preheader?: string
): string {
	let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject || "Email"}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${designTokens.background || "#f7f4f2"};
      font-family: ${designTokens.fontFamily || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"};
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${designTokens.background || "#f7f4f2"};">
`;

	if (preheader) {
		html += `  <!-- PREHEADER -->\n`;
		html += `  <div style="display:none; font-size:1px; color:${designTokens.background || "#f7f4f2"}; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">\n`;
		html += `    ${preheader}\n`;
		html += `  </div>\n\n`;
	}

	html += `  <!-- MAIN WRAPPER -->\n`;
	html += `  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">\n`;
	html += `    <tr>\n`;
	html += `      <td align="center" style="padding:24px 12px;">\n`;
	html += `        <!-- CONTAINER -->\n`;
	html += `        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden;">\n`;

	// Group blocks by section
	const headerBlocks = blocks.filter(b => b.section === "header");
	const bodyBlocks = blocks.filter(b => b.section === "body");
	const footerBlocks = blocks.filter(b => b.section === "footer");

	// Render header
	if (headerBlocks.length > 0) {
		html += `          <!-- HEADER -->\n`;
		html += `          <tr>\n`;
		html += `            <td align="center" style="padding:20px 32px 12px 32px;">\n`;
		for (const block of headerBlocks) {
			html += blockToHTML(block, designTokens, 6);
		}
		html += `            </td>\n`;
		html += `          </tr>\n`;
	}

	// Render body
	if (bodyBlocks.length > 0) {
		html += `          <!-- MAIN CONTENT -->\n`;
		html += `          <tr>\n`;
		html += `            <td style="padding:24px 28px 12px 28px;">\n`;
		for (const block of bodyBlocks) {
			html += blockToHTML(block, designTokens, 6);
		}
		html += `            </td>\n`;
		html += `          </tr>\n`;
	}

	// Render footer
	if (footerBlocks.length > 0) {
		html += `          <!-- FOOTER -->\n`;
		html += `          <tr>\n`;
		html += `            <td style="padding:18px 24px 24px 24px; background-color:#f5f1ee;">\n`;
		for (const block of footerBlocks) {
			html += blockToHTML(block, designTokens, 6);
		}
		html += `            </td>\n`;
		html += `          </tr>\n`;
	}

	html += `        </table>\n`;
	html += `      </td>\n`;
	html += `    </tr>\n`;
	html += `  </table>\n`;
	html += `</body>\n`;
	html += `</html>`;

	return html;
}

/**
 * Convert a single block to HTML
 */
function blockToHTML(
	block: EmailTemplateBlock,
	designTokens: EmailTemplateDesignTokens,
	indent: number = 0
): string {
	const indentStr = " ".repeat(indent * 2);
	
	switch (block.type) {
		case "subject": {
			const subjectBlock = block as Extract<EmailTemplateBlock, { type: "subject" }>;
			return `${indentStr}<h1 style="margin:0; font-size:22px; line-height:1.3; color:#2f3432; font-weight:700;">${subjectBlock.content || ""}</h1>\n`;
		}
		case "text": {
			const textBlock = block as Extract<EmailTemplateBlock, { type: "text" }>;
			const typography = textBlock.typography;
			const spacing = textBlock.spacing;
			const styles: Record<string, string> = {
				margin: `${spacing?.marginTop || 0}px ${spacing?.marginRight || 0}px ${spacing?.marginBottom || 0}px ${spacing?.marginLeft || 0}px`,
				padding: `${spacing?.paddingTop || 0}px ${spacing?.paddingRight || 0}px ${spacing?.paddingBottom || 0}px ${spacing?.paddingLeft || 0}px`,
				fontSize: `${typography?.fontSize || 14}px`,
				fontWeight: typography?.fontWeight || "400",
				lineHeight: String(typography?.lineHeight || 1.6),
				color: typography?.color || "#555f59",
				textAlign: textBlock.align || "left",
			};
			if (textBlock.backgroundColor) styles.backgroundColor = textBlock.backgroundColor;
			const styleStr = Object.entries(styles).map(([k, v]) => `${k}:${v}`).join("; ");
			const tag = textBlock.emphasize ? "strong" : "p";
			return `${indentStr}<${tag} style="${styleStr}">${textBlock.content || ""}</${tag}>\n`;
		}
		case "button": {
			const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
			const styles: Record<string, string> = {
				display: "inline-block",
				padding: `${buttonBlock.buttonHeight / 2 || 12}px ${buttonBlock.buttonHeight || 26}px`,
				fontSize: "14px",
				textDecoration: "none",
				color: "#ffffff",
				fontWeight: "600",
				borderRadius: "999px",
				backgroundColor: buttonBlock.variant === "primary" ? "#2d5a4f" : "#e5e7eb",
			};
			const styleStr = Object.entries(styles).map(([k, v]) => `${k}:${v}`).join("; ");
			return `${indentStr}<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${buttonBlock.align || "center"}" style="margin:18px auto 8px auto;">\n${indentStr}  <tr>\n${indentStr}    <td align="center" bgcolor="${buttonBlock.variant === "primary" ? "#2d5a4f" : "#e5e7eb"}" style="border-radius:999px;">\n${indentStr}      <a href="${buttonBlock.url || "#"}" style="${styleStr}">${buttonBlock.label || ""}</a>\n${indentStr}    </td>\n${indentStr}  </tr>\n${indentStr}</table>\n`;
		}
		case "image": {
			const imageBlock = block as Extract<EmailTemplateBlock, { type: "image" }>;
			const styles: Record<string, string> = {
				display: "block",
				width: "100%",
				maxWidth: `${imageBlock.width || 600}px`,
				height: "auto",
				border: "0",
			};
			if (imageBlock.borderRadius) styles.borderRadius = `${imageBlock.borderRadius}px`;
			const styleStr = Object.entries(styles).map(([k, v]) => `${k}:${v}`).join("; ");
			return `${indentStr}<img src="${imageBlock.src || ""}" alt="${imageBlock.alt || ""}" style="${styleStr}" />\n`;
		}
		case "logo": {
			const logoBlock = block as Extract<EmailTemplateBlock, { type: "logo" }>;
			const styles: Record<string, string> = {
				display: "block",
				maxWidth: `${logoBlock.width || 160}px`,
				height: "auto",
				border: "0",
				marginBottom: "12px",
			};
			if (logoBlock.borderRadius) styles.borderRadius = `${logoBlock.borderRadius}px`;
			const styleStr = Object.entries(styles).map(([k, v]) => `${k}:${v}`).join("; ");
			const link = logoBlock.link ? `<a href="${logoBlock.link}" style="text-decoration:none; display:inline-block;">` : "";
			const linkClose = logoBlock.link ? "</a>" : "";
			return `${indentStr}${link}<img src="${logoBlock.src || ""}" alt="${logoBlock.alt || ""}" style="${styleStr}" />${linkClose}\n`;
		}
		case "divider": {
			const dividerBlock = block as Extract<EmailTemplateBlock, { type: "divider" }>;
			return `${indentStr}<hr style="border:none; border-top:${dividerBlock.width || 1}px ${dividerBlock.style || "solid"} ${dividerBlock.color || "#ece4df"}; margin:0 0 16px 0;" />\n`;
		}
		case "columns": {
			const columnsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			let html = `${indentStr}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">\n`;
			html += `${indentStr}  <tr>\n`;
			for (const column of columnsBlock.columns) {
				const width = Math.round(column.width);
				html += `${indentStr}    <td width="${width}%" valign="top" style="padding-right:${columnsBlock.gap / 2 || 6}px; padding-left:${columnsBlock.gap / 2 || 6}px;">\n`;
				for (const nestedBlock of column.blocks) {
					html += blockToHTML(nestedBlock, designTokens, indent + 4);
				}
				html += `${indentStr}    </td>\n`;
			}
			html += `${indentStr}  </tr>\n`;
			html += `${indentStr}</table>\n`;
			return html;
		}
		case "container": {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			const styles: Record<string, string> = {
				margin: "16px 0",
				backgroundColor: containerBlock.backgroundColor || "#f8faf8",
				borderRadius: "12px",
			};
			const styleStr = Object.entries(styles).map(([k, v]) => `${k}:${v}`).join("; ");
			let html = `${indentStr}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${styleStr}">\n`;
			for (const nestedBlock of containerBlock.blocks) {
				html += `${indentStr}  <tr>\n`;
				html += `${indentStr}    <td style="padding:12px 16px 4px 16px;">\n`;
				html += blockToHTML(nestedBlock, designTokens, indent + 3);
				html += `${indentStr}    </td>\n`;
				html += `${indentStr}  </tr>\n`;
			}
			html += `${indentStr}</table>\n`;
			return html;
		}
		case "rawHtml": {
			const rawHtmlBlock = block as Extract<EmailTemplateBlock, { type: "rawHtml" }>;
			return `${indentStr}${rawHtmlBlock.html || ""}\n`;
		}
		default:
			return `${indentStr}<!-- Unknown block type: ${block.type} -->\n`;
	}
}

/**
 * Parse HTML back to EmailTemplate blocks
 * Handles both div-based and table-based email layouts
 */
export function htmlToBlocks(html: string): {
	blocks: EmailTemplateBlock[];
	subject?: string;
	preheader?: string;
} {
	console.warn("[HTML Parser] Starting HTML to blocks conversion");
	
	const blocks: EmailTemplateBlock[] = [];
	let subject: string | undefined;
	let preheader: string | undefined;

	try {
		// Create a temporary DOM element to parse HTML
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		// Check for parsing errors
		const parserError = doc.querySelector("parsererror");
		if (parserError) {
			console.warn("[HTML Parser] HTML parsing error detected:", parserError.textContent);
		// Don't fail completely - try to parse what we can
		}

		// Extract subject from <title>
		const titleEl = doc.querySelector("title");
		if (titleEl) {
			subject = titleEl.textContent?.trim() || undefined;
		}

		// Extract preheader (usually in a hidden div with display:none)
		const preheaderDiv = Array.from(doc.querySelectorAll("div")).find(
			(div) => {
				const style = div.getAttribute("style") || "";
				return style.includes("display:none") || style.includes("display: none");
			}
		);
		if (preheaderDiv) {
			preheader = preheaderDiv.textContent?.trim() || undefined;
		}

		// Try to find sections by class names first (div-based layout)
		const headerEl = doc.querySelector(".email-header");
		const bodyEl = doc.querySelector(".email-body");
		const footerEl = doc.querySelector(".email-footer");

	if (headerEl || bodyEl || footerEl) {
		// Div-based layout
		if (headerEl) {
			const h1 = headerEl.querySelector("h1");
			if (h1 && !subject) {
				subject = h1.textContent?.trim() || undefined;
			}
			const headerBlocks = parseBlocksFromElement(headerEl, "header");
			blocks.push(...headerBlocks);
		}

		if (bodyEl) {
			const bodyBlocks = parseBlocksFromElement(bodyEl, "body");
			blocks.push(...bodyBlocks);
		}

		if (footerEl) {
			const footerBlocks = parseBlocksFromElement(footerEl, "footer");
			blocks.push(...footerBlocks);
		}
	} else {
		// Table-based layout (standard for emails)
		// Find the main content table - look for the outermost table with role="presentation"
		// or the largest table structure
		const allTables = Array.from(doc.querySelectorAll('table[role="presentation"]'));
		
		if (allTables.length > 0) {
			// Find the outermost table (not nested inside another table)
			let mainTable: Element | null = null;
			for (const table of allTables) {
				let isNested = false;
				for (const otherTable of allTables) {
					if (otherTable !== table && otherTable.contains(table)) {
						isNested = true;
						break;
					}
				}
				if (!isNested) {
					mainTable = table;
					break;
				}
			}
			
			// If no outermost found, use the first one
			if (!mainTable && allTables.length > 0) {
				mainTable = allTables[0];
			}
			
			if (mainTable) {
				const tableBlocks = parseTableLayout(mainTable);
				blocks.push(...tableBlocks);
			}
		} else {
			// No presentation tables - look for any table structure
			const anyTable = doc.querySelector("body > table, body > div > table");
			if (anyTable) {
				const tableBlocks = parseTableLayout(anyTable);
				blocks.push(...tableBlocks);
			} else {
				// Fallback: parse the entire body or container
				const container = doc.querySelector(".email-container") || 
				                 doc.querySelector("body > div") ||
				                 doc.body;
				const allBlocks = parseBlocksFromElement(container, "body");
				blocks.push(...allBlocks);
			}
		}
	}

		// Extract subject from h1 if not found yet
		if (!subject) {
			const h1 = doc.querySelector("h1");
			if (h1) {
				subject = h1.textContent?.trim() || undefined;
			}
		}

		if (blocks.length === 0) {
			console.warn("[HTML Parser] No blocks were parsed from HTML. HTML length:", html.length);
			console.warn("[HTML Parser] HTML structure:", html.substring(0, 500));
			// If we couldn't parse anything, try to preserve the body content as rawHtml
			// but only as a last resort
			const bodyContent = doc.body?.innerHTML || "";
			if (bodyContent.trim()) {
				console.warn("[HTML Parser] Falling back to rawHtml for entire body content");
				blocks.push({
					id: crypto.randomUUID(),
					type: "rawHtml",
					section: "body",
					html: bodyContent,
				});
			}
		} else {
			console.warn(`[HTML Parser] Successfully parsed ${blocks.length} blocks`);
			const blockTypes = blocks.map(b => b.type);
			const typeCounts = blockTypes.reduce((acc, type) => {
				acc[type] = (acc[type] || 0) + 1;
				return acc;
			}, {} as Record<string, number>);
			console.warn("[HTML Parser] Block type distribution:", typeCounts);
		}
	} catch (error) {
		console.error("[HTML Parser] Error during parsing:", error);
		// Don't wrap entire HTML - try to extract what we can
		// Only use rawHtml as absolute last resort
		if (blocks.length === 0) {
			console.warn("[HTML Parser] Complete parse failure, preserving HTML as rawHtml");
			blocks.push({
				id: crypto.randomUUID(),
				type: "rawHtml",
				section: "body",
				html: html,
			});
		}
		// If we have some blocks, continue with what we parsed
	}

	return { blocks, subject, preheader };
}

/**
 * Parse table-based email layout
 * Handles nested tables and complex structures
 */
function parseTableLayout(table: Element): EmailTemplateBlock[] {
	const blocks: EmailTemplateBlock[] = [];
	// Get direct children - check for tbody first, then direct tr elements
	const children = Array.from(table.children);
	const rows: Element[] = [];
	
	// Look for tbody elements first
	for (const child of children) {
		if (child.tagName.toLowerCase() === "tbody") {
			// Get all tr children of tbody
			const tbodyRows = Array.from(child.children).filter(
				el => el.tagName.toLowerCase() === "tr"
			);
			rows.push(...tbodyRows);
		} else if (child.tagName.toLowerCase() === "tr") {
			// Direct tr child
			rows.push(child);
		}
	}

	if (rows.length === 0) {
		console.warn("[HTML Parser] Table has no rows");
		return blocks;
	}

	let currentSection: "header" | "body" | "footer" = "body";
	let rowIndex = 0;
	const totalRows = rows.length;
	
	console.warn(`[HTML Parser] Parsing table with ${totalRows} rows`);

	for (const row of rows) {
		// Get direct td/th children using DOM methods
		const rowChildren = Array.from(row.children);
		const cells = rowChildren.filter(
			el => el.tagName.toLowerCase() === "td" || el.tagName.toLowerCase() === "th"
		);
		if (cells.length === 0) continue;

		// Better section detection based on content and styling
		const cellStyles = cells[0] ? parseStyles(cells[0].getAttribute("style") || "") : {};
		
		// Check for header indicators
		if (rowIndex < 3) {
			const hasLogo = row.querySelector("img[alt*='logo' i], img[alt*='Logo' i], img[alt*='brand' i]") !== null;
			const hasGradient = cellStyles.background?.includes("gradient") || cellStyles.background?.includes("linear-gradient");
			const hasHeaderText = row.textContent?.match(/цветя|decor|logo|brand/i) !== null;
			
			if (hasLogo || hasGradient || hasHeaderText) {
				currentSection = "header";
			}
		}

		// Check for footer indicators
		if (rowIndex >= totalRows - 2) {
			const hasUnsubscribe = row.textContent?.toLowerCase().includes("unsubscribe") ||
			                      row.textContent?.toLowerCase().includes("отпиш") ||
			                      row.querySelector('a[href*="unsubscribe" i]') !== null;
			const hasContact = row.textContent?.includes("@") || 
			                  row.querySelector('a[href^="mailto:"]') !== null;
			const hasFooterBg = cellStyles.backgroundColor && 
			                   (cellStyles.backgroundColor.includes("#f5f1ee") || 
			                    cellStyles.backgroundColor.includes("#f5f1ee"));
			
			if (hasUnsubscribe || hasContact || hasFooterBg) {
				currentSection = "footer";
			}
		}

		// Check if this row contains a nested table (like order summary or product cards)
		const nestedTable = cells[0]?.querySelector("table[role='presentation']");
		if (nestedTable && cells.length === 1) {
			// Check if it's a two-column layout (products) - look for a row with 2 cells
			const nestedChildren = Array.from(nestedTable.children);
			const nestedRows: Element[] = [];
			
			// Get rows from nested table (same logic as parseTableLayout)
			for (const child of nestedChildren) {
				if (child.tagName.toLowerCase() === "tbody") {
					const tbodyRows = Array.from(child.children).filter(
						el => el.tagName.toLowerCase() === "tr"
					);
					nestedRows.push(...tbodyRows);
				} else if (child.tagName.toLowerCase() === "tr") {
					nestedRows.push(child);
				}
			}
			let foundTwoColumn = false;
			
			for (const nestedRow of nestedRows) {
				const nestedRowChildren = Array.from(nestedRow.children);
				const nestedRowCells = nestedRowChildren.filter(
					el => el.tagName.toLowerCase() === "td" || el.tagName.toLowerCase() === "th"
				);
				if (nestedRowCells.length === 2) {
					// Found two-column layout - create columns block
					const columnBlocks = nestedRowCells.map((cell) => {
						// Parse the entire cell content, including nested tables
						const cellBlocks = parseBlocksFromElement(cell, currentSection);
						return {
							id: crypto.randomUUID(),
							width: 50,
							blocks: cellBlocks,
						};
					});

					if (columnBlocks.some(col => col.blocks.length > 0)) {
						// Calculate gap from cell padding
						const firstCellStyles = parseStyles(nestedRowCells[0].getAttribute("style") || "");
						const gap = (parseInt(firstCellStyles.paddingRight || "0") || 0) + 
						           (parseInt(firstCellStyles.paddingLeft || "0") || 0) || 12;
						
						blocks.push({
							id: crypto.randomUUID(),
							type: "columns",
							section: currentSection,
							columnCount: "2" as const,
							gap,
							align: "left",
							stackOnMobile: true,
							columns: columnBlocks,
						});
						foundTwoColumn = true;
						break; // Only process first two-column row
					}
				}
			}
			
			if (!foundTwoColumn) {
				// Single column nested table (like order summary) - parse as container
				const cellStyles = parseStyles(cells[0].getAttribute("style") || "");
				const nestedBlocks = parseTableLayout(nestedTable);
				
				// If nested table has background or styling, wrap in container
				if (cellStyles.backgroundColor || nestedBlocks.length > 1) {
					blocks.push({
						id: crypto.randomUUID(),
						type: "container",
						section: currentSection,
						maxWidth: 600,
						align: "left",
						padding: "md",
						backgroundColor: cellStyles.backgroundColor || undefined,
						blocks: nestedBlocks,
					});
				} else {
					blocks.push(...nestedBlocks);
				}
			}
		} else if (cells.length > 1) {
			// Multi-column row - create columns block
			const columnBlocks = cells.map((cell) => {
				const cellBlocks = parseBlocksFromElement(cell, currentSection);
				return {
					id: crypto.randomUUID(),
					width: 100 / cells.length,
					blocks: cellBlocks,
				};
			});

			if (columnBlocks.some(col => col.blocks.length > 0)) {
				blocks.push({
					id: crypto.randomUUID(),
					type: "columns",
					section: currentSection,
					columnCount: String(Math.min(cells.length, 4)) as "2" | "3" | "4",
					gap: 16,
					align: "left",
					stackOnMobile: true,
					columns: columnBlocks,
				});
			}
		} else if (cells.length === 1) {
			// Single cell - parse its content
			const cell = cells[0];
			const cellBlocks = parseBlocksFromElement(cell, currentSection);
			
			// Check if cell has a nested table that we should parse separately
			const cellNestedTable = Array.from(cell.children).find(
				el => el.tagName.toLowerCase() === "table" && el.getAttribute("role") === "presentation"
			) as Element | undefined;
			if (cellNestedTable && cellBlocks.length === 0) {
				console.warn(`[HTML Parser] Found nested table in row ${rowIndex}, parsing separately`);
				const tableBlocks = parseTableLayout(cellNestedTable);
				blocks.push(...tableBlocks);
			} else {
				if (cellBlocks.length === 0) {
					console.warn(`[HTML Parser] Row ${rowIndex} cell produced no blocks. Cell content:`, cell.textContent?.substring(0, 100));
				}
				blocks.push(...cellBlocks);
			}
		}

		// After first few rows, switch to body (unless we detected footer)
		if (rowIndex >= 2 && currentSection === "header") {
			currentSection = "body";
		}

		rowIndex++;
	}

	return blocks;
}

/**
 * Parse blocks from a DOM element
 * Handles nested structures, tables, and complex layouts
 */
function parseBlocksFromElement(
	element: Element | null,
	section: "header" | "body" | "footer"
): EmailTemplateBlock[] {
	if (!element) return [];

	const blocks: EmailTemplateBlock[] = [];
	const tagName = element.tagName.toLowerCase();
	
	// Handle table cells - parse their content
	if (tagName === "td" || tagName === "th") {
		const children = Array.from(element.children);
		
		// If cell has nested table, parse it (check direct children first)
		const cellChildren = Array.from(element.children);
		const nestedTable = cellChildren.find(
			el => el.tagName.toLowerCase() === "table" && el.getAttribute("role") === "presentation"
		) as Element | undefined;
		if (nestedTable) {
			const tableBlocks = parseTableLayout(nestedTable);
			blocks.push(...tableBlocks);
			return blocks;
		}
		
		// If cell has direct children, parse them
		if (children.length > 0) {
			for (const child of children) {
				const block = elementToBlock(child, section);
				if (block) {
					blocks.push(block);
				} else {
					// Try to parse nested content more aggressively
					const nestedBlocks = parseBlocksFromElement(child, section);
					if (nestedBlocks.length === 0) {
						// Try one more time - extract any text content
						const textContent = child.textContent?.trim();
						if (textContent) {
							console.warn(`[HTML Parser] Could not parse <${child.tagName.toLowerCase()}> in cell, extracting text:`, textContent.substring(0, 100));
							blocks.push({
								id: crypto.randomUUID(),
								type: "text",
								section,
								content: textContent,
								align: "left",
								emphasize: false,
							});
						}
					} else {
						blocks.push(...nestedBlocks);
					}
				}
			}
		} else {
			// Cell has only text content or mixed content
			// Try to parse as block first (handles styled elements)
			const block = elementToBlock(element, section);
			if (block) {
				blocks.push(block);
			} else {
				// Extract text from cell - handle nested elements and inline formatting
				const text = element.textContent?.trim();
				if (text) {
					// Check if cell has inline elements that should be preserved
					const hasInlineElements = element.querySelector("strong, b, em, i, a, span");
					if (hasInlineElements) {
						// Has formatting - try to parse children recursively
						const childBlocks = parseBlocksFromElement(element, section);
						if (childBlocks.length > 0) {
							blocks.push(...childBlocks);
						} else {
							// Fallback to text block with all text (preserve formatting in content)
							console.warn(`[HTML Parser] Could not parse formatted text in cell, preserving as text block:`, text.substring(0, 100));
							blocks.push({
								id: crypto.randomUUID(),
								type: "text",
								section,
								content: text,
								align: "left",
								emphasize: false,
							});
						}
					} else {
						// Plain text - create text block
						blocks.push({
							id: crypto.randomUUID(),
							type: "text",
							section,
							content: text,
							align: "left",
							emphasize: false,
						});
					}
				}
			}
		}
		return blocks;
	}

	// Handle nested tables
	if (tagName === "table" && element.getAttribute("role") === "presentation") {
		const tableBlocks = parseTableLayout(element);
		blocks.push(...tableBlocks);
		return blocks;
	}

	const children = Array.from(element.children);

	for (const child of children) {
		// Skip if it's a section wrapper
		if (child.classList.contains("email-header") || 
			child.classList.contains("email-body") || 
			child.classList.contains("email-footer")) {
			continue;
		}

		// Skip table structure elements (we handle them in parseTableLayout)
		if (child.tagName.toLowerCase() === "table" && child.getAttribute("role") === "presentation") {
			// Nested table - parse it
			const nestedBlocks = parseTableLayout(child);
			blocks.push(...nestedBlocks);
			continue;
		}

		const block = elementToBlock(child, section);
		if (block) {
			blocks.push(block);
		} else {
			// Try to parse nested content more aggressively
			const nestedBlocks = parseBlocksFromElement(child, section);
			if (nestedBlocks.length > 0) {
				blocks.push(...nestedBlocks);
			} else {
				// Try to extract text content as a last attempt before rawHtml
				const textContent = child.textContent?.trim();
				if (textContent) {
					console.warn(`[HTML Parser] Could not parse element <${child.tagName.toLowerCase()}> as visual block, extracting as text:`, textContent.substring(0, 100));
					blocks.push({
						id: crypto.randomUUID(),
						type: "text",
						section,
						content: textContent,
						align: "left",
						emphasize: false,
					});
				} else {
					// Only use rawHtml as absolute last resort
					const rawHtml = child.outerHTML || child.innerHTML || "";
					if (rawHtml.trim() && rawHtml.length > 20) { // Only for substantial HTML
						console.warn(`[HTML Parser] Could not parse element <${child.tagName.toLowerCase()}> into visual blocks, preserving as rawHtml:`, rawHtml.substring(0, 200));
						blocks.push({
							id: crypto.randomUUID(),
							type: "rawHtml",
							section,
							html: rawHtml,
						});
					}
				}
			}
		}
	}

	return blocks;
}

/**
 * Convert a DOM element to an EmailTemplateBlock
 */
function elementToBlock(
	element: Element,
	section: "header" | "body" | "footer"
): EmailTemplateBlock | null {
	const tagName = element.tagName.toLowerCase();
	const styles = parseStyles(element.getAttribute("style") || "");
	const computedStyles = window.getComputedStyle(element);

	// Handle text elements - extract text content properly, handling nested elements
	if (tagName === "p" || tagName === "strong" || tagName === "b" || tagName === "em" || tagName === "i" || 
	    tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6" ||
	    tagName === "span" || (tagName === "div" && element.children.length === 0)) {
		
		// Get text content - handle nested elements and preserve structure
		let textContent = "";
		if (element.children.length === 0) {
			// No children - get text directly
			textContent = element.textContent?.trim() || "";
		} else {
			// Has children - extract text from all text nodes, preserving order
			const textParts: string[] = [];
			const processNode = (node: Node) => {
				if (node.nodeType === Node.TEXT_NODE) {
					const text = node.textContent?.trim();
					if (text) {
						textParts.push(text);
					}
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					// For inline elements, get their text
					const el = node as Element;
					if (["strong", "b", "em", "i", "span", "a"].includes(el.tagName.toLowerCase())) {
						const childText = el.textContent?.trim();
						if (childText) {
							textParts.push(childText);
						}
					} else {
						// For block elements, process children
						Array.from(node.childNodes).forEach(processNode);
					}
				}
			};
			Array.from(element.childNodes).forEach(processNode);
			textContent = textParts.join(" ").trim();
		}
		
		// Only create text block if there's actual text content
		if (!textContent) {
			return null;
		}
		
		return {
			id: crypto.randomUUID(),
			type: "text",
			section,
			content: textContent,
			align: (styles.textAlign || "left") as "left" | "center" | "right" | "justify",
			emphasize: tagName === "strong" || tagName === "b" || tagName === "h1" || tagName === "h2" || tagName === "h3",
			typography: (() => {
				// Parse fontSize - handle px, em, rem units
				const fontSizeStr = styles.fontSize || computedStyles.fontSize || "16";
				const fontSize = parseInt(fontSizeStr.replace(/px|em|rem/, "")) || 16;
				const fontWeight = (styles.fontWeight || computedStyles.fontWeight || "400") as "400" | "600" | "normal" | "500" | "700" | "bold";
				const lineHeight = parseFloat(styles.lineHeight || computedStyles.lineHeight || "1.5");
				const letterSpacing = parseFloat(styles.letterSpacing || computedStyles.letterSpacing || "0");
				const color = styles.color || computedStyles.color || "#000000";
				return {
					fontSize: isNaN(fontSize) ? 16 : fontSize,
					fontWeight: fontWeight,
					lineHeight: isNaN(lineHeight) ? 1.5 : lineHeight,
					letterSpacing: isNaN(letterSpacing) ? 0 : letterSpacing,
					color: color,
					fontStyle: (styles.fontStyle || computedStyles.fontStyle || "normal") as "normal" | "italic",
					textDecoration: (styles.textDecoration || computedStyles.textDecoration || "none") as "none" | "underline" | "line-through",
				};
			})(),
			spacing: (() => {
				const marginTop = parseInt(styles.marginTop || "0") || 0;
				const marginRight = parseInt(styles.marginRight || "0") || 0;
				const marginBottom = parseInt(styles.marginBottom || "0") || 0;
				const marginLeft = parseInt(styles.marginLeft || "0") || 0;
				const paddingTop = parseInt(styles.paddingTop || "0") || 0;
				const paddingRight = parseInt(styles.paddingRight || "0") || 0;
				const paddingBottom = parseInt(styles.paddingBottom || "0") || 0;
				const paddingLeft = parseInt(styles.paddingLeft || "0") || 0;
				return {
					marginTop,
					marginRight,
					marginBottom,
					marginLeft,
					paddingTop,
					paddingRight,
					paddingBottom,
					paddingLeft,
				};
			})(),
			backgroundColor: styles.backgroundColor || undefined,
			border: (() => {
				const borderWidth = parseInt(styles.borderWidth || "0") || 0;
				const borderRadius = parseInt(styles.borderRadius || "0") || 0;
				return {
					borderWidth,
					borderColor: styles.borderColor || "#000000",
					borderStyle: (styles.borderStyle || "solid") as "solid" | "dashed" | "dotted",
					borderRadius,
				};
			})(),
		};
	}

	if (tagName === "a") {
		const href = element.getAttribute("href") || "#";
		const linkText = element.textContent?.trim() || "";
		
		if (!linkText) {
			return null;
		}
		
		// Check if it looks like a button (has background, padding, border-radius, or bgcolor attribute)
		const hasButtonStyle = styles.backgroundColor || 
		                      element.getAttribute("bgcolor") ||
		                      styles.padding || 
		                      styles.borderRadius ||
		                      styles.display === "inline-block" ||
		                      styles.display === "block";
		
		if (hasButtonStyle) {
			// Parse padding to get button height - handle formats like "12px 26px" or "12px"
			const paddingStr = styles.padding || "";
			const paddingMatch = paddingStr.match(/(\d+)/);
			const paddingValue = paddingMatch ? parseInt(paddingMatch[1]) : 12;
			
			return {
				id: crypto.randomUUID(),
				type: "button",
				section,
				label: linkText,
				url: href,
				variant: (styles.backgroundColor || element.getAttribute("bgcolor")) ? "primary" : "secondary",
				align: (styles.textAlign || element.getAttribute("align") || "center") as "left" | "center" | "right",
				buttonWidth: styles.width === "100%" || element.getAttribute("width") === "100%" ? "full" : "auto",
				buttonHeight: Math.max(paddingValue * 2, 32) || 44,
			};
		}
		
		// Regular link - convert to text block (links in text can be preserved in content)
		return {
			id: crypto.randomUUID(),
			type: "text",
			section,
			content: linkText,
			align: (styles.textAlign || "left") as "left" | "center" | "right" | "justify",
			emphasize: false,
		};
	}

	if (tagName === "img") {
		const src = element.getAttribute("src") || "";
		if (!src) {
			return null;
		}
		
		// Parse width - handle max-width, width style, or width attribute
		const widthStr = styles.maxWidth || styles.width || element.getAttribute("width") || "400";
		const width = parseInt(widthStr.replace(/px|%/, "")) || 400;
		
		// Parse border radius
		const borderRadiusStr = styles.borderRadius || "0";
		const borderRadius = parseInt(borderRadiusStr.replace(/px/, "")) || 0;
		
		// Determine if it's a logo (usually in header or has logo in alt/src/class)
		const alt = element.getAttribute("alt") || "";
		const className = element.getAttribute("class") || "";
		const isLogo = section === "header" || 
		               alt.toLowerCase().includes("logo") ||
		               src.toLowerCase().includes("logo") ||
		               className.toLowerCase().includes("logo");
		
		// Get alignment from style, align attribute, or parent
		const align = (styles.textAlign || 
		              element.getAttribute("align") || 
		              element.parentElement?.getAttribute("align") ||
		              (isLogo ? "center" : "center")) as "left" | "center" | "right";
		
		if (isLogo) {
			return {
				id: crypto.randomUUID(),
				type: "logo" as const,
				section: "header" as const,
				src,
				alt,
				width: Math.min(Math.max(width, 24), 300),
				align,
				aspectRatio: "auto" as const,
				borderRadius,
			};
		} else {
			return {
				id: crypto.randomUUID(),
				type: "image" as const,
				section,
				src,
				alt,
				width: Math.min(Math.max(width, 24), 600),
				align,
				aspectRatio: "auto" as const,
				borderRadius,
			};
		}
	}

	if (tagName === "hr") {
		return {
			id: crypto.randomUUID(),
			type: "divider",
			section,
			style: (styles.borderStyle || "solid") as "solid" | "dashed" | "dotted",
			color: styles.backgroundColor || "#e5e7eb",
			width: parseInt(styles.height || "1") || 1,
			align: (styles.textAlign || "center") as "left" | "center" | "right",
			dividerWidth: parseInt(styles.width || "100") || 100,
		};
	}

	if (tagName === "div" && element.classList.contains("columns-container")) {
		const columns = Array.from(element.querySelectorAll(".column"));
		return {
			id: crypto.randomUUID(),
			type: "columns",
			section,
			columnCount: String(columns.length) as "2" | "3" | "4",
			gap: parseInt(styles.gap || "16") || 16,
			align: (styles.textAlign || "left") as "left" | "center" | "right",
			stackOnMobile: styles.flexWrap === "wrap",
			columns: columns.map((col) => ({
				id: crypto.randomUUID(),
				width: 100 / columns.length,
				blocks: parseBlocksFromElement(col, section),
			})),
		};
	}

	if (tagName === "div" && element.classList.contains("container")) {
		return {
			id: crypto.randomUUID(),
			type: "container",
			section,
			maxWidth: (() => {
				const width = parseInt(styles.maxWidth || "600");
				const validWidths = [520, 600, 680, 800] as const;
				const parsed = isNaN(width) ? 600 : width;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return (validWidths.includes(parsed as any) ? parsed : 600) as 520 | 600 | 680 | 800;
			})(),
			align: (styles.textAlign || "center") as "left" | "center" | "right",
			padding: "md",
			blocks: parseBlocksFromElement(element, section),
		};
	}

	if (tagName === "div" && !element.textContent?.trim()) {
		// Empty div - treat as spacer
		const height = parseInt(styles.height || "16") || 16;
		if (height > 0) {
			return {
				id: crypto.randomUUID(),
				type: "spacer",
				section,
				height,
			};
		}
	}

	// For other elements, try to parse nested content more aggressively
	// Try multiple strategies before giving up
	const nestedBlocks = parseBlocksFromElement(element, section);
	if (nestedBlocks.length > 0) {
		// If element has meaningful styling or is a structural element, wrap in container
		const hasMeaningfulStyle = styles.backgroundColor || 
		                          styles.padding || 
		                          styles.margin ||
		                          styles.borderRadius ||
		                          element.classList.length > 0;
		
		if (hasMeaningfulStyle && tagName === "div") {
			return {
				id: crypto.randomUUID(),
				type: "container",
				section,
				maxWidth: (() => {
					const width = parseInt(styles.maxWidth || "600");
					const validWidths = [520, 600, 680, 800] as const;
					const parsed = isNaN(width) ? 600 : width;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return (validWidths.includes(parsed as any) ? parsed : 600) as 520 | 600 | 680 | 800;
				})(),
				align: (styles.textAlign || "center") as "left" | "center" | "right",
				padding: "md",
				blocks: nestedBlocks,
			};
		}
		
		// For other elements, just return nested blocks directly
		// This prevents unnecessary container wrapping
		return null; // Let parseBlocksFromElement handle it
	}

	// Last resort: try to extract any text content before returning null
	const textContent = element.textContent?.trim();
	if (textContent && textContent.length > 0) {
		console.warn(`[HTML Parser] Could not parse <${tagName}> element, extracting text content:`, textContent.substring(0, 100));
		return {
			id: crypto.randomUUID(),
			type: "text",
			section,
			content: textContent,
			align: "left",
			emphasize: false,
		};
	}

	return null;
}

/**
 * Parse style string to object
 */
function parseStyles(styleString: string): Record<string, string> {
	const styles: Record<string, string> = {};
	if (!styleString) return styles;

	styleString.split(";").forEach((rule) => {
		const [key, value] = rule.split(":").map((s) => s.trim());
		if (key && value) {
			styles[key] = value;
		}
	});

	return styles;
}
