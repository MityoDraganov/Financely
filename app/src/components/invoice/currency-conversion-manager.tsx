/**
 * Currency Conversion Manager Component
 * Manages conversion rates for multi-currency invoices
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  getConversionRate, 
  formatConversionRate, 
  type ConversionRate 
} from "@/services/currency-conversion-service";
import { getCurrency } from "@/utils/currencies";
import { Loader2, RefreshCw, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";

interface CurrencyConversionManagerProps {
  baseCurrency: string;
  items: Array<{ currency?: string; [key: string]: unknown }>;
  existingRates?: ConversionRate[];
  onRatesChange: (rates: ConversionRate[]) => void;
}

export function CurrencyConversionManager({
  baseCurrency,
  items,
  existingRates = [],
  onRatesChange,
}: CurrencyConversionManagerProps) {
  const [rates, setRates] = useState<ConversionRate[]>(existingRates);
  const [loadingRates, setLoadingRates] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(
    new Set(existingRates.filter(r => r.manualOverride).map(r => `${r.fromCurrency}-${r.toCurrency}`))
  );

  // Find all unique currency pairs needed
  const currencyPairs = useMemo(() => {
    const pairs = new Map<string, { from: string; to: string }>();
    
    for (const item of items) {
      const itemCurrency = item.currency || baseCurrency;
      if (itemCurrency !== baseCurrency) {
        const pairKey = `${itemCurrency}-${baseCurrency}`;
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, { from: itemCurrency, to: baseCurrency });
        }
      }
    }
    
    return Array.from(pairs.values());
  }, [items, baseCurrency]);

  // Auto-fetch rates when currency pairs change
  useEffect(() => {
    const fetchRates = async () => {
      const newRates: ConversionRate[] = [...rates];
      const toFetch: Array<{ from: string; to: string }> = [];
      
      for (const pair of currencyPairs) {
        const existing = rates.find(r => 
          r.fromCurrency === pair.from && 
          r.toCurrency === pair.to &&
          !r.manualOverride
        );
        
        if (!existing) {
          toFetch.push(pair);
        }
      }
      
      if (toFetch.length === 0) return;
      
      setLoadingRates(new Set(toFetch.map(p => `${p.from}-${p.to}`)));
      
      try {
        for (const pair of toFetch) {
          const rate = await getConversionRate(pair.from, pair.to, rates);
          const existingIndex = newRates.findIndex(
            r => r.fromCurrency === pair.from && r.toCurrency === pair.to
          );
          
          if (existingIndex >= 0) {
            newRates[existingIndex] = rate;
          } else {
            newRates.push(rate);
          }
        }
        
        setRates(newRates);
        onRatesChange(newRates);
        toast.success("Exchange rates updated");
      } catch (error) {
        toast.error(`Failed to fetch some exchange rates: ${error}`);
      } finally {
        setLoadingRates(new Set());
      }
    };
    
    if (currencyPairs.length > 0) {
      fetchRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyPairs.length]); // Only re-fetch when pairs change, not on every render

  // Update parent when rates change
  useEffect(() => {
    onRatesChange(rates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates]); // Only update when rates change, not onRatesChange

  const handleRefreshRate = async (fromCurrency: string, toCurrency: string) => {
    const pairKey = `${fromCurrency}-${toCurrency}`;
    setLoadingRates(prev => new Set(prev).add(pairKey));
    
    try {
      const rate = await getConversionRate(fromCurrency, toCurrency, []);
      setRates(prev => {
        const filtered = prev.filter(
          r => !(r.fromCurrency === fromCurrency && r.toCurrency === toCurrency)
        );
        return [...filtered, rate];
      });
      toast.success("Rate refreshed");
    } catch (error) {
      toast.error(`Failed to refresh rate: ${error}`);
    } finally {
      setLoadingRates(prev => {
        const next = new Set(prev);
        next.delete(pairKey);
        return next;
      });
    }
  };

  const handleManualOverride = (fromCurrency: string, toCurrency: string, enabled: boolean) => {
    const pairKey = `${fromCurrency}-${toCurrency}`;
    setManualOverrides(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(pairKey);
      } else {
        next.delete(pairKey);
      }
      return next;
    });
    
    setRates(prev => {
      const filtered = prev.filter(
        r => !(r.fromCurrency === fromCurrency && r.toCurrency === toCurrency)
      );
      
      if (enabled) {
        // Get existing rate or default to 1
        const existing = prev.find(
          r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
        );
        filtered.push({
          fromCurrency,
          toCurrency,
          rate: existing?.rate || 1,
          source: "manual",
          date: new Date().toISOString(),
          manualOverride: true,
        });
      } else {
        // Remove manual override, will be re-fetched on next update
        // For now, keep the rate but mark as API
        const existing = prev.find(
          r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
        );
        if (existing) {
          filtered.push({
            ...existing,
            manualOverride: false,
            source: "api",
          });
        }
      }
      
      return filtered;
    });
  };

  const handleRateChange = (fromCurrency: string, toCurrency: string, newRate: number) => {
    setRates(prev => {
      const filtered = prev.filter(
        r => !(r.fromCurrency === fromCurrency && r.toCurrency === toCurrency)
      );
      const existing = prev.find(
        r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
      );
      
      filtered.push({
        fromCurrency,
        toCurrency,
        rate: newRate,
        source: "manual",
        date: existing?.date || new Date().toISOString(),
        manualOverride: true,
      });
      
      return filtered;
    });
  };

  if (currencyPairs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Currency Conversion
        </CardTitle>
        <CardDescription>
          Manage exchange rates for items in different currencies. Rates are automatically fetched from live APIs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Base currency: <strong>{baseCurrency}</strong>. Items will be converted to this currency for totals.
          </AlertDescription>
        </Alert>
        
        {currencyPairs.map((pair) => {
          const pairKey = `${pair.from}-${pair.to}`;
          const rate = rates.find(
            r => r.fromCurrency === pair.from && r.toCurrency === pair.to
          );
          const isLoading = loadingRates.has(pairKey);
          const isManual = manualOverrides.has(pairKey);
          const fromCurrencyInfo = getCurrency(pair.from);
          const toCurrencyInfo = getCurrency(pair.to);
          
          return (
            <div key={pairKey} className="p-4 border rounded-lg space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {pair.from} → {pair.to}
                  </Badge>
                  {isManual && (
                    <Badge variant="secondary" className="text-xs">
                      Manual
                    </Badge>
                  )}
                  {!isManual && rate && (
                    <Badge variant="outline" className="text-xs">
                      Live
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isManual}
                    onCheckedChange={(checked) => handleManualOverride(pair.from, pair.to, checked)}
                  />
                  <Label className="text-xs">Manual Override</Label>
                </div>
              </div>
              
              {rate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs flex-1">
                      {formatConversionRate(rate, false)}
                    </Label>
                    {!isManual && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshRate(pair.from, pair.to)}
                        disabled={isLoading}
                        className="h-7 px-2"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {isManual && (
                    <div className="space-y-1">
                      <Label className="text-xs">Manual Rate</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rate.rate}
                        onChange={(e) => {
                          const newRate = Number(e.target.value);
                          if (!isNaN(newRate) && newRate > 0) {
                            handleRateChange(pair.from, pair.to, newRate);
                          }
                        }}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {fromCurrencyInfo?.name || pair.from} to {toCurrencyInfo?.name || pair.to}
                      </p>
                    </div>
                  )}
                  
                  {rate.date && (
                    <p className="text-xs text-muted-foreground">
                      Updated: {new Date(rate.date).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              
              {!rate && isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Fetching rate...</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

