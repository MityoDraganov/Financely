import {
  AnalyticsViewFilter,
  AnalyticsViewTableConfig,
  BusinessAnalyticsFilters,
  BusinessAnalyticsRecordSort,
  BusinessAnalyticsRecordsPayload,
  BusinessAnalyticsSummaryPayload,
} from "@/core";

export type AnalyticsTab = "documents" | "customers" | "proposals" | "collections";

export interface AnalyticsTableState {
  tab: AnalyticsTab;
  sort: BusinessAnalyticsRecordSort;
  groupBy: string | null;
  page: number;
  pageSize: number;
}

export interface AnalyticsState {
  filters: BusinessAnalyticsFilters;
  table: AnalyticsTableState;
}

export const DEFAULT_ANALYTICS_FILTERS: BusinessAnalyticsFilters = {
  documentTypes: [],
  statuses: [],
  customerKeys: [],
  ownerIds: [],
  currencies: [],
  markets: [],
  paymentStates: [],
  overdueOnly: false,
};

export const DEFAULT_ANALYTICS_TABLE: AnalyticsTableState = {
  tab: "documents",
  sort: {
    field: "date",
    direction: "desc",
  },
  groupBy: null,
  page: 1,
  pageSize: 25,
};

export const DEFAULT_ANALYTICS_STATE: AnalyticsState = {
  filters: { ...DEFAULT_ANALYTICS_FILTERS },
  table: { ...DEFAULT_ANALYTICS_TABLE },
};

type FilterArrayKey = keyof Pick<
  BusinessAnalyticsFilters,
  | "documentTypes"
  | "statuses"
  | "customerKeys"
  | "ownerIds"
  | "currencies"
  | "markets"
  | "paymentStates"
>;

export type AnalyticsAction =
  | { type: "set_filter_array"; key: FilterArrayKey; values: string[] }
  | { type: "add_filter_value"; key: FilterArrayKey; value: string }
  | { type: "remove_filter_value"; key: FilterArrayKey; value: string }
  | { type: "set_overdue_only"; value: boolean }
  | { type: "clear_filters" }
  | { type: "set_tab"; tab: AnalyticsTab }
  | { type: "set_sort"; sort: BusinessAnalyticsRecordSort }
  | { type: "set_group_by"; groupBy: string | null }
  | { type: "set_page"; page: number }
  | { type: "set_page_size"; pageSize: number }
  | {
      type: "apply_saved_view";
      filters: AnalyticsViewFilter;
      tableConfig: AnalyticsViewTableConfig;
    };

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function analyticsReducer(
  state: AnalyticsState,
  action: AnalyticsAction,
): AnalyticsState {
  switch (action.type) {
    case "set_filter_array":
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.key]: uniqueValues(action.values),
        },
        table: {
          ...state.table,
          page: 1,
        },
      };
    case "add_filter_value": {
      const currentValues = (state.filters[action.key] || []) as string[];
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.key]: uniqueValues([...currentValues, action.value]),
        },
        table: {
          ...state.table,
          page: 1,
        },
      };
    }
    case "remove_filter_value": {
      const currentValues = (state.filters[action.key] || []) as string[];
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.key]: currentValues.filter((value) => value !== action.value),
        },
        table: {
          ...state.table,
          page: 1,
        },
      };
    }
    case "set_overdue_only":
      return {
        ...state,
        filters: {
          ...state.filters,
          overdueOnly: action.value,
        },
        table: {
          ...state.table,
          page: 1,
        },
      };
    case "clear_filters":
      return {
        ...state,
        filters: { ...DEFAULT_ANALYTICS_FILTERS },
        table: {
          ...state.table,
          page: 1,
        },
      };
    case "set_tab":
      return {
        ...state,
        table: {
          ...state.table,
          tab: action.tab,
          page: 1,
        },
      };
    case "set_sort":
      return {
        ...state,
        table: {
          ...state.table,
          sort: action.sort,
          page: 1,
        },
      };
    case "set_group_by":
      return {
        ...state,
        table: {
          ...state.table,
          groupBy: action.groupBy,
          page: 1,
        },
      };
    case "set_page":
      return {
        ...state,
        table: {
          ...state.table,
          page: Math.max(1, action.page),
        },
      };
    case "set_page_size":
      return {
        ...state,
        table: {
          ...state.table,
          pageSize: Math.max(1, Math.min(250, action.pageSize)),
          page: 1,
        },
      };
    case "apply_saved_view":
      return {
        filters: {
          ...DEFAULT_ANALYTICS_FILTERS,
          ...action.filters,
        },
        table: {
          tab: action.tableConfig.tab || DEFAULT_ANALYTICS_TABLE.tab,
          sort: {
            field:
              action.tableConfig.sortField || DEFAULT_ANALYTICS_TABLE.sort.field,
            direction:
              action.tableConfig.sortDirection ||
              DEFAULT_ANALYTICS_TABLE.sort.direction,
          },
          groupBy:
            action.tableConfig.groupBy === undefined
              ? DEFAULT_ANALYTICS_TABLE.groupBy
              : action.tableConfig.groupBy,
          page: 1,
          pageSize:
            action.tableConfig.pageSize || DEFAULT_ANALYTICS_TABLE.pageSize,
        },
      };
    default:
      return state;
  }
}

export function buildAnalyticsRecordsPayload(
  summaryPayload: BusinessAnalyticsSummaryPayload,
  state: AnalyticsState,
): BusinessAnalyticsRecordsPayload {
  return {
    ...summaryPayload,
    filters: state.filters,
    tab: state.table.tab,
    sort: state.table.sort,
    groupBy: state.table.groupBy,
    page: state.table.page,
    pageSize: state.table.pageSize,
  };
}

export function buildAnalyticsViewPayload(state: AnalyticsState): {
  filters: AnalyticsViewFilter;
  tableConfig: AnalyticsViewTableConfig;
} {
  return {
    filters: {
      ...state.filters,
    },
    tableConfig: {
      tab: state.table.tab,
      sortField: state.table.sort.field,
      sortDirection: state.table.sort.direction,
      groupBy: state.table.groupBy,
      pageSize: state.table.pageSize,
    },
  };
}

export interface AnalyticsFilterPill {
  key: FilterArrayKey | "overdueOnly";
  value: string;
  label: string;
}

export function buildFilterPills(
  filters: BusinessAnalyticsFilters,
): AnalyticsFilterPill[] {
  const pills: AnalyticsFilterPill[] = [];
  const keys: FilterArrayKey[] = [
    "documentTypes",
    "statuses",
    "customerKeys",
    "ownerIds",
    "currencies",
    "markets",
    "paymentStates",
  ];
  for (const key of keys) {
    const values = (filters[key] || []) as string[];
    for (const value of values) {
      pills.push({
        key,
        value,
        label: `${key}: ${value}`,
      });
    }
  }
  if (filters.overdueOnly) {
    pills.push({
      key: "overdueOnly",
      value: "true",
      label: "Overdue only",
    });
  }
  return pills;
}

export function buildAnalyticsExportPayload(
  summaryPayload: BusinessAnalyticsSummaryPayload,
  state: AnalyticsState,
): Record<string, unknown> {
  return {
    orgId: summaryPayload.orgId,
    dateRange: summaryPayload.dateRange,
    comparePrevious: summaryPayload.comparePrevious,
    filters: state.filters,
    tab: state.table.tab,
    sort: state.table.sort,
    groupBy: state.table.groupBy,
    page: state.table.page,
    pageSize: state.table.pageSize,
    exportedAt: new Date().toISOString(),
  };
}
