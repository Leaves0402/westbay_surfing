import type { PublicMemberProfile } from "@/lib/types";

type AttendanceStat = {
  member: PublicMemberProfile;
  count: number;
  total: number;
};

export function buildAttendanceCsv(stats: AttendanceStat[]) {
  const rows = [
    ["姓名", "學號", "程度", "出席次數", "社課次數"],
    ...stats.map(({ member, count, total }) => [
      member.full_name || "未填姓名",
      member.student_id ?? "",
      member.surf_level ?? "",
      String(count),
      String(total),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map((value) => {
    // Spreadsheet apps must treat member-entered values as text, not formulas.
    const text = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n")}`;
}
