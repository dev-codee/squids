import { PPC_STATUS_META, type PpcPermissionStatus } from "@/lib/ppc";

/** Status pill shared by the directory, the queue, and the detail header. */
export default function PpcStatusBadge({
  status,
  showHint = false,
}: {
  status: PpcPermissionStatus;
  showHint?: boolean;
}) {
  const meta = PPC_STATUS_META[status];
  return (
    <span
      title={showHint ? meta.hint : undefined}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
