import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { FileText, Folder, FolderOpen, Plus, Trash2, Save, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import MonacoEditor from "@monaco-editor/react";
import * as monaco from "monaco-editor";


interface FileNode {
  name: string;
  path: string;
  content: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileEditorProps {
  files: Record<string, string>; // path -> content
  onSave: (files: Record<string, string>) => Promise<void>;
  onDeploy: (files: Record<string, string>) => Promise<void>;
  organizationId: string;
  projectId: string;
}

export function FileEditor({ files: initialFiles, onSave, onDeploy}: FileEditorProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Configure Monaco theme on mount
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
  }, []);

  // Build file tree from flat file structure
  useEffect(() => {
    const buildTree = (): FileNode[] => {
      const tree: FileNode[] = [];
      const pathMap = new Map<string, FileNode>();

      // Create nodes for all files
      Object.keys(files).forEach((path) => {
        const parts = path.split("/");
        let currentPath = "";
        
        parts.forEach((part, index) => {
          const isFile = index === parts.length - 1;
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!pathMap.has(currentPath)) {
            const node: FileNode = {
              name: part,
              path: currentPath,
              content: isFile ? files[path] : "",
              type: isFile ? "file" : "folder",
              children: [],
            };
            
            pathMap.set(currentPath, node);
            
            if (parentPath) {
              const parent = pathMap.get(parentPath);
              if (parent) {
                parent.children = parent.children || [];
                parent.children.push(node);
              }
            } else {
              tree.push(node);
            }
          }
        });
      });

      // Sort tree
      const sortTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }).map(node => ({
          ...node,
          children: node.children ? sortTree(node.children) : undefined,
        }));
      };

      return sortTree(tree);
    };

    setFileTree(buildTree());
  }, [files]);

  // Update editor content when file is selected
  useEffect(() => {
    if (selectedFile && files[selectedFile]) {
      setEditorContent(files[selectedFile]);
    }
  }, [selectedFile, files]);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleContentChange = (value: string | undefined) => {
    setEditorContent(value || "");
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setIsSaving(true);
    try {
      const updatedFiles = {
        ...files,
        [selectedFile]: editorContent,
      };
      setFiles(updatedFiles);
      await onSave(updatedFiles);
      toast.success(t("siteBuilder.fileEditor.toasts.fileSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("siteBuilder.fileEditor.toasts.fileSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      // Save current file if editing
      if (selectedFile && editorContent !== files[selectedFile]) {
        const updatedFiles = {
          ...files,
          [selectedFile]: editorContent,
        };
        setFiles(updatedFiles);
        await onDeploy(updatedFiles);
      } else {
        await onDeploy(files);
      }
      toast.success(t("siteBuilder.fileEditor.toasts.siteDeployed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("siteBuilder.fileEditor.toasts.siteDeployFailed"));
    } finally {
      setIsDeploying(false);
    }
  };

  const handleNewFile = () => {
    if (!newFileName.trim()) return;

    const path = newFileName.startsWith("/") ? newFileName.substring(1) : newFileName;
    const updatedFiles = {
      ...files,
      [path]: "",
    };
    setFiles(updatedFiles);
    setSelectedFile(path);
    setEditorContent("");
    setIsNewFileDialogOpen(false);
    setNewFileName("");
    toast.success(t("siteBuilder.fileEditor.toasts.fileCreated"));
  };

  const handleDeleteFile = (path: string) => {
    if (!confirm(t("siteBuilder.fileEditor.deleteConfirm", { path }))) return;

    const updatedFiles = { ...files };
    delete updatedFiles[path];
    setFiles(updatedFiles);
    
    if (selectedFile === path) {
      setSelectedFile(null);
      setEditorContent("");
    }
    
    toast.success(t("siteBuilder.fileEditor.toasts.fileDeleted"));
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], level = 0): ReactElement[] => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === "folder") {
        return (
          <div key={node.path}>
            <div
              className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )}
              <span className="text-sm">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={node.path}
          className={`flex items-center justify-between gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
            isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFileSelect(node.path)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-gray-500 shrink-0" />
            <span className="text-sm truncate">{node.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFile(node.path);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      );
    });
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      html: "html",
      css: "css",
      js: "javascript",
      json: "json",
      ts: "typescript",
      tsx: "typescript",
      jsx: "javascript",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
    };
    return languageMap[ext || ""] || "plaintext";
  };

  return (
    <div className="flex h-[calc(100vh-200px)] border rounded-lg overflow-hidden">
      {/* File Tree Sidebar */}
      <div className="w-64 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="p-2 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">{t("siteBuilder.fileEditor.files")}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsNewFileDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {fileTree.length > 0 ? (
            renderFileTree(fileTree)
          ) : (
            <div className="p-4 text-sm text-gray-500 text-center">
              {t("siteBuilder.fileEditor.emptyState.noFiles")}
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="border-b p-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <span className="text-sm font-medium">{selectedFile}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || editorContent === files[selectedFile]}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? t("siteBuilder.fileEditor.saving") : t("siteBuilder.fileEditor.save")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isDeploying ? t("siteBuilder.fileEditor.deploying") : t("siteBuilder.fileEditor.deploy")}
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language={getLanguageFromPath(selectedFile)}
                value={editorContent}
                onChange={handleContentChange}
                theme="financely-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("siteBuilder.fileEditor.emptyState.selectFile")}</p>
            </div>
          </div>
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("siteBuilder.fileEditor.newFileDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("siteBuilder.fileEditor.newFileDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder={t("siteBuilder.fileEditor.newFileDialog.placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleNewFile();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFileDialogOpen(false)}>
              {t("siteBuilder.fileEditor.newFileDialog.cancel")}
            </Button>
            <Button onClick={handleNewFile} disabled={!newFileName.trim()}>
              {t("siteBuilder.fileEditor.newFileDialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
