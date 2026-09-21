'use client'

import type { Variants } from 'motion/react'
import * as motion from 'motion/react-client'
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

export default function TechStack() {
  const translations = useTranslations()

  return (
    <motion.ul
      aria-label={translations.home.techStackLabel}
      className="mt-[21px] grid grid-cols-7 gap-[10px]"
      variants={techStackVariants}
    >
      {techStackData.map(({ Icon, name }) => (
        <motion.li
          key={name}
          title={name}
          className="size-6"
          variants={techStackItemVariants}
        >
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