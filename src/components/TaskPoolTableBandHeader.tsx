import {
  TASK_POOL_TABLE_BAND_HEADER_CLASS,
  TASK_POOL_TABLE_BAND_LABEL,
  type TaskPoolTableBand,
} from '@/lib/taskPoolTableBands';

type Props = {
  band: TaskPoolTableBand;
  count: number;
  colSpan: number;
};

export default function TaskPoolTableBandHeader({ band, count, colSpan }: Props) {
  return (
    <tr className={TASK_POOL_TABLE_BAND_HEADER_CLASS[band]}>
      <td colSpan={colSpan} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {TASK_POOL_TABLE_BAND_LABEL[band]}
        <span className="ml-2 font-normal normal-case text-muted-foreground">({count})</span>
      </td>
    </tr>
  );
}
