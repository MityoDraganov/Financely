import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYTICS_STATE,
  analyticsReducer,
  buildAnalyticsExportPayload,
  buildAnalyticsRecordsPayload,
  buildAnalyticsViewPayload,
} from "@/pages/analytics/analytics-state";

describe("analyticsReducer", () => {
  it("adds chart-click filter values and keeps them unique", () => {
    const stateWithOwner = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "add_filter_value",
      key: "ownerIds",
      value: "user_1",
    });
    const deduped = analyticsReducer(stateWithOwner, {
      type: "add_filter_value",
      key: "ownerIds",
      value: "user_1",
    });

    expect(deduped.filters.ownerIds).toEqual(["user_1"]);
    expect(deduped.table.page).toBe(1);
  });

  it("removes filter pills from the active filter set", () => {
    const seeded = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "set_filter_array",
      key: "currencies",
      values: ["USD", "EUR"],
    });
    const afterRemoval = analyticsReducer(seeded, {
      type: "remove_filter_value",
      key: "currencies",
      value: "EUR",
    });

    expect(afterRemoval.filters.currencies).toEqual(["USD"]);
  });

  it("applies saved view filters and table config", () => {
    const applied = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "apply_saved_view",
      filters: {
        statuses: ["sent"],
        overdueOnly: true,
      },
      tableConfig: {
        tab: "collections",
        sortField: "collectionDays",
        sortDirection: "asc",
        groupBy: "owner",
        pageSize: 100,
      },
    });

    expect(applied.filters.statuses).toEqual(["sent"]);
    expect(applied.filters.overdueOnly).toBe(true);
    expect(applied.table.tab).toBe("collections");
    expect(applied.table.sort).toEqual({
      field: "collectionDays",
      direction: "asc",
    });
    expect(applied.table.pageSize).toBe(100);
  });
});

describe("analytics payload builders", () => {
  const summaryPayload = {
    orgId: "org_123",
    dateRange: {
      start: "2026-01-01",
      end: "2026-01-31",
    },
    comparePrevious: true,
  } as const;

  it("shapes table state into records payload", () => {
    const state = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "set_sort",
      sort: {
        field: "amount",
        direction: "asc",
      },
    });
    const payload = buildAnalyticsRecordsPayload(summaryPayload, state);

    expect(payload.tab).toBe("documents");
    expect(payload.sort).toEqual({
      field: "amount",
      direction: "asc",
    });
    expect(payload.page).toBe(1);
    expect(payload.pageSize).toBe(25);
  });

  it("creates export payload with filters and table config", () => {
    const withFilters = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "set_filter_array",
      key: "statuses",
      values: ["paid", "sent"],
    });
    const payload = buildAnalyticsExportPayload(summaryPayload, withFilters);
    expect(payload.filters).toEqual({
      ...withFilters.filters,
    });
    expect(payload.tab).toBe("documents");
  });

  it("builds saved-view persistence payload from current state", () => {
    const state = analyticsReducer(DEFAULT_ANALYTICS_STATE, {
      type: "set_group_by",
      groupBy: "market",
    });
    const viewPayload = buildAnalyticsViewPayload(state);
    expect(viewPayload.tableConfig.groupBy).toBe("market");
    expect(viewPayload.tableConfig.sortField).toBe("date");
  });
});
