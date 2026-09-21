'use client'

import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { getRemainingDaysOfYear, getYearProgress } from '@/lib/utils/common/time'

function getTodayProgress() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)

  const values: Record<string, number> = {}

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value)
    }
  }

  const elapsedMs =
    ((values.hour ?? 0) * 60 * 60 + (values.minute ?? 0) * 60 + (values.second ?? 0)) * 1000 +
    now.getMilliseconds()

  return (elapsedMs / 86_400_000) * 100
}

export const YearSummary: FC<{ year: number; dayOfYear: number }> = ({ year, dayOfYear }) => {
  const [todayProgress, setTodayProgress] = useState(() => getTodayProgress())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodayProgress(getTodayProgress())
    }, 100)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <section className="text-center text-lg">
      <h2 className="font-semibold">
        今天是 <span className="text-theme-ring">{year}</span> 的第{' '}
        <span className="text-theme-accent">{dayOfYear}</span> 天
      </h2>
      <p>
        今年已经过去了 <span className="font-bold text-pink-400">{getYearProgress().passed}%</span>{' '}
        距离今年结束还有 <span className="font-bold text-pink-400">{getRemainingDaysOfYear()}</span>{' '}
        天
      </p>
      <p className="mt-1">
        今天已经过去了{' '}
        <span className="font-bold font-mono text-theme-accent tabular-nums">
          {todayProgress.toFixed(5)}%
        </span>
      </p>
    </section>
  )
}
