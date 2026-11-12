import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BlockAnchor, ScreenHeading, type BlockLink } from "./parts";

/** One figure the screen leads with, read from the product's own records, and how it moved where it has a past. */
export type DashboardStat = {
  label: string;
  value: string;
  /** How it moved, such as "+12% on last week". */
  change?: string;
  trend?: "up" | "down" | "flat";
  icon?: LucideIcon;
};

/** A figure over time (by day, week or month) from the product's records. */
export type DashboardChart = {
  title: string;
  description?: string;
  points: readonly { label: string; value: number }[];
  /**
   * How a value reads, such as a currency, with its locale named (`Intl.NumberFormat("de-DE", …)`), since the server and a
   * visitor's browser read an unnamed one differently; a plain number otherwise.
   */
  format?: (value: number) => string;
  /** Shown where there are no points yet. */
  empty: string;
};

/** The newest records as rows, each cell already written as it should read; a phone leaves out `hideOnPhone` columns. */
export type DashboardTable = {
  title: string;
  description?: string;
  columns: readonly { key: string; label: string; align?: "start" | "end"; hideOnPhone?: boolean }[];
  rows: readonly ({ id: string } & Record<string, ReactNode>)[];
  /** Shown where there are no rows yet. */
  empty: string;
  /** A link to all of them, such as the list screen. */
  action?: BlockLink;
};

const trends = {
  up: { icon: TrendingUp, className: "text-primary" },
  down: { icon: TrendingDown, className: "text-destructive" },
  flat: { icon: Minus, className: "text-muted-foreground" },
} as const;

function Bars({ chart }: { chart: DashboardChart }) {
  const format = chart.format ?? String;
  const top = Math.max(0, ...chart.points.map((point) => point.value));
  if (!chart.points.length) return <p className="py-16 text-center text-sm text-muted-foreground">{chart.empty}</p>;
  return (
    <figure className="flex flex-col gap-3">
      <div aria-hidden className="flex h-56 items-stretch gap-2 sm:gap-3">
        {chart.points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs text-muted-foreground tabular-nums max-sm:hidden">{format(point.value)}</span>
              <div
                className="w-full max-w-12 rounded-t-md bg-primary"
                style={{ height: `${top > 0 ? Math.max((point.value / top) * 100, point.value > 0 ? 2 : 0) : 0}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-xs text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{chart.title}</caption>
        <tbody>
          {chart.points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * A product's home screen: its title row, the figures it leads with as cards, a chart of one figure over time beside an
 * optional panel (`aside`, such as today's list), and its newest records as a table. Every figure comes from the
 * product's own records; with none yet, each part says so in its `empty` words.
 */
export function DashboardOverview({
  title,
  description,
  actions,
  stats,
  chart,
  aside,
  table,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  stats: readonly DashboardStat[];
  chart?: DashboardChart;
  /** A card of its own beside the chart. */
  aside?: ReactNode;
  table?: DashboardTable;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ScreenHeading title={title} description={description} actions={actions} />
      {stats.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const trend = stat.trend && trends[stat.trend];
            return (
              <li key={stat.label}>
                <Card className="gap-3 py-5">
                  <CardHeader className="px-5">
                    <CardDescription>{stat.label}</CardDescription>
                    {Icon && (
                      <CardAction>
                        <Icon aria-hidden className="size-4 text-muted-foreground" />
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 px-5">
                    <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums [font-synthesis-weight:none]">{stat.value}</span>
                    {stat.change && (
                      <span className={cn("flex items-center gap-1 text-sm", trend?.className ?? "text-muted-foreground")}>
                        {trend && <trend.icon aria-hidden className="size-4" />}
                        {stat.change}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {(chart || aside) && (
        <div className={cn("grid gap-6", chart && aside && "lg:grid-cols-3")}>
          {chart && (
            <Card className={cn(aside && "lg:col-span-2")}>
              <CardHeader>
                <CardTitle>
                  <h2>{chart.title}</h2>
                </CardTitle>
                {chart.description && <CardDescription>{chart.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Bars chart={chart} />
              </CardContent>
            </Card>
          )}
          {aside}
        </div>
      )}
      {table && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{table.title}</h2>
            </CardTitle>
            {table.description && <CardDescription>{table.description}</CardDescription>}
            {table.action && (
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <BlockAnchor href={table.action.href}>{table.action.label}</BlockAnchor>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {table.rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.columns.map((column) => (
                      <TableHead key={column.key} className={cn(column.align === "end" && "text-right", column.hideOnPhone && "max-sm:hidden")}>
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row) => (
                    <TableRow key={row.id}>
                      {table.columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(column.align === "end" && "text-right tabular-nums", column.hideOnPhone && "max-sm:hidden")}
                        >
                          {row[column.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{table.empty}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
