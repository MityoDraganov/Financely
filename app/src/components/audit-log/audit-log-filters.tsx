import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarIcon, ChevronDown, X, Check } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfToday, endOfToday } from "date-fns";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AUDIT_LOG_ACTION_GROUPS, AuditLogActionType } from "@/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DurationPreset = "today" | "3days" | "week" | "month" | "custom";

export interface AuditLogFiltersState {
  duration: DurationPreset;
  customDateRange: { start?: Date; end?: Date };
  memberIds: string[];
  actionTypes: AuditLogActionType[];
}

export interface OrganizationMemberOption {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export const DEFAULT_FILTERS: AuditLogFiltersState = {
  duration: "3days",
  customDateRange: {},
  memberIds: [],
  actionTypes: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDateRangeFromFilters(filters: AuditLogFiltersState): {
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  switch (filters.duration) {
    case "today":
      return {
        startDate: startOfToday().toISOString(),
        endDate: endOfToday().toISOString(),
      };
    case "3days":
      return {
        startDate: startOfDay(subDays(now, 3)).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    case "week":
      return {
        startDate: startOfDay(subDays(now, 7)).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    case "month":
      return {
        startDate: startOfDay(subDays(now, 30)).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    case "custom":
      return {
        startDate: filters.customDateRange.start
          ? startOfDay(filters.customDateRange.start).toISOString()
          : undefined,
        endDate: filters.customDateRange.end
          ? endOfDay(filters.customDateRange.end).toISOString()
          : undefined,
      };
    default:
      return {};
  }
}

function hasActiveFilters(filters: AuditLogFiltersState): boolean {
  return (
    filters.duration !== DEFAULT_FILTERS.duration ||
    filters.memberIds.length > 0 ||
    filters.actionTypes.length > 0
  );
}

// ─── Duration Filter ──────────────────────────────────────────────────────────

interface DurationFilterProps {
  value: DurationPreset;
  customDateRange: { start?: Date; end?: Date };
  onChange: (duration: DurationPreset, customRange?: { start?: Date; end?: Date }) => void;
}

export function DurationFilter({ value, customDateRange, onChange }: DurationFilterProps) {
  const { t } = useTranslation();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    customDateRange.start
      ? { from: customDateRange.start, to: customDateRange.end }
      : undefined
  );

  const durationLabels: Record<DurationPreset, string> = {
    today: t("settings.security.auditLog.filters.duration.today", "Today"),
    "3days": t("settings.security.auditLog.filters.duration.3days", "Last 3 days"),
    week: t("settings.security.auditLog.filters.duration.week", "Last week"),
    month: t("settings.security.auditLog.filters.duration.month", "Last month"),
    custom: t("settings.security.auditLog.filters.duration.custom", "Custom range"),
  };

  const displayLabel =
    value === "custom" && customDateRange.start
      ? `${format(customDateRange.start, "MMM d")}${customDateRange.end ? ` – ${format(customDateRange.end, "MMM d")}` : ""}`
      : durationLabels[value];

  const handlePresetChange = (preset: string) => {
    if (preset !== "custom") {
      onChange(preset as DurationPreset);
      setIsCalendarOpen(false);
    } else {
      onChange("custom", customDateRange);
      setIsCalendarOpen(true);
    }
  };

  const handleRangeSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange);
    if (selectedRange?.from) {
      onChange("custom", { start: selectedRange.from, end: selectedRange.to });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-8 text-xs border-border bg-background min-w-[130px]">
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(durationLabels) as [DurationPreset, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {customDateRange.start
                ? `${format(customDateRange.start, "MMM d")}${customDateRange.end ? ` – ${format(customDateRange.end, "MMM d")}` : ""}`
                : t("settings.security.auditLog.filters.duration.pickDates", "Pick dates")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Member Filter ────────────────────────────────────────────────────────────

interface MemberFilterProps {
  members: OrganizationMemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function MemberFilter({ members, selectedIds, onChange }: MemberFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const toggleMember = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((m) => m !== id)
        : [...selectedIds, id]
    );
  };

  const label =
    selectedIds.length === 0
      ? t("settings.security.auditLog.filters.members.placeholder", "All members")
      : selectedIds.length === 1
      ? members.find((m) => m.id === selectedIds[0])?.name ?? "1 member"
      : t("settings.security.auditLog.filters.members.count", "{{count}} members", {
          count: selectedIds.length,
        });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs gap-1.5 min-w-[130px] justify-between",
            selectedIds.length > 0 && "border-primary/60 bg-primary/5"
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {t("settings.security.auditLog.filters.members.title", "Filter by member")}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t("settings.security.auditLog.filters.members.empty", "No members found")}
            </p>
          ) : (
            members.map((member) => {
              const checked = selectedIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-muted/50 text-left transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMember(member.id)}
                    className="pointer-events-none"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              {t("settings.security.auditLog.filters.members.clear", "Clear selection")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Event Type Filter ────────────────────────────────────────────────────────

interface EventTypeFilterProps {
  selectedActions: AuditLogActionType[];
  onChange: (actions: AuditLogActionType[]) => void;
}

export function EventTypeFilter({ selectedActions, onChange }: EventTypeFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const toggleAction = (action: AuditLogActionType) => {
    onChange(
      selectedActions.includes(action)
        ? selectedActions.filter((a) => a !== action)
        : [...selectedActions, action]
    );
  };

  const toggleGroup = (groupActions: AuditLogActionType[]) => {
    const allSelected = groupActions.every((a) => selectedActions.includes(a));
    if (allSelected) {
      onChange(selectedActions.filter((a) => !groupActions.includes(a)));
    } else {
      const newActions = [...selectedActions];
      groupActions.forEach((a) => {
        if (!newActions.includes(a)) newActions.push(a);
      });
      onChange(newActions);
    }
  };

  const label =
    selectedActions.length === 0
      ? t("settings.security.auditLog.filters.eventTypes.placeholder", "All event types")
      : t("settings.security.auditLog.filters.eventTypes.count", "{{count}} event types", {
          count: selectedActions.length,
        });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs gap-1.5 min-w-[140px] justify-between",
            selectedActions.length > 0 && "border-primary/60 bg-primary/5"
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {t("settings.security.auditLog.filters.eventTypes.title", "Filter by event type")}
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {Object.entries(AUDIT_LOG_ACTION_GROUPS).map(([groupKey, group]) => {
            const groupActions = group.actions as AuditLogActionType[];
            const allSelected = groupActions.every((a) => selectedActions.includes(a));
            const someSelected = groupActions.some((a) => selectedActions.includes(a));

            return (
              <div key={groupKey} className="mb-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupActions)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors"
                >
                  <Checkbox
                    checked={allSelected}
                    data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                    onCheckedChange={() => toggleGroup(groupActions)}
                    className="pointer-events-none"
                  />
                  <span className="text-xs font-semibold text-foreground">{group.label}</span>
                  {someSelected && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                      {groupActions.filter((a) => selectedActions.includes(a)).length}
                    </Badge>
                  )}
                </button>
                {/* Individual actions */}
                <div className="ml-4 space-y-0.5">
                  {groupActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => toggleAction(action)}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded-md hover:bg-muted/30 text-left transition-colors"
                    >
                      <Checkbox
                        checked={selectedActions.includes(action)}
                        onCheckedChange={() => toggleAction(action)}
                        className="pointer-events-none h-3.5 w-3.5"
                      />
                      <span className="text-xs text-muted-foreground font-mono">{action}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {selectedActions.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              {t("settings.security.auditLog.filters.eventTypes.clear", "Clear selection")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface AuditLogFilterBarProps {
  filters: AuditLogFiltersState;
  onFiltersChange: (filters: AuditLogFiltersState) => void;
  members: OrganizationMemberOption[];
}

export function AuditLogFilterBar({
  filters,
  onFiltersChange,
  members,
}: AuditLogFilterBarProps) {
  const { t } = useTranslation();

  const updateFilters = (partial: Partial<AuditLogFiltersState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const resetFilters = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  };

  const activeFilterCount =
    (filters.duration !== DEFAULT_FILTERS.duration ? 1 : 0) +
    (filters.memberIds.length > 0 ? 1 : 0) +
    (filters.actionTypes.length > 0 ? 1 : 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {t("settings.security.auditLog.filters.label", "Filters:")}
      </span>

      <DurationFilter
        value={filters.duration}
        customDateRange={filters.customDateRange}
        onChange={(duration, customDateRange) =>
          updateFilters({ duration, customDateRange: customDateRange ?? {} })
        }
      />

      <MemberFilter
        members={members}
        selectedIds={filters.memberIds}
        onChange={(memberIds) => updateFilters({ memberIds })}
      />

      <EventTypeFilter
        selectedActions={filters.actionTypes}
        onChange={(actionTypes) => updateFilters({ actionTypes })}
      />

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={resetFilters}
        >
          <X className="h-3.5 w-3.5" />
          {t("settings.security.auditLog.filters.reset", "Reset filters")}
        </Button>
      )}
    </div>
  );
}
