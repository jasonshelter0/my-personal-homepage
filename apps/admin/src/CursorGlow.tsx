import { useEffect, useRef, type CSSProperties } from 'react';
import { attachCursorGlow } from '../../../shared/cursor-glow';
import { CURSOR_GLOW_RADIUS } from '../../../shared/types';
import '../../../shared/cursor-glow.css';

export function CursorGlow({
  accent = '#5eead4',
  radius = CURSOR_GLOW_RADIUS.default,
}: {
  accent?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return attachCursorGlow(ref.current);
  }, []);
  const hex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#5eead4';
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(', ');
  return (
    <div
      ref={ref}
      className="cursor-glow"
      aria-hidden="true"
      style={
        {
          '--glow-rgb': rgb,
          '--glow-radius': `${radius}px`,
        } as CSSProperties
      }
    />
  );
}
