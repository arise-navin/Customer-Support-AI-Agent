import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, Eye, Tag, ArrowRight, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeArticle, setActiveArticle] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kb-articles', search, selectedCategory],
    queryFn: async () => {
      if (search.trim()) {
        const res = await apiRequest<{ count: number; data: any[] }>(
          `/knowledge-base/search?q=${encodeURIComponent(search)}${selectedCategory !== 'ALL' ? `&category=${encodeURIComponent(selectedCategory)}` : ''}`
        );
        return res.data || [];
      } else {
        const url = selectedCategory !== 'ALL'
          ? `/knowledge-base?category=${encodeURIComponent(selectedCategory)}&limit=100`
          : '/knowledge-base?limit=100';
        const res = await apiRequest<{ total: number; data: any[] }>(url);
        return res.data || [];
      }
    }
  });

  const articles = data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" />
          Knowledge Base & Policies
        </h1>
        <p className="text-sm text-muted-foreground">
          {articles.length} verified support articles, warranty terms, and compliance policies.
        </p>
      </div>

      {/* Search and Category Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search articles by keywords, tags, or question..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs overflow-x-auto max-w-full">
          {['ALL', 'Returns & Refunds', 'Shipping & Delivery', 'Order Management', 'Billing & Payments'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-card border border-border animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-5 bg-muted rounded w-48"></div>
              <div className="h-12 bg-muted rounded w-full"></div>
            </div>
          ))
        ) : articles.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl border border-border bg-card">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
            <h3 className="font-bold text-foreground">No articles match your search</h3>
            <p className="text-xs text-muted-foreground mt-1">Try different keywords or clear category filters.</p>
          </div>
        ) : (
          articles.map((art: any) => (
            <div
              key={art.id}
              onClick={() => setActiveArticle(art)}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="font-semibold text-primary">{art.category}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {art.viewCount}
                  </span>
                </div>
                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                  {art.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                  {art.content}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {art.tags?.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Read Policy <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Article Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  {activeArticle.category}
                </span>
                <h3 className="font-bold text-lg text-foreground mt-0.5">{activeArticle.title}</h3>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {activeArticle.content}
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-1">
                  {activeArticle.tags?.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-secondary font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
                <span>Total Views: {activeArticle.viewCount}</span>
              </div>
            </div>

            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end">
              <button
                onClick={() => setActiveArticle(null)}
                className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
