import React, { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Course = Tables<"training_courses">;
type Participant = Tables<"training_participants"> & {
  employee: Pick<Employee, "id" | "first_name" | "last_name"> | null;
};

type CourseForm = {
  code: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  note: string;
};

const EMPTY_FORM: CourseForm = {
  code: "", title: "", start_date: "", end_date: "",
  start_time: "", end_time: "", location: "", note: "",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function TrainingPage() {
  const queryClient = useQueryClient();
  const t = useT("training");
  const common = useT("common");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [addEmpId, setAddEmpId] = useState("");

  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

  const coursesQuery = useQuery({
    queryKey: ["training_courses", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_courses")
        .select("*")
        .gte("start_date", `${selectedYear}-01-01`)
        .lte("start_date", `${selectedYear}-12-31`)
        .order("start_date");
      if (error) throw error;
      return data as Course[];
    },
  });

  const courses = coursesQuery.data ?? [];

  useEffect(() => {
    if (courses.length > 0 && selectedCourseId === null) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  const participantsQuery = useQuery({
    queryKey: ["training_participants", selectedCourseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_participants")
        .select("*, employee:employees(id, first_name, last_name)")
        .eq("training_course_id", selectedCourseId!);
      if (error) throw error;
      return data as Participant[];
    },
    enabled: selectedCourseId !== null,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("active", true)
        .order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const participantIds = new Set((participantsQuery.data ?? []).map((p) => p.employee_id));
  const availableEmployees = (employeesQuery.data ?? []).filter((e) => !participantIds.has(e.id));

  const saveCourseMutation = useMutation({
    mutationFn: async ({ courseId, mode }: { courseId: string | null; mode: "new" | "edit" }) => {
      const payload = {
        code: form.code,
        title: form.title,
        start_date: form.start_date,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        note: form.note || null,
      };
      if (mode === "new") {
        const { error } = await supabase.from("training_courses").insert(payload);
        if (error) throw error;
      } else {
        if (!courseId) throw new Error("No course selected");
        const { error } = await supabase
          .from("training_courses")
          .update(payload)
          .eq("id", courseId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_courses", selectedYear] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("training_courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedCourseId(null);
      queryClient.invalidateQueries({ queryKey: ["training_courses", selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["training_participants"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!selectedCourse) throw new Error("No course selected");
      const { error: pErr } = await supabase
        .from("training_participants")
        .insert({ training_course_id: selectedCourse.id, employee_id: employeeId });
      if (pErr) throw pErr;
      const { error: aErr } = await supabase.from("absences").insert({
        employee_id: employeeId,
        start_date: selectedCourse.start_date,
        end_date: selectedCourse.end_date ?? selectedCourse.start_date,
        type: "TRAINING" as const,
        status: "approved" as const,
        training_course_id: selectedCourse.id,
      });
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      setAddEmpId("");
      queryClient.invalidateQueries({ queryKey: ["training_participants", selectedCourseId] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!selectedCourseId) throw new Error("No course selected");
      const { error: pErr } = await supabase
        .from("training_participants")
        .delete()
        .eq("training_course_id", selectedCourseId)
        .eq("employee_id", employeeId);
      if (pErr) throw pErr;
      const { error: aErr } = await supabase
        .from("absences")
        .delete()
        .eq("training_course_id", selectedCourseId)
        .eq("employee_id", employeeId);
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_participants", selectedCourseId] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
    },
  });

  const openNew = () => { setForm(EMPTY_FORM); setModalMode("new"); setShowModal(true); };
  const openEdit = () => {
    if (!selectedCourse) return;
    setForm({
      code: selectedCourse.code,
      title: selectedCourse.title,
      start_date: selectedCourse.start_date,
      end_date: selectedCourse.end_date ?? "",
      start_time: selectedCourse.start_time ?? "",
      end_time: selectedCourse.end_time ?? "",
      location: selectedCourse.location ?? "",
      note: selectedCourse.note ?? "",
    });
    setModalMode("edit");
    setShowModal(true);
  };

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="toolbar">
          <label className="field">
            <span>{common.year}</span>
            <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedCourseId(null); }}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" onClick={openNew}>+ {t.newCourse}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div className="card" style={{ flex: "0 0 38%", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 1rem", background: "var(--surface-2, #f4f4f4)", borderBottom: "1px solid var(--border, #e0e8e0)", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted, #6f816f)", textTransform: "uppercase" }}>
            {courses.length} {t.coursesCount} · {selectedYear}
          </div>
          {coursesQuery.isLoading ? <p style={{ padding: "1rem" }}>{t.loadingCourses}</p> : null}
          {!coursesQuery.isLoading && courses.length === 0 ? (
            <p style={{ padding: "1rem" }}>{t.noCoursesYear.replace("{year}", String(selectedYear))}</p>
          ) : null}
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              style={{
                padding: "0.6rem 1rem", cursor: "pointer",
                borderLeft: course.id === selectedCourseId ? "3px solid var(--accent, #2d5a2d)" : "3px solid transparent",
                background: course.id === selectedCourseId ? "var(--surface-selected, #e8f0e8)" : "transparent",
                borderBottom: "1px solid var(--border-light, #f0f4f0)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{course.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #6f816f)", marginTop: 2 }}>
                {formatDate(course.start_date)}{course.location ? ` · ${course.location}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ flex: 1 }}>
          {selectedCourse === null ? (
            <p>{t.noCourseSelected}</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedCourse.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #6f816f)", marginTop: 2 }}>
                    {formatDate(selectedCourse.start_date)}
                    {selectedCourse.end_date ? ` → ${formatDate(selectedCourse.end_date)}` : ""}
                    {selectedCourse.location ? ` · ${selectedCourse.location}` : ""}
                    {selectedCourse.start_time ? ` · ${selectedCourse.start_time}` : ""}
                    {selectedCourse.end_time ? `–${selectedCourse.end_time}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="secondary" onClick={openEdit}>{common.modify}</button>
                  <button type="button" className="secondary" style={{ color: "var(--danger, #c04040)" }}
                    onClick={() => { if (window.confirm(t.confirmDelete)) deleteCourseMutation.mutate(selectedCourse.id); }}>
                    {common.delete}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted, #6f816f)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                {t.participants}
              </div>
              {participantsQuery.isLoading ? <p>{common.loading}</p> : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {(participantsQuery.data ?? []).length === 0 && !participantsQuery.isLoading
                  ? <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #6f816f)" }}>{t.noParticipants}</span>
                  : null}
                {(participantsQuery.data ?? []).map((p) => (
                  <span key={p.id} style={{ background: "var(--chip-bg, #c8e0c8)", borderRadius: 12, padding: "3px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}>
                    {p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : "—"}
                    <button type="button" onClick={() => removeParticipantMutation.mutate(p.employee_id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6f816f)", padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <select value={addEmpId} onChange={(e) => setAddEmpId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">{t.addParticipant}…</option>
                  {availableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
                <button type="button" disabled={!addEmpId || addParticipantMutation.isPending}
                  onClick={() => addParticipantMutation.mutate(addEmpId)}>{t.add}</button>
              </div>

              <div style={{ background: "var(--info-bg, #fdf8e8)", border: "1px solid var(--info-border, #e8d880)", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--info-text, #807040)" }}>
                {"\u2139"} {t.autoAbsenceNote}
              </div>

              {addParticipantMutation.isError ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorSaving}</p> : null}
              {removeParticipantMutation.isError ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorDeleting}</p> : null}
              {deleteCourseMutation.isError ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorDeleting}</p> : null}
            </>
          )}
        </div>
      </div>

      {showModal ? (
        <CourseModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onSave={(e) => { e.preventDefault(); saveCourseMutation.mutate({ courseId: selectedCourseId, mode: modalMode }); }}
          onCancel={() => { setShowModal(false); setForm(EMPTY_FORM); }}
          saving={saveCourseMutation.isPending}
          error={saveCourseMutation.isError}
          t={t}
          common={common}
        />
      ) : null}
    </section>
  );
}

type CourseModalProps = {
  mode: "new" | "edit";
  form: CourseForm;
  setForm: React.Dispatch<React.SetStateAction<CourseForm>>;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: boolean;
  t: ReturnType<typeof useT<"training">>;
  common: ReturnType<typeof useT<"common">>;
};

function CourseModal({ mode, form, setForm, onSave, onCancel, saving, error, t, common }: CourseModalProps) {
  const field = (key: keyof CourseForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="card" style={{ width: "min(500px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3>{mode === "new" ? t.newCourse : t.editCourse}</h3>
        <form className="form-grid" onSubmit={onSave}>
          <label className="field">
            <span>{t.courseCode}</span>
            <input type="text" required value={form.code} onChange={field("code")} placeholder="TOPKOMP_S1_A" />
          </label>
          <label className="field">
            <span>{t.courseTitle}</span>
            <input type="text" required value={form.title} onChange={field("title")} />
          </label>
          <label className="field">
            <span>{t.startDate}</span>
            <input type="date" required value={form.start_date} onChange={field("start_date")} />
          </label>
          <label className="field">
            <span>{t.endDate}</span>
            <input type="date" value={form.end_date} onChange={field("end_date")} />
          </label>
          <label className="field">
            <span>{t.startTime}</span>
            <input type="time" value={form.start_time} onChange={field("start_time")} />
          </label>
          <label className="field">
            <span>{t.endTime}</span>
            <input type="time" value={form.end_time} onChange={field("end_time")} />
          </label>
          <label className="field">
            <span>{t.location}</span>
            <input type="text" value={form.location} onChange={field("location")} />
          </label>
          <label className="field">
            <span>{t.notes}</span>
            <textarea value={form.note} onChange={field("note")} rows={2} />
          </label>
          {error ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorSaving}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="secondary" onClick={onCancel}>{common.cancel}</button>
            <button type="submit" disabled={saving}>{saving ? t.saving : t.saveCourse}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
