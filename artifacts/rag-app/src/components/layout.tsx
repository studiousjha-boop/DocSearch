import { Link, useLocation } from "wouter";
import { useGetStats } from "@workspace/api-client-react";
import { BookOpen, Library, Search, Layers, Database, Cpu } from "lucide-react";
import { Badge } from "./ui/badge";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: stats } = useGetStats();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-primary">
              <BookOpen className="h-6 w-6" />
              <span className="font-serif text-xl font-medium tracking-tight">DocSearch</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link 
                href="/" 
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  location === "/" 
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <Search className="h-4 w-4" />
                Workspace
              </Link>
              <Link 
                href="/library" 
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  location === "/library" 
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <Library className="h-4 w-4" />
                Library
              </Link>
            </nav>
          </div>

          {stats && (
            <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5" title="Total Documents">
                <Database className="h-3.5 w-3.5" />
                <span>{stats.total_documents} docs</span>
              </div>
              <div className="flex items-center gap-1.5" title="Total Chunks">
                <Layers className="h-3.5 w-3.5" />
                <span>{stats.total_chunks} chunks</span>
              </div>
              <div className="flex items-center gap-1.5 border-l pl-4">
                <Cpu className="h-3.5 w-3.5" />
                <span>{stats.embedding_model}</span>
                {stats.has_llm && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] uppercase font-mono">
                    AI Enabled
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 md:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
