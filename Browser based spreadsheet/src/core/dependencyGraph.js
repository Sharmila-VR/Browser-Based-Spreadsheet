export class DependencyGraph {
  constructor() {
    this.cellToDeps = new Map();
    this.cellToDependents = new Map();
  }

  setDependencies(cellId, newDeps) {
    const depsSet = newDeps instanceof Set ? newDeps : new Set(newDeps);

    const oldDeps = this.cellToDeps.get(cellId);
    if (oldDeps) {
      for (const dep of oldDeps) {
        const dependents = this.cellToDependents.get(dep);
        if (dependents) {
          dependents.delete(cellId);
          if (dependents.size === 0) {
            this.cellToDependents.delete(dep);
          }
        }
      }
    }

    if (depsSet.size === 0) {
      this.cellToDeps.delete(cellId);
      return;
    }

    this.cellToDeps.set(cellId, depsSet);

    for (const dep of depsSet) {
      let dependents = this.cellToDependents.get(dep);
      if (!dependents) {
        dependents = new Set();
        this.cellToDependents.set(dep, dependents);
      }
      dependents.add(cellId);
    }
  }

  clearCell(cellId) {
    this.setDependencies(cellId, []);
  }

  getDependencies(cellId) {
    return this.cellToDeps.get(cellId) || new Set();
  }

  getDependents(cellId) {
    return this.cellToDependents.get(cellId) || new Set();
  }

  getAffectedSubgraph(dirtyRoots) {
    const subgraph = new Set();
    const queue = [];

    for (const root of dirtyRoots) {
      subgraph.add(root);
      queue.push(root);
    }

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      const dependents = this.cellToDependents.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!subgraph.has(dep)) {
            subgraph.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return subgraph;
  }

  computeRecalculationPlan(dirtyRoots) {
    const subgraph = this.getAffectedSubgraph(dirtyRoots);
    const inDegree = new Map();

    for (const cellId of subgraph) {
      let degree = 0;
      const deps = this.cellToDeps.get(cellId);
      if (deps) {
        for (const dep of deps) {
          if (subgraph.has(dep)) {
            degree++;
          }
        }
      }
      inDegree.set(cellId, degree);
    }

    const queue = [];
    let queueHead = 0;

    for (const [cellId, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(cellId);
      }
    }

    const evaluationOrder = [];

    while (queueHead < queue.length) {
      const current = queue[queueHead++];
      evaluationOrder.push(current);

      const dependents = this.cellToDependents.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (subgraph.has(dep)) {
            const currentDeg = inDegree.get(dep) - 1;
            inDegree.set(dep, currentDeg);
            if (currentDeg === 0) {
              queue.push(dep);
            }
          }
        }
      }
    }

    const circularCells = new Set();
    if (evaluationOrder.length < subgraph.size) {
      for (const cellId of subgraph) {
        if (inDegree.get(cellId) > 0) {
          circularCells.add(cellId);
        }
      }
    }

    return {
      evaluationOrder,
      circularCells,
      subgraphSize: subgraph.size,
    };
  }
}
