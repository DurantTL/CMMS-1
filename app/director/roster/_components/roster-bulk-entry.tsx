"use client";

import { Gender, MemberRole } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";

import { bulkCreateRosterMembers, type BulkCreateRosterResult } from "../../../actions/roster-actions";

// Column order matches the spreadsheet-paste mapping below.
const COLUMNS = [
  "firstName",
  "lastName",
  "memberRole",
  "dateOfBirth",
  "gender",
  "ageAtStart",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

type ColumnKey = (typeof COLUMNS)[number];
type GridRow = Record<ColumnKey, string>;

const roleOptions = Object.values(MemberRole);
const genderOptions = Object.values(Gender);

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function emptyRow(): GridRow {
  return {
    firstName: "",
    lastName: "",
    memberRole: "",
    dateOfBirth: "",
    gender: "",
    ageAtStart: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  };
}

function isRowEmpty(row: GridRow): boolean {
  return COLUMNS.every((col) => row[col].trim().length === 0);
}

function rowRequiredErrors(row: GridRow): Partial<Record<ColumnKey, true>> {
  const errors: Partial<Record<ColumnKey, true>> = {};
  if (!row.firstName.trim()) errors.firstName = true;
  if (!row.lastName.trim()) errors.lastName = true;
  if (!row.memberRole.trim()) errors.memberRole = true;
  if (!DOB_PATTERN.test(row.dateOfBirth.trim())) errors.dateOfBirth = true;
  return errors;
}

/** Split pasted spreadsheet text into a 2-D grid (tab-delimited, falling back to comma). */
function parseClipboardTable(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Trim a single trailing empty line that spreadsheets often append.
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const delimiter = text.includes("\t") ? "\t" : ",";
  return lines.map((line) => line.split(delimiter));
}

type RosterBulkEntryProps = {
  rosterYearId: string;
  managedClubId: string | null;
};

export function RosterBulkEntry({ rosterYearId, managedClubId }: RosterBulkEntryProps) {
  const t = useTranslations("Director");
  const [rows, setRows] = useState<GridRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [result, formAction] = useFormState<BulkCreateRosterResult | null, FormData>(
    bulkCreateRosterMembers,
    null,
  );

  const updateCell = (rowIndex: number, col: ColumnKey, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [col]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (rowIndex: number) =>
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== rowIndex)));

  // Spreadsheet paste: fill the grid starting at the cell that received the paste.
  const handlePaste = (
    rowIndex: number,
    col: ColumnKey,
    event: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const text = event.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) {
      return; // single value — let the default paste happen
    }
    event.preventDefault();

    const table = parseClipboardTable(text);
    const startCol = COLUMNS.indexOf(col);

    setRows((prev) => {
      const next = [...prev];
      table.forEach((cells, r) => {
        const targetIndex = rowIndex + r;
        while (next.length <= targetIndex) {
          next.push(emptyRow());
        }
        const target = { ...next[targetIndex] };
        cells.forEach((cell, c) => {
          const colKey = COLUMNS[startCol + c];
          if (colKey) {
            target[colKey] = cell.trim();
          }
        });
        next[targetIndex] = target;
      });
      return next;
    });
  };

  const nonEmptyRows = useMemo(() => rows.filter((row) => !isRowEmpty(row)), [rows]);
  const readyCount = useMemo(
    () => nonEmptyRows.filter((row) => Object.keys(rowRequiredErrors(row)).length === 0).length,
    [nonEmptyRows],
  );

  // Only submit rows that are non-empty; the server re-validates and reports per-row issues.
  const rowsPayload = JSON.stringify(nonEmptyRows);

  return (
    <div className="glass-panel space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{t("rosterBulkEntry.title")}</h3>
        <p className="text-sm text-slate-600">{t("rosterBulkEntry.description")}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                t("rosterBulkEntry.columns.firstName"),
                t("rosterBulkEntry.columns.lastName"),
                t("rosterBulkEntry.columns.role"),
                t("rosterBulkEntry.columns.dateOfBirth"),
                t("rosterBulkEntry.columns.gender"),
                t("rosterBulkEntry.columns.age"),
                t("rosterBulkEntry.columns.emergencyName"),
                t("rosterBulkEntry.columns.emergencyPhone"),
                "",
              ].map((header, i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const errors = isRowEmpty(row) ? {} : rowRequiredErrors(row);
              const cellClass = (col: ColumnKey) =>
                `input-glass px-2 py-1 text-sm ${errors[col] ? "border-rose-300 bg-rose-50" : ""}`;

              return (
                <tr key={rowIndex} className="align-top">
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.firstName")}
                      value={row.firstName}
                      onChange={(e) => updateCell(rowIndex, "firstName", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "firstName", e)}
                      className={cellClass("firstName")}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.lastName")}
                      value={row.lastName}
                      onChange={(e) => updateCell(rowIndex, "lastName", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "lastName", e)}
                      className={cellClass("lastName")}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={t("rosterBulkEntry.columns.role")}
                      value={row.memberRole}
                      onChange={(e) => updateCell(rowIndex, "memberRole", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "memberRole", e)}
                      className={`select-glass px-2 py-1 text-sm ${errors.memberRole ? "border-rose-300 bg-rose-50" : ""}`}
                    >
                      <option value="">{t("rosterBulkEntry.selectRole")}</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.dateOfBirth")}
                      placeholder="YYYY-MM-DD"
                      value={row.dateOfBirth}
                      onChange={(e) => updateCell(rowIndex, "dateOfBirth", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "dateOfBirth", e)}
                      className={cellClass("dateOfBirth")}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={t("rosterBulkEntry.columns.gender")}
                      value={row.gender}
                      onChange={(e) => updateCell(rowIndex, "gender", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "gender", e)}
                      className="select-glass px-2 py-1 text-sm"
                    >
                      <option value="">—</option>
                      {genderOptions.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.age")}
                      placeholder={t("rosterBulkEntry.autoAge")}
                      value={row.ageAtStart}
                      onChange={(e) => updateCell(rowIndex, "ageAtStart", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "ageAtStart", e)}
                      className="input-glass w-20 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.emergencyName")}
                      value={row.emergencyContactName}
                      onChange={(e) => updateCell(rowIndex, "emergencyContactName", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "emergencyContactName", e)}
                      className="input-glass px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={t("rosterBulkEntry.columns.emergencyPhone")}
                      value={row.emergencyContactPhone}
                      onChange={(e) => updateCell(rowIndex, "emergencyContactPhone", e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, "emergencyContactPhone", e)}
                      className="input-glass px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      className="btn-ghost rounded-lg px-2 py-1 text-slate-400 hover:text-rose-600"
                      aria-label={t("rosterBulkEntry.removeRow")}
                      title={t("rosterBulkEntry.removeRow")}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addRow} className="btn-secondary">
          {t("rosterBulkEntry.addRow")}
        </button>
        <p className="text-sm text-slate-600">
          {t("rosterBulkEntry.readyCount", { ready: readyCount, total: nonEmptyRows.length })}
        </p>
      </div>

      <p className="text-xs text-slate-500">{t("rosterBulkEntry.consentNote")}</p>

      <form action={formAction} className="flex justify-end">
        <input type="hidden" name="clubRosterYearId" value={rosterYearId} />
        {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} /> : null}
        <input type="hidden" name="rows" value={rowsPayload} />
        <button type="submit" disabled={readyCount === 0} className="btn-primary disabled:opacity-50">
          {t("rosterBulkEntry.submit", { count: readyCount })}
        </button>
      </form>

      {result !== null ? (
        <div
          className={[
            "rounded-lg border px-4 py-3 text-sm",
            result.errors.length > 0 && result.created === 0
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : result.errors.length > 0 || result.skippedDuplicates > 0
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
          ].join(" ")}
        >
          <p className="font-semibold">
            {t("rosterBulkEntry.result", {
              created: result.created,
              skipped: result.skippedDuplicates,
            })}
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {result.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
