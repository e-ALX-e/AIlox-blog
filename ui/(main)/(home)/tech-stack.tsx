'use client'

import type { Variants } from 'motion/react'
import * as motion from 'motion/react-client'
import { useState } from 'react'
import { useTranslations } from '@/ui/components/provider/main/language-provider'

import {
  BlenderIcon,
  CICDIcon,
  CloudIcon,
  DockerIcon,
  GoIcon,
  LinuxIcon,
  PythonIcon,
} from './assets/minimal-tech-icons'

const techStackData = [
  { name: 'Go', Icon: GoIcon },
  { name: 'Python', Icon: PythonIcon },
  { name: 'Blender', Icon: BlenderIcon },
  { name: 'Docker', Icon: DockerIcon },
  { name: 'Linux', Icon: LinuxIcon },
  { name: 'CI/CD', Icon: CICDIcon },
  { name: 'Cloud', Icon: CloudIcon },
]

const techStackVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
}

const techStackItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

function getFocusState(index: number, activeIndex: number | null) {
  if (activeIndex == null) {
    return {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: 'blur(0px)',
    }
  }

  const distance = Math.abs(index - activeIndex)

  if (distance === 0) {
    return {
      opacity: 1,
      scale: 1.34,
      y: -5,
      filter: 'blur(0px)',
    }
  }

  if (distance === 1) {
    return {
      opacity: 0.72,
      scale: 1.1,
      y: -2,
      filter: 'blur(0px)',
    }
  }

  return {
    opacity: 0.38,
    scale: 0.92,
    y: 0,
    filter: 'blur(0.45px)',
  }
}

export default function TechStack() {
  const translations = useTranslations()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeName = activeIndex == null ? '' : techStackData[activeIndex]?.name ?? ''
  const activeLeft = activeIndex == null ? 12 : activeIndex * 34 + 12

  return (
    <motion.ul
      aria-label={translations.home.techStackLabel}
      className="relative mt-[21px] grid grid-cols-7 gap-[10px]"
      variants={techStackVariants}
      onMouseLeave={() => {
        setActiveIndex(null)
      }}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -top-9 z-30 overflow-hidden whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-3 py-1.5 font-mono text-[10px] text-zinc-700 tracking-wide shadow-[0_10px_30px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.62),inset_0_-1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/[0.025] backdrop-blur-[24px] backdrop-saturate-200 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_24%_8%,rgba(255,255,255,0.5),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] before:content-[''] after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[inherit] after:border after:border-white/18 after:content-[''] dark:border-white/14 dark:bg-black/10 dark:text-zinc-100 dark:ring-white/[0.025] dark:shadow-[0_10px_34px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.14)] dark:before:bg-[radial-gradient(circle_at_24%_8%,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] dark:after:border-white/7"
        style={{ x: '-50%' }}
        animate={{
          left: activeLeft,
          opacity: activeIndex == null ? 0 : 1,
          y: activeIndex == null ? 3 : 0,
        }}
        transition={{
          left: { type: 'spring', stiffness: 430, damping: 32, mass: 0.55 },
          opacity: { duration: 0.16 },
          y: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
        }}
      >
        <span className="relative z-10">{activeName}</span>
      </motion.span>

      {techStackData.map(({ Icon, name }, index) => (
        <motion.li
          key={name}
          tabIndex={0}
          className="relative size-6 cursor-default rounded-md outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background dark:focus-visible:ring-white/40"
          variants={techStackItemVariants}
          animate={getFocusState(index, activeIndex)}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 28,
            mass: 0.55,
          }}
          onMouseEnter={() => {
            setActiveIndex(index)
          }}
          onFocus={() => {
            setActiveIndex(index)
          }}
          onBlur={() => {
            setActiveIndex(null)
          }}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-7px] -z-10 rounded-xl bg-black/[0.055] dark:bg-white/[0.08]"
            initial={false}
            animate={{
              opacity: activeIndex === index ? 1 : 0,
              scale: activeIndex === index ? 1 : 0.72,
            }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 30,
            }}
          />

          <Icon
            role="img"
            aria-label={name}
            className="size-full"
          />
        </motion.li>
      ))}
    </motion.ul>
  )
}
