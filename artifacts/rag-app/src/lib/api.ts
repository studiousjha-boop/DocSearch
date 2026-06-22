import { useListDocuments, useGetDocument, useDeleteDocument, useQueryDocuments, useGetStats, getListDocumentsQueryKey, getGetDocumentQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export async function uploadDocumentFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/documents', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error('Upload failed');
  }
  return res.json();
}
