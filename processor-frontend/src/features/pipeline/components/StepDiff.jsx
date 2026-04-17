// Per-step diff display: added / modified / removed paths inside a shadcn Accordion.
// Long paths are truncated with native title tooltip (avoids tooltip provider plumbing).
import React from "react"
import { Plus, Pencil, Minus } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

function FileList({ paths, Icon, color }) {
  if (!paths || paths.length === 0) return null
  return (
    <ul className="space-y-1">
      {paths.map((p, i) => (
        <li
          key={`${p}-${i}`}
          className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-zinc-900/60"
          title={p}
        >
          <Icon className={cn("h-3 w-3 shrink-0", color)} />
          <span className="truncate font-mono text-zinc-300">{p}</span>
        </li>
      ))}
    </ul>
  )
}

export default function StepDiff({ diff, defaultOpen = false }) {
  if (!diff) return null
  const added = diff.added || []
  const modified = diff.modified || []
  const removed = diff.removed || []
  const total = added.length + modified.length + removed.length
  if (total === 0) return null

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "diff" : undefined}
      className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3"
    >
      <AccordionItem value="diff" className="border-0">
        <AccordionTrigger className="text-xs text-zinc-400">
          <span className="flex items-center gap-3">
            <span>Cambios en disco</span>
            <span className="flex items-center gap-2 text-[11px] text-zinc-500">
              {added.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Plus className="h-3 w-3" />
                  {added.length}
                </span>
              )}
              {modified.length > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Pencil className="h-3 w-3" />
                  {modified.length}
                </span>
              )}
              {removed.length > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <Minus className="h-3 w-3" />
                  {removed.length}
                </span>
              )}
              {diff.truncated && <span className="text-zinc-500">(truncado)</span>}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pb-2">
            <FileList paths={added} Icon={Plus} color="text-emerald-400" />
            <FileList paths={modified} Icon={Pencil} color="text-amber-400" />
            <FileList paths={removed} Icon={Minus} color="text-red-400" />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
