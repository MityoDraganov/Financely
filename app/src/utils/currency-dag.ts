/**
 * Dependency Graph (DAG) for Currency Field Linking
 * Prevents cycles and manages topological ordering for field computation
 */

import type { CurrencyFieldLink } from "@/core/entities/currency-field";

export interface FieldNode {
  id: string;
  links: CurrencyFieldLink[];
  dependsOn: string[]; // Field IDs this field depends on
}

/**
 * Build dependency graph from currency field links
 */
export function buildDependencyGraph(
  fields: Array<{ id: string; links?: CurrencyFieldLink[] }>
): Map<string, FieldNode> {
  const graph = new Map<string, FieldNode>();

  // Initialize all nodes
  for (const field of fields) {
    graph.set(field.id, {
      id: field.id,
      links: field.links || [],
      dependsOn: [],
    });
  }

  // Build dependencies from links
  for (const field of fields) {
    const node = graph.get(field.id);
    if (!node) continue;

    for (const link of field.links || []) {
      if (link.type === "FX_PAIR" && link.sourceFieldId) {
        // This field depends on the source field
        if (!node.dependsOn.includes(link.sourceFieldId)) {
          node.dependsOn.push(link.sourceFieldId);
        }
      } else if (link.type === "FORMULA" && link.formula) {
        // Extract field IDs from formula (simple regex-based extraction)
        // In production, use a proper formula parser
        const fieldIdMatches = link.formula.match(/\{([^}]+)\}/g);
        if (fieldIdMatches) {
          for (const match of fieldIdMatches) {
            const fieldId = match.slice(1, -1); // Remove { }
            if (!node.dependsOn.includes(fieldId)) {
              node.dependsOn.push(fieldId);
            }
          }
        }
      }
    }
  }

  return graph;
}

/**
 * Detect cycles in dependency graph using DFS
 */
export function detectCycles(graph: Map<string, FieldNode>): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycle: string[] = [];

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      // Cycle detected
      cycle.push(nodeId);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const node = graph.get(nodeId);
    if (node) {
      for (const depId of node.dependsOn) {
        if (dfs(depId)) {
          if (cycle.length > 0 && cycle[0] !== nodeId) {
            cycle.push(nodeId);
          }
          return true;
        }
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  // Check all nodes
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        return cycle.reverse(); // Return cycle path
      }
    }
  }

  return null;
}

/**
 * Topological sort for computing fields in correct order
 */
export function topologicalSort(graph: Map<string, FieldNode>): string[] {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  // Calculate in-degrees
  for (const [nodeId, node] of graph.entries()) {
    inDegree.set(nodeId, node.dependsOn.length);
    if (node.dependsOn.length === 0) {
      queue.push(nodeId);
    }
  }

  // Process nodes
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    // Decrease in-degree for dependent nodes
    for (const [id, node] of graph.entries()) {
      if (node.dependsOn.includes(nodeId)) {
        const currentInDegree = inDegree.get(id) || 0;
        inDegree.set(id, currentInDegree - 1);
        if (currentInDegree - 1 === 0) {
          queue.push(id);
        }
      }
    }
  }

  // If result length doesn't match graph size, there's a cycle
  if (result.length !== graph.size) {
    throw new Error("Cycle detected in dependency graph");
  }

  return result;
}

/**
 * Validate field linking doesn't create cycles
 */
export function validateFieldLinking(
  fields: Array<{ id: string; links?: CurrencyFieldLink[] }>,
  newLink?: { fieldId: string; link: CurrencyFieldLink }
): { valid: boolean; cycle?: string[] } {
  // Create temporary graph with new link
  const tempFields = fields.map((f) => ({
    id: f.id,
    links: f.id === newLink?.fieldId
      ? [...(f.links || []), newLink.link]
      : f.links || [],
  }));

  const graph = buildDependencyGraph(tempFields);
  const cycle = detectCycles(graph);

  return {
    valid: cycle === null,
    cycle: cycle || undefined,
  };
}

