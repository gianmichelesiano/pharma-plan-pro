import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listEmployees } from "../employees/api";
import { createShift, deleteShift, type ShiftWithEmployee } from "./api";

type Props = {
  date: string;
  existing: ShiftWithEmployee[];
  onClose: () => void;
};

export function ShiftEditorModal({ date, existing, onClose }: Props) {
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["employees-active"], queryFn: () => listEmployees(true) });

  const add = useMutation({
    mutationFn: createShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const del = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    add.mutate({
      employee_id: String(fd.get("employee_id")),
      shift_date: date,
      shift_type: String(fd.get("shift_type")) as never,
      note: String(fd.get("note")) || null,
    });
    (e.currentTarget as HTMLFormElement).reset();
  }

  return (
    <dialog open>
      <h3>Shifts on {date}</h3>
      <ul>
        {existing.map((s) => (
          <li key={s.id}>
            {s.plan_employees?.display_code} — {s.shift_type}
            {s.note && ` (${s.note})`}
            <button onClick={() => del.mutate(s.id)}>✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit}>
        <select name="employee_id" required>
          <option value="">—</option>
          {employees.data?.map((e) => (
            <option key={e.id} value={e.id}>{e.display_code}</option>
          ))}
        </select>
        <select name="shift_type" defaultValue="FULL_DAY">
          <option value="FULL_DAY">Full day</option>
          <option value="MORNING">Morning</option>
          <option value="AFTERNOON">Afternoon</option>
        </select>
        <input name="note" placeholder="Note (optional)" />
        <button type="submit" disabled={add.isPending}>Add</button>
      </form>
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}
