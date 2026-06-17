export interface StepDef {
  id: number;
  label: string;
}

interface Props {
  steps: StepDef[];
  current: number;
}

export function StepNav({ steps, current }: Props) {
  return (
    <nav className="steps" aria-label="Progress">
      {steps.map((s) => {
        const state = s.id < current ? "done" : s.id === current ? "active" : "";
        return (
          <div key={s.id} className={`step-pill ${state}`}>
            <span className="step-num">{s.id < current ? "✓" : s.id}</span>
            {s.label}
          </div>
        );
      })}
    </nav>
  );
}
