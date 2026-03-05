import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChartSize = {
  width: number;
  height: number;
};

type MeasuredChartFrameProps = {
  children: (size: ChartSize) => ReactNode;
  className?: string;
  minHeight?: number;
};

export function MeasuredChartFrame({
  children,
  className,
  minHeight = 288,
}: MeasuredChartFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }

    const measure = () => {
      const nextWidth = Math.round(element.clientWidth);
      const nextHeight = Math.round(element.clientHeight);

      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("min-w-0", className)}
      style={{ minHeight }}
    >
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
