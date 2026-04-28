import { useEffect, useRef, useState } from 'react';

interface Props {
  scrollContainer?: HTMLElement | null;
}

export function ScrollToTopButton({ scrollContainer }: Props) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [atBottom, setAtBottom] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      const scrollHeight = scrollContainer
        ? scrollContainer.scrollHeight - scrollContainer.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;

      if (scrollHeight <= 0) {
        setVisible(false);
        setProgress(0);
        return;
      }

      const ratio = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      setProgress(ratio);
      setVisible(scrollTop > 150);
      setAtBottom(ratio > 0.9);
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    const target = scrollContainer ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      target.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainer]);

  const handleClick = () => {
    if (atBottom) {
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  if (!visible) return null;

  const SIZE = 44;
  const RADIUS = 18;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <button
      onClick={handleClick}
      aria-label={atBottom ? 'العودة للأعلى' : 'النزول للأسفل'}
      title={atBottom ? 'العودة للأعلى' : 'النزول للأسفل'}
      className="flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all duration-200"
      style={{ width: SIZE, height: SIZE, position: 'relative' }}
    >
      <svg
        width={SIZE + 8}
        height={SIZE + 8}
        viewBox={`0 0 ${SIZE + 8} ${SIZE + 8}`}
        className="absolute inset-0 -m-1"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={(SIZE + 8) / 2}
          cy={(SIZE + 8) / 2}
          r={RADIUS + 2}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />
        <circle
          cx={(SIZE + 8) / 2}
          cy={(SIZE + 8) / 2}
          r={RADIUS + 2}
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: atBottom ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease',
        }}
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
