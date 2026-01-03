import { ReactNode, useEffect, useState } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /**
   * Animation type for the page content
   * @default 'fadeIn'
   */
  animation?: 'fadeIn' | 'slideUp' | 'slideInLeft' | 'slideInRight';
  /**
   * Delay in milliseconds before animation starts
   * @default 0
   */
  delay?: number;
  /**
   * Whether to apply animation to children
   * @default true
   */
  animate?: boolean;
}

/**
 * PageTransition component - Wraps page content with consistent animations
 * 
 * Usage:
 * ```tsx
 * <PageTransition animation="slideUp" delay={100}>
 *   <div>Your page content</div>
 * </PageTransition>
 * ```
 */
export const PageTransition = ({
  children,
  className = '',
  animation = 'fadeIn',
  delay = 0,
  animate = true,
}: PageTransitionProps) => {
  const [isVisible, setIsVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setIsVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [animate, delay]);

  const animationClass = animate && isVisible 
    ? `animate-${animation}` 
    : '';

  return (
    <div className={`${animationClass} ${className}`.trim()}>
      {children}
    </div>
  );
};

/**
 * PageSection component - For animating sections within a page with staggered delays
 */
interface PageSectionProps {
  children: ReactNode;
  className?: string;
  /**
   * Animation type
   * @default 'slideUp'
   */
  animation?: 'fadeIn' | 'slideUp' | 'slideInLeft' | 'slideInRight';
  /**
   * Delay multiplier (0 = no delay, 1 = 100ms, 2 = 200ms, etc.)
   * @default 0
   */
  delay?: 0 | 1 | 2 | 3 | 4;
}

export const PageSection = ({
  children,
  className = '',
  animation = 'slideUp',
  delay = 0,
}: PageSectionProps) => {
  const delayClass = delay > 0 ? `animate-delay-${delay}00` : '';
  const animationClass = `animate-${animation}`;

  return (
    <div className={`${animationClass} ${delayClass} ${className}`.trim()}>
      {children}
    </div>
  );
};

export default PageTransition;

