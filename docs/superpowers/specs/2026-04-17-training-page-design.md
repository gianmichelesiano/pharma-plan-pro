# TrainingPage — Design Spec
Date: 2026-04-17

## Overview

New page `/training` for managing pharmacy staff training courses and their participants. Integrates with the existing `training_courses`, `training_participants`, and `absences` tables.

---

## Layout: Master / Detail

Single page with three zones:

1. **Toolbar** — year filter (default: current year) + "Nuovo corso" button
2. **Master list** (left ~38%) — courses for selected year, sorted by date, each row shows title + date + participant count. Selected row highlighted.
3. **Detail panel** (right ~62%) — full info for selected course + participant management

No modal/drawer for participants — all inline in the detail panel. A modal is used only for the "Nuovo corso" form.

---

## Components

### Toolbar
- Year `<select>` populated from distinct years in `training_courses.start_date`; if no data, range defaults to `[currentYear - 1, currentYear, currentYear + 1]`
- `+ Nuovo corso` button → opens `CourseModal`

### Master List
- Query: `training_courses` filtered by `extract(year from start_date) = selectedYear`, ordered by `start_date ASC`
- Each row: course title, date (dd.mm.yyyy), location (if set), participant count badge
- Click → sets `selectedCourseId` state; first course auto-selected on load
- Empty state: "Nessun corso per il {year}"

### Detail Panel
Shown when a course is selected.

**Header:**
- Course title + subtitle (date range, location, times)
- `✏ Modifica` button → opens `CourseModal` pre-filled
- `🗑 Elimina` button → confirm dialog → deletes course (cascades to `training_participants`; absences FK is `on delete set null`)

**Participants section:**
- Query: `training_participants` joined with `employees` for selected course
- Each participant shown as chip with name + `×` remove button
- Remove: deletes `training_participants` row + deletes linked `absences` row where `training_course_id = courseId AND employee_id = empId`

**Add participant:**
- `<select>` showing active employees not already in this course
- `Aggiungi` button → inserts `training_participants` row + creates `absences` row:
  ```
  type: 'TRAINING'
  status: 'approved'
  start_date: course.start_date
  end_date: course.end_date ?? course.start_date
  training_course_id: course.id
  ```

**Info banner:** "Aggiungendo un partecipante viene creata automaticamente un'assenza TRAINING per quella data."

### CourseModal (new + edit)
Fields:
- `code` (text, required, unique) — short identifier e.g. `TOPKOMP_S1_A`
- `title` (text, required)
- `start_date` (date, required)
- `end_date` (date, optional — defaults to `start_date` if empty)
- `start_time` / `end_time` (time, optional)
- `location` (text, optional)
- `note` (textarea, optional)

Save: upsert on `code`. Cancel closes modal without saving.

---

## Data Flow

```
selectedYear ──► training_courses (filtered) ──► master list
selectedCourseId ──► training_participants + employees ──► chips
                 └──► training_courses (single) ──► detail header

Add participant ──► INSERT training_participants
               └──► INSERT absences (TRAINING)

Remove participant ──► DELETE training_participants
                   └──► DELETE absences WHERE training_course_id + employee_id
```

---

## Routing

Add `/training` route in `router.tsx`. Add "Formazione" entry to `AppShell` navigation.

---

## i18n

Add `training` namespace to i18n with keys: `title`, `description`, `newCourse`, `saveCourse`, `noCoursesYear`, `participants`, `addParticipant`, `courseCode`, `courseTitle`, `location`, `notes`, `confirmDelete`, `autoAbsenceNote`.

---

## Out of Scope

- Bulk import of courses
- Exporting participant lists
- Notifications / reminders for upcoming courses
- Attendance tracking (confirmed field exists in DB but not shown)
