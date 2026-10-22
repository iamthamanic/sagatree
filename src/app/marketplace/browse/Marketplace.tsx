/**
 * Marketplace — Vertical slice: browse/download marketplace templates.
 * Location: src/app/marketplace/browse/Marketplace.tsx
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Badge } from '../../../shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import {
  MagnifyingGlass,
  DownloadSimple,
  Star,
  TrendUp,
  CircleNotch,
  Package,
  Plus
} from '@phosphor-icons/react';
import { useMarketplace } from './useMarketplace';
import type { MarketplaceItemType } from '../../../domains/marketplace/contracts/marketplace.types';
import { toast } from 'sonner';
import {
  marketplacePaidActionEnabled,
  marketplacePaidCtaLabelDe,
} from '../../../domains/session/contracts/production-ux-integrity';

export function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MarketplaceItemType | 'all'>('all');
  
  const { items, featuredItems, isLoading, error, downloadItem } = useMarketplace({
    searchQuery,
    type: filterType,
    sortBy: 'downloads',
    sortOrder: 'desc',
  });

  const handleDownload = async (itemId: string, title: string, price: number) => {
    if (!marketplacePaidActionEnabled(price)) {
      return;
    }

    try {
      await downloadItem(itemId);
      toast.success(`"${title}" heruntergeladen!`);
    } catch {
      toast.error('Download fehlgeschlagen');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <CircleNotch className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Lade Marketplace...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Fehler beim Laden</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>
                Erneut versuchen
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!isLoading && items.length === 0 && !searchQuery && filterType === 'all') {
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <Card className="border-dashed">
            <CardHeader className="text-center py-12">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle>Marketplace ist leer</CardTitle>
              <CardDescription className="mt-2 max-w-md mx-auto">
                Der Marketplace enthält noch keine Inhalte. Erstelle das erste Item oder warte auf Community-Beiträge!
              </CardDescription>
              <div className="mt-6">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Erstes Item erstellen
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl">Marktplatz</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Community-Inhalte entdecken und teilen
          </p>
        </div>

        {/* MagnifyingGlass and Filters */}
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Welten, Abenteuern, Charakteren..."
                  className="pl-10 text-sm md:text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={(v) => setFilterType(v as MarketplaceItemType | 'all')}>
                  <SelectTrigger className="flex-1 md:w-48 text-sm md:text-base">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="world">Welten</SelectItem>
                    <SelectItem value="adventure">Abenteuer</SelectItem>
                    <SelectItem value="character">Charaktere</SelectItem>
                    <SelectItem value="item">Items</SelectItem>
                    <SelectItem value="ruleset">Regelsets</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="md:w-auto"
                >
                  <TrendUp className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Trending</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Items */}
        {featuredItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Featured</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Top Community-Picks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {featuredItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="border border-border rounded-lg p-3 md:p-4">
                    {item.image_url ? (
                      <div className="aspect-video bg-muted rounded-lg mb-3 md:mb-4 overflow-hidden">
                        <img 
                          src={item.image_url} 
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted rounded-lg mb-3 md:mb-4 flex items-center justify-center">
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm md:text-base truncate">{item.title}</h4>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            von {item.author_name || 'Unbekannt'}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        {item.description || 'Keine Beschreibung'}
                      </p>
                      <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
                          {item.rating.toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <DownloadSimple className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">{item.downloads.toLocaleString()}</span>
                          <span className="sm:hidden">{(item.downloads / 1000).toFixed(1)}k</span>
                        </span>
                        <span className="font-medium">
                          {item.price === 0 ? 'Kostenlos' : `€${item.price.toFixed(2)}`}
                        </span>
                      </div>
                      <Button 
                        className="w-full" 
                        size="sm"
                        disabled={!marketplacePaidActionEnabled(item.price)}
                        title={
                          marketplacePaidActionEnabled(item.price)
                            ? undefined
                            : 'Bezahlter Kauf ist noch nicht verfügbar'
                        }
                        data-marketplace-cta={item.price > 0 ? 'paid-deferred' : 'free'}
                        onClick={() => handleDownload(item.id, item.title, item.price)}
                      >
                        {marketplacePaidCtaLabelDe(item.price)}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">
              {searchQuery || filterType !== 'all' ? 'Suchergebnisse' : 'Alle Inhalte'}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {items.length} {items.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Keine Ergebnisse gefunden</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                >
                  Filter zurücksetzen
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="grid">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <TabsList className="h-9">
                    <TabsTrigger value="grid" className="text-xs md:text-sm">Grid</TabsTrigger>
                    <TabsTrigger value="list" className="text-xs md:text-sm">Liste</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="grid">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {items.map((item) => (
                      <div 
                        key={item.id} 
                        className="border border-border rounded-lg p-2 md:p-3 hover:border-primary transition-colors"
                      >
                        {item.image_url ? (
                          <div className="aspect-video bg-muted rounded-lg mb-2 overflow-hidden">
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-muted rounded-lg mb-2 flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="space-y-1 md:space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs md:text-sm font-medium line-clamp-1 flex-1">
                              {item.title}
                            </h4>
                            <Badge variant="outline" className="text-[10px] md:text-xs flex-shrink-0">
                              {item.type}
                            </Badge>
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                            {item.description || 'Keine Beschreibung'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] md:text-xs">
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {item.rating.toFixed(1)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <DownloadSimple className="w-3 h-3" />
                              <span className="hidden md:inline">{item.downloads}</span>
                              <span className="md:hidden">{(item.downloads / 1000).toFixed(1)}k</span>
                            </span>
                          </div>
                          <p className="text-xs md:text-sm font-medium">
                            {item.price === 0 ? 'Kostenlos' : `€${item.price.toFixed(2)}`}
                          </p>
                          <Button 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => handleDownload(item.id, item.title, item.price)}
                          >
                            <DownloadSimple className="w-3 h-3 mr-1" />
                            <span className="hidden md:inline">Laden</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="list">
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-3 md:p-4 border border-border rounded-lg hover:border-primary transition-colors"
                      >
                        {item.image_url ? (
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-sm md:text-base">{item.title}</h4>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                von {item.author_name || 'Unbekannt'}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">{item.type}</Badge>
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-1">
                            {item.description || 'Keine Beschreibung'}
                          </p>
                          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
                              {item.rating.toFixed(1)}
                            </span>
                            <span className="flex items-center gap-1">
                              <DownloadSimple className="w-3 h-3 md:w-4 md:h-4" />
                              {item.downloads.toLocaleString()}
                            </span>
                            <span className="font-medium">
                              {item.price === 0 ? 'Kostenlos' : `€${item.price.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={!marketplacePaidActionEnabled(item.price)}
                          title={
                            marketplacePaidActionEnabled(item.price)
                              ? undefined
                              : 'Bezahlter Kauf ist noch nicht verfügbar'
                          }
                          data-marketplace-cta={item.price > 0 ? 'paid-deferred' : 'free'}
                          onClick={() => handleDownload(item.id, item.title, item.price)}
                        >
                          {marketplacePaidCtaLabelDe(item.price)}
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
