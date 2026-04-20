# TrainingPage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/training` page with master/detail layout to manage pharmacy training courses and auto-linked employee absences.

**Architecture:** Single `TrainingPage.tsx` containing a `CourseModal` sub-component. Year filter + master list on the left, detail panel on the right. Adding/removing participants automatically creates/deletes the corresponding `absences` row.

**Tech Stack:** React 18, TypeScript, @tanstack/react-query, Supabase JS client, react-router-dom v6. No test framework exists in the project — verify by running the dev server.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `frontend/src/i18n/translations.ts` | Add `training` namespace to all 4 languages + `nav.training` key |
| Create | `frontend/src/pages/TrainingPage.tsx` | Full page: master list, detail panel, CourseModal |
| Modify | `frontend/src/routes/router.tsx` | Add `/training` route |
| Modify | `frontend/src/components/AppShell.tsx` | Add "Formazione" nav entry |

---

## Task 1: i18n — Add `training` namespace and nav key

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

The file uses `as const` with type inference (`Namespace = keyof typeof translations.it`). Adding the `training` key to `it` automatically extends the `Namespace` type. All 4 languages (`it`, `de`, `fr`, `en`) must have identical keys.

- [ ] **Step 1: Add `training` namespace to `it` block** (after the `availability` block, before the closing `},`):

```typescript
    training: {
      title: "Formazione",
      description: "Corsi di formazione annuali con partecipanti e assenze automatiche.",
      newCourse: "Nuovo corso",
      editCourse: "Modifica corso",
      saveCourse: "Salva corso",
      saving: "Salvataggio...",
      deleteCourse: "Elimina corso",
      confirmDelete: "Eliminare questo corso? I partecipanti verranno rimossi.",
      noCoursesYear: "Nessun corso per il {year}.",
      noCourseSelected: "Seleziona un corso dalla lista.",
      courseCode: "Codice",
      courseTitle: "Titolo",
      startDate: "Data inizio",
      endDate: "Data fine (opz.)",
      startTime: "Ora inizio",
      endTime: "Ora fine",
      location: "Luogo",
      notes: "Note",
      participants: "Partecipanti",
      addParticipant: "Aggiungi dipendente",
      add: "Aggiungi",
      noParticipants: "Nessun partecipante.",
      autoAbsenceNote: "Aggiungendo un partecipante viene creata automaticamente un'assenza TRAINING per la data del corso.",
      loadingCourses: "Caricamento corsi...",
      errorLoading: "Errore nel caricamento.",
      errorSaving: "Errore nel salvataggio.",
      errorDeleting: "Errore nell'eliminazione.",
      coursesCount: "corsi",
    },
```

- [ ] **Step 2: Add `training` key to `nav` in `it` block**:

In the `it.nav` object, add after `schedule`:
```typescript
      training: "Formazione",
```

- [ ] **Step 3: Add `training` namespace to `de` block** (after `de.availability`):

```typescript
    training: {
      title: "Schulungen",
      description: "Jährliche Schulungen mit Teilnehmern und automatischen Abwesenheiten.",
      newCourse: "Neue Schulung",
      editCourse: "Schulung bearbeiten",
      saveCourse: "Schulung speichern",
      saving: "Speichern...",
      deleteCourse: "Schulung löschen",
      confirmDelete: "Diese Schulung löschen? Teilnehmer werden entfernt.",
      noCoursesYear: "Keine Schulungen für {year}.",
      noCourseSelected: "Schulung aus der Liste auswählen.",
      courseCode: "Kürzel",
      courseTitle: "Titel",
      startDate: "Startdatum",
      endDate: "Enddatum (opt.)",
      startTime: "Startzeit",
      endTime: "Endzeit",
      location: "Ort",
      notes: "Notizen",
      participants: "Teilnehmer",
      addParticipant: "Mitarbeiter hinzufügen",
      add: "Hinzufügen",
      noParticipants: "Keine Teilnehmer.",
      autoAbsenceNote: "Beim Hinzufügen eines Teilnehmers wird automatisch eine TRAINING-Abwesenheit erstellt.",
      loadingCourses: "Schulungen laden...",
      errorLoading: "Fehler beim Laden.",
      errorSaving: "Fehler beim Speichern.",
      errorDeleting: "Fehler beim Löschen.",
      coursesCount: "Schulungen",
    },
```

- [ ] **Step 4: Add `training` key to `nav` in `de` block**:

```typescript
      training: "Schulungen",
```

- [ ] **Step 5: Add `training` namespace to `fr` block** (after `fr.availability`):

```typescript
    training: {
      title: "Formation",
      description: "Formations annuelles avec participants et absences automatiques.",
      newCourse: "Nouvelle formation",
      editCourse: "Modifier la formation",
      saveCourse: "Enregistrer",
      saving: "Enregistrement...",
      deleteCourse: "Supprimer la formation",
      confirmDelete: "Supprimer cette formation? Les participants seront retirés.",
      noCoursesYear: "Aucune formation pour {year}.",
      noCourseSelected: "Sélectionnez une formation dans la liste.",
      courseCode: "Code",
      courseTitle: "Titre",
      startDate: "Date de début",
      endDate: "Date de fin (opt.)",
      startTime: "Heure de début",
      endTime: "Heure de fin",
      location: "Lieu",
      notes: "Notes",
      participants: "Participants",
      addParticipant: "Ajouter un employé",
      add: "Ajouter",
      noParticipants: "Aucun participant.",
      autoAbsenceNote: "L'ajout d'un participant crée automatiquement une absence FORMATION pour la date du cours.",
      loadingCourses: "Chargement des formations...",
      errorLoading: "Erreur de chargement.",
      errorSaving: "Erreur d'enregistrement.",
      errorDeleting: "Erreur de suppression.",
      coursesCount: "formations",
    },
```

- [ ] **Step 6: Add `training` key to `nav` in `fr` block**:

```typescript
      training: "Formation",
```

- [ ] **Step 7: Add `training` namespace to `en` block** (after `en.availability`):

```typescript
    training: {
      title: "Training",
      description: "Annual training courses with participants and automatic absences.",
      newCourse: "New course",
      editCourse: "Edit course",
      saveCourse: "Save course",
      saving: "Saving...",
      deleteCourse: "Delete course",
      confirmDelete: "Delete this course? Participants will be removed.",
      noCoursesYear: "No courses for {year}.",
      noCourseSelected: "Select a course from the list.",
      courseCode: "Code",
      courseTitle: "Title",
      startDate: "Start date",
      endDate: "End date (opt.)",
      startTime: "Start time",
      endTime: "End time",
      location: "Location",
      notes: "Notes",
      participants: "Participants",
      addParticipant: "Add employee",
      add: "Add",
      noParticipants: "No participants.",
      autoAbsenceNote: "Adding a participant automatically creates a TRAINING absence for the course date.",
      loadingCourses: "Loading courses...",
      errorLoading: "Error loading.",
      errorSaving: "Error saving.",
      errorDeleting: "Error deleting.",
      coursesCount: "courses",
    },
```

- [ ] **Step 8: Add `training` key to `nav` in `en` block**:

```typescript
      training: "Training",
```

- [ ] **Step 9: Verify TypeScript compiles** — run from `frontend/`:

```bash
npx tsc --noEmit
```

Expected: no errors related to `training` namespace.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "feat: add training i18n namespace and nav key (it/de/fr/en)"
```

---

## Task 2: Create TrainingPage.tsx

**Files:**
- Create: `frontend/src/pages/TrainingPage.tsx`

- [ ] **Step 1: Create the file with types, queries and state skeleton**

```typescript
import { FormEvent, useState } from "react";
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

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function TrainingPage() {
  const queryClient = useQueryClient();
  const t = useT("training");
  const c = useT("common");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [addEmpId, setAddEmpId] = useState("");

  // -- queries and mutations go here (next steps) --

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <p>TrainingPage skeleton</p>
    </section>
  );
}
```

- [ ] **Step 2: Add year options + courses query**

Replace the `// -- queries and mutations go here --` comment with:

```typescript
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
    onSuccess: (data) => {
      if (data.length > 0 && selectedCourseId === null) {
        setSelectedCourseId(data[0].id);
      }
    },
  });

  const selectedCourse = coursesQuery.data?.find((c) => c.id === selectedCourseId) ?? null;
```

- [ ] **Step 3: Add participants query + employees query**

After the courses query:

```typescript
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

  const participantIds = new Set(
    (participantsQuery.data ?? []).map((p) => p.employee_id)
  );

  const availableEmployees = (employeesQuery.data ?? []).filter(
    (e) => !participantIds.has(e.id)
  );
```

- [ ] **Step 4: Add save course mutation**

```typescript
  const saveCourseMutation = useMutation({
    mutationFn: async () => {
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
      if (modalMode === "new") {
        const { error } = await supabase.from("training_courses").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("training_courses")
          .update(payload)
          .eq("id", selectedCourseId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_courses", selectedYear] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
  });
```

- [ ] **Step 5: Add delete course mutation**

```typescript
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("training_courses")
        .delete()
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedCourseId(null);
      queryClient.invalidateQueries({ queryKey: ["training_courses", selectedYear] });
    },
  });
```

- [ ] **Step 6: Add participant mutations (add + remove)**

```typescript
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
```

- [ ] **Step 7: Replace the skeleton JSX with the full render**

Replace the entire `return (...)` block:

```typescript
  const openNew = () => {
    setForm(EMPTY_FORM);
    setModalMode("new");
    setShowModal(true);
  };

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

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="toolbar">
          <label className="field">
            <span>{c.year}</span>
            <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedCourseId(null); }}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" onClick={openNew}>+ {t.newCourse}</button>
        </div>
      </div>

      {/* Master / Detail */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>

        {/* Master list */}
        <div className="card" style={{ flex: "0 0 38%", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 1rem", background: "var(--surface-2, #f4f4f4)", borderBottom: "1px solid var(--border, #e0e8e0)", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted, #6f816f)", textTransform: "uppercase" }}>
            {coursesQuery.data?.length ?? 0} {t.coursesCount} · {selectedYear}
          </div>
          {coursesQuery.isLoading ? <p style={{ padding: "1rem" }}>{t.loadingCourses}</p> : null}
          {!coursesQuery.isLoading && (coursesQuery.data?.length ?? 0) === 0 ? (
            <p style={{ padding: "1rem" }}>{t.noCoursesYear.replace("{year}", String(selectedYear))}</p>
          ) : null}
          {(coursesQuery.data ?? []).map((course) => (
            <div
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              style={{
                padding: "0.6rem 1rem",
                cursor: "pointer",
                borderLeft: course.id === selectedCourseId ? "3px solid var(--accent, #2d5a2d)" : "3px solid transparent",
                background: course.id === selectedCourseId ? "var(--surface-selected, #e8f0e8)" : "transparent",
                borderBottom: "1px solid var(--border-light, #f0f4f0)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{course.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #6f816f)", marginTop: 2 }}>
                {formatDate(course.start_date)}
                {course.location ? ` · ${course.location}` : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="card" style={{ flex: 1 }}>
          {selectedCourse === null ? (
            <p>{t.noCourseSelected}</p>
          ) : (
            <>
              {/* Detail header */}
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
                  <button type="button" className="secondary" onClick={openEdit}>{c.modify}</button>
                  <button
                    type="button"
                    className="secondary"
                    style={{ color: "var(--danger, #c04040)" }}
                    onClick={() => {
                      if (window.confirm(t.confirmDelete)) {
                        deleteCourseMutation.mutate(selectedCourse.id);
                      }
                    }}
                  >
                    {c.delete}
                  </button>
                </div>
              </div>

              {/* Participants */}
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted, #6f816f)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                {t.participants}
              </div>
              {participantsQuery.isLoading ? <p>{c.loading}</p> : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {(participantsQuery.data ?? []).length === 0 && !participantsQuery.isLoading ? (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #6f816f)" }}>{t.noParticipants}</span>
                ) : null}
                {(participantsQuery.data ?? []).map((p) => (
                  <span
                    key={p.id}
                    style={{ background: "var(--chip-bg, #c8e0c8)", borderRadius: 12, padding: "3px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : "—"}
                    <button
                      type="button"
                      onClick={() => removeParticipantMutation.mutate(p.employee_id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6f816f)", padding: 0, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add participant */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <select
                  value={addEmpId}
                  onChange={(e) => setAddEmpId(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">{t.addParticipant}…</option>
                  {availableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addEmpId || addParticipantMutation.isPending}
                  onClick={() => addParticipantMutation.mutate(addEmpId)}
                >
                  {t.add}
                </button>
              </div>

              {/* Auto-absence note */}
              <div style={{ background: "var(--info-bg, #fdf8e8)", border: "1px solid var(--info-border, #e8d880)", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--info-text, #807040)" }}>
                ℹ {t.autoAbsenceNote}
              </div>

              {addParticipantMutation.error ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorSaving}</p> : null}
              {removeParticipantMutation.error ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorDeleting}</p> : null}
              {deleteCourseMutation.error ? <p style={{ color: "red", fontSize: "0.8rem" }}>{t.errorDeleting}</p> : null}
            </>
          )}
        </div>
      </div>

      {/* CourseModal */}
      {showModal ? (
        <CourseModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onSave={(e) => { e.preventDefault(); saveCourseMutation.mutate(); }}
          onCancel={() => { setShowModal(false); setForm(EMPTY_FORM); }}
          saving={saveCourseMutation.isPending}
          error={saveCourseMutation.isError}
          t={t}
          c={c}
        />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 8: Add CourseModal component** (at the bottom of the file, after `TrainingPage`):

```typescript
type CourseModalProps = {
  mode: "new" | "edit";
  form: CourseForm;
  setForm: React.Dispatch<React.SetStateAction<CourseForm>>;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: boolean;
  t: ReturnType<typeof useT<"training">>;
  c: ReturnType<typeof useT<"common">>;
};

function CourseModal({ mode, form, setForm, onSave, onCancel, saving, error, t, c }: CourseModalProps) {
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
            <button type="button" className="secondary" onClick={onCancel}>{c.cancel}</button>
            <button type="submit" disabled={saving}>{saving ? t.saving : t.saveCourse}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/TrainingPage.tsx
git commit -m "feat: add TrainingPage with master/detail layout and participant management"
```

---

## Task 3: Wire routing and navigation

**Files:**
- Modify: `frontend/src/routes/router.tsx`
- Modify: `frontend/src/components/AppShell.tsx`

- [ ] **Step 1: Add route to `router.tsx`**

Add the import at the top:
```typescript
import { TrainingPage } from "../pages/TrainingPage";
```

Add the route inside the children array (after the `schedule` route):
```typescript
      { path: "training", element: <TrainingPage /> },
```

- [ ] **Step 2: Add nav entry to `AppShell.tsx`**

In the `navRoutes` array, add after the `schedule` entry:
```typescript
  { to: "/training", key: "training" as const },
```

The `nav` type is inferred from `translations.it.nav`, so adding `training` in Task 1 step 2 makes this typecheck correctly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify**

```bash
cd frontend && npm run dev
```

Check:
- "Formazione" appears in sidebar navigation
- `/training` loads without errors
- Year selector shows current year + adjacent years
- "+ Nuovo corso" button opens the modal
- Saving a course adds it to the master list
- Selecting a course shows the detail panel
- Adding a participant shows the chip + creates an absence in AbsencesPage
- Removing a participant removes the chip + removes the absence
- Deleting a course removes it from the list

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/router.tsx frontend/src/components/AppShell.tsx
git commit -m "feat: wire /training route and sidebar nav entry"
```
