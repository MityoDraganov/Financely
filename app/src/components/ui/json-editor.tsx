import React, { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, ChevronRight } from "lucide-react";

interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

interface JsonValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

interface CompletionSuggestion {
  label: string;
  value: string;
  description?: string;
  type: 'keyword' | 'template' | 'variable';
}

interface CompletionContext {
  suggestions: CompletionSuggestion[];
  position: { top: number; left: number };
  selectedIndex: number;
}

export function JsonEditor({
  label,
  value,
  onChange,
  placeholder = "{}",
  rows = 4,
  className = "",
}: JsonEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [validation, setValidation] = useState<JsonValidationResult>({ isValid: true });
  const [completion, setCompletion] = useState<CompletionContext | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate JSON in real-time
  useEffect(() => {
    const validationResult = validateJson(localValue);
    setValidation(validationResult);
  }, [localValue]);

  // Close completion on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (completionRef.current && !completionRef.current.contains(event.target as Node)) {
        setCompletion(null);
      }
    };

    if (completion) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [completion]);

  // Common JSON templates and suggestions
  const getJsonTemplates = (): CompletionSuggestion[] => [
    // HTTP Headers templates
    { label: "Content-Type JSON", value: '"Content-Type": "application/json"', type: 'template', description: 'JSON content type header' },
    { label: "Authorization Bearer", value: '"Authorization": "Bearer {token}"', type: 'template', description: 'Bearer token authorization' },
    { label: "Authorization Basic", value: '"Authorization": "Basic {credentials}"', type: 'template', description: 'Basic auth authorization' },
    { label: "User-Agent", value: '"User-Agent": "Financely/1.0"', type: 'template', description: 'User agent header' },
    { label: "Accept JSON", value: '"Accept": "application/json"', type: 'template', description: 'Accept JSON response' },
    
    // HTTP Body templates
    { label: "User Object", value: '{\n  "name": "{user.name}",\n  "email": "{user.email}",\n  "id": "{user.id}"\n}', type: 'template', description: 'User object template' },
    { label: "Invoice Object", value: '{\n  "number": "{invoice.number}",\n  "amount": "{invoice.amount}",\n  "status": "{invoice.status}"\n}', type: 'template', description: 'Invoice object template' },
    { label: "Customer Object", value: '{\n  "name": "{customer.name}",\n  "email": "{customer.email}",\n  "phone": "{customer.phone}"\n}', type: 'template', description: 'Customer object template' },
    { label: "Webhook Payload", value: '{\n  "event": "{event.type}",\n  "data": {\n    "id": "{event.id}",\n    "timestamp": "{event.timestamp}"\n  }\n}', type: 'template', description: 'Webhook payload template' },
    
    // Common variables
    { label: "Invoice Number", value: '"{invoice.number}"', type: 'variable', description: 'Invoice number variable' },
    { label: "Invoice Amount", value: '"{invoice.amount}"', type: 'variable', description: 'Invoice amount variable' },
    { label: "Customer Email", value: '"{customer.email}"', type: 'variable', description: 'Customer email variable' },
    { label: "User ID", value: '"{user.id}"', type: 'variable', description: 'User ID variable' },
    { label: "Organization ID", value: '"{org.id}"', type: 'variable', description: 'Organization ID variable' },
    { label: "Current Timestamp", value: '"{timestamp}"', type: 'variable', description: 'Current timestamp variable' },
    
    // JSON keywords
    { label: "true", value: 'true', type: 'keyword', description: 'Boolean true' },
    { label: "false", value: 'false', type: 'keyword', description: 'Boolean false' },
    { label: "null", value: 'null', type: 'keyword', description: 'Null value' },
    { label: "Empty Object", value: '{}', type: 'template', description: 'Empty JSON object' },
    { label: "Empty Array", value: '[]', type: 'template', description: 'Empty JSON array' },
  ];

  // Get suggestions based on context
  const getSuggestions = (text: string, cursorPos: number): CompletionSuggestion[] => {
    const beforeCursor = text.slice(0, cursorPos);
    
    // Check if we're inside quotes (string value)
    const quoteCount = (beforeCursor.match(/"/g) || []).length;
    const isInsideQuotes = quoteCount % 2 === 1;
    
    // Check if we're after a colon (object value)
    const lastColon = beforeCursor.lastIndexOf(':');
    const isAfterColon = lastColon > beforeCursor.lastIndexOf('"') && lastColon > beforeCursor.lastIndexOf('{');
    
    // Check if we're at the start of a key (object key)
    const lastBrace = beforeCursor.lastIndexOf('{');
    const isObjectKey = lastBrace > beforeCursor.lastIndexOf('"') && !isInsideQuotes;
    
    const allTemplates = getJsonTemplates();
    
    if (isInsideQuotes) {
      // Inside quotes - suggest variables and common values
      return allTemplates.filter(t => t.type === 'variable' || t.type === 'keyword');
    } else if (isAfterColon) {
      // After colon - suggest values
      return allTemplates.filter(t => t.type === 'template' || t.type === 'keyword');
    } else if (isObjectKey) {
      // Object key - suggest common keys
      return [
        { label: "id", value: '"id"', type: 'keyword', description: 'ID field' },
        { label: "name", value: '"name"', type: 'keyword', description: 'Name field' },
        { label: "email", value: '"email"', type: 'keyword', description: 'Email field' },
        { label: "status", value: '"status"', type: 'keyword', description: 'Status field' },
        { label: "amount", value: '"amount"', type: 'keyword', description: 'Amount field' },
        { label: "type", value: '"type"', type: 'keyword', description: 'Type field' },
        { label: "data", value: '"data"', type: 'keyword', description: 'Data field' },
        { label: "message", value: '"message"', type: 'keyword', description: 'Message field' },
        { label: "timestamp", value: '"timestamp"', type: 'keyword', description: 'Timestamp field' },
      ];
    } else {
      // General context - suggest all templates
      return allTemplates;
    }
  };

  const validateJson = (jsonString: string): JsonValidationResult => {
    if (!jsonString.trim()) {
      return { isValid: true };
    }

    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      return { isValid: true, formatted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid JSON";
      return { isValid: false, error: errorMessage };
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setLocalValue(newValue);
    
    // Auto-format on certain triggers
    const autoFormatted = handleAutoFormatting(newValue, cursorPos);
    if (autoFormatted !== newValue) {
      setLocalValue(autoFormatted);
      onChange(autoFormatted);
    } else {
      onChange(newValue);
    }
    
    // Trigger completion suggestions
    triggerCompletion(newValue, cursorPos);
  };

  const triggerCompletion = (text: string, cursorPos: number) => {
    const suggestions = getSuggestions(text, cursorPos);
    
    if (suggestions.length > 0) {
      const textarea = textareaRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        const position = {
          top: rect.top + 20, // Position below the textarea
          left: rect.left + 10,
        };
        
        setCompletion({
          suggestions,
          position,
          selectedIndex: 0,
        });
      }
    } else {
      setCompletion(null);
    }
  };

  const insertSuggestion = (suggestion: CompletionSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const beforeCursor = localValue.slice(0, start);
    const afterCursor = localValue.slice(end);
    
    // Insert the suggestion value
    const newValue = beforeCursor + suggestion.value + afterCursor;
    setLocalValue(newValue);
    onChange(newValue);
    
    // Hide completion
    setCompletion(null);
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + suggestion.value.length;
      textarea.focus();
    }, 0);
  };

  const handleAutoFormatting = (text: string, cursorPos: number): string => {
    // Auto-close brackets and quotes
    const lastChar = text[cursorPos - 1];
    const nextChar = text[cursorPos];
    
    // Auto-close brackets
    if (lastChar === '{' && nextChar !== '}') {
      return text.slice(0, cursorPos) + '}' + text.slice(cursorPos);
    }
    
    if (lastChar === '[' && nextChar !== ']') {
      return text.slice(0, cursorPos) + ']' + text.slice(cursorPos);
    }
    
    // Auto-close quotes
    if (lastChar === '"' && nextChar !== '"') {
      return text.slice(0, cursorPos) + '"' + text.slice(cursorPos);
    }
    
    return text;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const newValue = value.slice(0, start) + '  ' + value.slice(end);
      setLocalValue(newValue);
      onChange(newValue);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Handle Enter key for proper JSON formatting
    if (e.key === 'Enter') {
      const lines = value.slice(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      const indent = currentLine.match(/^(\s*)/)?.[1] || '';
      
      // Add proper indentation for JSON
      if (currentLine.includes('{') || currentLine.includes('[')) {
        e.preventDefault();
        const newIndent = indent + '  ';
        const newValue = value.slice(0, start) + '\n' + newIndent + value.slice(end);
        setLocalValue(newValue);
        onChange(newValue);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + newIndent.length + 1;
        }, 0);
      }
    }

    // Handle auto-completion for common JSON patterns
    if (e.key === ':') {
      const beforeCursor = value.slice(0, start);
      const afterCursor = value.slice(end);
      
      // Auto-add space after colon
      if (!afterCursor.startsWith(' ')) {
        e.preventDefault();
        const newValue = beforeCursor + ': ' + afterCursor;
        setLocalValue(newValue);
        onChange(newValue);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    // Handle auto-completion for quotes
    if (e.key === '"') {
      const beforeCursor = value.slice(0, start);
      const afterCursor = value.slice(end);
      
      // If we're inside quotes, don't auto-close
      const quoteCount = (beforeCursor.match(/"/g) || []).length;
      if (quoteCount % 2 === 0) {
        // We're outside quotes, auto-close
        e.preventDefault();
        const newValue = beforeCursor + '""' + afterCursor;
        setLocalValue(newValue);
        onChange(newValue);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }, 0);
      }
    }

    // Handle completion navigation
    if (completion) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCompletion({
          ...completion,
          selectedIndex: Math.min(completion.selectedIndex + 1, completion.suggestions.length - 1),
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCompletion({
          ...completion,
          selectedIndex: Math.max(completion.selectedIndex - 1, 0),
        });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(completion.suggestions[completion.selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCompletion(null);
      }
    }
  };

  const formatJson = () => {
    if (validation.isValid && validation.formatted) {
      setLocalValue(validation.formatted);
      onChange(validation.formatted);
    }
  };

  const getValidationIcon = () => {
    if (!localValue.trim()) {
      return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
    
    if (validation.isValid) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getValidationBadge = () => {
    if (!localValue.trim()) {
      return <Badge variant="secondary" className="text-xs">Empty</Badge>;
    }
    
    if (validation.isValid) {
      return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Valid JSON</Badge>;
    } else {
      return <Badge variant="destructive" className="text-xs">Invalid JSON</Badge>;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          {getValidationIcon()}
          {getValidationBadge()}
          {validation.isValid && validation.formatted && localValue !== validation.formatted && (
            <button
              type="button"
              onClick={formatJson}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Format
            </button>
          )}
        </div>
      </div>
      
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={`font-mono text-sm ${
            validation.isValid || !localValue.trim()
              ? 'border-gray-300 focus:border-blue-500'
              : 'border-red-300 focus:border-red-500'
          }`}
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            lineHeight: '1.5',
          }}
        />
        
        {!validation.isValid && validation.error && (
          <div className="absolute -bottom-6 left-0 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            {validation.error}
          </div>
        )}
      </div>
      
      {validation.isValid && localValue.trim() && (
        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
          ✓ JSON is valid and ready to use
        </div>
      )}
      
      {/* Completion Dropdown */}
      {completion && (
        <div
          ref={completionRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          style={{
            top: completion.position.top,
            left: completion.position.left,
            minWidth: '300px',
          }}
        >
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="text-xs font-medium text-gray-600">
              Suggestions ({completion.suggestions.length})
            </div>
            <div className="text-xs text-gray-500">
              Use ↑↓ to navigate, Enter/Tab to select, Esc to close
            </div>
          </div>
          
          {completion.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                index === completion.selectedIndex
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => insertSuggestion(suggestion)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    suggestion.type === 'template' ? 'bg-green-500' :
                    suggestion.type === 'variable' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`} />
                  <span className="font-medium text-sm">{suggestion.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              
              {suggestion.description && (
                <div className="text-xs text-gray-500 mt-1 ml-4">
                  {suggestion.description}
                </div>
              )}
              
              <div className="text-xs font-mono text-gray-600 mt-1 ml-4 bg-gray-100 px-2 py-1 rounded">
                {suggestion.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
