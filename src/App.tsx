import { useCallback, useRef, useState, useEffect } from "react";
import clsx from "clsx";

class DOMVector {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly magnitudeX: number,
    readonly magnitudeY: number,
  ) {
    this.x = x;
    this.y = y;
    this.magnitudeX = magnitudeX;
    this.magnitudeY = magnitudeY;
  }

  getDiagonalLength(): number {
    return Math.sqrt(
      Math.pow(this.magnitudeX, 2) + Math.pow(this.magnitudeY, 2),
    );
  }

  toDOMRect(): DOMRect {
    return new DOMRect(
      Math.min(this.x, this.x + this.magnitudeX),
      Math.min(this.y, this.y + this.magnitudeY),
      Math.abs(this.magnitudeX),
      Math.abs(this.magnitudeY),
    );
  }

  add(vector: DOMVector): DOMVector {
    return new DOMVector(
      this.x + vector.x,
      this.y + vector.y,
      this.magnitudeX + vector.magnitudeX,
      this.magnitudeY + vector.magnitudeY,
    );
  }

  clamp(vector: DOMRect): DOMVector {
    return new DOMVector(
      this.x,
      this.y,
      Math.min(vector.width - this.x, this.magnitudeX),
      Math.min(vector.height - this.y, this.magnitudeY),
    );
  }

  toTerminalPoint(): DOMPoint {
    return new DOMPoint(this.x + this.magnitudeX, this.y + this.magnitudeY);
  }
}

function intersect(rect1: DOMRect, rect2: DOMRect) {
  if (rect1.right < rect2.left || rect2.right < rect1.left) return false;

  if (rect1.bottom < rect2.top || rect2.bottom < rect1.top) return false;

  return true;
}

function App() {
  const items = Array.from({ length: 300 }, (_, i) => i + "");

  const [dragVector, setDragVector] = useState<DOMVector | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [isDragging, setIsDragging] = useState(false);
  const [scrollVector, setScrollVector] = useState<DOMVector | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectionRect =
    dragVector && scrollVector && isDragging && containerRef.current
      ? dragVector
          .add(scrollVector)
          .clamp(
            new DOMRect(
              0,
              0,
              containerRef.current.scrollWidth,
              containerRef.current.scrollHeight,
            ),
          )
          .toDOMRect()
      : null;

  const updateSelectedItems = useCallback(function updateSelectedItems(
    dragVector: DOMVector,
    scrollVector: DOMVector,
  ) {
    if (containerRef.current == null) return;
    const next: Record<string, boolean> = {};
    const containerRect = containerRef.current.getBoundingClientRect();

    containerRef.current.querySelectorAll("[data-item]").forEach((el) => {
      if (containerRef.current == null || !(el instanceof HTMLElement)) return;

      const itemRect = el.getBoundingClientRect();
      const x = itemRect.x - containerRect.x + containerRef.current.scrollLeft;
      const y = itemRect.y - containerRect.y + containerRef.current.scrollTop;
      const translatedItemRect = new DOMRect(
        x,
        y,
        itemRect.width,
        itemRect.height,
      );

      if (
        !intersect(dragVector.add(scrollVector).toDOMRect(), translatedItemRect)
      )
        return;

      if (el.dataset.item && typeof el.dataset.item === "string") {
        next[el.dataset.item] = true;
      }
    });

    setSelectedItems(next);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let handle = requestAnimationFrame(scrollTheLad);

    return () => cancelAnimationFrame(handle);

    function clamp(num: number, min: number, max: number) {
      return Math.min(Math.max(num, min), max);
    }

    function scrollTheLad() {
      if (containerRef.current == null || dragVector == null) return;

      const currentPointer = dragVector.toTerminalPoint();
      const containerRect = containerRef.current.getBoundingClientRect();

      const shouldScrollRight = containerRect.width - currentPointer.x < 20;
      const shouldScrollLeft = currentPointer.x < 20;
      const shouldScrollDown = containerRect.height - currentPointer.y < 20;
      const shouldScrollUp = currentPointer.y < 20;

      const left = shouldScrollRight
        ? clamp(20 - containerRect.width + currentPointer.x, 0, 15)
        : shouldScrollLeft
          ? -1 * clamp(20 - currentPointer.x, 0, 15)
          : undefined;

      const top = shouldScrollDown
        ? clamp(20 - containerRect.height + currentPointer.y, 0, 15)
        : shouldScrollUp
          ? -1 * clamp(20 - currentPointer.y, 0, 15)
          : undefined;

      if (top === undefined && left === undefined) {
        handle = requestAnimationFrame(scrollTheLad);
        return;
      }

      containerRef.current.scrollBy({
        left,
        top,
      });
      handle = requestAnimationFrame(scrollTheLad);
    }
  }, [isDragging, dragVector, updateSelectedItems]);

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div className="px-2 border-2 border-black">selectable area</div>
        {Object.keys(selectedItems).length > 0 && (
          <div className="px-2 border-2 border-black">
            count: {Object.keys(selectedItems).length}
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        className={clsx(
          "relative max-h-96 overflow-auto z-10 grid grid-cols-[repeat(20,min-content)] gap-4 p-4",
          "border-2 border-black select-none -translate-y-0.5 focus:outline-none focus:border-dashed",
        )}
        tabIndex={-1}
        onScroll={(e) => {
          if (dragVector == null || scrollVector == null) return;
          const { scrollLeft, scrollTop } = e.currentTarget;
          const nextScrollVector = new DOMVector(
            scrollVector.x,
            scrollVector.y,
            scrollLeft - scrollVector.x,
            scrollTop - scrollVector.y,
          );
          setScrollVector(nextScrollVector);
          updateSelectedItems(dragVector, nextScrollVector);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setSelectedItems({});
            setDragVector(null);
          }
          setScrollVector(null);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;

          const containerRect = e.currentTarget.getBoundingClientRect();
          setDragVector(
            new DOMVector(
              e.clientX - containerRect.x,
              e.clientY - containerRect.y,
              0,
              0,
            ),
          );
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrollVector(
            new DOMVector(
              e.currentTarget.scrollLeft,
              e.currentTarget.scrollTop,
              0,
              0,
            ),
          );
        }}
        onPointerMove={(e) => {
          if (dragVector == null || scrollVector == null) return;
          const containerRect = e.currentTarget.getBoundingClientRect();
          const nextDragVector = new DOMVector(
            dragVector.x,
            dragVector.y,
            e.clientX - containerRect.x - dragVector.x,
            e.clientY - containerRect.y - dragVector.y,
          );
          if (!isDragging && nextDragVector.getDiagonalLength() < 10) return;
          setIsDragging(true);
          containerRef.current?.focus();
          setDragVector(nextDragVector);
          updateSelectedItems(nextDragVector, scrollVector);
        }}
        onPointerUp={() => {
          if (!isDragging) {
            setSelectedItems({});
            setDragVector(null);
          } else {
            setDragVector(null);
            setIsDragging(false);
          }
          setScrollVector(null);
        }}
      >
        {items.map((item) => (
          <div
            className={clsx(
              "border-2 size-10 border-black flex justify-center items-center",
              selectedItems[item]
                ? "bg-black text-white"
                : "bg-white text-black",
            )}
            key={item}
            data-item={item}
          >
            {item}
          </div>
        ))}
        {selectionRect && (
          <div
            className="absolute border-black border-2 bg-black/30"
            style={{
              top: selectionRect.y,
              left: selectionRect.x,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          ></div>
        )}
      </div>
    </div>
  );
}

export default App;
