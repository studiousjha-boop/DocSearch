import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/layout";
import { FileUpload } from "@/components/file-upload";
import { useQueryDocuments, useListDocuments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Loader2, Sparkles, BookOpen, Quote, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  const [question, setQuestion] = useState("");
  const { data: documents } = useListDocuments();
  
  const queryMutation = useQueryDocuments();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    queryMutation.mutate({ data: { question, top_k: 5 } });
  };

  const hasReadyDocs = documents?.some((d) => d.status === "ready");

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Q&A Area */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-[calc(100vh-8rem)]">
          <Card className="border shadow-sm flex flex-col flex-1 overflow-hidden">
            <CardHeader className="bg-secondary/30 pb-4 border-b">
              <CardTitle className="font-serif text-2xl">Ask your library</CardTitle>
              <CardDescription>
                Search across all your uploaded documents for answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col relative">
              <ScrollArea className="flex-1 p-6">
                {!queryMutation.data && !queryMutation.isPending && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 py-20">
                    <Search className="h-12 w-12 opacity-20" />
                    <p className="text-sm">Ask a question to see answers grounded in your notes.</p>
                  </div>
                )}

                {queryMutation.isPending && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium animate-pulse">Searching through documents...</p>
                  </div>
                )}

                {queryMutation.data && (
                  <div className="space-y-8 pb-10">
                    <div>
                      <h2 className="text-xl font-bold font-serif mb-4 flex items-center gap-2">
                        {queryMutation.data.has_llm ? (
                          <Sparkles className="h-5 w-5 text-accent" />
                        ) : (
                          <BookOpen className="h-5 w-5 text-primary" />
                        )}
                        Answer
                        <Badge variant="outline" className="ml-2 font-mono text-xs font-normal">
                          {queryMutation.data.processing_time_ms}ms
                        </Badge>
                      </h2>
                      <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-none bg-secondary/20 p-6 rounded-lg border prose-p:leading-relaxed prose-p:my-3 prose-ul:my-3 prose-li:my-1 prose-headings:font-serif prose-strong:font-semibold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {queryMutation.data.answer}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {queryMutation.data.sources.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                          Sources
                        </h3>
                        <div className="grid gap-3">
                          {queryMutation.data.sources.map((source, i) => (
                            <div key={i} className="bg-card border rounded-md p-4 text-sm group hover:border-primary/30 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-primary flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5" />
                                  {source.document_name}
                                </div>
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {Math.round(source.score * 100)}% Match
                                </Badge>
                              </div>
                              <div className="text-muted-foreground relative pl-3 border-l-2 border-muted mt-2 font-serif italic text-[13px] leading-relaxed">
                                {source.chunk_text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              
              <div className="p-4 bg-card border-t shrink-0">
                <form onSubmit={handleSearch} className="relative">
                  <Input
                    placeholder={hasReadyDocs ? "Ask a question about your documents..." : "Upload a document first..."}
                    className="pr-24 py-6 text-base bg-secondary/50 focus-visible:bg-card shadow-sm font-serif"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={!hasReadyDocs || queryMutation.isPending}
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-medium"
                    disabled={!hasReadyDocs || !question.trim() || queryMutation.isPending}
                  >
                    {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <FileUpload />
          
          <Card className="border shadow-sm bg-secondary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.slice(0, 5).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                      <div className="truncate pr-4 flex-1">
                        <p className="text-sm font-medium truncate" title={doc.name}>{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.status}</p>
                      </div>
                      <Badge variant={doc.status === "ready" ? "default" : doc.status === "error" ? "destructive" : "secondary"} className="capitalize text-[10px]">
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No documents yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
