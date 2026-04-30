type Props = {
  snapshotDate: string;
  holderCount: number;
};

/**
 * Always-visible disclaimers above the criteria list. Plain text — no
 * decorative icons. Snapshot date and holder count are passed in so the
 * banner reflects the baked-in data without runtime fetches.
 */
export const Disclaimers = ({ snapshotDate, holderCount }: Props) => {
  // Format snapshotDate (ISO) into a more human-readable UTC line. We do NOT
  // localize to the viewer because the snapshot is a global, immutable claim.
  const human = (() => {
    try {
      const d = new Date(snapshotDate);
      return d.toUTCString();
    } catch {
      return snapshotDate;
    }
  })();

  return (
    <div className="alert alert-warning bg-warning/15 border border-warning/40 text-base-content w-full">
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>
          Holder snapshot as of <span className="font-semibold">{human}</span> ({holderCount} holders).
        </li>
        <li>New holders after this date are not included.</li>
        <li>Ties are broken randomly.</li>
        <li>Made by one community member with the help of LeftClaw Services beta. Use at your own risk.</li>
      </ul>
    </div>
  );
};
