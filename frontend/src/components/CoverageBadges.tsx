import type { CoverageIssue } from "../lib/coverage";
import { roleLabel } from "../lib/coverage";

export function CoverageBadges({ issues }: { issues: CoverageIssue[] }) {
  const shortages = issues.filter((i) => i.kind === "shortage");
  if (shortages.length === 0) return null;
  return (
    <div className="coverage-badges">
      {shortages.map((s, i) => (
        <span key={i} className="coverage-badge coverage-badge-shortage">
          -{(s.required ?? 0) - (s.assigned ?? 0)} {roleLabel(s.role)}
        </span>
      ))}
    </div>
  );
}

export function hasCritical(issues: CoverageIssue[]): boolean {
  return issues.some((i) => i.severity === "critical");
}
