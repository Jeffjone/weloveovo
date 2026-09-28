'use client';
import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionStyle } from 'motion/react';
import { useExperience } from './experience';
import s from './scroll-scene.module.css';

/** Native scroll stays in charge; movement is limited to decorative layers. */
export function ScrollScene({
  children,
  variant,
  className = '',
}: {
  children: ReactNode;
  variant: 'sleeves' | 'chronology' | 'city' | 'story';
  className?: string;
}) {
  const target = useRef<HTMLElement>(null);
  const { animated } = useExperience();
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end start'] });
  const travel = useTransform(scrollYProgress, [0, 1], ['36px', '-36px']);
  const turn = useTransform(scrollYProgress, [0, 1], ['-4deg', '4deg']);
  const progress = useTransform(scrollYProgress, [0.12, 0.85], [0, 1]);
  return (
    <motion.section
      ref={target}
      data-scroll-scene={variant}
      data-motion={animated}
      className={`${s.scene} ${s[variant]} ${className}`}
      style={
        {
          '--scene-travel': animated ? travel : '0px',
          '--scene-turn': animated ? turn : '0deg',
          '--scene-progress': animated ? progress : 1,
        } as MotionStyle
      }
    >
      {children}
      <span className={s.progress} aria-hidden="true" />
    </motion.section>
  );
}
