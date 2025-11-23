import { useEditor, EditorContent, Extension } from "@tiptap/react";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import "./rich-text-editor.css";

// Custom FontSize extension
const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const fontSize = element.style.fontSize;
              if (!fontSize) return null;
              return fontSize.replace("px", "");
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: any }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: any }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    } as any;
  },
});
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Palette,
  Highlighter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Extra Large", value: "24px" },
  { label: "Huge", value: "32px" },
];

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Orange", value: "#fed7aa" },
];

export function RichTextEditor({
  content,
  onChange,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyle,
      FontSize,
      Color.configure({
        types: ["textStyle"],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[200px] p-4",
          "prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ol:my-2",
          className
        ),
      },
    },
  });

  // Update editor content when prop changes (critical for loading saved content)
  useEffect(() => {
    if (!editor) return;
    
    const currentHtml = editor.getHTML();
    const newContent = content || "";
    
    // Normalize HTML for comparison (remove extra whitespace)
    const normalizeHtml = (html: string) => {
      if (!html || html.trim() === "") return "";
      // Remove extra whitespace between tags but preserve content
      return html.replace(/>\s+</g, '><').trim();
    };
    
    const normalizedContent = normalizeHtml(newContent);
    const normalizedCurrent = normalizeHtml(currentHtml);
    
    // Only update if content actually changed
    // This is important when the dialog opens with existing content
    if (normalizedContent !== normalizedCurrent) {
      // Use setContent with emitUpdate: false to avoid triggering onChange during load
      // The false parameter prevents the onUpdate callback from firing
      editor.commands.setContent(newContent, false);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const currentColor = editor.getAttributes("textStyle").color || "#000000";
  const fontSizeAttr = editor.getAttributes("textStyle").fontSize;
  const currentFontSize = fontSizeAttr ? `${fontSizeAttr}px` : "16px";
  const currentHighlight = editor.getAttributes("highlight").color;

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2 flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(editor.isActive("bold") && "bg-muted")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(editor.isActive("italic") && "bg-muted")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(editor.isActive("underline") && "bg-muted")}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={cn(editor.isActive("strike") && "bg-muted")}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
            >
              <Palette className="h-4 w-4" />
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: currentColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="space-y-2">
              <div className="text-xs font-medium mb-2">Text Color</div>
              <div className="grid grid-cols-5 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(color.value).run();
                    }}
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all",
                      currentColor === color.value && "ring-2 ring-primary"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(editor.isActive("highlight") && "bg-muted")}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="space-y-2">
              <div className="text-xs font-medium mb-2">Highlight Color</div>
              <div className="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                  }}
                  className="w-8 h-8 rounded border-2 flex items-center justify-center text-xs"
                  title="Remove highlight"
                >
                  ×
                </button>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: color.value }).run();
                    }}
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all",
                      currentHighlight === color.value && "ring-2 ring-primary"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Font Size */}
        <Select
          value={currentFontSize}
          onValueChange={(value) => {
            const fontSize = value.replace("px", "");
            (editor.chain().focus() as any).setFontSize(fontSize).run();
          }}
        >
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <Select
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onValueChange={(value) => {
            if (value === "p") {
              editor.chain().focus().setParagraph().run();
            } else {
              const level = parseInt(value.replace("h", "")) as 1 | 2 | 3;
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
        >
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={cn(editor.isActive({ textAlign: "left" }) && "bg-muted")}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={cn(editor.isActive({ textAlign: "center" }) && "bg-muted")}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={cn(editor.isActive({ textAlign: "right" }) && "bg-muted")}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={cn(editor.isActive({ textAlign: "justify" }) && "bg-muted")}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(editor.isActive("bulletList") && "bg-muted")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(editor.isActive("orderedList") && "bg-muted")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(editor.isActive("blockquote") && "bg-muted")}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

