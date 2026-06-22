import { useState, useCallback } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { uploadDocumentFile } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(pdf|docx|txt)$/i)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload PDF, DOCX, or TXT files only.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadDocumentFile(file);
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      toast({
        title: "Document uploaded",
        description: "Your document is now processing.",
      });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files[0]);
      }
    },
    []
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-8 transition-colors flex flex-col items-center justify-center text-center space-y-4 ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted bg-card hover:border-primary/50"
      }`}
    >
      <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>
      <div>
        <h3 className="font-serif text-lg font-medium text-foreground">
          Upload Document
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Drag and drop your study notes here, or click to browse.
          <br />
          Supports PDF, DOCX, and TXT files.
        </p>
      </div>
      <div className="relative">
        <Button variant="outline" disabled={isUploading}>
          Select File
        </Button>
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleUpload(e.target.files[0]);
            }
          }}
          disabled={isUploading}
        />
      </div>
    </div>
  );
}
