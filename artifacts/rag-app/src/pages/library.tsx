import { Layout } from "@/components/layout";
import { FileUpload } from "@/components/file-upload";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KiB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function Library() {
  const queryClient = useQueryClient();
  
  // Enable polling if any doc is processing
  const { data: documents } = useListDocuments({
    query: {
      queryKey: getListDocumentsQueryKey(),
      refetchInterval: (query) => {
        const docs = query.state.data;
        if (docs && docs.some(d => d.status === "processing")) {
          return 2000;
        }
        return false;
      }
    }
  });

  const deleteMutation = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      }
    }
  });

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">Document Library</h1>
          <p className="text-muted-foreground">Manage your uploaded texts, notes, and research papers.</p>
        </div>

        <FileUpload />

        <Card className="border shadow-sm">
          <CardHeader className="bg-secondary/30 border-b">
            <CardTitle className="text-lg">Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!documents ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <FileText className="h-12 w-12 opacity-20 mb-4" />
                <p>Your library is empty.</p>
                <p className="text-sm mt-1">Upload documents to start asking questions.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="truncate max-w-[200px] md:max-w-[300px]" title={doc.name}>{doc.name}</span>
                        </div>
                        {doc.error_message && (
                          <div className="text-xs text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            {doc.error_message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={doc.status === "ready" ? "default" : doc.status === "error" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {doc.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatBytes(doc.size_bytes)}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {doc.chunk_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(doc.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => deleteMutation.mutate({ id: doc.id })}
                          disabled={deleteMutation.isPending && deleteMutation.variables?.id === doc.id}
                        >
                          {deleteMutation.isPending && deleteMutation.variables?.id === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
