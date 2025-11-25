import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useTheme } from "@/components/ui/theme-provider";

interface EmailHtmlEditorProps {
	html: string;
	onChange: (html: string) => void;
	onBlur?: () => void;
}

export function EmailHtmlEditor({ html, onChange, onBlur }: EmailHtmlEditorProps) {
	const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light");
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
	const lastHtmlRef = useRef<string>(html);
	const lastSentHtmlRef = useRef<string>(html);
	const isInternalUpdateRef = useRef<boolean>(false);
	const changeDisposableRef = useRef<monaco.IDisposable | null>(null);
	const onChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const { theme } = useTheme();

	// Configure Monaco themes
	useEffect(() => {
		monaco.editor.defineTheme("financely-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [],
			colors: {
				"editor.background": "#1a1a1a",
				"editor.foreground": "#d4d4d4",
			},
		});

		monaco.editor.defineTheme("financely-light", {
			base: "vs",
			inherit: true,
			rules: [],
			colors: {
				"editor.background": "#ffffff",
				"editor.foreground": "#000000",
			},
		});
	}, []);

	// Sync theme with app theme
	useEffect(() => {
		const isDark = theme === "dark" || document.documentElement.classList.contains("dark");
		setEditorTheme(isDark ? "dark" : "light");
	}, [theme]);

	// Watch for theme changes
	useEffect(() => {
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setEditorTheme(isDark ? "dark" : "light");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	// Sync HTML content from props (only when it changes externally)
	useEffect(() => {
		if (editorRef.current) {
			const editor = editorRef.current;
			const currentValue = editor.getValue();
			// Only update if:
			// 1. The prop is different from current editor value
			// 2. The prop is different from what we last set
			// 3. The prop is different from what we last sent to parent (to avoid loop)
			if (html !== currentValue && html !== lastHtmlRef.current && html !== lastSentHtmlRef.current) {
				// Mark as internal update BEFORE setting value to prevent onChange trigger
				isInternalUpdateRef.current = true;
				editor.setValue(html);
				lastHtmlRef.current = html;
				// Reset flag after a short delay to allow the change event to process
				setTimeout(() => {
					isInternalUpdateRef.current = false;
				}, 50);
			} else if (html === lastSentHtmlRef.current) {
				// If html matches what we last sent, it's likely a response to our onChange
				// Just update the refs to prevent unnecessary checks
				lastHtmlRef.current = html;
			}
		}
	}, [html]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (changeDisposableRef.current) {
				changeDisposableRef.current.dispose();
			}
			if (onChangeTimeoutRef.current) {
				clearTimeout(onChangeTimeoutRef.current);
			}
		};
	}, []);

	// Note: We don't use the onChange prop from MonacoEditor
	// Instead, we use onDidChangeModelContent in handleEditorDidMount
	// to prevent infinite loops

	const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
		editorRef.current = editor;
		lastHtmlRef.current = html;
		lastSentHtmlRef.current = html;

		// Configure HTML language features
		monaco.languages.html.htmlDefaults.setOptions({
			format: {
				indentInnerHtml: true,
				wrapLineLength: 120,
				wrapAttributes: "auto",
				tabSize: 2,
				insertSpaces: true,
				unformatted: "",
				contentUnformatted: "pre,code,textarea",
				indentHandlebars: false,
				endWithNewline: false,
				extraLiners: "head, body, /html",
				preserveNewLines: true,
				maxPreserveNewLines: 2,
			},
		});

		// Add custom HTML snippets for email templates
		monaco.languages.registerCompletionItemProvider("html", {
			provideCompletionItems: (model, position) => {
				const word = model.getWordUntilPosition(position);
				const range = {
					startLineNumber: position.lineNumber,
					endLineNumber: position.lineNumber,
					startColumn: word.startColumn,
					endColumn: word.endColumn,
				};
				return {
					suggestions: [
						{
							label: "email-container",
							kind: monaco.languages.CompletionItemKind.Snippet,
							insertText: '<div class="email-container">\n\t$0\n</div>',
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							documentation: "Email container wrapper",
							range: range,
						},
						{
							label: "email-header",
							kind: monaco.languages.CompletionItemKind.Snippet,
							insertText: '<div class="email-header">\n\t$0\n</div>',
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							documentation: "Email header section",
							range: range,
						},
						{
							label: "email-body",
							kind: monaco.languages.CompletionItemKind.Snippet,
							insertText: '<div class="email-body">\n\t$0\n</div>',
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							documentation: "Email body section",
							range: range,
						},
						{
							label: "email-footer",
							kind: monaco.languages.CompletionItemKind.Snippet,
							insertText: '<div class="email-footer">\n\t$0\n</div>',
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							documentation: "Email footer section",
							range: range,
						},
					],
				};
			},
		});

		// Listen to content changes (only from user input, not programmatic updates)
		// Clean up previous listener if it exists
		if (changeDisposableRef.current) {
			changeDisposableRef.current.dispose();
		}

		const changeDisposable = editor.onDidChangeModelContent(() => {
			// Skip if this is an internal update (from setValue)
			if (isInternalUpdateRef.current) {
				return;
			}

			const newValue = editor.getValue();
			// Only call onChange if the value actually changed from what we last sent
			if (newValue !== lastSentHtmlRef.current) {
				// Update ref immediately to prevent duplicate calls
				lastHtmlRef.current = newValue;
				
				// Clear any pending timeout
				if (onChangeTimeoutRef.current) {
					clearTimeout(onChangeTimeoutRef.current);
					onChangeTimeoutRef.current = null;
				}
				
				// Debounce onChange to prevent rapid-fire updates and break the update cycle
				onChangeTimeoutRef.current = setTimeout(() => {
					// Double-check the value hasn't changed since we queued this
					const currentEditorValue = editor.getValue();
					if (currentEditorValue !== lastSentHtmlRef.current) {
						lastSentHtmlRef.current = currentEditorValue;
						onChange(currentEditorValue);
					}
					onChangeTimeoutRef.current = null;
				}, 500); // Longer debounce to break the cycle
			}
		});

		changeDisposableRef.current = changeDisposable;

		// Handle blur
		if (onBlur) {
			editor.onDidBlurEditorText(() => {
				// Clear any pending timeout and call onChange immediately on blur
				if (onChangeTimeoutRef.current) {
					clearTimeout(onChangeTimeoutRef.current);
					onChangeTimeoutRef.current = null;
				}
				const currentValue = editor.getValue();
				if (currentValue !== lastSentHtmlRef.current) {
					lastHtmlRef.current = currentValue;
					lastSentHtmlRef.current = currentValue;
					onChange(currentValue);
				}
				onBlur();
			});
		}
	};

	return (
		<div className="h-full w-full border rounded-lg overflow-hidden">
			<MonacoEditor
				height="100%"
				language="html"
				theme={editorTheme === "dark" ? "financely-dark" : "financely-light"}
				value={html}
				onMount={handleEditorDidMount}
				options={{
					fontSize: 14,
					lineNumbers: "on",
					roundedSelection: false,
					scrollBeyondLastLine: false,
					readOnly: false,
					automaticLayout: true,
					minimap: { enabled: true },
					wordWrap: "on",
					formatOnPaste: true,
					formatOnType: true,
					tabSize: 2,
					insertSpaces: true,
					detectIndentation: false,
					folding: true,
					bracketPairColorization: { enabled: true },
					suggest: {
						showKeywords: true,
						showSnippets: true,
					},
				}}
			/>
		</div>
	);
}

