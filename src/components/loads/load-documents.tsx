"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Download } from "lucide-react";
import { format } from "date-fns";

interface LoadDocument {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  createdAt: string;
}

interface LoadDocumentsProps {
  loadId: string;
  documents: LoadDocument[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bol: "Bill of Lading",
  rate_confirmation: "Rate Confirmation",
  pod: "Proof of Delivery",
  other: "Other",
};

export function LoadDocuments({ loadId, documents: initialDocs }: LoadDocumentsProps) {
  const [documents, setDocuments] = useState(initialDocs);
  const [docType, setDocType] = useState("bol");
  const [isPending, startTransition] = useTransition();

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("loadId", loadId);
      formData.append("photoType", docType);
      formData.append("file", file);

      try {
        const res = await fetch("/api/verification/photos", {
          method: "POST",
          body: formData,
        });
        const result = await res.json();

        if (result.success) {
          const newDoc: LoadDocument = {
            id: crypto.randomUUID(),
            docType,
            fileName: file.name,
            fileUrl: result.fileUrl ?? "/uploads/" + file.name,
            fileSize: file.size,
            createdAt: new Date().toISOString(),
          };
          setDocuments((prev) => [...prev, newDoc]);
        } else {
          console.error("[UPLOAD] Failed:", result.error);
        }
      } catch (err) {
        console.error("[UPLOAD] Error:", err);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Document Type</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bol">Bill of Lading</SelectItem>
                <SelectItem value="rate_confirmation">Rate Confirmation</SelectItem>
                <SelectItem value="pod">Proof of Delivery</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="doc-upload" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="h-4 w-4" />
                Upload
              </div>
            </label>
            <Input
              id="doc-upload"
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={isPending}
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No documents attached yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                    </Badge>
                    {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>}
                    <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
