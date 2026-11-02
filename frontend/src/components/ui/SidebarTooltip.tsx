import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface SidebarTooltipProps {
  label: string;
  children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}

interface TooltipPosition {
  left: number;
  top: number;
}

export function SidebarTooltip({ label, children }: SidebarTooltipProps) {
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0 });
  const isOpen = isHovered || isFocused;

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!isRendered || !triggerElement) return;

    const updatePosition = () => {
      const triggerRect = triggerElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      const tooltipWidth = tooltipRect?.width ?? 160;
      const tooltipHeight = tooltipRect?.height ?? 28;
      const edgePadding = 8;
      const gap = 8;
      const rightPosition = triggerRect.right + gap;
      const preferredLeft =
        rightPosition + tooltipWidth <= window.innerWidth - edgePadding
          ? rightPosition
          : triggerRect.left - tooltipWidth - gap;
      const left = Math.min(
        Math.max(edgePadding, preferredLeft),
        Math.max(edgePadding, window.innerWidth - tooltipWidth - edgePadding),
      );
      const top = Math.min(
        Math.max(edgePadding, triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2),
        Math.max(edgePadding, window.innerHeight - tooltipHeight - edgePadding),
      );

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isRendered, triggerElement]);

  const cancelClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
    if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    unmountTimeoutRef.current = null;
  };

  const scheduleUnmount = () => {
    if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    unmountTimeoutRef.current = setTimeout(() => {
      setIsRendered(false);
      unmountTimeoutRef.current = null;
    }, 150);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      closeTimeoutRef.current = null;
      if (!triggerElement?.matches(':focus-visible')) {
        setIsFocused(false);
        scheduleUnmount();
      }
    }, 100);
  };

  const showTooltip = () => {
    cancelClose();
    setIsRendered(true);
  };

  const trigger = (
    <span
      className="contents"
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return;
        const target = event.currentTarget.querySelector('button');
        if (!target) return;
        setTriggerElement(target);
        showTooltip();
        setIsHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') scheduleClose();
      }}
      onFocus={(event) => {
        const target = event.currentTarget.querySelector('button');
        if (!target) return;
        setTriggerElement(target);
        const isKeyboardFocus = target.matches(':focus-visible');
        setIsFocused(isKeyboardFocus);
        if (isKeyboardFocus) showTooltip();
      }}
      onBlur={() => {
        setIsFocused(false);
        if (!isHovered) scheduleUnmount();
      }}
    >
      {children}
    </span>
  );

  return (
    <>
      {trigger}
      {isRendered &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={`sidebar-tooltip${isOpen ? ' sidebar-tooltip-visible' : ''}`}
            style={{ left: position.left, top: position.top }}
            onPointerEnter={(event) => {
              if (event.pointerType === 'touch') return;
              showTooltip();
              setIsHovered(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch') scheduleClose();
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
