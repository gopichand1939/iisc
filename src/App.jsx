import { useEffect, useMemo, useRef, useState } from 'react';

function parseDateParam(dateValue) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day);
}


// Normalizes a date to midnight to ensure consistent day comparisons
function normalizeDate(dateValue) {
  const next = new Date(dateValue);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getGridLayout(width, height) {
  let best = { rows: 28, cols: 15, dot: 13.5, count: 420 };

  for (let dot = 30; dot >= 23; dot -= 0.5) {
    const cols = Math.max(2, Math.floor((width + 4) / (dot + 4)));
    const rows = Math.max(2, Math.floor((height + 4) / (dot + 4)));
    const gapX = cols > 1 ? (width - cols * dot) / (cols - 1) : 0;
    const gapY = rows > 1 ? (height - rows * dot) / (rows - 1) : 0;

    if (gapX < 2 || gapY < 2) continue;

    const count = rows * cols;
    if (count > best.count || (count === best.count && dot > best.dot)) {
      best = { rows, cols, dot, count };
    }
  }

  return best;
}

export default function App() {
  const gridRef = useRef(null);
  const cardRef = useRef(null);
  const touchTooltipTimeoutRef = useRef(null);
  const [grid, setGrid] = useState({ rows: 30, cols: 16, dot: 8 });
  const [hoveredDot, setHoveredDot] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [today, setToday] = useState(() => normalizeDate(new Date()));

  const dayMs = 24 * 60 * 60 * 1000;
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const goalName = query.get('goal') || 'IISC';
  const fixedStartDate = useMemo(() => new Date(2026, 2, 9), []);
  const startDate = fixedStartDate;
  const targetDate = useMemo(() => new Date(2027, 1, 1), []);

  useEffect(() => {
    const syncToday = () => {
      setToday((prev) => {
        const now = normalizeDate(new Date());
        return now.getTime() === prev.getTime() ? prev : now;
      });
    };

    const timer = setInterval(syncToday, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (touchTooltipTimeoutRef.current) {
        clearTimeout(touchTooltipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const target = gridRef.current;
    if (!target) return;

    const updateGrid = () => {
      const rect = target.getBoundingClientRect();
      const next = getGridLayout(rect.width, rect.height);
      setGrid({ rows: next.rows, cols: next.cols, dot: next.dot });
    };

    updateGrid();
    const observer = new ResizeObserver(updateGrid);
    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  const totalSlots = grid.rows * grid.cols;
  const totalRangeDays = useMemo(() => {
    const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / dayMs);
    return diffDays >= 0 ? diffDays + 1 : 0;
  }, [startDate, targetDate, dayMs]);

  const elapsedDays = useMemo(() => {
    if (today.getTime() < startDate.getTime()) return 0;
    const rawElapsed = Math.floor((today.getTime() - startDate.getTime()) / dayMs) + 1;
    return Math.min(Math.max(rawElapsed, 0), totalRangeDays);
  }, [today, startDate, totalRangeDays, dayMs]);

  const totalDots = Math.min(totalSlots, totalRangeDays);
  const currentDotIndex = totalDots > 0 && elapsedDays > 0 ? Math.min(elapsedDays - 1, totalDots - 1) : -1;
  const filledRows = totalDots > 0 ? Math.ceil(totalDots / grid.cols) : 0;
  const dots = useMemo(() => Array.from({ length: totalDots }), [totalDots]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
    []
  );

  const getDotInfo = (index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      dateLabel: dateFormatter.format(date),
      status:
        index < currentDotIndex ? 'Completed' : index === currentDotIndex ? 'Today' : 'Pending',
      isCurrent: index === currentDotIndex,
      isCompleted: index < currentDotIndex
    };
  };

  const updateHoveredDot = (event) => {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;

    const cardRect = cardRef.current?.getBoundingClientRect();
    if (!cardRect) return;

    const horizontalInset = Math.min(110, Math.max(54, cardRect.width * 0.18));
    const topInset = Math.max(22, cardRect.height * 0.05);
    const bottomInset = Math.max(18, cardRect.height * 0.03);
    const clampedX = Math.min(
      Math.max(event.clientX - cardRect.left, horizontalInset),
      cardRect.width - horizontalInset
    );
    const clampedY = Math.min(
      Math.max(event.clientY - cardRect.top - 8, topInset),
      cardRect.height - bottomInset
    );

    if (touchTooltipTimeoutRef.current) {
      clearTimeout(touchTooltipTimeoutRef.current);
      touchTooltipTimeoutRef.current = null;
    }

    if (event.pointerType && event.pointerType !== 'mouse') {
      touchTooltipTimeoutRef.current = setTimeout(() => {
        setHoveredDot(null);
      }, 1600);
    }

    setHoveredDot({ index, x: clampedX, y: clampedY });
  };

  const triggerReaction = (event) => {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;

    const cardRect = cardRef.current?.getBoundingClientRect();
    if (!cardRect) return;

    const x = Math.min(Math.max(event.clientX - cardRect.left, 72), cardRect.width - 72);
    const y = Math.min(Math.max(event.clientY - cardRect.top, 90), cardRect.height - 90);

    setReaction({
      key: `${index}-${Date.now()}`,
      x,
      y,
      state:
        index < currentDotIndex ? 'completed' : index === currentDotIndex ? 'current' : 'pending'
    });
  };

  useEffect(() => {
    if (!reaction) return undefined;

    const timer = setTimeout(() => {
      setReaction(null);
    }, 1800);

    return () => clearTimeout(timer);
  }, [reaction]);

  const hoveredInfo = hoveredDot ? getDotInfo(hoveredDot.index) : null;
  const daysLeft = Math.max(totalRangeDays - elapsedDays, 0);
  const progress = totalRangeDays > 0 ? Math.floor((elapsedDays / totalRangeDays) * 100) : 0;

  return (
    <main className="viewport">
      <section className="app">
        <header className="top">
          <h1>{goalName} Progress</h1>
        </header>

        <section ref={cardRef} className="progressCard" aria-label="IISC progress card">
          <div
            ref={gridRef}
            className="dotGrid"
            style={{
              '--rows': filledRows,
              '--cols': grid.cols,
              '--dot-size': `${grid.dot}px`
            }}
          >
            {dots.map((_, index) => (
              <span
                key={index}
                data-index={index}
                className={`dot ${index < currentDotIndex ? 'completed' : ''} ${
                  index === currentDotIndex ? 'active' : ''
                }`}
                onPointerEnter={updateHoveredDot}
                onPointerMove={updateHoveredDot}
                onPointerDown={updateHoveredDot}
                onClick={triggerReaction}
                onPointerLeave={() => setHoveredDot(null)}
              />
            ))}
          </div>

          {hoveredDot && hoveredInfo && (
            <div
              className="dotTooltip"
              style={{
                '--tooltip-x': `${hoveredDot.x}px`,
                '--tooltip-y': `${hoveredDot.y}px`
              }}
            >
              <span
                className={`dotIndicator ${
                  hoveredInfo.isCompleted ? 'completed' : hoveredInfo.isCurrent ? 'current' : 'pending'
                }`}
              />
              <span>
                {hoveredInfo.dateLabel} - {hoveredInfo.status}
              </span>
            </div>
          )}

          {reaction && (
            <div
              key={reaction.key}
              className={`motivationBurst ${reaction.state}`}
              style={{
                '--burst-x': `${reaction.x}px`,
                '--burst-y': `${reaction.y}px`
              }}
            >
              <span className="motivationGlow" />
              <span className="motivationPulse" />
            </div>
          )}

          <div className="progressText">{daysLeft}d left - {progress}%</div>
        </section>
      </section>
    </main>
  );
}
