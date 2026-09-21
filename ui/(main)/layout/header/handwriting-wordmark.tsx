'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils/common/shadcn'
import {
  AILOXI_DOT_FILL,
  AILOXI_MAIN_FILL,
  AILOXI_RING_FILL,
} from './ailoxi-wordmark-paths'

// The visible logo is the exact original filled vector.
// These paths are only an invisible animated mask following its centerline.
const A_MAIN = 'M324.0 599.0 L514.0 405.0 L520.0 388.0 L544.0 384.0 L551.0 367.0 L714.0 207.0 L762.0 166.0 L797.0 146.0 L810.0 145.0 L816.0 147.0 L821.0 152.0 L825.0 162.0 L825.0 181.0 L812.0 231.0 L759.0 386.0 L751.0 424.0 L746.0 428.0 L736.0 487.0 L736.0 513.0 L743.0 531.0 L752.0 539.0 L760.0 541.0 L776.0 539.0 L800.0 526.0 L855.0 480.0 L875.0 474.0'
const A_CROSS = 'M186.0 515.0 L196.0 501.0 L218.0 480.0 L281.0 440.0 L317.0 423.0 L361.0 407.0 L436.0 390.0 L494.0 385.0 L513.0 385.0 L523.0 388.0 L544.0 384.0 L551.0 388.0 L603.0 394.0 L752.0 426.0 L798.0 429.0'
const BODY = 'M894.0 444.0 L876.0 472.0 L878.0 478.0 L877.0 501.0 L879.0 512.0 L886.0 526.0 L892.0 532.0 L904.0 538.0 L926.0 538.0 L941.0 534.0 L984.0 508.0 L1029.0 472.0 L1046.0 467.0 L1049.0 464.0 L1052.0 449.0 L1059.0 433.0 L1057.0 428.0 L1059.0 407.0 L1074.0 362.0 L1099.0 305.0 L1125.0 258.0 L1156.0 214.0 L1194.0 175.0 L1212.0 164.0 L1233.0 162.0 L1239.0 164.0 L1245.0 171.0 L1247.0 192.0 L1236.0 225.0 L1213.0 266.0 L1175.0 318.0 L1128.0 373.0 L1076.0 427.0 L1061.0 431.0 L1056.0 438.0 L1048.0 465.0 L1051.0 472.0 L1051.0 485.0 L1055.0 506.0 L1067.0 527.0 L1080.0 539.0 L1093.0 546.0 L1106.0 549.0 L1120.0 549.0 L1143.0 544.0 L1183.0 525.0 L1237.0 489.0 L1256.0 485.0 L1280.0 461.0 L1297.0 455.0 L1315.0 470.0 L1347.0 478.0 L1344.0 493.0 L1336.0 506.0 L1319.0 526.0 L1303.0 539.0 L1286.0 545.0 L1275.0 545.0 L1264.0 541.0 L1257.0 533.0 L1253.0 522.0 L1256.0 485.0 L1280.0 461.0 L1298.0 454.0 L1302.0 435.0 L1312.0 426.0 L1322.0 422.0 L1343.0 424.0 L1354.0 434.0 L1358.0 445.0 L1357.0 474.0 L1362.0 476.0 L1390.0 474.0 L1422.0 467.0 L1460.0 451.0 L1483.0 444.0 L1507.0 443.0 L1517.0 446.0 L1540.0 461.0 L1606.0 531.0 L1621.0 540.0 L1632.0 543.0 L1664.0 541.0 L1689.0 532.0 L1736.0 506.0 L1800.0 460.0 L1821.0 454.0'
const X_CROSS = 'M1448.0 602.0 L1505.0 542.0 L1573.0 479.0 L1634.0 432.0 L1653.0 421.0 L1663.0 419.0'
const FINAL_I = 'M1833.0 437.0 L1822.0 452.0 L1819.0 479.0 L1819.0 508.0 L1822.0 520.0 L1830.0 534.0 L1840.0 543.0 L1850.0 548.0 L1874.0 552.0 L1908.0 545.0 L1952.0 523.0 L1986.0 498.0'
const RING = 'M1924.0 305.0 L1919.0 297.0 L1906.0 286.0 L1896.0 283.0 L1882.0 283.0 L1872.0 286.0 L1861.0 293.0 L1851.0 307.0 L1849.0 322.0 L1852.0 335.0 L1864.0 349.0 L1878.0 357.0 L1893.0 360.0 L1912.0 359.0 L1928.0 354.0 L1949.0 343.0 L1962.0 334.0 L1977.0 319.0'

const MASK_STROKE_WIDTH = 60

const writingStrokes = [
  // The A main stroke passes very close to the cross stroke. Use a tighter
  // reveal mask here so the cross stroke cannot peek through early.
  { d: A_MAIN, duration: 0.58, maskStrokeWidth: 32, advance: 0.61 },
  { d: A_CROSS, duration: 0.30, maskStrokeWidth: MASK_STROKE_WIDTH, advance: 0.22 },
  { d: BODY, duration: 1.08, maskStrokeWidth: MASK_STROKE_WIDTH, advance: 0.78 },
  { d: X_CROSS, duration: 0.24, maskStrokeWidth: MASK_STROKE_WIDTH, advance: 0.17 },
  { d: FINAL_I, duration: 0.34, maskStrokeWidth: MASK_STROKE_WIDTH, advance: 0.24 },
] as const

export function HandwritingWordmark({
  className,
  delay = 0,
  isVisible,
}: {
  className?: string
  delay?: number
  isVisible: boolean
}) {
  const shouldReduceMotion = useReducedMotion()
  const rawMaskId = useId()
  const maskId = `ailoxi-write-${rawMaskId.replace(/:/g, '')}`

  let strokeDelay = delay

  const strokeTimings = writingStrokes.map(stroke => {
    const currentDelay = strokeDelay
    strokeDelay += stroke.advance
    return { ...stroke, delay: currentDelay }
  })

  const dotDelay = strokeDelay + 0.03
  const ringDelay = dotDelay + 0.14

  return (
    <motion.svg
      aria-label="Ailoxi"
      role="img"
      className={cn(
        'h-5 w-16 overflow-visible sm:h-7 sm:w-[5.5rem]',
        className,
      )}
      viewBox="164 117 1845 511"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="2172"
          height="724"
        >
          <rect x="0" y="0" width="2172" height="724" fill="black" />

          {strokeTimings.map((stroke, index) => (
            <motion.path
              key={index}
              d={stroke.d}
              fill="none"
              stroke="white"
              strokeWidth={stroke.maskStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={
                shouldReduceMotion || isVisible
                  ? { pathLength: 1, opacity: 1 }
                  : { pathLength: 0, opacity: 0 }
              }
              transition={{
                pathLength: {
                  delay: shouldReduceMotion ? 0 : stroke.delay,
                  duration: shouldReduceMotion ? 0 : stroke.duration,
                  ease: [0.4, 0, 0.2, 1],
                },
                opacity: {
                  delay: shouldReduceMotion ? 0 : stroke.delay,
                  duration: shouldReduceMotion ? 0 : 0.05,
                },
              }}
            />
          ))}

          {/* First i dot: dots are added after the word body, like real handwriting. */}
          <motion.circle
            cx="933.5"
            cy="360.5"
            r="30"
            fill="white"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={
              shouldReduceMotion || isVisible
                ? { scale: 1, opacity: 1 }
                : { scale: 0, opacity: 0 }
            }
            transition={{
              delay: shouldReduceMotion ? 0 : dotDelay,
              duration: shouldReduceMotion ? 0 : 0.16,
              ease: [0.16, 1, 0.3, 1],
            }}
          />

          {/* Final i open-ring dot. */}
          <motion.path
            d={RING}
            fill="none"
            stroke="white"
            strokeWidth={MASK_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={
              shouldReduceMotion || isVisible
                ? { pathLength: 1, opacity: 1 }
                : { pathLength: 0, opacity: 0 }
            }
            transition={{
              pathLength: {
                delay: shouldReduceMotion ? 0 : ringDelay,
                duration: shouldReduceMotion ? 0 : 0.28,
                ease: [0.4, 0, 0.2, 1],
              },
              opacity: {
                delay: shouldReduceMotion ? 0 : ringDelay,
                duration: shouldReduceMotion ? 0 : 0.05,
              },
            }}
          />
        </mask>
      </defs>

      <g
      mask={`url(#${maskId})`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={18}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={AILOXI_MAIN_FILL} fillRule="evenodd" />
      <path d={AILOXI_DOT_FILL} fillRule="evenodd" />
      <path d={AILOXI_RING_FILL} fillRule="evenodd" />
    </g>
    </motion.svg>
  )
}
