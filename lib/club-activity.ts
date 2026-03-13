type ActivitySummaryInput = {
  pathfinderAttendance: number;
  staffAttendance: number;
  uniformCompliance: number;
};

type ExistingReportInput = {
  meetingCount: number;
  averagePathfinderAttendance: number;
  averageStaffAttendance: number;
  uniformCompliance: number;
} | null;

export type MonthlyReportFormValues = {
  meetingCount: number;
  averagePathfinderAttendance: number;
  averageStaffAttendance: number;
  uniformCompliance: number;
};

export type ClubActivityAutoFill = MonthlyReportFormValues & {
  activityCount: number;
};

function roundAverage(total: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Math.round(total / count);
}

export function parseMonthInput(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  const [yearPart, monthPart] = value.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Month input is invalid.");
  }

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export function getMonthWindow(monthStart: Date) {
  return {
    monthStart,
    monthEndExclusive: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
  };
}

export function formatMonthInputValue(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function formatDateInputValue(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function buildClubActivityAutoFill(activities: ActivitySummaryInput[]): ClubActivityAutoFill {
  if (activities.length === 0) {
    return {
      activityCount: 0,
      meetingCount: 0,
      averagePathfinderAttendance: 0,
      averageStaffAttendance: 0,
      uniformCompliance: 0,
    };
  }

  const totals = activities.reduce(
    (accumulator, activity) => ({
      pathfinders: accumulator.pathfinders + activity.pathfinderAttendance,
      staff: accumulator.staff + activity.staffAttendance,
      uniformCompliance: accumulator.uniformCompliance + activity.uniformCompliance,
    }),
    {
      pathfinders: 0,
      staff: 0,
      uniformCompliance: 0,
    },
  );

  return {
    activityCount: activities.length,
    meetingCount: activities.length,
    averagePathfinderAttendance: roundAverage(totals.pathfinders, activities.length),
    averageStaffAttendance: roundAverage(totals.staff, activities.length),
    uniformCompliance: roundAverage(totals.uniformCompliance, activities.length),
  };
}

export function buildMonthlyReportFormValues(
  existingReport: ExistingReportInput,
  autoFill: ClubActivityAutoFill,
): MonthlyReportFormValues {
  if (existingReport) {
    return {
      meetingCount: existingReport.meetingCount,
      averagePathfinderAttendance: existingReport.averagePathfinderAttendance,
      averageStaffAttendance: existingReport.averageStaffAttendance,
      uniformCompliance: existingReport.uniformCompliance,
    };
  }

  return {
    meetingCount: autoFill.meetingCount,
    averagePathfinderAttendance: autoFill.averagePathfinderAttendance,
    averageStaffAttendance: autoFill.averageStaffAttendance,
    uniformCompliance: autoFill.uniformCompliance,
  };
}
