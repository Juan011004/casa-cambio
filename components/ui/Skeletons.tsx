import { motion } from 'framer-motion'

export function SkeletonCard() {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.2, repeat: Infinity }}
      className="card-pro space-y-3 p-6"
    >
      <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="h-8 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
      <div className="h-2.5 w-20 rounded-full bg-slate-100 dark:bg-slate-800/80" />
    </motion.div>
  )
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card-pro overflow-hidden">
      <div className="flex gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-slate-200 dark:bg-slate-800"
            style={{ width: `${60 + ((i * 37) % 80)}px` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-t border-slate-200 px-4 py-3.5 dark:border-slate-800"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 rounded-md bg-slate-200 dark:bg-slate-800/90"
              style={{ width: `${50 + (((r + c) * 41) % 90)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
