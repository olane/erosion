import type { BuildingType } from '../data/buildings.ts';
import type { UpgradeType } from '../data/upgrades.ts';

// A building placement or upgrade that is in progress. The building isn't placed
// (and the upgrade isn't applied) until onComplete runs when the timer finishes.
export interface ConstructionJob {
  q: number;
  r: number;
  kind: 'build' | 'upgrade';
  buildingType?: BuildingType;
  upgradeType?: UpgradeType;
  totalTime: number;
  elapsed: number;
  onComplete: () => void;
}

export class ConstructionSystem {
  private jobs: ConstructionJob[] = [];

  start(job: Omit<ConstructionJob, 'elapsed'>): void {
    this.jobs.push({ ...job, elapsed: 0 });
  }

  // Advances every job by dt game-seconds and completes any that have finished.
  // Completed jobs are removed before their onComplete runs.
  update(dt: number): void {
    if (dt <= 0 || this.jobs.length === 0) return;

    const completed: ConstructionJob[] = [];
    for (const job of this.jobs) {
      job.elapsed += dt;
      if (job.elapsed >= job.totalTime) completed.push(job);
    }
    if (completed.length === 0) return;

    this.jobs = this.jobs.filter((j) => !completed.includes(j));
    for (const job of completed) job.onComplete();
  }

  hasBuildJobAt(q: number, r: number): boolean {
    return this.jobs.some((j) => j.kind === 'build' && j.q === q && j.r === r);
  }

  hasUpgradeJobAt(q: number, r: number, upgrade: UpgradeType): boolean {
    return this.jobs.some(
      (j) => j.kind === 'upgrade' && j.q === q && j.r === r && j.upgradeType === upgrade,
    );
  }

  get activeJobs(): readonly ConstructionJob[] {
    return this.jobs;
  }
}
